// HU09 historial de la calle · HU10 semáforo por zona · HU11 panel por distrito · HU12 mapa de calor
// Todo se calcula SOLO con eventos verificados (3+ confirmaciones).
const express = require('express');
const db = require('../db');
const repo = require('../repositorio');
const { limiteApi } = require('../limites');
const { requerido, entero } = require('../validar');
const { historialCalle, riesgoZona } = require('../domain/estadisticas');

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

module.exports = router;
