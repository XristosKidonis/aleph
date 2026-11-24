// Voz natural con IA (Piper), dentro de la app y sin internet una vez descargada.
// - El modelo de cada voz (~63 MB) viene de Hugging Face (rhasspy/piper-voices).
// - El motor de pronunciación (piper-phonemize con eSpeak NG, GPL) se descarga aparte la primera vez desde
//   jsDelivr: no va dentro del instalador. El de inferencia (ONNX Runtime, MIT) sí viene con la app.
// Todo queda guardado en IndexedDB; después funciona sin conexión.
import { esTauri, pedir } from './bd.js';

const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/';
const FONEMAS = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';
export const MOTOR = [`${FONEMAS}.js`, `${FONEMAS}.wasm`, `${FONEMAS}.data`];
export const MOTOR_MB = 19;
// Huella SHA-256 de cada archivo del motor (la misma que publica jsDelivr para la versión 1.0.0). El .js se
// ejecuta dentro de la app: si lo que llega o lo guardado no coincide byte a byte, no se usa.
const HUELLAS = {
  [`${FONEMAS}.js`]: 'fef0c2fc442d24fdef5c7c7cc37d5da2314407640fe11ab1bfe347c723dff19b',
  [`${FONEMAS}.wasm`]: 'b777cd107a91d2bcc6a1ea46f2c26a662a7407394fe84589198aeaa83dd7a9d6',
  [`${FONEMAS}.data`]: '29f1025eb23a5b5c192cd14a6efbce4509402ff265405072ee6f7d1a09b78f8c',
};
async function comprobarHuella(url, blob) {
  const esperada = HUELLAS[url];
  if (!esperada) return blob;
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  const hex = [...hash].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (hex !== esperada) throw new Error(`El archivo ${url.split('/').pop()} no coincide con el original; no se usará.`);
  return blob;
}

// Solo voces con licencia libre para cualquier uso (se dejaron fuera las «no comerciales»)
export const VOCES_NEURALES = [
  { id: 'es_MX-claude-high', lang: 'es', nombre: 'Claude', acento: { es: 'México', en: 'Mexico' }, ruta: 'es/es_MX/claude/high/es_MX-claude-high.onnx', mb: 63, licencia: 'Apache 2.0' },
  { id: 'es_MX-ald-medium', lang: 'es', nombre: 'Ald', acento: { es: 'México', en: 'Mexico' }, ruta: 'es/es_MX/ald/medium/es_MX-ald-medium.onnx', mb: 63, licencia: 'Unlicense' },
  { id: 'es_AR-daniela-high', lang: 'es', nombre: 'Daniela', acento: { es: 'Argentina', en: 'Argentina' }, ruta: 'es/es_AR/daniela/high/es_AR-daniela-high.onnx', mb: 114, licencia: 'CC BY-SA 4.0' },
  { id: 'es_ES-davefx-medium', lang: 'es', nombre: 'Dave', acento: { es: 'España', en: 'Spain' }, ruta: 'es/es_ES/davefx/medium/es_ES-davefx-medium.onnx', mb: 63, licencia: 'CC0' },
  { id: 'en_US-kristin-medium', lang: 'en', nombre: 'Kristin', acento: { es: 'EE. UU.', en: 'US' }, ruta: 'en/en_US/kristin/medium/en_US-kristin-medium.onnx', mb: 64, licencia: { es: 'Dominio público', en: 'Public domain' } },
  { id: 'en_US-john-medium', lang: 'en', nombre: 'John', acento: { es: 'EE. UU.', en: 'US' }, ruta: 'en/en_US/john/medium/en_US-john-medium.onnx', mb: 64, licencia: { es: 'Dominio público', en: 'Public domain' } },
  { id: 'en_US-ljspeech-medium', lang: 'en', nombre: 'Linda', acento: { es: 'EE. UU.', en: 'US' }, ruta: 'en/en_US/ljspeech/medium/en_US-ljspeech-medium.onnx', mb: 64, licencia: { es: 'Dominio público', en: 'Public domain' } },
  { id: 'en_GB-cori-medium', lang: 'en', nombre: 'Cori', acento: { es: 'Reino Unido', en: 'UK' }, ruta: 'en/en_GB/cori/medium/en_GB-cori-medium.onnx', mb: 64, licencia: { es: 'Dominio público', en: 'Public domain' } },
];
export const vozNeural = (id) => VOCES_NEURALES.find((v) => v.id === id);
const archivosDe = (v) => [`${HF}${v.ruta}`, `${HF}${v.ruta}.json`];

// ---------- almacén (IndexedDB) ----------
let bd;
function abrir() {
  bd ??= new Promise((ok, mal) => {
    const r = indexedDB.open('chiro-voces', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('archivos');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
  return bd;
}
async function operar(modo, fn) {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const tx = db.transaction('archivos', modo);
    const r = fn(tx.objectStore('archivos'));
    tx.oncomplete = () => ok(r?.result);
    tx.onerror = () => mal(tx.error);
  });
}
const leerArchivo = (url) => operar('readonly', (s) => s.get(url));
const guardarArchivo = (url, blob) => operar('readwrite', (s) => s.put(blob, url));
const borrarArchivo = (url) => operar('readwrite', (s) => s.delete(url));
const tieneArchivo = async (url) => !!(await operar('readonly', (s) => s.getKey(url)));

export async function instalada(id) {
  const v = vozNeural(id);
  if (!v) return false;
  for (const u of [...MOTOR, ...archivosDe(v)]) if (!(await tieneArchivo(u))) return false;
  return true;
}

// Baja un archivo contando bytes. En el navegador basta fetch (Hugging Face y jsDelivr permiten CORS);
// en la app de escritorio, si el WebView lo bloquea, se pide por el plugin HTTP de Tauri.
async function bajar(url, alAvanzar) {
  let r;
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(new Error('sin respuesta en 20 s')), 20000); // solo hasta las cabeceras
  try {
    r = await fetch(url, { signal: corte.signal });
    clearTimeout(reloj);
  } catch (e) {
    clearTimeout(reloj);
    if (!esTauri) throw e;
    r = await pedir(url);
  }
  if (!r.ok) throw new Error(`${r.status} · ${url.split('/').pop()}`);
  const total = Number(r.headers.get('content-length')) || 0;
  if (!r.body?.getReader) { const b = await r.blob(); alAvanzar(b.size, b.size); return b; }
  const lector = r.body.getReader();
  const partes = [];
  let n = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    partes.push(value);
    n += value.length;
    alAvanzar(n, total);
  }
  return new Blob(partes);
}

