const {
  estadoEvento, motivoNoPuedeVotar, excedeLimiteReportes, dentroDeLima, HORA, DIA,
} = require('../../src/domain/eventos');

const AHORA = new Date('2026-11-20T15:00:00Z');
const hace = (ms) => new Date(AHORA - ms);
const ev = (o) => ({ tipo: 'robo', calle: 'Av. Arequipa', creado_en: hace(HORA), confirmaciones: 0, desmentidos: 0, ya_no_esta: 0, ...o });

describe('Vencimiento y "ya no está" (HU07)', () => {
  test('un vehículo en la ciclovía vence a las 2 horas sin reconfirmación', () => {
    const e = ev({ tipo: 'vehiculo_ciclovia', creado_en: hace(3 * HORA), ultima_confirmacion_en: hace(2.5 * HORA) });
    expect(estadoEvento(e, AHORA).estado).toBe('vencido');
  });
  test('una reconfirmación reciente mantiene vivo el evento temporal', () => {
    const e = ev({ tipo: 'vehiculo_ciclovia', creado_en: hace(3 * HORA), ultima_confirmacion_en: hace(HORA) });
    expect(estadoEvento(e, AHORA).visible).toBe(true);
  });
  test('una calle enrejada sigue activa hasta 3 votos de "ya no está"', () => {
    expect(estadoEvento(ev({ tipo: 'calle_enrejada', creado_en: hace(20 * DIA), ya_no_esta: 2 }), AHORA).estado).toBe('activo');
    expect(estadoEvento(ev({ tipo: 'calle_enrejada', ya_no_esta: 3 }), AHORA).estado).toBe('resuelto');
  });
  test('un robo sale del mapa en vivo a las 24 h pero queda en el historial', () => {
    const st = estadoEvento(ev({ creado_en: hace(30 * HORA), confirmaciones: 3 }), AHORA);
    expect(st.visible).toBe(false);
    expect(st.estado).toBe('historial');
    expect(st.cuentaEnEstadisticas).toBe(true);
  });
  test('un tipo desconocido lanza error', () => {
    expect(() => estadoEvento(ev({ tipo: 'ovni' }), AHORA)).toThrow();
  });
});
