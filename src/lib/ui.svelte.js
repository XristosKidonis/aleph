// Estado de la interfaz (no se guarda): selección, panel abierto, capítulo cargado, avisos.
import { flushSync } from 'svelte';
import { usuario, irA as guardarPosicion } from './usuario.svelte.js';
import { capitulo as cargarCapitulo, info } from './biblia.js';
import { clave, nombreRef, nombreLibro, LIBROS } from './libros.js';

export const ui = $state({
  vista: 'inicio',      // 'inicio' | 'biblioteca' | 'lector' | 'archivo' | 'laminas' | 'historia'
  puerta: null,         // pantalla que va antes de todo: 'bienvenida' y 'seteo' (la primera vez) | 'candado' (contraseña) | null
  llegada: false,       // recién se pasó la puerta: el Inicio aparece con un fundido
  historia: { pestana: 'jesus', abierta: null }, // sección Historia: pestaña y prueba abierta
  evidencias: [],       // pruebas que muestra el diálogo «lado a lado» del lector
  evidenciaVerso: null, // { libro, cap, v } desde donde se abrió
  visor: null,          // imagen de Historia abierta a pantalla completa
  navAbierta: false,    // selector de libros y capítulos del lector
  menuBarra: null,      // menú abierto en la barra del lector: 'version' | 'aa'
  buscadorAbierto: false, // búsqueda global (Ctrl/Cmd K)
  coleccion: null,      // colección de láminas abierta: null (índice) | 'tipografia' | 'color' | 'imagen'
  estudioAbierto: false, // el estudio se abre a pedido, como un margen junto al texto
  pestana: 'palabra',
  seleccion: [],        // números de versículo seleccionados
  ancla: null,          // último versículo tocado (para Mayús+clic)
  palabra: null,        // { texto, libro, cap, v }
  lamina: null,         // lámina pedida desde el menú de inicio: { texto, referencia, clave, version, libro, estilo, formato }
  dialogo: null,        // 'versiones' | 'ajustes' | 'respaldo' | 'poster'
  aviso: null,          // { texto, error }
  leyendo: null,        // versículo que lee la voz
  destello: null,       // { libro, cap, v } a resaltar al llegar
  portada: 0,           // libro cuya portada se está mostrando a pantalla completa (0 = ninguna)
  entrada: null,        // «Entrar al libro»: de qué cubierta sale la portada { libro, caja, color, titulo }
  busqueda: '',         // texto enviado desde la barra superior
  cap: { cargando: true, error: '', clave: '', versos: [], titulos: {}, paralelo: null, errorParalelo: '' },
});

// Desplazamiento suave, salvo para quien pidió menos movimiento en su sistema (el CSS no alcanza a las
// llamadas con behavior: 'smooth' hechas desde código).
export const desplazamiento = () => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

let temporizadorAviso;
export function avisar(texto, error = false) {
  ui.aviso = { texto, error };
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => (ui.aviso = null), error ? 5200 : 2600);
}

// Avisos de «uso otra voz porque la elegida no está lista»: una vez por sesión basta; repetirlo en cada play molesta
const yaAvisados = new Set();
export function avisarUnaVez(clave, texto) {
  if (yaAvisados.has(clave)) return;
  yaAvisados.add(clave);
  avisar(texto);
}

export const pos = () => usuario.ajustes.pos;

// Cambia de pantalla; al salir del lector se cierran la selección y los paneles
// quien eligió «la estoy estudiando» lee con el estudio abierto al lado (en pantallas anchas)
function estudioAlEntrar(antes) {
  if (antes !== 'lector' && usuario.ajustes.estudioAlAbrir && typeof window !== 'undefined' && window.innerWidth > 900) ui.estudioAbierto = true;
}

// Transición «Cristal» entre pantallas (elegida por el dueño, 2026-11-23): la pantalla que dejas se hunde y se
// desenfoca, y la nueva llega desde cerca. Cada movimiento significa algo: la app tiene tres niveles (Inicio, las
// salas —Biblioteca, Mi archivo, Láminas, Historia— y el texto). Bajar de nivel avanza («entrar»), subir
// retrocede («salir») y cambiar de sala en el mismo nivel es un desenfoque quieto, sin profundidad. Usa la View
// Transitions API (los estilos están en app.css); sin ella, o con «reducir movimiento», el cambio es instantáneo.
const PROFUNDIDAD = { inicio: 0, biblioteca: 1, archivo: 1, laminas: 1, historia: 1, lector: 2 };
const TIPO = { 1: 'adentro', '-1': 'afuera', 0: 'sala' };
function conTransicion(destino, cambio) {
  const desde = ui.vista;
  const movimiento = typeof document !== 'undefined' ? document.documentElement.dataset.movimiento : 'quieto';
  const sinEfecto = destino === desde || ui.puerta || movimiento === 'quieto' || !document.startViewTransition
    || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (sinEfecto) return cambio();
  const raiz = document.documentElement;
  // en «sereno» todo cambio es un desenfoque quieto, sin profundidad
  raiz.dataset.transicion = movimiento === 'sereno' ? 'sala' : TIPO[Math.sign(PROFUNDIDAD[destino] - PROFUNDIDAD[desde])];
  const t = document.startViewTransition(() => flushSync(cambio));
  t.finished.finally(() => { delete raiz.dataset.transicion; });
}

