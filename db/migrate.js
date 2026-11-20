// Aplica el esquema y, si se pide, carga datos de demostración (solo si aún no hay eventos).
// Uso: node db/migrate.js  ->  esquema + datos demo
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

const DISTRITOS = [
  ['Miraflores', -12.1211, -77.0297], ['San Isidro', -12.0977, -77.0365], ['Lince', -12.0835, -77.035],
  ['Jesús María', -12.075, -77.045], ['Cercado de Lima', -12.0464, -77.0428], ['Santiago de Surco', -12.13, -76.995],
  ['Barranco', -12.1494, -77.0218], ['San Borja', -12.1, -77.0], ['La Victoria', -12.07, -77.02],
  ['Chorrillos', -12.168, -77.018],
];

// Calles por distrito con un punto aproximado (datos de demostración)
const CALLES = {
  Miraflores: [['Av. Arequipa', -12.115, -77.033], ['Av. José Larco', -12.124, -77.03], ['Malecón de la Reserva', -12.13, -77.034], ['Av. Benavides', -12.126, -77.02]],
  'San Isidro': [['Av. Javier Prado Oeste', -12.093, -77.04], ['Av. Salaverry', -12.095, -77.05], ['Av. Camino Real', -12.098, -77.036]],
  Lince: [['Av. Arequipa', -12.083, -77.034], ['Av. César Vallejo', -12.086, -77.031], ['Av. Petit Thouars', -12.081, -77.031]],
  'Jesús María': [['Av. Salaverry', -12.08, -77.05], ['Av. Brasil', -12.072, -77.051], ['Campo de Marte', -12.07, -77.043]],
  'Cercado de Lima': [['Av. Arequipa', -12.06, -77.036], ['Jr. de la Unión', -12.05, -77.033], ['Av. Venezuela', -12.055, -77.06], ['Av. Grau', -12.056, -77.025]],
  'Santiago de Surco': [['Av. Primavera', -12.11, -76.99], ['Av. Caminos del Inca', -12.13, -76.99]],
  Barranco: [['Av. Grau', -12.146, -77.021], ['Av. Pedro de Osma', -12.15, -77.024]],
  'San Borja': [['Av. San Borja Norte', -12.1, -77.0], ['Av. Aviación', -12.095, -77.002]],
  'La Victoria': [['Av. Aviación', -12.075, -77.012], ['Av. Canadá', -12.083, -77.02], ['Av. México', -12.069, -77.025]],
  Chorrillos: [['Av. Defensores del Morro', -12.165, -77.02], ['Av. Huaylas', -12.175, -77.012]],
};
// Peso de incidentes por distrito (para que el semáforo muestre zonas distintas)
const RIESGO = { 'Cercado de Lima': 9, 'La Victoria': 8, Lince: 6, 'Jesús María': 4, Miraflores: 2, 'San Isidro': 1, Chorrillos: 1, 'Santiago de Surco': 1, 'San Borja': 0, Barranco: 0 };

const USUARIOS_DEMO = [
  ['Ana Torres', 'ana@demo.pe'], ['Luis Ramos', 'luis@demo.pe'], ['María Quispe', 'maria@demo.pe'],
  ['Jorge Salas', 'jorge@demo.pe'], ['Rosa Huamán', 'rosa@demo.pe'], ['Pedro Vega', 'pedro@demo.pe'],
  ['Lucía Paredes', 'lucia@demo.pe'], ['Diego Flores', 'diego@demo.pe'],
];

// Generador pseudoaleatorio determinista: los datos demo son siempre los mismos
function prng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

