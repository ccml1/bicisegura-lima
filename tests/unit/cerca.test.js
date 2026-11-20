const { distanciaKm, cercanos } = require('../../public/cerca');

describe('Eventos cerca de mí (HU15)', () => {
  const miraflores = { lat: -12.1211, lng: -77.0297 };
  test('calcula distancias en kilómetros (Miraflores–Barranco ≈ 3.2 km)', () => {
    expect(distanciaKm(miraflores, { lat: -12.1494, lng: -77.0218 })).toBeCloseTo(3.27, 1);
  });
  test('devuelve solo eventos a 1 km o menos, del más cercano al más lejano', () => {
    const r = cercanos(miraflores, [
      { id: 1, lat: -12.1290, lng: -77.0297 }, // ~0.88 km
      { id: 2, lat: -12.1215, lng: -77.0300 }, // ~0.05 km
      { id: 3, lat: -12.1494, lng: -77.0218 }, // ~3.2 km
    ]);
    expect(r.map((e) => e.id)).toEqual([2, 1]);
  });
});