export function abrirVista(v) {
  conTransicion(v, () => cambiarVista(v));
}
function cambiarVista(v, arriba = true) {
  const antes = ui.vista;
  ui.menuBarra = null;
  if (v === 'laminas') ui.coleccion = null;
  if (v !== 'lector') { ui.seleccion = []; ui.navAbierta = false; }
  ui.vista = v;
  if (v === 'lector') estudioAlEntrar(antes);
  if (arriba && typeof window !== 'undefined') requestAnimationFrame(() => document.querySelector('.vista')?.scrollTo?.(0, 0));
}

// «Entrar al libro» (opción A, elegida por el dueño 2026-11-24). Al tocar una cubierta de la Biblioteca, esa misma
// cubierta crece hasta ser la portada del libro y su título viaja hasta ser el primer renglón: el libro que tocas es
// el libro en el que entras, sin corte. Al volver con «← Biblioteca», la página se achica de regreso a su cubierta.
// Solo en Movimiento «Inmersivo» y sin «reducir movimiento»; si no, todo sigue como antes (Cristal y portada).
// La portada (Portada.svelte) hace el crecimiento con los datos de ui.entrada y, cuando ya tapa la pantalla, llama a
// llegarAlLibro(), que recién ahí cambia al lector (así no se ve el cambio de pantalla alrededor de la cubierta).
const CURVA_LIBRO = 'cubic-bezier(.7,0,.2,1)';
const inmersivo = () => typeof document !== 'undefined' && (document.documentElement.dataset.movimiento || 'inmersivo') === 'inmersivo'
  && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const cajaComo = (r) => `translate(${r.left}px, ${r.top}px) scale(${r.width / innerWidth}, ${r.height / innerHeight})`;
// color de fondo de un elemento; si es transparente (cubiertas de Imprenta y Editorial), el de la página
const fondoDe = (el) => {
  const c = getComputedStyle(el).backgroundColor;
  return c === 'transparent' || c === 'rgba(0, 0, 0, 0)' ? getComputedStyle(document.documentElement).getPropertyValue('--fondo').trim() || '#f7f7f5' : c;
};
let pendiente = 0;

export function entrarAlLibro(cubierta, libro) {
  if (!cubierta || !inmersivo() || usuario.ajustes.portadas === false || ui.portada) return irA(libro, 1);
  cubierta.style.transform = '';
  const r = cubierta.getBoundingClientRect();
  const tit = cubierta.querySelector('.cub-titulo');
  const rt = tit.getBoundingClientRect();
  const cs = getComputedStyle(tit);
  const tam = parseFloat(cs.fontSize);
  ui.entrada = {
    libro,
    caja: { left: r.left, top: r.top, width: r.width, height: r.height },
    color: fondoDe(cubierta),
    titulo: { left: rt.left, top: rt.top, texto: tit.textContent, font: cs.font, espaciado: cs.letterSpacing, color: cs.color,
      mayusculas: cs.textTransform, tam, interlinea: (parseFloat(cs.lineHeight) || tam * 1.1) / tam },
  };
  cubierta.classList.add('entrando');
  pendiente = libro;
  ui.portada = libro;
  setTimeout(llegarAlLibro, 1100); // respaldo: si la portada no avisa, igual se llega al libro
}

export function llegarAlLibro() {
  if (!pendiente) return;
  const libro = pendiente;
  pendiente = 0;
  irAhora(libro, 1, null);
}

