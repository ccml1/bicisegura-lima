/* BiciSegura Lima · frontend sin framework (Leaflet + OpenStreetMap). */
const ICONOS = {
  robo: '🚨', accidente: '💥', mal_estado: '🕳️', vehiculo_ciclovia: '🚗',
  calle_enrejada: '🚧', ciclovia_interrumpida: '⛔', estacionamiento: '🅿️',
};
const ACTUALIZAR_CADA_MS = 30000;
const estado = {
  tipos: [], distritos: [], eventos: [], usuario: null, token: null,
  modoReporte: false, filtroTipos: new Set(), capaEventos: null, capaCalor: null, capaRiesgo: null,
};

// ---------- sesión (localStorage protegido: puede no estar disponible) ----------
function cargarSesion() {
  try {
    const s = JSON.parse(localStorage.getItem('bicisegura.sesion') || 'null');
    if (s?.token) { estado.token = s.token; estado.usuario = s.usuario; }
  } catch { /* sin almacenamiento */ }
}
function guardarSesion() {
  try {
    if (estado.token) localStorage.setItem('bicisegura.sesion', JSON.stringify({ token: estado.token, usuario: estado.usuario }));
    else localStorage.removeItem('bicisegura.sesion');
  } catch { /* sin almacenamiento */ }
}

async function api(ruta, opciones = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (estado.token) headers.Authorization = `Bearer ${estado.token}`;
  const r = await fetch(`/api${ruta}`, { ...opciones, headers });
  const datos = await r.json().catch(() => ({}));
  if (r.status === 401 && estado.token) { estado.token = null; estado.usuario = null; guardarSesion(); pintarCuenta(); }
  if (!r.ok) throw new Error(datos.error || 'Algo salió mal');
  return datos;
}