// Descarga lo que falte (motor + voz). alAvanzar(fracción 0..1)
export async function instalar(id, alAvanzar = () => {}) {
  const v = vozNeural(id);
  const faltan = [];
  for (const u of [...MOTOR, ...archivosDe(v)]) if (!(await tieneArchivo(u))) faltan.push(u);
  const estimado = (u) => (u.endsWith('.data') ? 18.1e6 : u.endsWith('.onnx') ? v.mb * 1e6 : 0.7e6);
  const total = faltan.reduce((a, u) => a + estimado(u), 0) || 1;
  let hecho = 0;
  for (const u of faltan) {
    const blob = await comprobarHuella(u, await bajar(u, (n) => alAvanzar(Math.min(1, (hecho + n) / total))));
    await guardarArchivo(u, blob);
    hecho += estimado(u);
  }
  alAvanzar(1);
}

// Borra la voz; el motor solo si ya no queda ninguna voz
export async function borrar(id) {
  for (const u of archivosDe(vozNeural(id))) await borrarArchivo(u);
  let otra = false;
  for (const x of VOCES_NEURALES) if (x.id !== id && (await tieneArchivo(`${HF}${x.ruta}`))) otra = true;
  if (!otra) for (const u of MOTOR) await borrarArchivo(u);
}

// ---------- síntesis ----------
let ort = null;
let crearFonemizador = null;
let binarios = null; // { wasm: ArrayBuffer, data: ArrayBuffer }
const sesiones = new Map(); // id -> { sesion, config }

async function preparar(id) {
  if (!ort) {
    ort = await import('onnxruntime-web/wasm'); // su .wasm viene empaquetado con la app
    ort.env.wasm.numThreads = 1; // sin aislamiento de origen no hay hilos
  }
  if (!crearFonemizador) {
    // se vuelve a comprobar lo guardado: IndexedDB se puede tocar desde fuera de la app (otra página del mismo origen)
    const leer = async (u) => comprobarHuella(u, await leerArchivo(u)).catch(async (e) => { await borrarArchivo(u); throw e; });
    const codigo = await (await leer(`${FONEMAS}.js`)).text();
    crearFonemizador = new Function(`${codigo}\nreturn createPiperPhonemize;`)();
    binarios = {
      wasm: await (await leer(`${FONEMAS}.wasm`)).arrayBuffer(),
      data: await (await leer(`${FONEMAS}.data`)).arrayBuffer(),
    };
  }
  if (!sesiones.has(id)) {
    const v = vozNeural(id);
    const [modelo, config] = archivosDe(v);
    const bytes = new Uint8Array(await (await leerArchivo(modelo)).arrayBuffer());
    const sesion = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
    sesiones.set(id, { sesion, config: JSON.parse(await (await leerArchivo(config)).text()) });
  }
  return sesiones.get(id);
}

// Texto → números de fonemas, con eSpeak NG (un módulo nuevo por llamada: callMain no se puede repetir)
function fonemas(texto, vozEspeak) {
  return new Promise((ok, mal) => {
    let listo = false;
    crearFonemizador({
      wasmBinary: binarios.wasm,
      getPreloadedPackage: () => binarios.data,
      noInitialRun: true,
      print: (linea) => { if (!listo) { listo = true; ok(JSON.parse(linea).phoneme_ids); } },
      printErr: () => {},
      locateFile: (u) => u,
    }).then((m) => {
      m.callMain(['-l', vozEspeak, '--input', JSON.stringify([{ text: texto }]), '--espeak_data', '/espeak-ng-data']);
    }).catch(mal);
  });
}

// Parte el texto en frases (Piper suena mejor y responde antes con trozos cortos)
export function frases(texto, max = 260) {
  const partes = texto.match(/[^.!?;:]+[.!?;:]*["»”’)]*\s*/g) || [texto];
  const out = [];
  let act = '';
  for (const p of partes) {
    if ((act + p).length > max && act) { out.push(act.trim()); act = ''; }
    act += p;
  }
  if (act.trim()) out.push(act.trim());
  return out;
}

// Devuelve { pcm: Float32Array, frecuencia } para un texto. velocidad: 1 = normal, 1.3 = más rápido
export async function sintetizar(id, texto, velocidad = 1) {
  const { sesion, config } = await preparar(id);
  const ids = await fonemas(texto, config.espeak.voice);
  const inf = config.inference || {};
  const entradas = {
    input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor('float32', Float32Array.from([inf.noise_scale ?? 0.667, (inf.length_scale ?? 1) / velocidad, inf.noise_w ?? 0.8]), [3]),
  };
  if (Object.keys(config.speaker_id_map || {}).length) entradas.sid = new ort.Tensor('int64', BigInt64Array.from([0n]), [1]);
  const salida = await sesion.run(entradas);
  return { pcm: salida.output.data, frecuencia: config.audio?.sample_rate || 22050 };
}