export function volverAlEstante() {
  const libro = pos().libro;
  const marco = document.querySelector('.marco'); // el lector (texto y estudio), debajo de la cabecera
  if (!inmersivo() || ui.vista !== 'lector' || !marco) return abrirVista('biblioteca');
  // la página del lector, de su color, se queda encima mientras cambia la pantalla debajo
  const lienzo = document.createElement('div');
  lienzo.className = 'lienzo-libro';
  const desde = marco.getBoundingClientRect();
  const color = fondoDe(document.querySelector('.lector') || marco);
  lienzo.style.background = color;
  lienzo.style.transform = cajaComo(desde);
  document.body.append(lienzo);
  flushSync(() => cambiarVista('biblioteca', false));
  const cub = document.querySelector(`.cubierta[data-libro="${libro}"]`);
  const terminar = () => lienzo.remove();
  if (!cub) {
    lienzo.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'both' }).finished.then(terminar, terminar);
    return;
  }
  cub.scrollIntoView({ block: 'center' });
  const r = cub.getBoundingClientRect();
  cub.classList.add('entrando');
  lienzo.animate([{ transform: cajaComo(desde), backgroundColor: color }, { transform: cajaComo(r), backgroundColor: fondoDe(cub) }],
    { duration: 520, easing: CURVA_LIBRO, fill: 'both' }).finished.then(() => {
    cub.classList.remove('entrando');
    [...cub.children].forEach((el) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' }));
    terminar();
  }, terminar);
}

export function irA(libro, cap, v = null) {
  conTransicion('lector', () => irAhora(libro, cap, v));
}
function irAhora(libro, cap, v) {
  const desdeBiblioteca = ui.vista === 'biblioteca';
  estudioAlEntrar(ui.vista);
  ui.vista = 'lector';
  ui.buscadorAbierto = false;
  ui.seleccion = [];
  ui.ancla = null;
  ui.navAbierta = false;
  ui.destello = v ? { libro, cap, v } : null;
  if (v) ui.seleccion = [v];
  // al abrir un libro por su comienzo (otro libro, o cualquiera desde la Biblioteca), primero su portada;
  // no al «Continuar leyendo», ni al saltar a un versículo puntual, ni al volver al capítulo 1 desde el 2
  if (!v && cap === 1 && (libro !== pos().libro || desdeBiblioteca) && usuario.ajustes.portadas !== false) ui.portada = libro;
  guardarPosicion(libro, cap);
}

export function abrirPestana(p) {
  ui.pestana = p;
  ui.estudioAbierto = true;
}

// Claves de los versículos seleccionados en el capítulo actual
export function clavesSeleccion() {
  const { libro, cap } = pos();
  return [...ui.seleccion].sort((a, b) => a - b).map((v) => clave(libro, cap, v));
}

export function etiquetaSeleccion() {
  const { libro, cap } = pos();
  const s = [...ui.seleccion].sort((a, b) => a - b);
  if (!s.length) return '';
  const contiguo = s.every((v, i) => i === 0 || v === s[i - 1] + 1);
  if (contiguo) return nombreRef(libro, cap, s[0], s.at(-1));
  return `${nombreLibro(LIBROS[libro - 1])} ${cap}:${s.join(', ')}`;
}

let pedido = 0;
export async function recargarCapitulo() {
  const { libro, cap } = pos();
  const { version, paralela, claveNLT } = usuario.ajustes;
  const n = ++pedido;
  ui.cap.cargando = true;
  ui.cap.error = '';
  // la paralela se pide a la vez que la principal (con la NTV en línea ahorra una vuelta de red entera)
  const conParalela = paralela && paralela !== version && info(paralela);
  const pedidoParalelo = conParalela ? cargarCapitulo(paralela, libro, cap, claveNLT) : null;
  pedidoParalelo?.catch(() => {}); // su error se muestra abajo; aquí solo se evita el aviso de promesa sin atender
  try {
    const datos = await cargarCapitulo(version, libro, cap, claveNLT);
    if (n !== pedido) return;
    ui.cap.versos = datos.versos;
    ui.cap.titulos = datos.titulos;
    ui.cap.clave = `${libro}.${cap}`;
  } catch (e) {
    if (n !== pedido) return;
    ui.cap.versos = [];
    ui.cap.titulos = {};
    ui.cap.clave = `${libro}.${cap}`;
    ui.cap.error = e.message || String(e);
  }
  ui.cap.paralelo = null;
  ui.cap.errorParalelo = '';
  if (pedidoParalelo) {
    try {
      const p = await pedidoParalelo;
      if (n === pedido) ui.cap.paralelo = Object.fromEntries(p.versos.map((x) => [x.v, x.texto]));
    } catch (e) {
      if (n === pedido) ui.cap.errorParalelo = e.message || String(e);
    }
  }
  if (n === pedido) ui.cap.cargando = false;
}

export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
