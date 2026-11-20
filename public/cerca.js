/* HU15 · Distancia y orden por cercanía (se calcula en el navegador: la ubicación no se envía al servidor). */
(function (raiz) {
  function distanciaKm(a, b) {
    const R = 6371;
    const rad = (g) => (g * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function cercanos(origen, eventos, radioKm = 1) {
    return eventos
      .map((e) => ({ ...e, distanciaKm: distanciaKm(origen, e) }))
      .filter((e) => e.distanciaKm <= radioKm)
      .sort((a, b) => a.distanciaKm - b.distanciaKm);
  }
  const api = { distanciaKm, cercanos };
  if (typeof module !== 'undefined') module.exports = api; else raiz.Cerca = api;
}(typeof window !== 'undefined' ? window : globalThis));
