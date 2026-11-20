// Convierte reports/junit.xml y coverage/coverage-summary.json en una tabla Markdown para el resumen de GitHub Actions.
const fs = require('node:fs');
let xml = '';
try { xml = fs.readFileSync('reports/junit.xml', 'utf8'); } catch { console.log('No se generó reports/junit.xml'); process.exit(0); }
const attr = (s, n) => Number((s.match(new RegExp(`${n}="(\\d+)"`)) || [])[1] || 0);
const raiz = xml.match(/<testsuites[^>]*>/)[0];
const total = attr(raiz, 'tests');
const fallas = attr(raiz, 'failures') + attr(raiz, 'errors');
console.log(`## Resultados de pruebas ${fallas ? '❌' : '✅'}\n`);
console.log(`**${total - fallas} de ${total} pruebas pasaron**\n`);
console.log('| Suite | Pruebas | Fallas |\n| --- | --- | --- |');
for (const s of xml.match(/<testsuite [^>]*>/g) || []) {
  const nombre = ((s.match(/name="([^"]*)"/) || [])[1] || '').replace(/&quot;/g, '"');
  console.log(`| ${nombre} | ${attr(s, 'tests')} | ${attr(s, 'failures') + attr(s, 'errors')} |`);
}
try {
  const c = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8')).total;
  console.log(`\n**Cobertura:** sentencias ${c.statements.pct}% · ramas ${c.branches.pct}% · funciones ${c.functions.pct}% · líneas ${c.lines.pct}%`);
} catch { /* sin cobertura */ }
