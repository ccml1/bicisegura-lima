// HU09 historial de la calle · HU10 semáforo por zona · HU11 panel por distrito · HU12 mapa de calor
// Todo se calcula SOLO con eventos verificados (3+ confirmaciones).
const express = require('express');
const db = require('../db');
const repo = require('../repositorio');
const { limiteApi } = require('../limites');
const { requerido, entero } = require('../validar');
const { historialCalle, riesgoZona, estadisticasDistrito } = require('../domain/estadisticas');
const { estadoEvento, DIA, DIAS_HISTORIAL } = require('../domain/eventos');

const router = express.Router();
router.use(limiteApi);

router.get('/calles/historial', async (req, res) => {
  requerido(req.query, ['calle']);
  const distritoId = req.query.distrito ? entero(req.query.distrito, 'distrito') : undefined;
  const eventos = await repo.listarEventos({ calle: String(req.query.calle), distritoId });
  res.json({ calle: req.query.calle, ...historialCalle(eventos, new Date()) });
});

router.get('/zonas/riesgo', async (_req, res) => {
  const ahora = new Date();
  const [distritos, eventos] = await Promise.all([
    db.query('SELECT id, nombre, lat, lng FROM distritos ORDER BY nombre'),
    repo.listarEventos(),
  ]);
  res.json(distritos.rows.map((d) => ({
    ...d, ...riesgoZona(eventos.filter((e) => e.distrito_id === d.id), ahora),
  })));
});

router.get('/estadisticas/:distritoId', async (req, res) => {
  const distritoId = entero(req.params.distritoId, 'distritoId');
  const { rows } = await db.query('SELECT id, nombre FROM distritos WHERE id = $1', [distritoId]);
  if (!rows[0]) return res.status(404).json({ error: 'Distrito no encontrado' });
  const eventos = await repo.listarEventos({ distritoId });
  return res.json({ distrito: rows[0].nombre, ...estadisticasDistrito(eventos, new Date()) });
});

router.get('/mapa-calor', async (_req, res) => {
  const ahora = new Date();
  const desde = ahora - DIAS_HISTORIAL * DIA;
  const puntos = (await repo.listarEventos())
    .filter((e) => (e.tipo === 'robo' || e.tipo === 'accidente') && new Date(e.creado_en) >= desde)
    .filter((e) => estadoEvento(e, ahora).cuentaEnEstadisticas)
    .map((e) => [e.lat, e.lng, e.tipo === 'robo' ? 1 : 0.7]);
  res.json(puntos);
});

module.exports = router;
