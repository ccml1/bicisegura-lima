// HU04 mapa público con eventos activos
const express = require('express');
const db = require('../db');
const { entero } = require('../validar');
const repo = require('../repositorio');
const { TIPOS, estadoEvento } = require('../domain/eventos');

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

module.exports = router;
