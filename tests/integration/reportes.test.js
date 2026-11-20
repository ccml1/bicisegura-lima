const request = require('supertest');
const { prepararApp, conBD } = require('./helpers');

conBD('HU05 y HU08 · Reportes y límite contra spam', () => {
  let ctx;
  beforeAll(async () => { ctx = await prepararApp(); });
  afterAll(() => ctx.pool.end());
  test('HU05: un visitante no puede reportar', async () => {
    const r = await request(ctx.app).post('/api/eventos').send({ tipo: 'robo', lat: -12.1, lng: -77.03, calle: 'X', distritoId: 1 });
    expect(r.status).toBe(401);
  });
  test('HU05: rechaza ubicaciones fuera de Lima y tipos inválidos', async () => {
    const fuera = await request(ctx.app).post('/api/eventos').set(ctx.auth('autor')).send({ tipo: 'robo', lat: -13.5, lng: -71.9, calle: 'X', distritoId: 1 });
    expect(fuera.status).toBe(400);
    const tipo = await request(ctx.app).post('/api/eventos').set(ctx.auth('autor')).send({ tipo: 'ovni', lat: -12.1, lng: -77.03, calle: 'X', distritoId: 1 });
    expect(tipo.status).toBe(400);
  });
  test('HU08: el reporte 11 de la hora devuelve 429', async () => {
    let ultimo;
    for (let i = 0; i < 11; i += 1) {
      ultimo = await request(ctx.app).post('/api/eventos').set(ctx.auth('v3'))
        .send({ tipo: 'mal_estado', lat: -12.1, lng: -77.03, calle: `Calle ${i}`, distritoId: 2 });
    }
    expect(ultimo.status).toBe(429);
  });
});
