// Informe de la PC2 (Word). Desde la raíz:  npm i --no-save docx && node docs/informe/build.js
// Lee el backlog (docs/scrum/backlog.json, exportado de Jira), los gráficos (docs/graficos) y el código real del repo.
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, ImageRun, PageBreak, LevelFormat, Footer, PageNumber,
  TableOfContents, Header, PageOrientation,
} = require('docx');


const P = path.resolve(__dirname, '../..'); // raíz del repositorio
const GRAF = `${P}/docs/graficos`;
const backlog = JSON.parse(fs.readFileSync(`${P}/docs/scrum/backlog.json`, 'utf8'));
const FONT = 'Arial';
const CONTENT_W = 9638; // A4 con márgenes de 2 cm
const AZUL = '1F4E79';
const GRIS = 'F2F2F2';

// ---------- utilidades ----------
function runs(texto, base = {}) {
  // **negrita** y `código`
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let i = 0; let m;
  while ((m = re.exec(texto))) {
    if (m.index > i) out.push(new TextRun({ text: texto.slice(i, m.index), ...base }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), font: 'Consolas', size: 19, ...base }));
    i = m.index + t.length;
  }
  if (i < texto.length) out.push(new TextRun({ text: texto.slice(i), ...base }));
  return out;
}
const p = (t, o = {}) => new Paragraph({ children: runs(t), spacing: { after: 120, line: 276 }, ...o });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const h3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
const li = (t, nivel = 0) => new Paragraph({ numbering: { reference: 'vinetas', level: nivel }, children: runs(t), spacing: { after: 60 } });
const num = (t, ref = 'numeros') => new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 60 } });
const salto = () => new Paragraph({ children: [new PageBreak()] });

const borde = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const bordes = { top: borde, bottom: borde, left: borde, right: borde };

function tabla(cabecera, filas, anchos) {
  const total = anchos.reduce((a, b) => a + b, 0);
  const celda = (txt, i, esCab) => new TableCell({
    width: { size: anchos[i], type: WidthType.DXA },
    borders: bordes,
    shading: esCab ? { type: ShadingType.CLEAR, color: 'auto', fill: AZUL } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: String(txt).split('\n').map((linea) => new Paragraph({
      children: runs(linea, esCab ? { bold: true, color: 'FFFFFF', size: 19 } : { size: 19 }),
      spacing: { after: 20 },
    })),
  });
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: anchos,
    rows: [
      new TableRow({ tableHeader: true, children: cabecera.map((c, i) => celda(c, i, true)) }),
      ...filas.map((f) => new TableRow({ children: f.map((c, i) => celda(c, i, false)) })),
    ],
  });
}
const espacio = () => new Paragraph({ children: [], spacing: { after: 80 } });

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function imagen(file, anchoPx = 640, pie) {
  const { w, h } = pngSize(file);
  const alto = Math.round((anchoPx * h) / w);
  const maxAlto = anchoPx > 700 ? 520 : 820;
  const [fw, fh] = alto > maxAlto ? [Math.round((maxAlto * w) / h), maxAlto] : [anchoPx, alto];
  const out = [new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 40 },
    children: [new ImageRun({ type: 'png', data: fs.readFileSync(file), transformation: { width: fw, height: fh } })],
  })];
  if (pie) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: pie, italics: true, size: 18, color: '595959' })] }));
  return out;
}
function captura(texto) {
  // Espacio reservado para evidencia real (Jira, GitHub, Azure)
  const b = { style: BorderStyle.DASHED, size: 8, color: 'C00000' };
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: { top: b, bottom: b, left: b, right: b },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FFF5F5' },
      margins: { top: 500, bottom: 500, left: 200, right: 200 },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `[INSERTAR CAPTURA] ${texto}`, bold: true, color: 'C00000', size: 20 })] })],
    })] })],
  });
}
function codigo(texto, titulo) {
  const out = [];
  if (titulo) out.push(new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: titulo, bold: true, size: 18, color: '595959' })] }));
  const lineas = texto.replace(/\t/g, '  ').split('\n');
  out.push(new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: bordes,
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: GRIS },
      margins: { top: 80, bottom: 80, left: 140, right: 140 },
      children: lineas.map((l) => new Paragraph({ spacing: { after: 0, line: 240 }, children: [new TextRun({ text: l || ' ', font: 'Consolas', size: 16 })] })),
    })] })],
  }));
  out.push(espacio());
  return out;
}
function extracto(file, desde, hasta) {
  return fs.readFileSync(file, 'utf8').split('\n').slice(desde - 1, hasta).join('\n');
}
function lineasDe(file, inicio, fin) {
  const t = fs.readFileSync(file, 'utf8').split('\n');
  const a = t.findIndex((l) => l.includes(inicio));
  const b = t.findIndex((l, i) => i > a && l.includes(fin));
  return t.slice(a, b + 1).join('\n');
}

// ---------- contenido (BiciSegura Lima · Caso "Ciclistas en Lima") ----------
const GH = 'https://github.com/ccml1/bicisegura-lima';
const JIRA = 'https://ccml01.atlassian.net/jira/software/projects/EXAMPFC/boards/74';
const URL_APP = 'https://bicisegura-lima.azurewebsites.net';
const H = backlog.historias;
const E = backlog.epicas;
const S = backlog.sprints;
const delSprint = (n) => H.filter((h) => h.sprint === n);
const pts = (l) => l.reduce((a, h) => a + h.pts, 0);
const hechos = (l) => l.filter((h) => h.estado === 'Listo');

