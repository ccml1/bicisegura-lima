const request = require('supertest');
const { prepararApp, conBD } = require('./helpers');

conBD('HU04 · Mapa público en tiempo real', () => {
  let ctx;
  beforeAll(async () => { ctx = await prepararApp(); });
  afterAll(() => ctx.pool.end());
  test('HU04: el mapa público lista eventos activos sin iniciar sesión', async () => {
    const r = await request(ctx.app).get('/api/eventos');
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(5);
    expect(r.body.every((e) => e.estado === 'activo')).toBe(true);
  });
  test('HU04: la página envía el origen como Referer a los mosaicos de OpenStreetMap (política de uso de OSM)', async () => {
    const r = await request(ctx.app).get('/');
    expect(r.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(r.headers['content-security-policy']).toContain('https://tile.openstreetmap.org');
  });
});
