const {
  estadoEvento, motivoNoPuedeVotar, excedeLimiteReportes, dentroDeLima, HORA, DIA,
} = require('../../src/domain/eventos');

const AHORA = new Date('2026-11-20T15:00:00Z');
const hace = (ms) => new Date(AHORA - ms);
const ev = (o) => ({ tipo: 'robo', calle: 'Av. Arequipa', creado_en: hace(HORA), confirmaciones: 0, desmentidos: 0, ya_no_esta: 0, ...o });

describe('Verificación comunitaria (HU06)', () => {
  test('con menos de 3 confirmaciones el evento no está verificado', () => {
    const st = estadoEvento(ev({ confirmaciones: 2 }), AHORA);
    expect(st.verificado).toBe(false);
    expect(st.faltanParaVerificar).toBe(1);
  });
  test('con 3 confirmaciones de personas distintas queda verificado', () => {
    expect(estadoEvento(ev({ confirmaciones: 3 }), AHORA).verificado).toBe(true);
  });
  test('el autor no puede validar su propio reporte', () => {
    expect(motivoNoPuedeVotar({ autorId: 1, usuarioId: 1, yaVoto: false })).toMatch(/tú reportaste/);
  });
  test('una persona no puede votar dos veces el mismo evento', () => {
    expect(motivoNoPuedeVotar({ autorId: 1, usuarioId: 2, yaVoto: true })).toMatch(/Ya votaste/);
    expect(motivoNoPuedeVotar({ autorId: 1, usuarioId: 2, yaVoto: false })).toBeNull();
  });
  test('3 desmentidos y más desmentidos que confirmaciones descartan el evento', () => {
    const st = estadoEvento(ev({ confirmaciones: 1, desmentidos: 3 }), AHORA);
    expect(st.estado).toBe('descartado');
    expect(st.cuentaEnEstadisticas).toBe(false);
  });
});
