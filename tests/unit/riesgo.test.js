const { historialCalle, riesgoZona, estadisticasDistrito, franjaDe } = require('../../src/domain/estadisticas');
const { HORA, DIA } = require('../../src/domain/eventos');

const AHORA = new Date('2026-11-20T15:00:00Z');
const hace = (ms) => new Date(AHORA - ms);
const ev = (o) => ({ tipo: 'robo', calle: 'Av. Arequipa', creado_en: hace(HORA), confirmaciones: 0, desmentidos: 0, ya_no_esta: 0, ...o });

describe('Semáforo de riesgo (HU10)', () => {
  test('verde sin incidentes verificados', () => {
    expect(riesgoZona([ev({ confirmaciones: 1 })], AHORA).color).toBe('verde');
  });
  test('amarillo con 1 o 2 incidentes verificados', () => {
    expect(riesgoZona([ev({ confirmaciones: 3, creado_en: hace(3 * DIA) })], AHORA).color).toBe('amarillo');
  });
  test('amarillo con un tramo en mal estado verificado y activo', () => {
    expect(riesgoZona([ev({ tipo: 'mal_estado', confirmaciones: 3, creado_en: hace(40 * DIA) })], AHORA).color).toBe('amarillo');
  });
  test('rojo con 3 o más robos o accidentes verificados en 30 días', () => {
    const z = riesgoZona([1, 2, 3].map((d) => ev({ confirmaciones: 3, creado_en: hace(d * DIA) })), AHORA);
    expect(z.color).toBe('rojo');
    expect(z.motivos[0]).toMatch(/3 robo/);
  });
});
