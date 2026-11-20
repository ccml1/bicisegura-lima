const { historialCalle, riesgoZona, estadisticasDistrito, franjaDe } = require('../../src/domain/estadisticas');
const { HORA, DIA } = require('../../src/domain/eventos');

const AHORA = new Date('2026-11-20T15:00:00Z');
const hace = (ms) => new Date(AHORA - ms);
const ev = (o) => ({ tipo: 'robo', calle: 'Av. Arequipa', creado_en: hace(HORA), confirmaciones: 0, desmentidos: 0, ya_no_esta: 0, ...o });

describe('Historial de la calle (HU09)', () => {
  test('cuenta solo eventos verificados de los últimos 30 días', () => {
    const h = historialCalle([
      ev({ confirmaciones: 3, creado_en: hace(2 * DIA) }),
      ev({ confirmaciones: 4, creado_en: hace(10 * DIA) }),
      ev({ confirmaciones: 5, creado_en: hace(20 * DIA) }),
      ev({ confirmaciones: 1, creado_en: hace(DIA) }), // no verificado
      ev({ confirmaciones: 3, creado_en: hace(40 * DIA) }), // fuera de 30 días
      ev({ tipo: 'accidente', confirmaciones: 3, creado_en: hace(5 * DIA) }),
    ], AHORA);
    expect(h.conteo).toEqual({ robo: 3, accidente: 1 });
    expect(h.resumen).toBe('3 robos, 1 accidente en los últimos 30 días (último hace 2 días)');
  });
  test('muestra desde hace cuántos días existe una calle enrejada', () => {
    const h = historialCalle([ev({ tipo: 'calle_enrejada', creado_en: hace(5 * DIA), confirmaciones: 7 })], AHORA);
    expect(h.persistentes[0].texto).toBe('Calle enrejada desde hace 5 días, confirmado por 7 personas');
  });
  test('sin eventos verificados lo indica', () => {
    expect(historialCalle([], AHORA).resumen).toMatch(/Sin incidentes verificados/);
  });
});
