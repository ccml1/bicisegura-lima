const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const db = require('./db');

function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // App Service está detrás de un balanceador: IP real del cliente para el límite de intentos
  // Cabeceras de seguridad. CSP: scripts y estilos solo propios (Leaflet se sirve desde el mismo servidor);
  // imágenes externas solo de los mosaicos de OpenStreetMap (servicio externo del mapa).
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://*.tile.openstreetmap.org'],
        connectSrc: ["'self'"],
      },
    },
  }));
  app.use(express.json({ limit: '50kb' }));

  app.get('/health', async (_req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ok', db: 'ok', version: process.env.APP_VERSION || 'local' });
    } catch {
      res.status(503).json({ status: 'error', db: 'sin conexión' });
    }
  });

  app.use('/api', require('./routes/auth'));
  app.use('/api', require('./routes/eventos'));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
  const modulos = path.join(__dirname, '..', 'node_modules');
  app.use('/vendor/leaflet', express.static(path.join(modulos, 'leaflet', 'dist')));
  app.use('/vendor/leaflet-heat', express.static(path.join(modulos, 'leaflet.heat', 'dist')));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.code === '23505') return res.status(409).json({ error: 'El registro ya existe' });
    if (['23503', '23514', '22P02', '22003'].includes(err.code)) return res.status(400).json({ error: 'Datos inválidos' });
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  });
  return app;
}

module.exports = { crearApp };
