import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// En modo navegador sirve datos/biblias.db en /biblias.db (desarrollo) o la copia junto a la web (versión web).
// En la app de escritorio la base viaja como recurso de Tauri.
// Junto a la base va biblias.version: «huella tamaño». La web guarda la base en el navegador y solo la vuelve a
// bajar si la huella cambió; el tamaño real le sirve para reservar la memoria justa, porque GitHub Pages manda
// la base comprimida y su Content-Length es el del archivo comprimido, no el de los datos.
const BASE = path.resolve('datos/biblias.db');
let huellaGuardada = null; // { mtime, huella }: calcularla lee 170 MB, así que se recuerda mientras el archivo no cambie
function huellaBase() {
  const mtime = fs.statSync(BASE).mtimeMs;
  if (huellaGuardada?.mtime !== mtime) {
    const datos = fs.readFileSync(BASE);
    huellaGuardada = { mtime, huella: `${crypto.createHash('sha256').update(datos).digest('hex').slice(0, 16)} ${datos.length}` };
  }
  return huellaGuardada.huella;
}
const servirBiblias = {
  name: 'servir-biblias',
  writeBundle(opciones) {
    if (!process.env.WEB) return;
    fs.copyFileSync(BASE, path.join(opciones.dir, 'biblias.db'));
    fs.writeFileSync(path.join(opciones.dir, 'biblias.version'), huellaBase());
  },
  configureServer(server) {
    const falta = (res) => { res.statusCode = 404; res.end('Falta datos/biblias.db: ejecuta «npm run datos».'); };
    server.middlewares.use('/biblias.version', (req, res) => {
      if (!fs.existsSync(BASE)) return falta(res);
      res.setHeader('Content-Type', 'text/plain');
      res.end(huellaBase());
    });
    server.middlewares.use('/biblias.db', (req, res) => {
      if (!fs.existsSync(BASE)) return falta(res);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', fs.statSync(BASE).size); // la web copia la base por partes y necesita saber el tamaño
      fs.createReadStream(BASE).pipe(res);
    });
  },
};

// Política de seguridad de la versión web: solo corre el código de la propia app, y solo se conecta con los
// servicios que usa (Tyndale, Bible Brain, Hugging Face y jsDelivr para la voz natural).
// - 'wasm-unsafe-eval': SQLite y ONNX Runtime son WebAssembly.
// - 'unsafe-eval': el motor de pronunciación de la voz natural se ejecuta con new Function (se comprueba su
//   huella SHA-256 antes; ver vozNeural.js).
// - style 'unsafe-inline': Svelte escribe estilos en línea (style:width…).
// - media https:: el audio de Bible.is llega de su CDN, con URLs firmadas.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' blob:",
  "connect-src 'self' https://api.nlt.to https://4.dbt.io https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: data: https:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');
const politicaWeb = {
  name: 'politica-web',
  transformIndexHtml(html) {
    if (!process.env.WEB) return html;
    return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
  },
};

// WEB=1 arma la versión web de prueba (GitHub Pages), que vive en /aleph/ (el repo se llamaba chi-ro-heirs hasta 2026-11-24).
export default defineConfig({
  base: process.env.WEB ? '/aleph/' : '/',
  plugins: [svelte(), servirBiblias, politicaWeb],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm', 'onnxruntime-web'] },
  build: { target: 'es2022', sourcemap: false },
});
