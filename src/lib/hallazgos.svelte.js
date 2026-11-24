// Hallazgos: las fichas de Historia que llegan cada semana sin actualizar la app.
// Orden de carga: lo guardado en este equipo → la copia que viene con la app → la versión publicada en GitHub.
// Si no hay internet, se queda con lo último que tenía. Nunca ejecuta nada remoto: solo lee datos y los valida.
import { depurar } from './hallazgosEsquema.js';

const REMOTO = 'https://raw.githubusercontent.com/XristosKidonis/aleph/refs/heads/contenido/historia/hallazgos.json';
const LOCAL = `${import.meta.env.BASE_URL}historia/hallazgos.json`;
const GUARDADO = 'aleph.hallazgos';
const VISTOS = 'aleph.hallazgos.vistos';

const leer = (clave, defecto) => { try { return JSON.parse(localStorage.getItem(clave)) ?? defecto; } catch { return defecto; } };
const guardar = (clave, valor) => { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento: se usa en memoria */ } };

// Numeradas de la más vieja (01) a la más nueva, que va primero; «figura» las distingue de las de Jesús y Juan
const preparar = (lista) => lista?.map((h, i) => ({ ...h, figura: 'hallazgo', num: String(lista.length - i).padStart(2, '0') }));

export const hallazgos = $state({ lista: preparar(depurar(leer(GUARDADO, null))) || [], vistos: leer(VISTOS, []) });

async function traer(url, ms) {
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ms);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: corte.signal });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

let pedido = null;
// Una vez por sesión de la app; las llamadas repetidas esperan la misma descarga
export function cargarHallazgos() {
  pedido ||= (async () => {
    if (!hallazgos.lista.length) {
      const base = preparar(depurar(await traer(LOCAL, 4000)));
      if (base) hallazgos.lista = base;
    }
    // En desarrollo y en las pruebas basta la copia local: así un 404 del remoto (sin internet, o la rama
    // todavía sin publicar) no ensucia la consola ni hace fallar pruebas/navegador.mjs
    if (import.meta.env.DEV) return;
    const datos = await traer(REMOTO, 8000);
    const lista = preparar(depurar(datos));
    if (lista) {
      hallazgos.lista = lista;
      guardar(GUARDADO, datos);
    }
  })();
  return pedido;
}

export const esNuevo = (id) => !hallazgos.vistos.includes(id);
export const cuantosNuevos = () => hallazgos.lista.filter((h) => esNuevo(h.id)).length;
export function marcarVisto(id) {
  if (!esNuevo(id)) return;
  hallazgos.vistos = [...hallazgos.vistos, id];
  guardar(VISTOS, hallazgos.vistos);
}

// Para «¿Facto o fake?»: las preguntas que traen los hallazgos, con la misma forma que PREGUNTAS
export const preguntasHallazgos = () =>
  hallazgos.lista.filter((h) => h.pregunta).map((h) => ({ prueba: h.id, respuesta: h.pregunta.respuesta, texto: h.pregunta.texto }));
export const hallazgo = (id) => hallazgos.lista.find((h) => h.id === id);
