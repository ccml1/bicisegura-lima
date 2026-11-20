const request = require('supertest');
const { prepararApp, conBD } = require('./helpers');

conBD('HU16 · Filtros del mapa por tipo y por verificados', () => {
  let ctx;
  beforeAll(async () => { ctx = await prepararApp(); });
  afterAll(() => ctx.pool.end());

  test('filtra por tipo de evento', async () => {
    const r = await request(ctx.app).get('/api/eventos').query({ tipos: 'estacionamiento' });
    expect(r.body.length).toBeGreaterThan(0);
    expect(r.body.every((e) => e.tipo === 'estacionamiento')).toBe(true);
  });

  test('"solo verificados" devuelve eventos con 3 o más confirmaciones', async () => {
    const todos = await request(ctx.app).get('/api/eventos');
    const verificados = await request(ctx.app).get('/api/eventos').query({ verificados: 'true' });
    expect(verificados.body.length).toBeLessThan(todos.body.length);
    expect(verificados.body.every((e) => e.verificado && e.confirmaciones >= 3)).toBe(true);
  });
});
