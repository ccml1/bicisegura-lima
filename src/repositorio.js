// Consultas a PostgreSQL. Toda entrada viaja como parámetro ($1, $2...): sin concatenar SQL (evita inyección).
const db = require('./db');

const SELECT_EVENTOS = `
  SELECT e.id, e.tipo, e.lat, e.lng, e.calle, e.distrito_id, d.nombre AS distrito, e.descripcion,
         e.autor_id, e.creado_en, e.ultima_confirmacion_en,
         (SELECT count(*) FROM votos v WHERE v.evento_id = e.id AND v.voto = 'confirma')::int AS confirmaciones,
         (SELECT count(*) FROM votos v WHERE v.evento_id = e.id AND v.voto = 'desmiente')::int AS desmentidos,
         (SELECT count(*) FROM cierres c WHERE c.evento_id = e.id)::int AS ya_no_esta
  FROM eventos e JOIN distritos d ON d.id = e.distrito_id`;

// Eventos de los últimos 60 días (historial + tendencia) y todos los persistentes
async function listarEventos({ distritoId, calle } = {}) {
  const filtros = [`(e.creado_en >= now() - interval '60 days'
    OR e.tipo IN ('mal_estado','calle_enrejada','ciclovia_interrumpida','estacionamiento'))`];
  const params = [];
  if (distritoId) { params.push(distritoId); filtros.push(`e.distrito_id = $${params.length}`); }
  if (calle) { params.push(calle); filtros.push(`lower(e.calle) = lower($${params.length})`); }
  const { rows } = await db.query(`${SELECT_EVENTOS} WHERE ${filtros.join(' AND ')} ORDER BY e.creado_en DESC`, params);
  return rows;
}

async function obtenerEvento(id) {
  const { rows } = await db.query(`${SELECT_EVENTOS} WHERE e.id = $1`, [id]);
  return rows[0];
}

module.exports = { listarEventos, obtenerEvento };
