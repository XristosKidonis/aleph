// Hallazgos: fichas de Historia que llegan sin actualizar la app (rama «contenido» del repo, historia/hallazgos.json).
// Este archivo dice qué es una ficha válida. Lo usan la app (descarta lo que no cumple) y la rutina semanal
// (herramientas/hallazgos/validar.mjs, antes de publicar). Sin dependencias de Svelte para poder correrlo con node.
import { LIBROS } from './libros.js';
import { GRADOS } from './evidencias.js';

export const VERSION = 1;
export const GRUPOS_HALLAZGO = ['testigos', 'cristianos', 'manuscritos', 'piedras'];
export const RESPUESTAS = ['firme', 'discutido', 'falso'];
const TEXTOS = ['titulo', 'autor', 'obra', 'fecha', 'cita', 'establece', 'noEstablece'];
const IMAGEN_PERMITIDA = ['https://upload.wikimedia.org/', 'https://thumb.wikimedia.org/']; // solo Wikimedia Commons

const esTexto = (x) => typeof x === 'string' && x.trim().length > 0;
const bilingue = (x) => !!x && esTexto(x.es) && esTexto(x.en);
const esHttps = (u) => typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u);

// «libro.cap.v» o «libro.cap.v-hasta», con libro y capítulo que existan
export function versoValido(r) {
  const m = /^(\d{1,2})\.(\d{1,3})\.(\d{1,3})(?:-(\d{1,3}))?$/.exec(String(r));
  if (!m) return false;
  const [libro, cap, v, hasta] = [m[1], m[2], m[3], m[4]].map((x) => (x ? Number(x) : null));
  const l = LIBROS[libro - 1];
  return !!l && cap >= 1 && cap <= l.capitulos && v >= 1 && (hasta === null || hasta > v);
}

// Lista de problemas de una ficha (vacía = válida)
export function problemas(h) {
  const p = [];
  if (!h || typeof h !== 'object') return ['no es un objeto'];
  if (!/^[a-z0-9-]{3,60}$/.test(h.id || '')) p.push('id: minúsculas, números y guiones');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h.publicado || '')) p.push('publicado: AAAA-MM-DD');
  if (!GRUPOS_HALLAZGO.includes(h.grupo)) p.push(`grupo: uno de ${GRUPOS_HALLAZGO.join(', ')}`);
  if (!GRADOS.includes(h.grado)) p.push(`grado: uno de ${GRADOS.join(', ')}`);
  for (const k of TEXTOS) if (!bilingue(h[k])) p.push(`${k}: falta en es o en en`);
  if (!Array.isArray(h.versos) || !h.versos.length) p.push('versos: al menos uno');
  else for (const r of h.versos) if (!versoValido(r)) p.push(`versos: «${r}» no existe`);
  if (!esHttps(h.fuente)) p.push('fuente: enlace https a la fuente original');
  if (h.noticia !== undefined && !esHttps(h.noticia)) p.push('noticia: enlace https');
  if (h.imagen !== undefined) {
    const im = h.imagen;
    if (!im || !IMAGEN_PERMITIDA.some((x) => String(im.src || '').startsWith(x))) p.push(`imagen.src: solo ${IMAGEN_PERMITIDA.join(' o ')}`);
    else if (!bilingue(im.titulo) || !esTexto(im.autor) || !esTexto(im.fecha) || !esTexto(im.licencia) || !esHttps(im.pagina))
      p.push('imagen: titulo (es/en), autor, fecha, licencia y pagina');
  }
  if (h.pregunta !== undefined && (!bilingue(h.pregunta?.texto) || !RESPUESTAS.includes(h.pregunta?.respuesta)))
    p.push(`pregunta: texto (es/en) y respuesta (${RESPUESTAS.join(', ')})`);
  if (h.retirado !== undefined && typeof h.retirado !== 'boolean') p.push('retirado: true o false');
  return p;
}

// Lo que la app muestra: fichas válidas, no retiradas, sin ids repetidos, la más nueva primero
export function depurar(datos) {
  if (!datos || datos.version !== VERSION || !Array.isArray(datos.hallazgos)) return null;
  const vistos = new Set();
  return datos.hallazgos
    .filter((h) => !problemas(h).length && !h.retirado && !vistos.has(h.id) && vistos.add(h.id))
    .sort((a, b) => b.publicado.localeCompare(a.publicado));
}
