// Reglas de negocio de BiciSegura Lima (funciones puras, sin base de datos: se prueban con pruebas unitarias).

const CONFIRMACIONES_PARA_VERIFICAR = 3;
const VOTOS_YA_NO_ESTA_PARA_RESOLVER = 3;
const DESMENTIDOS_PARA_DESCARTAR = 3;
const DIAS_HISTORIAL = 30;
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

// Categorías de vida de un evento:
//  - incidente: queda en el mapa en vivo 24 h y luego solo en el historial (robo, accidente)
//  - temporal: vence a las 2 h si nadie lo vuelve a confirmar (vehículo en la ciclovía)
//  - persistente: sigue hasta que 3 personas votan "ya no está" (mal estado, enrejada, interrumpida, estacionamiento)
const TIPOS = {
  robo: { etiqueta: 'Robo', categoria: 'incidente' },
  accidente: { etiqueta: 'Accidente', categoria: 'incidente' },
  mal_estado: { etiqueta: 'Tramo en mal estado', categoria: 'persistente' },
  vehiculo_ciclovia: { etiqueta: 'Vehículo en la ciclovía', categoria: 'temporal' },
  calle_enrejada: { etiqueta: 'Calle enrejada', categoria: 'persistente' },
  ciclovia_interrumpida: { etiqueta: 'Ciclovía interrumpida', categoria: 'persistente' },
  estacionamiento: { etiqueta: 'Estacionamiento seguro', categoria: 'persistente' },
};
const VIGENCIA_EN_VIVO = { incidente: 24 * HORA, temporal: 2 * HORA };

// Límites aproximados de Lima Metropolitana y Callao
const LIMA = { latMin: -12.55, latMax: -11.57, lngMin: -77.2, lngMax: -76.62 };

function dentroDeLima(lat, lng) {
  return lat >= LIMA.latMin && lat <= LIMA.latMax && lng >= LIMA.lngMin && lng <= LIMA.lngMax;
}

function aFecha(v) {
  return v instanceof Date ? v : new Date(v);
}

// Estado de un evento según sus votos y el paso del tiempo.
// evento: { tipo, creado_en, ultima_confirmacion_en, confirmaciones, desmentidos, ya_no_esta }
function estadoEvento(evento, ahora = new Date()) {
  const def = TIPOS[evento.tipo];
  if (!def) throw new Error(`Tipo de evento desconocido: ${evento.tipo}`);
  const confirmaciones = Number(evento.confirmaciones || 0);
  const desmentidos = Number(evento.desmentidos || 0);
  const yaNoEsta = Number(evento.ya_no_esta || 0);
  const verificado = confirmaciones >= CONFIRMACIONES_PARA_VERIFICAR;

  let estado = 'activo';
  if (desmentidos >= DESMENTIDOS_PARA_DESCARTAR && desmentidos > confirmaciones) {
    estado = 'descartado';
  } else if (def.categoria === 'persistente') {
    if (yaNoEsta >= VOTOS_YA_NO_ESTA_PARA_RESOLVER) estado = 'resuelto';
  } else {
    const referencia = def.categoria === 'temporal'
      ? aFecha(evento.ultima_confirmacion_en || evento.creado_en)
      : aFecha(evento.creado_en);
    if (ahora - referencia > VIGENCIA_EN_VIVO[def.categoria]) {
      estado = def.categoria === 'temporal' ? 'vencido' : 'historial';
    }
  }

  return {
    estado,
    visible: estado === 'activo',
    verificado,
    confirmaciones,
    faltanParaVerificar: Math.max(0, CONFIRMACIONES_PARA_VERIFICAR - confirmaciones),
    // un evento cuenta para estadísticas si fue verificado y no fue descartado
    cuentaEnEstadisticas: verificado && estado !== 'descartado',
  };
}

// ¿Puede esta persona votar este evento? Devuelve null si puede, o el motivo si no.
function motivoNoPuedeVotar({ autorId, usuarioId, yaVoto }) {
  if (autorId === usuarioId) return 'No puedes validar un evento que tú reportaste';
  if (yaVoto) return 'Ya votaste este evento';
  return null;
}

// Límite de reportes por usuario (anti-spam)
function excedeLimiteReportes(reportesUltimaHora, maximo = 10) {
  return reportesUltimaHora >= maximo;
}

module.exports = {
  TIPOS, CONFIRMACIONES_PARA_VERIFICAR, VOTOS_YA_NO_ESTA_PARA_RESOLVER, DIAS_HISTORIAL, HORA, DIA, LIMA,
  dentroDeLima, estadoEvento, motivoNoPuedeVotar, excedeLimiteReportes,
};