const portada = [
  new Paragraph({ spacing: { before: 1600, after: 120 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PRÁCTICA CALIFICADA 2 — PFC III', bold: true, size: 28, color: '595959' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: 'Caso: Ciclistas en Lima', size: 26 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 120 }, children: [new TextRun({ text: 'BiciSegura Lima', bold: true, size: 56, color: AZUL })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'Mapa colaborativo, estilo Waze, para que los ciclistas reporten y validen robos, accidentes y el estado de las ciclovías', italics: true, size: 24, color: '404040' })] }),
  tabla(['Dato', 'Valor'], [
    ['Curso', 'Proyecto de Fin de Carrera III (PFC III)'],
    ['Docente', 'Kenny Neira'],
    ['Alumno', 'Carlos Mendoza Lozada · [Código]'],
    ['Repositorio GitHub', GH],
    ['Tablero Jira (Scrum)', JIRA],
    ['Solución desplegada (Azure)', URL_APP],
    ['Código final', 'bicisegura-lima.zip (adjunto)'],
  ], [3000, 6638]),
  espacio(),
  p('**Los tres enlaces están compartidos con el docente** (Jira: miembro del proyecto EXAMPFC; GitHub: colaborador del repositorio; la URL es pública).', { alignment: AlignmentType.CENTER }),
  salto(),
];

const indice = [
  h1('Índice'),
  new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-3' }),
  p('(Si el índice aparece vacío: clic derecho sobre él → Actualizar campos.)'),
  salto(),
];

const intro = [
  h1('Introducción: el problema y la solución'),
  p('En Lima cada vez más personas usan la bicicleta para ir al trabajo o al centro de estudios, pero enfrentan **ciclovías fragmentadas** que no conectan entre distritos, **tramos en mal estado**, **vehículos estacionados en la ciclovía**, falta de **estacionamientos seguros** y **zonas de riesgo** por robos y accidentes. No existe una fuente confiable y actualizada que diga qué pasa en cada calle.'),
  p('**BiciSegura Lima** resuelve esto con el modelo de Waze: los propios ciclistas reportan lo que ven y **se validan entre ellos**. Un evento queda **verificado con 3 confirmaciones de personas distintas** (el autor no puede confirmar su propio reporte y cada persona vota una sola vez). Con los eventos verificados se calculan estadísticas que convierten los reportes en conocimiento: “**3 robos en los últimos 30 días**”, “**calle enrejada desde hace 5 días**”, un semáforo de riesgo por zona, un panel por distrito y un mapa de calor.'),
  tabla(['Problema del caso', 'Cómo lo atiende BiciSegura', 'HU'], [
    ['Zonas de riesgo, robos y accidentes', 'Reporte comunitario, verificación con 3 votos, historial por calle, semáforo y mapa de calor', 'HU04–HU12'],
    ['Tramos en mal estado y vehículos en la ciclovía', 'Tipos de evento con vencimiento propio: temporal (2 h) y persistente (hasta 3 votos “ya no está”)', 'HU05, HU07'],
    ['Ciclovías fragmentadas entre distritos', 'Evento “ciclovía interrumpida” y capa de ciclovías por distrito', 'HU05, HU13'],
    ['Falta de estacionamientos seguros', 'Estacionamientos registrados y validados por la comunidad; “cerca de mí”', 'HU14, HU15'],
    ['Información falsa o spam', '3 confirmaciones, sin autovalidación, 1 voto por persona, 10 reportes/hora, límite por IP', 'HU06, HU08'],
  ], [3000, 5138, 1500]),
  espacio(),
  p('**Alcance justo y necesario:** se implementó el núcleo que da valor (mapa, reportes, validación y estadísticas) y se dejó en el Product Backlog lo que no es imprescindible para el MVP (planificador de rutas, notificaciones, datos abiertos, reputación), priorizado con MoSCoW.'),
  salto(),
];

// ---------- P1 ----------
const moscowCuenta = (m) => H.filter((h) => h.moscow === m);
const p1 = [
  h1('P1. Product Backlog y épicas en Jira'),
  p(`Proyecto Scrum **EXAMPFC** en Jira (${JIRA}). El backlog tiene **5 épicas** y **20 historias de usuario** vinculadas a su épica, con story points y prioridad MoSCoW. Las historias de los sprints son de tipo **Historia** y cada una tiene criterios de aceptación en formato **Dado / Cuando / Entonces**.`),
  h2('1.1 Épicas'),
  tabla(['Épica', 'Descripción', 'Objetivo de negocio'], E.map((e) => [`**${e.nombre}**\n${e.clave}`, e.descripcion, `${e.objetivo}\nIndicador: ${e.indicador}`]), [2100, 4200, 3338]),
  espacio(),
  captura('Jira > Backlog con el panel de Épicas visible (E1 a E5) y las historias agrupadas'),
  espacio(),
  h2('1.2 Historias de usuario, story points y prioridad MoSCoW'),
  p('Formato **“Como… quiero… para…”**. Estimación con **planning poker** usando la serie de Fibonacci (1, 2, 3, 5, 8, 13): los puntos miden complejidad, esfuerzo e incertidumbre relativos, no horas. La HU04 (mapa, 8 pts) y la HU06 (regla de 3 votos, 8 pts) son las más complejas; la HU17 (rutas, 13 pts) tiene alta incertidumbre porque requiere un motor de rutas externo.'),
  tabla(['ID', 'Historia de usuario', 'Épica', 'SP', 'MoSCoW', 'Sprint'], H.map((h) => [
    `**${h.id}**\n${h.clave}`, h.hu, h.epica, String(h.pts), h.moscow, h.sprint ? `S${h.sprint}` : 'Backlog',
  ]), [1500, 4950, 700, 550, 1100, 838]),
  espacio(),
  tabla(['MoSCoW', 'Significado', 'Historias', 'Puntos'], [
    ['Must', 'Imprescindible para que el producto tenga sentido', moscowCuenta('Must').map((h) => h.id).join(', '), String(pts(moscowCuenta('Must')))],
    ['Should', 'Importante, aporta mucho valor', moscowCuenta('Should').map((h) => h.id).join(', '), String(pts(moscowCuenta('Should')))],
    ['Could', 'Deseable si hay capacidad', moscowCuenta('Could').map((h) => h.id).join(', '), String(pts(moscowCuenta('Could')))],
    ["Won't", 'No entra en esta versión', moscowCuenta("Won't").map((h) => h.id).join(', '), String(pts(moscowCuenta("Won't")))],
  ], [1200, 3600, 3638, 1200]),
  espacio(),
  p('En Jira la prioridad MoSCoW se refleja en el campo **Prioridad**: Must = Highest, Should = High, Could = Medium, Won’t = Low; además se indica en la descripción de cada historia.'),
  h2('1.3 Criterios de aceptación (Dado / Cuando / Entonces)'),
  ...H.flatMap((h) => [
    h3(`${h.id} ${h.titulo} · ${h.pts} SP · ${h.moscow}`),
    p(`_${h.hu}_`.replace(/_/g, '')),
    ...h.criterios.map((c) => num(c.replace(/^(Dad[oa]s?)\b/, '**$1**').replace(/\b(cuando)\b/, '**$1**').replace(/\b(entonces)\b/, '**$1**'), `crit${h.id}`)),
  ]),
  espacio(),
  captura('Jira: detalle de una historia (por ejemplo EXAMPFC-11 HU06) con épica, story points, prioridad y criterios'),
  espacio(),
  captura('Jira > Lista o Backlog mostrando columnas Clave, Resumen, Épica, Story points y Prioridad'),
  h2('1.4 Definition of Done'),
  ...[
    'Rama `feature/EXAMPFC-<n>-<descripcion>` con commits descriptivos que llevan la clave de Jira.',
    'Pull Request hacia `test` con la HU, el enlace a Jira y los criterios de aceptación marcados.',
    'Pruebas automatizadas de la historia (unitarias y/o integración) en verde.',
    'Pipeline en verde: build, pruebas, gitleaks, npm audit y CodeQL; sin secretos en el código.',
    'Integrado en `main` mediante el PR de release del sprint y desplegado en Azure.',
    'Historia en **Listo** en Jira.',
  ].map((t) => num(t, 'dod')),
  salto(),
];

// ---------- P2 ----------
const filasSprint = S.map((s) => {
  const l = delSprint(s.n);
  return [`**Sprint ${s.n}**\n${s.nombre}\n${s.fechas}`, s.objetivo, l.map((h) => `${h.id} (${h.pts})`).join('\n'), String(pts(l)), String(pts(hechos(l)))];
});
const vel = S.map((s) => pts(hechos(delSprint(s.n))));
const prom = (vel.reduce((a, b) => a + b, 0) / vel.length).toFixed(1);
const p2 = [
  h1('P2. Simulación de 4 sprints'),
  p('Se simulan **4 sprints de 1 semana** (23 nov – 20 dic 2026), con un máximo de **4 historias por sprint** y una capacidad planificada de unos **21 puntos**. En Jira los sprints se crearon, iniciaron y cerraron de verdad; como la práctica dura 4 horas, cada sprint se ejecutó en **tiempo comprimido** (minutos en lugar de días) y las fechas de calendario de este informe son las del plan. Cada historia recorrió el flujo **Por hacer → En curso → En revisión → Listo** a medida que su rama y su Pull Request avanzaban en GitHub.'),
  h2('2.1 Objetivo, sprint backlog y puntos por sprint'),
  tabla(['Sprint', 'Objetivo (Sprint Goal)', 'Sprint backlog (SP)', 'Compro-\nmetido', 'Comple-\ntado'], filasSprint, [2100, 3700, 1700, 1100, 1038]),
  espacio(),
  p(`**Sprint 4:** de 20 puntos comprometidos se completaron ${vel[3]} (HU15 y HU16). **HU13 (ciclovías, 8 SP) y HU14 (estacionamientos, 5 SP) no cumplieron la Definition of Done** y, como manda Scrum, al cerrar el sprint vuelven al Product Backlog para repriorizarse; no se marcan como terminadas a medias. La capa de ciclovías necesita datos geográficos de las ciclovías de Lima que no estaban disponibles, y el estacionamiento ya puede reportarse como tipo de evento, pero falta el registro de sus características (vigilado, techado, gratuito).`),
  captura('Jira > Sprints: los 4 sprints con su objetivo y sus historias (backlog del sprint)'),
  h2('2.2 Burndown por sprint (ideal vs. real)'),
  p('La línea **ideal** baja de forma constante desde los puntos comprometidos hasta cero el último día. La línea **real** baja en escalón cada vez que una historia pasa a **Listo** (los puntos solo se queman cuando la historia está terminada). En los sprints 1 a 3 la línea real queda por encima de la ideal a mitad de semana —las historias grandes se cierran al final— y llega a cero. En el sprint 4 quedan 13 puntos sin quemar.'),
  ...imagen(`${GRAF}/burndown-sprints.png`, 640, 'Figura 1. Burndown de los 4 sprints (ideal vs. real)'),
  captura('Jira > Informes > Gráfico de trabajo pendiente (Burndown) de un sprint cerrado'),
  h2('2.3 Velocidad'),
  tabla(['', 'Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Promedio'], [
    ['Comprometido', ...S.map((s) => String(pts(delSprint(s.n)))), String((S.reduce((a, s) => a + pts(delSprint(s.n)), 0) / 4).toFixed(1))],
    ['Completado (velocidad)', ...vel.map(String), prom],
  ], [2400, 1450, 1450, 1450, 1450, 1438]),
  espacio(),
  ...imagen(`${GRAF}/velocidad.png`, 520, 'Figura 2. Velocidad: puntos comprometidos vs. completados'),
  p(`La **velocidad** son los puntos que llegan a Listo en un sprint. Fue estable (21) en los tres primeros sprints y cayó a ${vel[3]} en el cuarto. Con una velocidad promedio de **${prom} puntos**, el sprint 5 debería comprometer unos 18 puntos: HU13 (8) + HU14 (5) + HU18 (5).`),
  captura('Jira > Informes > Informe de velocidad'),
  h2('2.4 Diagrama de Gantt: fechas, dependencias e hitos'),
  ...imagen(`${GRAF}/gantt.png`, 640, 'Figura 3. Gantt por épica con dependencias e hitos de release'),
  li('**Dependencias:** HU02 (pipeline) necesita la infraestructura de HU01; HU05 (reportar) depende del mapa HU04; HU06 (validar) depende de que existan reportes (HU05); HU07 depende de los votos de HU06; HU10 (semáforo) usa el historial de HU09. En Jira se registraron como vínculos **“bloquea / es bloqueada por”**.'),
  li('**Hitos:** el cierre de cada sprint es un **release**: un Pull Request `test → main` que despliega en Azure (29 nov, 6 dic, 13 dic y 20 dic).'),
  captura('Jira > Cronograma (Timeline) con épicas, historias y dependencias'),
  h2('2.5 Tablero Kanban con límites WIP'),
  tabla(['Columna', 'Límite WIP', 'Significado', 'Regla de entrada'], [
    ['Por hacer (To Do)', 'Sin límite', 'Sprint backlog comprometido', 'La HU tiene criterios y estimación'],
    ['En curso (In Progress)', '2', 'Rama `feature/...` creada y en desarrollo', 'Solo si hay cupo: se termina antes de empezar otra'],
    ['En revisión (In Review)', '2', 'Pull Request abierto, pipeline corriendo y revisión', 'PR hacia `test` con checks en verde'],
    ['Listo (Done)', 'Sin límite', 'Cumple la Definition of Done', 'PR integrado y criterios verificados'],
  ], [2200, 1200, 3300, 2938]),
  espacio(),
  p('El límite WIP de 2 evita empezar muchas historias a la vez y dejar todo a medias: obliga a **terminar antes de empezar**. Como evidencia de flujo, en cada sprint las historias avanzaron escalonadas: mientras una estaba en Listo, otra estaba en revisión, otra en curso y otra por hacer.'),
  captura('Jira > Tablero del sprint con las 4 columnas, los límites WIP configurados e historias en distintas columnas (flujo)'),
  espacio(),
  captura('Jira > Tablero en otro momento del sprint (o informe de diagrama de flujo acumulado) mostrando el avance'),
  h2('2.6 Retrospectiva (feedback sándwich)'),
  li('**Lo bueno:** el pipeline con pruebas y seguridad detectó un problema real (CodeQL: falta de límite de peticiones en HU05) antes de llegar a producción.'),
  li('**Lo que no salió:** en el sprint 4 se comprometieron dos historias con dependencia de datos externos (ciclovías) sin verificarlos antes.'),
  li('**Compromiso:** refinar en el backlog grooming las historias con dependencias externas antes de meterlas al sprint y planificar con la velocidad real (≈18 puntos).'),
  salto(),
];

// ---------- P3 ----------
const devsecops = [
  ['Plan', 'Jira (Scrum, épicas, HU, sprints, Kanban)', 'Criterios de seguridad dentro de las HU (HU03 contraseñas cifradas, HU08 anti-spam y fuerza bruta, HU05 no guardar la ubicación del usuario)'],
  ['Code', 'VS Code, Git, GitHub (ramas `feature/*`, `test`, `main`)', 'Secretos solo en variables de entorno (`.env` en `.gitignore`); SQL parametrizado; validación de entradas; Helmet (CSP)'],
  ['Build', 'npm ci (versiones exactas del lock), `npm run check`', 'Instalación reproducible; `npm audit --omit=dev --audit-level=high` bloquea dependencias vulnerables'],
  ['Test', 'Jest + Supertest, PostgreSQL 16 como servicio del pipeline', 'Pruebas de las reglas de seguridad: autovalidación prohibida, voto duplicado, 429 por spam, credenciales genéricas, coordenadas fuera de Lima'],
  ['Release', 'Pull Request `test → main` (release por sprint)', 'Solo entra a producción lo que pasó build, pruebas, CodeQL (SAST) y gitleaks (secretos en todo el historial)'],
  ['Deploy', 'GitHub Actions + `azure/webapps-deploy@v3`', 'Publish profile en **GitHub Secrets**; credenciales de BD y `JWT_SECRET` en **App Settings** de Azure; prueba de humo a `/health`'],
  ['Operate', 'Azure App Service B1 Linux (Node 22) + PostgreSQL Flexible Server', 'HTTPS obligatorio, TLS 1.2, health check; PostgreSQL con SSL y firewall solo para servicios de Azure; límite de peticiones por IP'],
  ['Monitor', 'Azure Application Insights', 'Peticiones, errores, tiempos de respuesta y disponibilidad; alertas ante picos de errores 401/429 (posible ataque)'],
];
const p3 = [
  h1('P3. Arquitectura lógica y DevSecOps'),
  h2('3.1 Arquitectura lógica'),
  p('El diagrama lógico muestra **qué componentes hay y cómo se comunican**, sin depender del proveedor de nube: el frontend en el navegador, la API REST, la base de datos, la autenticación y los servicios externos. En el diagrama físico (Azure) solo cambian los nombres: la API vive en App Service, la base en PostgreSQL Flexible Server y el monitoreo en Application Insights.'),
  ...imagen(`${GRAF}/logica.png`, 640, 'Figura 4. Arquitectura lógica de BiciSegura Lima'),
  tabla(['Componente', 'Responsabilidad'], [
    ['Frontend (HTML, CSS, JS + Leaflet)', 'Vistas Mapa, Riesgo y Estadísticas; reportar tocando el mapa; votar; filtros; “Cerca de mí” calculado en el navegador (la ubicación del usuario no se envía al servidor)'],
    ['API REST (Node.js 22 + Express 5)', 'Endpoints `/api/eventos`, `/votos`, `/ya-no-esta`, `/calles/historial`, `/zonas/riesgo`, `/estadisticas/:distrito`, `/mapa-calor`'],
    ['Reglas de dominio (funciones puras)', '3 confirmaciones = verificado; autor no se autovalida; 1 voto por persona; vencimiento por tipo; semáforo; franja horaria. Se prueban sin base de datos'],
    ['Autenticación', 'Registro e inicio de sesión: contraseña con bcrypt y token JWT de 8 horas en `Authorization: Bearer`'],
    ['Base de datos (PostgreSQL 16)', 'Tablas usuarios, distritos, eventos, votos (PK evento+usuario) y cierres; CHECK de tipos y de coordenadas dentro de Lima'],
    ['Servicios externos', 'OpenStreetMap (mosaicos del mapa) y la API de geolocalización del navegador'],
    ['Monitoreo', 'Application Insights recibe la telemetría de la API'],
  ], [3000, 6638]),
  espacio(),
  h2('3.2 Herramientas por fase y seguridad shift-left'),
  p('DevOps une desarrollo, QA y operaciones en un ciclo continuo; **DevSecOps** agrega la seguridad en cada fase. **Shift-left** significa mover la seguridad a la izquierda del ciclo: detectar el problema cuando se escribe y se integra el código, que es cuando corregirlo es más barato, y no después de desplegar.'),
  tabla(['Fase', 'Herramienta', 'Control de seguridad (shift-left)'], devsecops.map(([f, h, s]) => [`**${f}**`, h, s]), [1300, 3400, 4938]),
  espacio(),
  h2('3.3 Justificación del stack frente al caso'),
  tabla(['Elección', 'Por qué para “Ciclistas en Lima”'], [
    ['Aplicación web responsiva (no app nativa)', 'El ciclista la abre desde el celular con un enlace, sin instalar nada; un solo código para móvil y escritorio, desplegable en 4 horas'],
    ['Leaflet + OpenStreetMap', 'Mapa libre y gratuito, sin clave de API ni costo por uso; buena cobertura de calles de Lima; capa de calor con leaflet.heat'],
    ['Node.js 22 + Express 5', 'JavaScript en frontend y backend; ideal para una API ligera con muchas lecturas cortas (consultar el mapa cada 30 s)'],
    ['PostgreSQL (relacional)', 'Las reglas del caso son de integridad: un voto por persona (clave primaria evento+usuario), tipos válidos y coordenadas dentro de Lima (CHECK); las estadísticas cruzan eventos, votos y distritos con consultas agregadas'],
    ['Azure App Service + PostgreSQL Flexible (Brazil South)', 'Plataforma administrada (PaaS) incluida en Azure for Students; región permitida más cercana a Perú para menor latencia'],
    ['GitHub Actions', 'El código ya está en GitHub; CI/CD, CodeQL y secretos en el mismo lugar, gratis para repositorios públicos'],
    ['Diseño inspirado en Apple (materiales translúcidos, tipografía del sistema)', 'Interfaz legible al aire libre, botones grandes y respuesta inmediata; respeta modo oscuro, movimiento reducido y transparencia reducida'],
  ], [3200, 6438]),
  salto(),
];

// ---------- P4 ----------
const prs = [
  ['#1', 'feature/EXAMPFC-6-infraestructura-azure', 'test', 'HU01 Infraestructura en Azure'],
  ['#2', 'feature/EXAMPFC-8-registro-inicio-sesion', 'test', 'HU03 Registro e inicio de sesión'],
  ['#3', 'feature/EXAMPFC-7-pipeline-ci-cd', 'test', 'HU02 Pipeline CI/CD'],
  ['#4', 'feature/EXAMPFC-9-mapa-eventos', 'test', 'HU04 Mapa en tiempo real'],
  ['#5', 'test', 'main', '**Release Sprint 1**'],
  ['#6', 'feature/EXAMPFC-10-reportar-evento', 'test', 'HU05 Reportar evento (incluye corrección por CodeQL)'],
  ['#7', 'feature/EXAMPFC-11-validacion-comunitaria', 'test', 'HU06 Verificación con 3 votos'],
  ['#8', 'feature/EXAMPFC-12-vencimiento-eventos', 'test', 'HU07 Vencimiento y “ya no está”'],
  ['#9', 'feature/EXAMPFC-13-limite-reportes', 'test', 'HU08 Límite contra spam'],
  ['#10', 'test', 'main', '**Release Sprint 2**'],
  ['#11', 'feature/EXAMPFC-14-historial-calle', 'test', 'HU09 Historial de la calle'],
  ['#12', 'feature/EXAMPFC-15-semaforo-riesgo', 'test', 'HU10 Semáforo de riesgo'],
  ['#13', 'feature/EXAMPFC-16-panel-estadisticas', 'test', 'HU11 Panel por distrito'],
  ['#14', 'feature/EXAMPFC-17-mapa-calor', 'test', 'HU12 Mapa de calor'],
  ['#15', 'test', 'main', '**Release Sprint 3**'],
  ['#16', 'feature/EXAMPFC-21-filtros-mapa', 'test', 'HU16 Filtros del mapa'],
  ['#17', 'feature/EXAMPFC-20-eventos-cerca-de-mi', 'test', 'HU15 Eventos cerca de mí'],
  ['#18', 'test', 'main', '**Release Sprint 4**'],
];
const wf = extracto(`${P}/.github/workflows/ci-cd.yml`, 20, 32) + '\n  ...\n' + extracto(`${P}/.github/workflows/ci-cd.yml`, 72, 95);
const p4 = [
  h1('P4. GitHub, pipeline y despliegue en la nube'),
  h2('4.1 Ramas, commits y Pull Requests'),
  p(`Repositorio: ${GH}`),
  li('**main:** producción. Solo recibe Pull Requests desde `test` al cierre de cada sprint (release); cada merge despliega en Azure.'),
  li('**test:** integración y pruebas del sprint. Recibe un Pull Request por historia.'),
  li('**feature/EXAMPFC-<n>-<descripcion>:** una rama por historia de Jira, por ejemplo `feature/EXAMPFC-11-validacion-comunitaria`. Así cada rama se justifica con una HU.'),
  li('**Commits descriptivos:** `EXAMPFC-<n> tipo: descripción` con tipo feat, fix, test, ci, docs o chore. Ejemplo: `EXAMPFC-11 feat: verificación con 3 confirmaciones de personas distintas`. La clave enlaza el commit con la historia en Jira.'),
  li('**Pull Request:** descripción con la HU, enlace a Jira, cambios, criterios de aceptación marcados y Definition of Done. Como la práctica es individual, la revisión es **propia y documentada** en cada PR (no se simulan revisores).'),
  tabla(['PR', 'Rama origen', 'Destino', 'Contenido'], prs, [700, 4300, 1000, 3638]),
  espacio(),
  captura('GitHub > Branches: main, test y las ramas feature/EXAMPFC-*'),
  espacio(),
  captura('GitHub > Pull requests (cerrados) con los PR por historia y los releases test → main'),
  espacio(),
  captura('Historial de commits descriptivos (GitHub > Commits de test)'),
  h2('4.2 Pipeline CI/CD (GitHub Actions)'),
  p('Workflow `.github/workflows/ci-cd.yml` con cuatro etapas y un workflow adicional de **CodeQL** para el análisis estático:'),
  tabla(['Job', 'Cuándo corre', 'Qué hace'], [
    ['1. Build', 'PR y push a test/main', '`npm ci` y revisión de sintaxis (`npm run check`)'],
    ['2. Pruebas automatizadas', 'Después de build', '39 pruebas (25 unitarias + 14 de integración contra un PostgreSQL 16 de servicio) con cobertura; publica el resultado en el resumen de la ejecución y guarda los reportes (JUnit y cobertura) como artefactos'],
    ['3. Seguridad', 'Después de build, en paralelo con pruebas', '**gitleaks** (secretos en todo el historial) y **npm audit** (dependencias; falla con vulnerabilidades altas)'],
    ['CodeQL (SAST)', 'PR y push a test/main', 'Análisis estático del código JavaScript con la suite `security-extended`'],
    ['4. Despliegue', 'Solo push a main con 2 y 3 en verde', 'Empaqueta dependencias de producción, despliega en Azure App Service y hace la prueba de humo contra `/health`'],
  ], [2000, 2400, 5238]),
  espacio(),
  ...codigo(wf, '.github/workflows/ci-cd.yml (extracto)'),
  captura('GitHub > Actions: ejecución exitosa en un PR (Build, Pruebas automatizadas, Seguridad y CodeQL en verde)'),
  espacio(),
  captura('GitHub > Actions: ejecución en main con el job "Despliegue en Azure App Service" en verde'),
  h2('4.3 Pruebas automatizadas visibles en el pipeline'),
  tabla(['Archivo', 'Tipo', 'Qué verifica', 'Pruebas'], [
    ['verificacion.test.js', 'Unitaria', '3 confirmaciones = verificado; autor no se autovalida; 1 voto por persona; descartado por desmentidos', '5'],
    ['vencimiento.test.js', 'Unitaria', 'Temporal vence a las 2 h; incidente pasa a historial a las 24 h; persistente se resuelve con 3 “ya no está”', '5'],
    ['limite-reportes.test.js', 'Unitaria', 'Límite de 10 reportes por hora', '2'],
    ['historial / riesgo / estadisticas / cerca', 'Unitaria', 'Conteos de 30 días solo verificados, semáforo, franja horaria, tendencia, distancia de 1 km', '13'],
    ['auth / reportes / validacion', 'Integración', 'Registro y login (bcrypt, JWT, error genérico), reporte con 401/400/429, votos con 409', '7'],
    ['mapa / estadisticas / filtros', 'Integración', 'Mapa en vivo, historial de calle, semáforo, panel, mapa de calor y filtros contra PostgreSQL real', '7'],
  ], [2700, 1200, 4838, 900]),
  espacio(),
  p('**Resultado:** 13 archivos, **39 pruebas en verde**; cobertura de sentencias **91.7 %** (líneas 95.2 %, funciones 93.3 %, ramas 77.7 %).'),
  captura('GitHub > Actions > resumen de la ejecución con la tabla de pruebas y cobertura'),
  h2('4.4 Seguridad en el pipeline y en la aplicación'),
  tabla(['Control', 'Herramienta', 'Evidencia'], [
    ['SAST (análisis estático)', 'CodeQL `security-extended`', 'En el PR #6 detectó **“Missing rate limiting”** (severidad alta) en la ruta de reportes; se corrigió en la misma rama con un límite de peticiones por IP y el análisis volvió a verde'],
    ['Análisis de dependencias', '`npm audit --audit-level=high`', 'Sin vulnerabilidades altas en dependencias de producción'],
    ['Escaneo de secretos', 'gitleaks 8.24.3 sobre todo el historial', 'Sin secretos detectados; credenciales solo en GitHub Secrets y App Settings'],
    ['Aplicación', 'Helmet (CSP), express-rate-limit, bcrypt, JWT, SQL parametrizado', 'CSP solo permite scripts propios y mosaicos de OpenStreetMap; 120 peticiones/min por IP; 20 intentos de login cada 15 min; 10 reportes/hora por usuario'],
    ['Infraestructura', 'Azure', 'HTTPS obligatorio y TLS 1.2; PostgreSQL con SSL obligatorio y firewall solo para servicios de Azure'],
  ], [2200, 2700, 4738]),
  espacio(),
  captura('GitHub > Security > Code scanning: alerta de CodeQL del PR #6 cerrada (corregida)'),
  h2('4.5 Despliegue en la nube con URL pública'),
  tabla(['Recurso (grupo bicisegura-lima-az, Brazil South)', 'Uso'], [
    ['App Service `bicisegura-lima` (plan B1 Linux, Node 22)', 'API y frontend; HTTPS, health check en `/health`'],
    ['PostgreSQL Flexible Server `pg-bicisegura-lima` (B1ms)', 'Base de datos `bicisegura` con SSL y firewall'],
    ['Application Insights `appi-bicisegura-lima`', 'Monitoreo de peticiones, errores y tiempos'],
  ], [4800, 4838]),
  espacio(),
  tabla(['Dato', 'Valor'], [
    ['URL pública', URL_APP],
    ['Health check', `${URL_APP}/health → {"status":"ok","db":"ok"}`],
    ['Cuentas demo', 'ana@demo.pe, luis@demo.pe, maria@demo.pe … (contraseña Demo1234!)'],
  ], [2400, 7238]),
  espacio(),
  captura('Portal de Azure: grupo de recursos bicisegura-lima-az con App Service, PostgreSQL y Application Insights'),
  espacio(),
  captura(`Aplicación funcionando en ${URL_APP}: mapa con eventos verificados y no verificados`),
  espacio(),
  captura('Aplicación: detalle de un evento con "2 de 3 confirmaciones" y el historial de la calle'),
  espacio(),
  captura('Aplicación: vista Riesgo (semáforo por distrito) y vista Estadísticas (panel por distrito)'),
  salto(),
];

const preguntas = [
  ['¿Cómo evitan los reportes falsos?', '3 confirmaciones de personas distintas para verificar; el autor no puede confirmar lo suyo; 1 voto por persona (PK evento+usuario); 3 desmentidos descartan; 10 reportes/hora por usuario; las estadísticas usan solo verificados.'],
  ['¿Por qué 3 confirmaciones?', 'Es el mínimo que hace costoso falsear un evento (harían falta 3 cuentas coludidas) sin demorar demasiado la verificación. Es configurable en una constante del dominio.'],
  ['¿Cómo desaparece un evento?', 'Según su categoría: incidente (robo, accidente) sale del mapa a las 24 h y queda en el historial; temporal (vehículo en ciclovía) vence a las 2 h sin reconfirmación; persistente (enrejada, mal estado) se resuelve con 3 votos “ya no está”.'],
  ['¿Qué es una épica y qué una HU?', 'Épica: bloque grande de valor con objetivo de negocio, que se divide en HU. HU: necesidad de un usuario en formato Como… quiero… para…, con criterios Dado/Cuando/Entonces.'],
  ['¿Qué es MoSCoW?', 'Priorización: Must (imprescindible), Should (importante), Could (deseable), Won’t (no en esta versión). Ej.: HU20 reputación es Won’t porque la regla de 3 votos ya da confiabilidad.'],
  ['¿Qué es un story point y cómo estimaste?', 'Medida relativa de complejidad, esfuerzo e incertidumbre. Planning poker con Fibonacci: votación simultánea, se discuten los extremos y se vuelve a votar.'],
  ['¿Cómo se lee el burndown?', 'Eje Y: puntos pendientes; eje X: días. Ideal = recta hasta 0. Real = baja cuando una HU llega a Listo. Si la real queda arriba, el sprint va atrasado.'],
  ['¿Qué es la velocidad y para qué sirve?', 'Puntos completados por sprint (21, 21, 21, 7; promedio 17.5). Sirve para planificar cuánto comprometer en el siguiente sprint.'],
  ['¿Qué pasa con HU13 y HU14?', 'No cumplieron la DoD, así que al cerrar el sprint 4 vuelven al Product Backlog. En Scrum no se cuentan puntos de historias a medio terminar.'],
  ['¿Qué es el límite WIP?', 'Máximo de tarjetas por columna (2 en curso, 2 en revisión). Obliga a terminar antes de empezar y deja ver los cuellos de botella.'],
  ['¿Diferencia entre arquitectura lógica y física?', 'Lógica: componentes y cómo se comunican (frontend → API → reglas → BD). Física: infraestructura real (App Service, PostgreSQL Flexible, App Insights, región Brazil South). La lógica no cambia, cambian los nombres.'],
  ['¿Qué es shift-left?', 'Mover la seguridad al inicio del ciclo: CodeQL, gitleaks y npm audit en cada PR, antes de llegar a producción, donde corregir es más barato. Ej.: CodeQL detectó la falta de rate limiting en el PR #6.'],
  ['¿Diferencia entre SAST, análisis de dependencias y escaneo de secretos?', 'SAST (CodeQL) revisa nuestro código sin ejecutarlo; dependencias (npm audit) revisa librerías de terceros con CVE conocidas; secretos (gitleaks) busca claves o contraseñas subidas al repositorio.'],
  ['¿Qué pasa si una prueba falla?', 'El job de pruebas falla, el PR no se integra y el despliegue no corre (depende de pruebas y seguridad).'],
  ['¿Por qué rama test además de main?', 'test integra las historias del sprint y se prueba; main solo recibe releases estables y cada merge despliega. Así main siempre está desplegable.'],
  ['¿Dónde están los secretos?', 'Publish profile en GitHub Secrets; DATABASE_URL y JWT_SECRET en App Settings de Azure. Nunca en el código; gitleaks lo verifica en cada ejecución.'],
  ['¿Por qué PostgreSQL y no NoSQL?', 'Las reglas son de integridad: un voto por persona (PK compuesta), tipos y coordenadas válidas (CHECK), FK entre eventos, votos y distritos; las estadísticas son consultas agregadas.'],
  ['¿Por qué Brazil South?', 'Es la región permitida por Azure for Students más cercana a Perú: menor latencia para los usuarios de Lima.'],
  ['¿Cómo se protege la base de datos?', 'SSL obligatorio, firewall que solo acepta servicios de Azure, contraseña en App Settings y consultas parametrizadas contra inyección SQL.'],
  ['¿Usaste IA? ¿Cómo la controlaste?', 'Sí, con human in the loop: revisé y entiendo cada parte; las pruebas automáticas y el pipeline verifican lo generado. Triángulo de la IA: ética (la responsabilidad es mía), lógica (GIGO) y estética (criterios objetivos).'],
];
const anexo = [
  h1('Anexo A. Preguntas probables de la sustentación'),
  tabla(['Pregunta', 'Respuesta corta'], preguntas, [3200, 6438]),
  espacio(),
  h1('Anexo B. Ejecución local'),
  ...codigo([
    'npm install',
    'export DATABASE_URL=postgres://usuario:clave@localhost:5432/bicisegura',
    'export JWT_SECRET=un-secreto-largo',
    'npm run migrate        # tablas, 10 distritos y datos demo (idempotente)',
    'npm run dev            # http://localhost:3000',
    'npm test               # 39 pruebas (integración requiere DATABASE_URL)',
    '',
    'Cuentas demo (contraseña Demo1234!): ana@demo.pe, luis@demo.pe, maria@demo.pe, ...',
  ].join('\n')),
];


const encabezado = () => new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'PC2 PFC III · Ciclistas en Lima · BiciSegura Lima', size: 16, color: '808080' })] })] });
const pie = () => new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], size: 16, color: '808080' })] })] });
function seccion(children, horizontal = false) {
  return {
    properties: { page: { size: { width: 11906, height: 16838, orientation: horizontal ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    headers: { default: encabezado() },
    footers: { default: pie() },
    children,
  };
}
const doc = new Document({
  creator: 'Estudiante PFC III',
  title: 'PC2 PFC III — BiciSegura Lima',
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 32, bold: true, color: AZUL }, paragraph: { spacing: { before: 240, after: 160 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true, color: '2E75B6' }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 22, bold: true, color: '404040' }, paragraph: { spacing: { before: 160, after: 80 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [
    { reference: 'vinetas', levels: [
      { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
      { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 270 } } } },
    ] },
    { reference: 'numeros', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
    { reference: 'dod', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
    ...backlog.historias.map((h) => ({ reference: `crit${h.id}`, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] })),
  ] },
  features: { updateFields: true },
  sections: [seccion([...portada, ...indice, ...intro, ...p1, ...p2, ...p3, ...p4, ...anexo])],
});

const salida = process.argv[2] || `${P}/docs/informe/Informe_PC2_BiciSegura.docx`;
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(salida, buf); console.log('OK', salida, buf.length); });
