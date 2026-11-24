// Candado al abrir: la app pide una contraseña antes de mostrar nada. Solo frena a quien abre la app en
// tu equipo; las notas siguen guardadas como siempre (quien copie usuario.db y sepa leerlo, las lee).
// Nunca se guarda la contraseña: solo una sal al azar y el resultado de PBKDF2 (SHA-256).
import { esTauri } from './bd.js';

const VUELTAS = 210000;
const LARGO_MINIMO = 4;
// Si olvidas la contraseña: un archivo vacío con este nombre en la carpeta de datos quita el candado al abrir.
const ARCHIVO_OLVIDO = 'quitar-candado.txt';

// En la web pública no se ofrece: allí, quitarlo exigiría borrar los datos del sitio (y con ellos tus notas).
// En desarrollo sí, para poder probarlo en el navegador.
export const puedeCandado = esTauri || import.meta.env.DEV;
export const claveValida = (clave) => typeof clave === 'string' && clave.length >= LARGO_MINIMO;

const aBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const deBase64 = (texto) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));

async function derivar(clave, sal, vueltas) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: vueltas }, base, 256);
}

export async function crearCandado(clave) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return { sal: aBase64(sal), hash: aBase64(await derivar(clave, sal, VUELTAS)), vueltas: VUELTAS };
}

export async function abreCandado(candado, clave) {
  if (!candado?.sal || !candado?.hash || typeof clave !== 'string') return false;
  const prueba = aBase64(await derivar(clave, deBase64(candado.sal), Number(candado.vueltas) || VUELTAS));
  // comparación sin cortar al primer carácter distinto
  let distinto = prueba.length ^ candado.hash.length;
  for (let i = 0; i < prueba.length; i++) distinto |= prueba.charCodeAt(i) ^ candado.hash.charCodeAt(i % candado.hash.length);
  return distinto === 0;
}

// ¿Dejaste el archivo para quitar el candado? Se borra el archivo y se avisa que hay que quitarlo.
export async function pidioQuitarCandado() {
  if (!esTauri) return false;
  try {
    const { exists, remove, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    if (!(await exists(ARCHIVO_OLVIDO, { baseDir: BaseDirectory.AppConfig }))) return false;
    await remove(ARCHIVO_OLVIDO, { baseDir: BaseDirectory.AppConfig });
    return true;
  } catch (e) {
    console.warn('No se pudo revisar el archivo para quitar el candado', e);
    return false;
  }
}

// La carpeta donde va ese archivo, para decírtela en la pantalla del candado
export async function carpetaDatos() {
  if (!esTauri) return '';
  const { appConfigDir } = await import('@tauri-apps/api/path');
  return appConfigDir();
}

export { ARCHIVO_OLVIDO };
