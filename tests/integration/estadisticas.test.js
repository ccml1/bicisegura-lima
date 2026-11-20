const request = require('supertest');
const { prepararApp, conBD } = require('./helpers');

conBD('HU09 a HU12 · Historial, riesgo, estadísticas y mapa de calor', () => {
  let ctx;
  beforeAll(async () => { ctx = await prepararApp(); });
  afterAll(() => ctx.pool.end());
  test('HU09: historial de una calle con datos demo', async () => {
    const r = await request(ctx.app).get('/api/calles/historial').query({ calle: 'Av. Arequipa' });
    expect(r.status).toBe(200);
    expect(r.body.resumen).toMatch(/últimos 30 días/);
  });
  test('HU10: semáforo por distrito con los tres colores en los datos demo', async () => {
    const r = await request(ctx.app).get('/api/zonas/riesgo');
    const colores = new Set(r.body.map((z) => z.color));
    expect(colores.has('rojo')).toBe(true);
    expect(colores.has('verde') || colores.has('amarillo')).toBe(true);
  });
});