async function insertarEvento(cliente, e) {
  const { rows } = await cliente.query(
    `INSERT INTO eventos (tipo, lat, lng, calle, distrito_id, descripcion, autor_id, creado_en, ultima_confirmacion_en)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [e.tipo, e.lat, e.lng, e.calle, e.distritoId, e.descripcion || null, e.autorId, e.creadoEn, e.ultimaConfirmacion || e.creadoEn],
  );
  const id = rows[0].id;
  const otros = e.votantes.filter((u) => u !== e.autorId);
  for (let i = 0; i < Math.min(e.confirmaciones, otros.length); i += 1) {
    await cliente.query('INSERT INTO votos (evento_id, usuario_id, voto, creado_en) VALUES ($1,$2,\'confirma\',$3)', [id, otros[i], e.creadoEn]);
  }
  for (let i = 0; i < (e.desmentidos || 0); i += 1) {
    const u = otros[otros.length - 1 - i];
    if (u) await cliente.query('INSERT INTO votos (evento_id, usuario_id, voto) VALUES ($1,$2,\'desmiente\') ON CONFLICT DO NOTHING', [id, u]);
  }
  for (let i = 0; i < (e.cierres || 0); i += 1) {
    await cliente.query('INSERT INTO cierres (evento_id, usuario_id) VALUES ($1,$2)', [id, otros[i]]);
  }
}

async function cargarDemo() {
  const { rows: [{ total }] } = await pool.query('SELECT count(*)::int AS total FROM eventos');
  if (total > 0) return;
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const hash = await bcrypt.hash(process.env.DEMO_PASSWORD || 'Demo1234!', 10);
    for (const [nombre, email] of USUARIOS_DEMO) {
      await cliente.query('INSERT INTO usuarios (nombre, email, password_hash) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING', [nombre, email, hash]);
    }
    const usuarios = (await cliente.query('SELECT id FROM usuarios ORDER BY id')).rows.map((r) => r.id);
    const distritos = Object.fromEntries((await cliente.query('SELECT id, nombre FROM distritos')).rows.map((r) => [r.nombre, r.id]));
    const r = prng(2026);
    const ahora = Date.now();
    const H = 3600 * 1000;
    const azar = (lista) => lista[Math.floor(r() * lista.length)];
    const jitter = () => (r() - 0.5) * 0.004;
    const mezclar = () => [...usuarios].sort(() => r() - 0.5);

    // Historial de 60 días: robos y accidentes (más robos entre 18:00 y 21:00), algunos sin verificar o desmentidos
    for (const [distrito, peso] of Object.entries(RIESGO)) {
      const n = peso ? peso * 2 + 1 : 0;
      for (let i = 0; i < n; i += 1) {
        const [calle, lat, lng] = azar(CALLES[distrito]);
        const dia = Math.floor(r() * 58) + 1;
        const horaLima = r() < 0.6 ? 18 + Math.floor(r() * 3) : 6 + Math.floor(r() * 12);
        const fecha = new Date(ahora - dia * 24 * H);
        fecha.setUTCHours((horaLima + 5) % 24, Math.floor(r() * 60), 0, 0);
        const tipo = r() < 0.7 ? 'robo' : 'accidente';
        // la mitad de los distritos más riesgosos concentra incidentes recientes (tendencia al alza)
        const votantes = mezclar();
        const p = r();
        await insertarEvento(cliente, {
          tipo, lat: lat + jitter(), lng: lng + jitter(), calle, distritoId: distritos[distrito],
          autorId: votantes[0], creadoEn: fecha, votantes,
          confirmaciones: p < 0.8 ? 3 + Math.floor(r() * 4) : Math.floor(r() * 3),
          desmentidos: p > 0.95 ? 3 : 0,
          descripcion: tipo === 'robo' ? 'Robo de bicicleta reportado por la comunidad' : 'Accidente con vehículo en la vía',
        });
      }
    }
    // Eventos en vivo y persistentes
    const vivos = [
      ['vehiculo_ciclovia', 'Miraflores', 0, 0.5, 2, 'Auto estacionado sobre la ciclovía'],
      ['vehiculo_ciclovia', 'San Isidro', 1, 1, 4, 'Mototaxi invadiendo la ciclovía'],
      ['robo', 'Lince', 0, 3, 3, 'Intento de robo de bicicleta en el semáforo'],
      ['accidente', 'Jesús María', 1, 6, 1, 'Ciclista atropellado, ambulancia en camino'],
      ['calle_enrejada', 'San Isidro', 2, 24 * 5, 7, 'Vecinos enrejaron la calle; no se puede cruzar en bicicleta'],
      ['calle_enrejada', 'Santiago de Surco', 0, 24 * 2, 1, 'Reja nueva al final de la cuadra'],
      ['ciclovia_interrumpida', 'Cercado de Lima', 0, 24 * 12, 5, 'La ciclovía termina sin conexión con Lince'],
      ['ciclovia_interrumpida', 'La Victoria', 1, 24 * 20, 4, 'Obras cortan la ciclovía entre distritos'],
      ['mal_estado', 'Chorrillos', 1, 24 * 3, 3, 'Bache grande en la ciclovía'],
      ['mal_estado', 'Chorrillos', 0, 24 * 1, 2, 'Pista hundida'],
      ['estacionamiento', 'Miraflores', 1, 24 * 40, 6, 'Vigilado · techado · gratuito'],
      ['estacionamiento', 'San Isidro', 0, 24 * 30, 4, 'Vigilado · gratuito'],
      ['estacionamiento', 'Cercado de Lima', 1, 24 * 15, 3, 'Vigilado · techado'],
      ['estacionamiento', 'Barranco', 0, 24 * 2, 1, 'Gratuito'],
    ];
    for (const [tipo, distrito, idxCalle, horasAtras, confirmaciones, descripcion] of vivos) {
      const [calle, lat, lng] = CALLES[distrito][idxCalle];
      const creado = new Date(ahora - horasAtras * H);
      const votantes = mezclar();
      await insertarEvento(cliente, {
        tipo, lat: lat + jitter() / 2, lng: lng + jitter() / 2, calle, distritoId: distritos[distrito],
        autorId: votantes[0], creadoEn: creado, votantes, confirmaciones, descripcion,
        ultimaConfirmacion: tipo === 'vehiculo_ciclovia' ? new Date(ahora - 0.3 * H) : creado,
      });
    }
    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}

async function migrate({ seed = true } = {}) {
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  for (const [nombre, lat, lng] of DISTRITOS) {
    await pool.query('INSERT INTO distritos (nombre, lat, lng) VALUES ($1,$2,$3) ON CONFLICT (nombre) DO NOTHING', [nombre, lat, lng]);
  }
  if (seed) await cargarDemo();
}

module.exports = { migrate };

if (require.main === module) {
  migrate({ seed: true })
    .then(() => { console.log('Esquema y datos demo aplicados.'); return pool.end(); })
    .catch((err) => { console.error(err); process.exit(1); });
}
