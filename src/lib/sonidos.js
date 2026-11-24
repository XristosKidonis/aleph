// Sonidos de la interfaz: el pack «Zen» de UI SFX (uisfx.com, CC0; papel, pincel, madera y campanitas), elegido
// por el dueño. Doce señales cortas para momentos puntuales, no para cada clic. Se apagan en Ajustes (ajuste «sonidos»).
import { usuario } from './usuario.svelte.js';

// volumen de cada señal según el manifiesto de UI SFX, por un factor común
const VOLUMEN = { press: 0.2, select: 0.2, check: 0.17, uncheck: 0.15, copy: 0.15, open: 0.18, close: 0.17, swipe: 0.14, success: 0.23, error: 0.22, complete: 0.24, unlock: 0.2 };
const FACTOR = 1.5;
const SEPARACION = 90; // ms: la misma señal no se repite más seguido (doble clic, efectos que se encadenan)

let ctx = null;
const buffers = new Map();
const ultima = new Map();

function contexto() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  return AC ? (ctx = new AC()) : null;
}

function cargar(c, senal) {
  if (!buffers.has(senal)) {
    buffers.set(senal, fetch(`${import.meta.env.BASE_URL}sonidos/zen/${senal}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then((datos) => c.decodeAudioData(datos))
      .catch(() => { buffers.delete(senal); return null; }));
  }
  return buffers.get(senal);
}

export function sonar(senal) {
  if (!usuario.ajustes.sonidos || !(senal in VOLUMEN)) return;
  const ahora = performance.now();
  if (ahora - (ultima.get(senal) || 0) < SEPARACION) return;
  ultima.set(senal, ahora);
  const c = contexto();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  cargar(c, senal).then((buffer) => {
    if (!buffer) return;
    const fuente = c.createBufferSource();
    const ganancia = c.createGain();
    fuente.buffer = buffer;
    ganancia.gain.value = VOLUMEN[senal] * FACTOR;
    fuente.connect(ganancia).connect(c.destination);
    fuente.start();
  });
}