const $ = (sel) => document.querySelector(sel);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function hace(fecha) {
  const ms = Date.now() - new Date(fecha);
  const min = Math.round(ms / 60000);
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? '' : 's'}`;
}
function aviso(texto) {
  const el = $('#aviso');
  el.textContent = texto; el.hidden = false;
  clearTimeout(aviso.t); aviso.t = setTimeout(() => { el.hidden = true; }, 3200);
}

// ---------- hoja inferior ----------
function abrirHoja(html) { $('#hoja-contenido').innerHTML = html; $('#hoja').hidden = false; }
function cerrarHoja() { $('#hoja').hidden = true; }

// ---------- mapa ----------
const mapa = L.map('mapa', { zoomControl: false }).setView([-12.095, -77.03], 13);
L.control.zoom({ position: 'bottomleft' }).addTo(mapa);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; colaboradores de OpenStreetMap',
}).addTo(mapa);
estado.capaEventos = L.layerGroup().addTo(mapa);

function iconoEvento(e) {
  return L.divIcon({
    className: '', iconSize: [34, 34], iconAnchor: [17, 17],
    html: `<div class="marcador ${e.verificado ? '' : 'no-verificado'}" title="${esc(e.etiqueta)}">${ICONOS[e.tipo]}</div>`,
  });
}

async function cargarEventos() {
  const params = new URLSearchParams();
  if ($('#f-verificados').checked) params.set('verificados', 'true');
  if (estado.filtroTipos.size) params.set('tipos', [...estado.filtroTipos].join(','));
  try {
    estado.eventos = await api(`/eventos?${params}`);
    estado.capaEventos.clearLayers();
    for (const e of estado.eventos) {
      L.marker([e.lat, e.lng], { icon: iconoEvento(e), keyboard: true, title: e.etiqueta })
        .on('click', () => mostrarEvento(e.id)).addTo(estado.capaEventos);
    }
    $('#estado-vivo').textContent = `Lima · ${estado.eventos.length} eventos en vivo`;
  } catch (err) { aviso(err.message); }
}

function mostrarEvento(id) {
  const e = estado.eventos.find((x) => x.id === id);
  if (!e) return;
  const persistente = ['mal_estado', 'calle_enrejada', 'ciclovia_interrumpida', 'estacionamiento'].includes(e.tipo);
  const pct = Math.min(100, Math.round((e.confirmaciones / 3) * 100));
  abrirHoja(`
    <h2>${ICONOS[e.tipo]} ${esc(e.etiqueta)}</h2>
    <p class="meta">${esc(e.calle)} · ${esc(e.distrito)} · ${hace(e.creadoEn)}</p>
    ${e.verificado
    ? `<span class="insignia ok">✓ Verificado por ${e.confirmaciones} personas</span>`
    : `<span class="insignia pendiente">${e.confirmaciones} de 3 confirmaciones</span><div class="progreso"><span style="width:${pct}%"></span></div>`}
    ${e.descripcion ? `<p>${esc(e.descripcion)}</p>` : ''}
    <div class="fila-botones">
      <button class="boton" data-voto="confirma">Sí, sigue ahí</button>
      <button class="boton secundario" data-voto="desmiente">No es cierto</button>
    </div>
    ${persistente ? '<button class="boton peligro" style="margin-top:.5rem" data-cierre>Ya no está</button>' : ''}
    <button class="boton secundario" style="margin-top:.5rem" data-historial>Ver historial de ${esc(e.calle)}</button>
    <p class="error" id="error-voto"></p>`);
  $('#hoja-contenido').querySelectorAll('[data-voto]').forEach((b) => b.addEventListener('click', () => votar(e, b.dataset.voto)));
  $('#hoja-contenido').querySelector('[data-cierre]')?.addEventListener('click', () => yaNoEsta(e));
  $('#hoja-contenido').querySelector('[data-historial]').addEventListener('click', () => mostrarHistorial(e.calle, e.distritoId));
}

async function votar(e, voto) {
  if (!estado.token) return pedirSesion('Inicia sesión para validar eventos');
  try {
    const actualizado = await api(`/eventos/${e.id}/votos`, { method: 'POST', body: JSON.stringify({ voto }) });
    aviso(actualizado.verificado ? 'Evento verificado por la comunidad ✓' : 'Gracias, tu voto se registró');
    await cargarEventos(); mostrarEvento(e.id);
  } catch (err) { $('#error-voto').textContent = err.message; }
}
async function yaNoEsta(e) {
  if (!estado.token) return pedirSesion('Inicia sesión para actualizar eventos');
  try {
    const r = await api(`/eventos/${e.id}/ya-no-esta`, { method: 'POST' });
    aviso(r.estado === 'resuelto' ? 'Marcado como resuelto por la comunidad' : `Registrado (${r.yaNoEsta} de 3)`);
    await cargarEventos(); if (r.estado === 'resuelto') cerrarHoja(); else mostrarEvento(e.id);
  } catch (err) { $('#error-voto').textContent = err.message; }
}

async function mostrarHistorial(calle, distritoId) {
  try {
    const h = await api(`/calles/historial?${new URLSearchParams({ calle, distrito: distritoId })}`);
    abrirHoja(`
      <h2>${esc(calle)}</h2>
      <p class="meta">Historial con eventos verificados</p>
      <div class="tarjeta"><strong>${esc(h.resumen)}</strong></div>
      ${h.persistentes.length ? '<h3>Situación actual</h3>' : ''}
      ${h.persistentes.map((p) => `<div class="tarjeta">${ICONOS[p.tipo]} ${esc(p.texto)}</div>`).join('')}`);
  } catch (err) { aviso(err.message); }
}

// ---------- reportar ----------
function distritoMasCercano(lat, lng) {
  return estado.distritos.reduce((mejor, d) => {
    const dist = (d.lat - lat) ** 2 + (d.lng - lng) ** 2;
    return !mejor || dist < mejor.dist ? { d, dist } : mejor;
  }, null)?.d;
}
function alternarModoReporte(activar) {
  if (activar && !estado.token) return pedirSesion('Inicia sesión para reportar');
  estado.modoReporte = activar;
  const fab = $('#btn-reportar');
  fab.classList.toggle('modo-reporte', activar);
  fab.textContent = activar ? 'Toca el mapa… ✕' : '＋ Reportar';
  if (activar) aviso('Toca el punto del mapa donde ocurre el evento');
  return undefined;
}
mapa.on('click', (ev) => { if (estado.modoReporte) formularioReporte(ev.latlng); });

function formularioReporte({ lat, lng }) {
  alternarModoReporte(false);
  const cercano = distritoMasCercano(lat, lng);
  abrirHoja(`
    <h2>Nuevo reporte</h2>
    <p class="meta">Se guarda la ubicación del evento, nunca la tuya.</p>
    <form id="form-reporte">
      <label>¿Qué está pasando?</label>
      <div class="tipos-reporte">${estado.tipos.map((t) => `<button type="button" class="tipo-opcion" data-tipo="${t.id}">${ICONOS[t.id]} ${esc(t.etiqueta)}</button>`).join('')}</div>
      <label for="r-calle">Calle o avenida</label>
      <input type="text" id="r-calle" required maxlength="120" placeholder="Ej. Av. Arequipa">
      <label for="r-distrito">Distrito</label>
      <select id="r-distrito">${estado.distritos.map((d) => `<option value="${d.id}" ${d.id === cercano?.id ? 'selected' : ''}>${esc(d.nombre)}</option>`).join('')}</select>
      <label for="r-desc">Detalle (opcional)</label>
      <textarea id="r-desc" rows="2" maxlength="280"></textarea>
      <p class="error" id="error-reporte"></p>
      <button class="boton" type="submit">Publicar reporte</button>
    </form>`);
  let tipo = null;
  document.querySelectorAll('.tipo-opcion').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.tipo-opcion').forEach((x) => x.classList.remove('elegido'));
    b.classList.add('elegido'); tipo = b.dataset.tipo;
  }));
  $('#form-reporte').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!tipo) { $('#error-reporte').textContent = 'Elige qué está pasando'; return; }
    try {
      const nuevo = await api('/eventos', { method: 'POST', body: JSON.stringify({
        tipo, lat, lng, calle: $('#r-calle').value, distritoId: Number($('#r-distrito').value), descripcion: $('#r-desc').value,
      }) });
      aviso('Reporte publicado. Necesita 3 confirmaciones para verificarse.');
      await cargarEventos(); mostrarEvento(nuevo.id);
    } catch (err) { $('#error-reporte').textContent = err.message; }
  });
}

// ---------- cuenta ----------
function pintarCuenta() { $('#btn-cuenta').textContent = estado.usuario ? estado.usuario.nombre.split(' ')[0] : 'Ingresar'; }
function pedirSesion(motivo) { formularioCuenta('login', motivo); }
function formularioCuenta(modo = 'login', motivo = '') {
  if (estado.usuario) {
    abrirHoja(`<h2>Hola, ${esc(estado.usuario.nombre)}</h2><p class="meta">${esc(estado.usuario.email || '')}</p>
      <button class="boton secundario" id="salir">Cerrar sesión</button>`);
    $('#salir').addEventListener('click', () => { estado.token = null; estado.usuario = null; guardarSesion(); pintarCuenta(); cerrarHoja(); });
    return;
  }
  const registro = modo === 'registro';
  abrirHoja(`
    <h2>${registro ? 'Crear cuenta' : 'Ingresar'}</h2>
    <p class="meta">${esc(motivo || 'Con tu cuenta puedes reportar y validar eventos.')}</p>
    <form id="form-cuenta">
      ${registro ? '<label for="c-nombre">Nombre</label><input type="text" id="c-nombre" required maxlength="80">' : ''}
      <label for="c-email">Correo</label><input type="email" id="c-email" required autocomplete="email">
      <label for="c-pass">Contraseña</label><input type="password" id="c-pass" required minlength="8" autocomplete="${registro ? 'new-password' : 'current-password'}">
      <p class="error" id="error-cuenta"></p>
      <button class="boton" type="submit">${registro ? 'Crear cuenta' : 'Ingresar'}</button>
    </form>
    <button class="boton-texto" id="cambiar-modo" style="margin-top:.5rem">${registro ? '¿Ya tienes cuenta? Ingresa' : '¿Eres nuevo? Crea tu cuenta'}</button>
    ${registro ? '' : '<p class="meta" style="margin-top:.6rem">Demo: ana@demo.pe · Demo1234!</p>'}`);
  $('#cambiar-modo').addEventListener('click', () => formularioCuenta(registro ? 'login' : 'registro', motivo));
  $('#form-cuenta').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      const cuerpo = { email: $('#c-email').value, password: $('#c-pass').value };
      if (registro) cuerpo.nombre = $('#c-nombre').value;
      const r = await api(`/auth/${registro ? 'registro' : 'login'}`, { method: 'POST', body: JSON.stringify(cuerpo) });
      estado.token = r.token; estado.usuario = r.usuario; guardarSesion(); pintarCuenta();
      aviso(`Bienvenido, ${r.usuario.nombre.split(' ')[0]}`); cerrarHoja();
    } catch (err) { $('#error-cuenta').textContent = err.message; }
  });
}

// ---------- riesgo por zona y estadísticas ----------
async function vistaRiesgo() {
  try {
    const zonas = await api('/zonas/riesgo');
    if (estado.capaRiesgo) estado.capaRiesgo.remove();
    const color = { verde: '#34c759', amarillo: '#ffcc00', rojo: '#ff3b30' };
    estado.capaRiesgo = L.layerGroup(zonas.map((z) => L.circle([z.lat, z.lng], {
      radius: 900, color: color[z.color], fillColor: color[z.color], fillOpacity: 0.25, weight: 2,
    }).bindTooltip(`${z.nombre}: ${z.motivos[0]}`))).addTo(mapa);
    const orden = { rojo: 0, amarillo: 1, verde: 2 };
    abrirHoja(`
      <h2>Riesgo por distrito</h2>
      <p class="meta">Últimos 30 días · solo eventos verificados</p>
      <ul class="lista">${zonas.sort((a, b) => orden[a.color] - orden[b.color]).map((z) => `
        <li class="zona" data-id="${z.id}"><span><span class="semaforo ${z.color}"></span>${esc(z.nombre)}</span>
        <span class="meta" style="margin:0;text-align:right">${esc(z.motivos[0])}</span></li>`).join('')}</ul>`);
    document.querySelectorAll('.zona').forEach((li) => li.addEventListener('click', () => vistaEstadisticas(Number(li.dataset.id))));
  } catch (err) { aviso(err.message); }
}

async function vistaEstadisticas(distritoId) {
  const id = distritoId || estado.distritos.find((d) => d.nombre === 'Cercado de Lima')?.id || estado.distritos[0]?.id;
  try {
    const s = await api(`/estadisticas/${id}`);
    const max = Math.max(1, ...Object.values(s.porTipo));
    const etiqueta = Object.fromEntries(estado.tipos.map((t) => [t.id, t.etiqueta]));
    const v = s.tendencia.variacion;
    const d = estado.distritos.find((x) => x.id === id);
    if (d) mapa.flyTo([d.lat, d.lng], 14, { duration: 0.6 });
    abrirHoja(`
      <h2>${esc(s.distrito)}</h2>
      <select id="sel-distrito" aria-label="Cambiar distrito">${estado.distritos.map((x) => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>
      <div class="tarjeta" style="margin-top:.8rem">
        <div class="cifra">${s.total}</div>
        <div class="meta" style="margin:0">eventos verificados en 30 días
        ${v === null ? '' : `· <span class="${v > 0 ? 'tendencia-sube' : 'tendencia-baja'}">${v > 0 ? '+' : ''}${v}% vs. mes anterior</span>`}</div>
      </div>
      <h3>Por tipo</h3>
      ${Object.entries(s.porTipo).sort((a, b) => b[1] - a[1]).map(([t, n]) => `
        <div class="barra-dato"><span>${ICONOS[t]} ${esc(etiqueta[t] || t)}</span><span class="relleno" style="width:${(n / max) * 100}%"></span><span>${n}</span></div>`).join('') || '<p class="meta">Sin datos</p>'}
      <h3>Calles con más robos</h3>
      <ul class="lista">${s.topCallesRobos.map((c) => `<li><span>${esc(c.calle)}</span><strong>${c.total}</strong></li>`).join('') || '<li class="meta">Sin robos verificados</li>'}</ul>
      <h3>Horario más riesgoso</h3>
      <div class="tarjeta">${s.franjaMasRiesgosa ? `<strong>${s.franjaMasRiesgosa.porcentaje}%</strong> de los robos y accidentes ocurren en la <strong>${esc(s.franjaMasRiesgosa.franja)}</strong>` : 'Sin datos suficientes'}</div>`);
    $('#sel-distrito').addEventListener('change', (ev) => vistaEstadisticas(Number(ev.target.value)));
  } catch (err) { aviso(err.message); }
}

async function alternarCalor(activar) {
  if (estado.capaCalor) { estado.capaCalor.remove(); estado.capaCalor = null; }
  if (!activar) return;
  try {
    const puntos = await api('/mapa-calor');
    estado.capaCalor = L.heatLayer(puntos, { radius: 28, blur: 22, maxZoom: 15 }).addTo(mapa);
  } catch (err) { aviso(err.message); }
}

function cambiarVista(vista) {
  document.querySelectorAll('.seg').forEach((b) => {
    const activa = b.dataset.vista === vista;
    b.classList.toggle('activo', activa); b.setAttribute('aria-selected', String(activa));
  });
  if (vista !== 'riesgo' && estado.capaRiesgo) { estado.capaRiesgo.remove(); estado.capaRiesgo = null; }
  if (vista === 'mapa') cerrarHoja();
  if (vista === 'riesgo') vistaRiesgo();
  if (vista === 'estadisticas') vistaEstadisticas();
}

// ---------- HU15 · cerca de mí ----------
function listaCercanos(origen, etiqueta) {
  const lista = window.Cerca.cercanos(origen, estado.eventos, 1);
  mapa.flyTo([origen.lat, origen.lng], 15, { duration: 0.6 });
  abrirHoja(`
    <h2>Cerca de ${esc(etiqueta)}</h2>
    <p class="meta">Eventos y estacionamientos a 1 km o menos · tu ubicación no se guarda</p>
    <ul class="lista">${lista.map((e) => `
      <li class="zona" data-id="${e.id}"><span>${ICONOS[e.tipo]} ${esc(e.etiqueta)} · ${esc(e.calle)}</span>
      <strong>${Math.round(e.distanciaKm * 1000)} m</strong></li>`).join('') || '<li class="meta">Nada reportado a menos de 1 km</li>'}</ul>`);
  document.querySelectorAll('.zona[data-id]').forEach((li) => li.addEventListener('click', () => mostrarEvento(Number(li.dataset.id))));
}
function elegirDistrito() {
  abrirHoja(`
    <h2>Cerca de…</h2>
    <p class="meta">No pudimos usar tu ubicación. Elige un distrito.</p>
    <select id="sel-cerca">${estado.distritos.map((d) => `<option value="${d.id}">${esc(d.nombre)}</option>`).join('')}</select>
    <button class="boton" id="ver-cerca" style="margin-top:.6rem">Ver eventos cercanos</button>`);
  $('#ver-cerca').addEventListener('click', () => {
    const d = estado.distritos.find((x) => x.id === Number($('#sel-cerca').value));
    listaCercanos({ lat: d.lat, lng: d.lng }, d.nombre);
  });
}
function cercaDeMi() {
  if (!navigator.geolocation) return elegirDistrito();
  navigator.geolocation.getCurrentPosition(
    (p) => listaCercanos({ lat: p.coords.latitude, lng: p.coords.longitude }, 'ti'),
    () => elegirDistrito(),
    { enableHighAccuracy: true, timeout: 8000 },
  );
  return undefined;
}

// ---------- inicio ----------
async function iniciar() {
  cargarSesion(); pintarCuenta();
  [estado.tipos, estado.distritos] = await Promise.all([api('/tipos'), api('/distritos')]);
  $('#f-tipos').innerHTML = estado.tipos.map((t) => `<label class="chip"><input type="checkbox" data-filtro="${t.id}"> ${ICONOS[t.id]} ${esc(t.etiqueta)}</label>`).join('');
  document.querySelectorAll('[data-filtro]').forEach((c) => c.addEventListener('change', () => {
    if (c.checked) estado.filtroTipos.add(c.dataset.filtro); else estado.filtroTipos.delete(c.dataset.filtro);
    cargarEventos();
  }));
  try {
    const f = JSON.parse(localStorage.getItem('bicisegura.filtros') || '{}');
    (f.tipos || []).forEach((t) => { estado.filtroTipos.add(t); const c = document.querySelector(`[data-filtro="${t}"]`); if (c) c.checked = true; });
    $('#f-verificados').checked = Boolean(f.verificados);
  } catch { /* sin almacenamiento */ }
  const recordarFiltros = () => {
    try { localStorage.setItem('bicisegura.filtros', JSON.stringify({ tipos: [...estado.filtroTipos], verificados: $('#f-verificados').checked })); } catch { /* sin almacenamiento */ }
  };
  document.querySelectorAll('[data-filtro]').forEach((c) => c.addEventListener('change', recordarFiltros));
  $('#f-verificados').addEventListener('change', () => { recordarFiltros(); cargarEventos(); });
  $('#f-calor').addEventListener('change', (ev) => alternarCalor(ev.target.checked));
  $('#btn-cerca').addEventListener('click', cercaDeMi);
  $('#btn-reportar').addEventListener('click', () => alternarModoReporte(!estado.modoReporte));
  $('#btn-cuenta').addEventListener('click', () => formularioCuenta());
  $('#hoja-cerrar').addEventListener('click', cerrarHoja);
  document.querySelectorAll('.seg').forEach((b) => b.addEventListener('click', () => cambiarVista(b.dataset.vista)));
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { cerrarHoja(); alternarModoReporte(false); } });
  await cargarEventos();
  setInterval(cargarEventos, ACTUALIZAR_CADA_MS); // "tiempo real" por consulta periódica
}
iniciar().catch((err) => aviso(err.message));
