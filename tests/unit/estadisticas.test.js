const { historialCalle, riesgoZona, estadisticasDistrito, franjaDe } = require('../../src/domain/estadisticas');
const { HORA, DIA } = require('../../src/domain/eventos');

const AHORA = new Date('2026-11-20T15:00:00Z');
const hace = (ms) => new Date(AHORA - ms);
const ev = (o) => ({ tipo: 'robo', calle: 'Av. Arequipa', creado_en: hace(HORA), confirmaciones: 0, desmentidos: 0, ya_no_esta: 0, ...o });

describe('Panel de estadísticas por distrito (HU11)', () => {
  const eventos = [
    ev({ calle: 'Av. Arequipa', confirmaciones: 3, creado_en: new Date('2026-11-18T23:30:00Z') }), // 18:30 Lima
    ev({ calle: 'Av. Arequipa', confirmaciones: 3, creado_en: new Date('2026-11-15T00:30:00Z') }), // 19:30 Lima
    ev({ calle: 'Av. Grau', confirmaciones: 3, creado_en: new Date('2026-11-10T14:00:00Z') }), // 09:00 Lima
    ev({ tipo: 'accidente', calle: 'Av. Grau', confirmaciones: 4, creado_en: new Date('2026-11-12T01:00:00Z') }), // 20:00 Lima
    ev({ calle: 'Av. Brasil', confirmaciones: 3, creado_en: new Date('2026-10-10T14:00:00Z') }), // periodo anterior
    ev({ calle: 'Av. Brasil', confirmaciones: 3, creado_en: new Date('2026-10-12T14:00:00Z') }), // periodo anterior
  ];
  const s = estadisticasDistrito(eventos, AHORA);
  test('cuenta por tipo en 30 días', () => {
    expect(s.porTipo).toEqual({ robo: 3, accidente: 1 });
  });
  test('ordena las calles con más robos', () => {
    expect(s.topCallesRobos[0]).toEqual({ calle: 'Av. Arequipa', total: 2 });
  });
  test('detecta la franja horaria más riesgosa en hora de Lima', () => {
    expect(s.franjaMasRiesgosa).toEqual({ franja: 'noche (18:00–21:00)', porcentaje: 75 });
    expect(franjaDe(new Date('2026-11-18T23:30:00Z'))).toBe('noche (18:00–21:00)');
  });
  test('calcula la tendencia frente a los 30 días anteriores', () => {
    expect(s.tendencia).toEqual({ totalAnterior: 2, variacion: 100 });
  });
});
