// Prepara una base limpia con datos demo y usuarios de prueba (se usa en cada archivo de integración).
const request = require('supertest');

async function prepararApp(usuarios = ['autor', 'v1', 'v2', 'v3']) {
  const { pool } = require('../../src/db');
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await require('../../db/migrate').migrate({ seed: true });
  const app = require('../../src/app').crearApp();
  const tokens = {};
  for (const n of usuarios) {
    const r = await request(app).post('/api/auth/registro').send({ nombre: n, email: `${n}@test.pe`, password: 'Clave1234' });
    tokens[n] = r.body.token;
  }
  return { app, pool, tokens, auth: (n) => ({ Authorization: `Bearer ${tokens[n]}` }) };
}

const conBD = process.env.DATABASE_URL ? describe : describe.skip;
module.exports = { prepararApp, conBD };
