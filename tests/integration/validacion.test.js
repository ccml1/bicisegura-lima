const request = require('supertest');
const { prepararApp, conBD } = require('./helpers');

conBD('HU06 y HU07 · Validación comunitaria y vencimiento', () => {
  let ctx;
  beforeAll(async () => { ctx = await prepararApp(); });
  afterAll(() => ctx.pool.end());
  test('HU05 + HU06: reportar y verificar con 3 confirmaciones de personas distintas', async () => {
    const r = await request(ctx.app).post('/api/eventos').set(ctx.auth('autor'))
      .send({ tipo: 'calle_enrejada', lat: -12.11, lng: -77.03, calle: 'Calle Prueba', distritoId: 1 });
    expect(r.status).toBe(201);
    expect(r.body.verificado).toBe(false);
    const id = r.body.id;

    const propio = await request(ctx.app).post(`/api/eventos/${id}/votos`).set(ctx.auth('autor')).send({ voto: 'confirma' });
    expect(propio.status).toBe(409);

    await request(ctx.app).post(`/api/eventos/${id}/votos`).set(ctx.auth('v1')).send({ voto: 'confirma' });
    const doble = await request(ctx.app).post(`/api/eventos/${id}/votos`).set(ctx.auth('v1')).send({ voto: 'confirma' });
    expect(doble.status).toBe(409);
    await request(ctx.app).post(`/api/eventos/${id}/votos`).set(ctx.auth('v2')).send({ voto: 'confirma' });
    const tercero = await request(ctx.app).post(`/api/eventos/${id}/votos`).set(ctx.auth('v3')).send({ voto: 'confirma' });
    expect(tercero.body.verificado).toBe(true);
    expect(tercero.body.confirmaciones).toBe(3);

  });
});
