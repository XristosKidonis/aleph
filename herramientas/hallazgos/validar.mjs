// Revisa un hallazgos.json antes de publicarlo: formato, los dos idiomas, versículos que existen,
// enlaces https e imágenes solo de Wikimedia Commons. Con --enlaces, además prueba que cada enlace abra.
//   node herramientas/hallazgos/validar.mjs <ruta/a/hallazgos.json> [--enlaces]
// Sale con código 1 si algo falla, para que la rutina semanal no publique.
import { readFileSync } from 'node:fs';
import { problemas, VERSION } from '../../src/lib/hallazgosEsquema.js';

const [ruta, opcion] = process.argv.slice(2);
if (!ruta) {
  console.error('Uso: node herramientas/hallazgos/validar.mjs <hallazgos.json> [--enlaces]');
  process.exit(2);
}

let datos;
try {
  datos = JSON.parse(readFileSync(ruta, 'utf8'));
} catch (e) {
  console.error(`✕ No se pudo leer ${ruta}: ${e.message}`);
  process.exit(1);
}

const errores = [];
if (datos.version !== VERSION) errores.push(`version: debe ser ${VERSION}`);
if (!Array.isArray(datos.hallazgos)) errores.push('hallazgos: debe ser una lista');
const lista = Array.isArray(datos.hallazgos) ? datos.hallazgos : [];
const ids = new Set();
for (const h of lista) {
  const nombre = h?.id || '(sin id)';
  if (ids.has(nombre)) errores.push(`${nombre}: id repetido`);
  ids.add(nombre);
  for (const p of problemas(h)) errores.push(`${nombre}: ${p}`);
}

async function abre(url) {
  // Algunos museos bloquean a los robots (403): eso no es un enlace roto
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (aleph-hallazgos)' }, signal: AbortSignal.timeout(15000) });
    return r.ok || r.status === 403 || r.status === 429 ? null : `HTTP ${r.status}`;
  } catch (e) {
    return e.name === 'TimeoutError' ? 'no respondió en 15 s' : e.message;
  }
}

if (opcion === '--enlaces') {
  for (const h of lista.filter((x) => !x.retirado)) {
    for (const url of [h.fuente, h.noticia, h.imagen?.src, h.imagen?.pagina].filter(Boolean)) {
      const fallo = await abre(url);
      if (fallo) errores.push(`${h.id}: el enlace no abre (${fallo}) ${url}`);
    }
  }
}

if (errores.length) {
  console.error(`✕ ${errores.length} problema(s):\n  - ${errores.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✓ ${lista.length} hallazgo(s) en orden${opcion === '--enlaces' ? ', enlaces comprobados' : ''}.`);
