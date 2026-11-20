const {
  estadoEvento, motivoNoPuedeVotar, excedeLimiteReportes, dentroDeLima, HORA, DIA,
} = require('../../src/domain/eventos');

const AHORA = new Date('2026-11-20T15:00:00Z');
const hace = (ms) => new Date(AHORA - ms);
const ev = (o) => ({ tipo: 'robo', calle: 'Av. Arequipa', creado_en: hace(HORA), confirmaciones: 0, desmentidos: 0, ya_no_esta: 0, ...o });

describe('Límite de reportes y ubicación (HU05, HU08)', () => {
  test('el reporte número 11 de la hora se rechaza', () => {
    expect(excedeLimiteReportes(9)).toBe(false);
    expect(excedeLimiteReportes(10)).toBe(true);
  });
  test('solo se aceptan ubicaciones dentro de Lima Metropolitana', () => {
    expect(dentroDeLima(-12.12, -77.03)).toBe(true);
    expect(dentroDeLima(-13.5, -71.97)).toBe(false); // Cusco
  });
});
