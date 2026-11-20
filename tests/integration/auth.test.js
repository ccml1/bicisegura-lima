const request = require('supertest');
const { prepararApp, conBD } = require('./helpers');

conBD('HU03 · Registro e inicio de sesión', () => {
  let ctx;
  beforeAll(async () => { ctx = await prepararApp(); });
  afterAll(() => ctx.pool.end());
  test('GET /health responde ok con la base de datos', async () => {
    const r = await request(ctx.app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body.db).toBe('ok');
  });
  test('HU03: login con clave incorrecta da error genérico', async () => {
    const r = await request(ctx.app).post('/api/auth/login').send({ email: 'autor@test.pe', password: 'otra' });
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('Correo o contraseña incorrectos');
  });
  test('HU03: registro rechaza contraseñas cortas', async () => {
    const r = await request(ctx.app).post('/api/auth/registro').send({ nombre: 'x', email: 'x@test.pe', password: '123' });
    expect(r.status).toBe(400);
  });
});
