// HU04 mapa · HU05 reportar · HU06 validar · HU07 vencimiento y "ya no está" · HU08 límite de reportes
const express = require('express');
const db = require('../db');
const config = require('../config');
const { requireAuth } = require('../auth');
const { requerido, enLista, numero, entero, ErrorValidacion } = require('../validar');
const repo = require('../repositorio');
const { limiteApi } = require('../limites');
const {
  TIPOS, estadoEvento, motivoNoPuedeVotar, excedeLimiteReportes, dentroDeLima,
} = require('../domain/eventos');

const router = express.Router();
router.use(limiteApi);

function aPublico(e, ahora) {
  const st = estadoEvento(e, ahora);
  return {
    id: e.id, tipo: e.tipo, etiqueta: TIPOS[e.tipo].etiqueta, lat: e.lat, lng: e.lng, calle: e.calle,
    distrito: e.distrito, distritoId: e.distrito_id, descripcion: e.descripcion, creadoEn: e.creado_en,
    confirmaciones: st.confirmaciones, desmentidos: Number(e.desmentidos), yaNoEsta: Number(e.ya_no_esta),
    verificado: st.verificado, faltanParaVerificar: st.faltanParaVerificar, estado: st.estado,
  };
}

router.get('/tipos', (_req, res) => {
  res.json(Object.entries(TIPOS).map(([id, t]) => ({ id, ...t })));
});

router.get('/distritos', async (_req, res) => {
  const { rows } = await db.query('SELECT id, nombre, lat, lng FROM distritos ORDER BY nombre');
  res.json(rows);
});

// Mapa en vivo: solo eventos visibles (activos)
router.get('/eventos', async (req, res) => {
  const ahora = new Date();
  const distritoId = req.query.distrito ? entero(req.query.distrito, 'distrito') : undefined;
  const tipos = req.query.tipos ? String(req.query.tipos).split(',') : null;
  const soloVerificados = req.query.verificados === 'true';
  const eventos = (await repo.listarEventos({ distritoId }))
    .map((e) => aPublico(e, ahora))
    .filter((e) => e.estado === 'activo')
    .filter((e) => !tipos || tipos.includes(e.tipo))
    .filter((e) => !soloVerificados || e.verificado);
  res.json(eventos);
});

router.post('/eventos', requireAuth, async (req, res) => {
  requerido(req.body, ['tipo', 'lat', 'lng', 'calle', 'distritoId']);
  enLista(req.body.tipo, Object.keys(TIPOS), 'tipo');
  const lat = numero(req.body.lat, 'lat');
  const lng = numero(req.body.lng, 'lng');
  if (!dentroDeLima(lat, lng)) throw new ErrorValidacion('La ubicación debe estar dentro de Lima Metropolitana');
  const { rows: [{ total }] } = await db.query(
    "SELECT count(*)::int AS total FROM eventos WHERE autor_id = $1 AND creado_en > now() - interval '1 hour'",
    [req.usuario.id],
  );
  if (excedeLimiteReportes(total, config.maxReportesPorHora)) {
    res.set('Retry-After', '3600');
    return res.status(429).json({ error: `Alcanzaste el límite de ${config.maxReportesPorHora} reportes por hora. Intenta más tarde.` });
  }
  const { rows } = await db.query(
    `INSERT INTO eventos (tipo, lat, lng, calle, distrito_id, descripcion, autor_id, ultima_confirmacion_en)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now()) RETURNING id`,
    [req.body.tipo, lat, lng, String(req.body.calle).trim().slice(0, 120), entero(req.body.distritoId, 'distritoId'),
      req.body.descripcion ? String(req.body.descripcion).slice(0, 280) : null, req.usuario.id],
  );
  return res.status(201).json(aPublico(await repo.obtenerEvento(rows[0].id), new Date()));
});

// Validación comunitaria: confirmar o desmentir (1 voto por persona; el autor no se autovalida)
router.post('/eventos/:id/votos', requireAuth, async (req, res) => {
  const id = entero(req.params.id, 'id');
  enLista(req.body.voto, ['confirma', 'desmiente'], 'voto');
  const evento = await repo.obtenerEvento(id);
  if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });
  const { rowCount } = await db.query('SELECT 1 FROM votos WHERE evento_id = $1 AND usuario_id = $2', [id, req.usuario.id]);
  const motivo = motivoNoPuedeVotar({ autorId: evento.autor_id, usuarioId: req.usuario.id, yaVoto: rowCount > 0 });
  if (motivo) return res.status(409).json({ error: motivo });
  await db.query('INSERT INTO votos (evento_id, usuario_id, voto) VALUES ($1,$2,$3)', [id, req.usuario.id, req.body.voto]);
  if (req.body.voto === 'confirma') await db.query('UPDATE eventos SET ultima_confirmacion_en = now() WHERE id = $1', [id]);
  return res.status(201).json(aPublico(await repo.obtenerEvento(id), new Date()));
});

// "Ya no está": con 3 votos un evento persistente pasa a resuelto
router.post('/eventos/:id/ya-no-esta', requireAuth, async (req, res) => {
  const id = entero(req.params.id, 'id');
  const evento = await repo.obtenerEvento(id);
  if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });
  const { rowCount } = await db.query('SELECT 1 FROM cierres WHERE evento_id = $1 AND usuario_id = $2', [id, req.usuario.id]);
  if (rowCount) return res.status(409).json({ error: 'Ya indicaste que este evento ya no está' });
  await db.query('INSERT INTO cierres (evento_id, usuario_id) VALUES ($1,$2)', [id, req.usuario.id]);
  return res.status(201).json(aPublico(await repo.obtenerEvento(id), new Date()));
});

module.exports = router;
