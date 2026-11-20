// HU08 · Límite general de peticiones por IP a la API (protección contra abuso y sobrecarga).
const rateLimit = require('express-rate-limit');

const limiteApi = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.MAX_PETICIONES_MINUTO) || 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intenta en un minuto.' },
});

module.exports = { limiteApi };
