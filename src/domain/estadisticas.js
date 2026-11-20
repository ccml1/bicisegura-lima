// Estadísticas de seguridad (HU09-HU11): se calculan SOLO con eventos verificados.
const { TIPOS, DIAS_HISTORIAL, HORA, DIA, estadoEvento } = require('./eventos');

function aFecha(v) {
  return v instanceof Date ? v : new Date(v);
}

function eventosRecientesVerificados(eventos, ahora, dias = DIAS_HISTORIAL) {
  const desde = ahora - dias * DIA;
  return eventos.filter((e) => aFecha(e.creado_en) >= desde && estadoEvento(e, ahora).cuentaEnEstadisticas);
}

function haceTexto(ms) {
  const dias = Math.floor(ms / DIA);
  if (dias >= 1) return `hace ${dias} día${dias === 1 ? '' : 's'}`;
  const horas = Math.floor(ms / HORA);
  if (horas >= 1) return `hace ${horas} hora${horas === 1 ? '' : 's'}`;
  return 'hace minutos';
}

// Historial de una calle: conteo por tipo en 30 días y eventos persistentes activos con su antigüedad.
function historialCalle(eventos, ahora = new Date()) {
  const verificados = eventosRecientesVerificados(eventos, ahora);
  const conteo = {};
  let ultimo = null;
  for (const e of verificados) {
    if (e.tipo === 'estacionamiento') continue;
    conteo[e.tipo] = (conteo[e.tipo] || 0) + 1;
    if (!ultimo || aFecha(e.creado_en) > aFecha(ultimo.creado_en)) ultimo = e;
  }
  const persistentes = eventos
    .filter((e) => TIPOS[e.tipo]?.categoria === 'persistente' && e.tipo !== 'estacionamiento')
    .filter((e) => {
      const st = estadoEvento(e, ahora);
      return st.verificado && st.estado === 'activo';
    })
    .map((e) => {
      const dias = Math.floor((ahora - aFecha(e.creado_en)) / DIA);
      return {
        tipo: e.tipo,
        dias,
        confirmaciones: Number(e.confirmaciones || 0),
        texto: `${TIPOS[e.tipo].etiqueta} desde hace ${dias} día${dias === 1 ? '' : 's'}, confirmado por ${Number(e.confirmaciones || 0)} personas`,
      };
    });

  const frases = Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, n]) => `${n} ${n === 1 ? TIPOS[tipo].etiqueta.toLowerCase() : plural(tipo)}`);
  const resumen = frases.length
    ? `${frases.join(', ')} en los últimos ${DIAS_HISTORIAL} días (último ${haceTexto(ahora - aFecha(ultimo.creado_en))})`
    : `Sin incidentes verificados en los últimos ${DIAS_HISTORIAL} días`;
  return { conteo, resumen, persistentes };
}

function plural(tipo) {
  const p = {
    robo: 'robos', accidente: 'accidentes', mal_estado: 'tramos en mal estado',
    vehiculo_ciclovia: 'vehículos en la ciclovía', calle_enrejada: 'calles enrejadas',
    ciclovia_interrumpida: 'ciclovías interrumpidas',
  };
  return p[tipo] || tipo;
}

// Semáforo de riesgo de una zona (distrito) con sus motivos.
function riesgoZona(eventos, ahora = new Date()) {
  const verificados = eventosRecientesVerificados(eventos, ahora);
  const incidentes = verificados.filter((e) => e.tipo === 'robo' || e.tipo === 'accidente').length;
  const malEstadoActivo = eventos.some((e) => ['mal_estado', 'ciclovia_interrumpida'].includes(e.tipo)
    && estadoEvento(e, ahora).verificado && estadoEvento(e, ahora).estado === 'activo');
  const motivos = [];
  if (incidentes) motivos.push(`${incidentes} robo(s) o accidente(s) verificados en ${DIAS_HISTORIAL} días`);
  if (malEstadoActivo) motivos.push('Tramo en mal estado o ciclovía interrumpida activa');
  let color = 'verde';
  if (incidentes >= 3) color = 'rojo';
  else if (incidentes >= 1 || malEstadoActivo) color = 'amarillo';
  if (!motivos.length) motivos.push(`Sin incidentes verificados en ${DIAS_HISTORIAL} días`);
  return { color, incidentes, motivos };
}

const FRANJAS = [
  [0, 6, 'madrugada (00:00–06:00)'], [6, 9, 'mañana temprano (06:00–09:00)'], [9, 12, 'mañana (09:00–12:00)'],
  [12, 15, 'mediodía (12:00–15:00)'], [15, 18, 'tarde (15:00–18:00)'], [18, 21, 'noche (18:00–21:00)'],
  [21, 24, 'noche tarde (21:00–24:00)'],
];
function franjaDe(fecha) {
  // Hora de Lima (UTC-5, sin horario de verano)
  const h = (aFecha(fecha).getUTCHours() + 24 - 5) % 24;
  return FRANJAS.find(([a, b]) => h >= a && h < b)[2];
}

// Panel de estadísticas de un distrito: por tipo, top calles con robos, franja horaria más riesgosa y tendencia.
function estadisticasDistrito(eventos, ahora = new Date()) {
  const actuales = eventosRecientesVerificados(eventos, ahora).filter((e) => e.tipo !== 'estacionamiento');
  const desdeAnterior = ahora - 2 * DIAS_HISTORIAL * DIA;
  const hastaAnterior = ahora - DIAS_HISTORIAL * DIA;
  const anteriores = eventos.filter((e) => {
    const f = aFecha(e.creado_en);
    return f >= desdeAnterior && f < hastaAnterior && e.tipo !== 'estacionamiento'
      && estadoEvento(e, ahora).cuentaEnEstadisticas;
  });

  const porTipo = {};
  for (const e of actuales) porTipo[e.tipo] = (porTipo[e.tipo] || 0) + 1;

  const robos = actuales.filter((e) => e.tipo === 'robo');
  const porCalle = {};
  for (const e of robos) porCalle[e.calle] = (porCalle[e.calle] || 0) + 1;
  const topCallesRobos = Object.entries(porCalle).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([calle, total]) => ({ calle, total }));

  const incidentes = actuales.filter((e) => e.tipo === 'robo' || e.tipo === 'accidente');
  const porFranja = {};
  for (const e of incidentes) porFranja[franjaDe(e.creado_en)] = (porFranja[franjaDe(e.creado_en)] || 0) + 1;
  const [franja, enFranja] = Object.entries(porFranja).sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const franjaMasRiesgosa = franja
    ? { franja, porcentaje: Math.round((enFranja / incidentes.length) * 100) }
    : null;

  const total = actuales.length;
  const totalAnterior = anteriores.length;
  const variacion = totalAnterior === 0 ? null : Math.round(((total - totalAnterior) / totalAnterior) * 100);

  return { total, porTipo, topCallesRobos, franjaMasRiesgosa, tendencia: { totalAnterior, variacion } };
}

module.exports = { historialCalle, riesgoZona, estadisticasDistrito, franjaDe };
