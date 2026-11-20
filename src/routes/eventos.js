// HU04 mapa · HU05 reportar
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { requerido, enLista, numero, entero, ErrorValidacion } = require('../validar');
const repo = require('../repositorio');
const {
  TIPOS, estadoEvento, dentroDeLima,
} = require('../domain/eventos');

const router = express.Router();

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
  const { rows } = await db.query(
    `INSERT INTO eventos (tipo, lat, lng, calle, distrito_id, descripcion, autor_id, ultima_confirmacion_en)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now()) RETURNING id`,
    [req.body.tipo, lat, lng, String(req.body.calle).trim().slice(0, 120), entero(req.body.distritoId, 'distritoId'),
      req.body.descripcion ? String(req.body.descripcion).slice(0, 280) : null, req.usuario.id],
  );
  return res.status(201).json(aPublico(await repo.obtenerEvento(rows[0].id), new Date()));
});

module.exports = router;
