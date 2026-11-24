# Rutina semanal · Hallazgos de Historia (Aleph)

Cada semana sumas **una** ficha nueva a la pestaña «Hallazgos» de la sección Historia de Aleph.
Tú eres quien la elige, la escribe y la aprueba. Xristos no la revisa: te dejó el criterio a ti.
Por eso la regla de oro es la exactitud: es una app bíblica, y una ficha equivocada vale menos que ninguna.

## Dónde está todo
- Repo de la app: `F:\Chi-RO Heirs\chi-ro-heirs`. **No toques nada ahí**: hay otras sesiones con cambios sin guardar. Solo lees y corres scripts.
- Las fichas publicadas viven en la rama `contenido` del repo (repo público `XristosKidonis/chi-ro-heirs`), en `historia/hallazgos.json`. La app las baja de ahí sin actualizarse.
- Copia de trabajo de esa rama: `F:\Chi-RO Heirs\contenido-historia` (un worktree de git). Ahí escribes, commiteas y haces push.
- Registro de lo que se eligió y se descartó: `historia/registro.md`, en la misma rama.

## Pasos
1. **Preparar la rama.**
   - Si `F:\Chi-RO Heirs\contenido-historia` no existe, créala con `git -C "F:\Chi-RO Heirs\chi-ro-heirs" worktree add "F:\Chi-RO Heirs\contenido-historia" contenido`.
   - Después, dentro de esa carpeta, corre `git pull --ff-only origin contenido`.
2. **Ver qué hay ya.**
   - Lee `historia/hallazgos.json` y `historia/registro.md`.
   - Lee también los ids de las 31 pruebas fijas en `chi-ro-heirs/src/lib/evidencias.js`, para no repetir un tema que ya existe.
3. **Leer las noticias.**
   - Corre `python "F:\Chi-RO Heirs\chi-ro-heirs\herramientas\hallazgos\leer_fuentes.py" --dias 8`.
   - Te da los candidatos de la semana, con su fuente y su seriedad.
4. **Elegir uno o ninguno** con el criterio de abajo.
   - Si eliges uno, ve a la **fuente original**: el estudio publicado, el comunicado de la universidad o de la Autoridad de Antigüedades de Israel, o el texto antiguo. No basta con el titular.
   - Si la noticia no tiene una fuente original que se pueda leer, no sirve esta semana.
5. **Si no hay ninguna noticia que pase el criterio**, toma el primer tema de `herramientas/hallazgos/reserva.md` que todavía no esté en `hallazgos.json`. También lo investigas en sus fuentes.
6. **Escribir la ficha.**
   - Va al **principio** de la lista `hallazgos`, con `publicado` = la fecha de hoy y `actualizado` = hoy. El formato está abajo.
   - Si encuentras en Wikimedia Commons una imagen con licencia libre (dominio público o CC), ponla con su autor y su licencia. Si no, déjala sin imagen. **Nunca** generes ni uses imágenes hechas con IA, y nunca uses fotos de prensa.
7. **Revisarla.**
   - Corre `node "F:\Chi-RO Heirs\chi-ro-heirs\herramientas\hallazgos\validar.mjs" historia/hallazgos.json --enlaces`. Si falla, corrige y repite.
   - Lee la ficha otra vez de punta a punta como un historiador escéptico y como un creyente. Las dos lecturas tienen que sentir que es justa.
   - Si algún dato no lo viste con tus ojos en la fuente, quítalo.
8. **Limpiar el texto.** Corre `python "C:\Users\Xristos PC\cerebro\automation\limpiar_texto.py" --archivo historia/hallazgos.json --en-sitio`, **sin** `--estilo`, porque la app usa comillas «».
9. **Registrar.**
   - Agrega al principio de `historia/registro.md` la fecha, lo que publicaste y por qué.
   - Agrega también las 2 o 3 noticias que más se acercaron y por qué no entraron, una línea cada una.
10. **Publicar.**
    - Dentro de `contenido-historia`, haz commit con el mensaje `Hallazgo: <título corto>` y después `git push origin contenido`.
    - La app lo ve en unos 5 minutos.
11. **Avisar.** Termina con 2 líneas en español simple: qué publicaste y su grado.
    - Si algo falló (sin internet, el push rechazado o la revisión que no pasa), **no publiques**: di qué pasó.

## Criterio (lo que Xristos pidió)
Entra solo si cumple las tres cosas:
1. **Toca la Biblia de verdad.** Una persona, un lugar, un hecho, una costumbre o un texto que la Biblia menciona, con al menos un versículo que realmente tenga que ver. «Es de Israel» o «es antiguo» no alcanza.
2. **Tiene una base seria.**
   - Hay una excavación con su equipo con nombre, un estudio publicado o un comunicado oficial.
   - Hay objetos con procedencia conocida. Las piezas de anticuario sin origen (como el osario de Santiago) llevan como máximo el grado «discutido», o no entran.
3. **No es inventado ni exagerado.**
   - Nada de «encontraron el arca», «prueba la Biblia» ni reconstrucciones o imágenes hechas con IA.
   - Si la noticia que circula exagera, la ficha se puede hacer igual, pero para frenar la exageración. Así lo hicimos con «los huesos de Juan» de Sozópol, que tienen grado «sin base».

Prefiere, en orden: primero el tiempo de Jesús, Juan y los apóstoles; después el Antiguo Testamento; y al final el contexto, como Roma, Persia o Egipto, si lo que se halló explica un pasaje.
Usa las fuentes de seriedad «aviso» (Live Science) solo para enterarte. La ficha cita la fuente original.

## Los grados (los mismos de las 31 pruebas)
- `firme`: los especialistas lo aceptan en general.
- `probable`: la mayoría lo acepta, pero tiene peros reales.
- `discutido`: los especialistas están divididos, o es la propuesta de un solo equipo que todavía no se ha discutido.
- `sinbase`: una afirmación que circula sin apoyo. Úsalo para desarmar titulares virales falsos.

Ante la duda, pon el grado más bajo. Un descubrimiento de esta semana casi nunca es `firme`.

## Cómo se escribe (mira las 3 primeras fichas y `src/lib/evidencias.js`)
- Español simple y cálido, frases cortas, sin jerga ni sermón. El inglés va al mismo nivel, como traducción natural, no literal.
- `titulo`: qué es y por qué importa, en una línea. `autor`: dónde y quién lo halló, o quién lo escribió. `obra`: qué objeto es y dónde está hoy. `fecha`: la del objeto, no la de la noticia.
- `cita`: si es un texto antiguo, una traducción **propia** y corta. Si es un objeto, describe lo que se ve en una frase. Nunca copies párrafos de la noticia.
- `establece`: qué prueba de verdad, en 2 frases. `noEstablece`: qué no prueba, qué falta y qué discuten los especialistas, también en 2 frases. Las dos son obligatorias y honestas.
- `versos`: con el formato «libro.cap.v» o «libro.cap.v-hasta», donde el libro va del 1 al 66 en el orden protestante (Génesis 1, Mateo 40, Juan 43, Hechos 44, Apocalipsis 66).
  - Abre el versículo y confirma que dice lo que la ficha supone. La base está en `chi-ro-heirs/datos/biblias.db` o en cualquier Biblia en línea.
- `grupo`: dice qué preguntas se muestran en la ficha.
  - `piedras`: «Dónde se halló» y «Qué es». Para objetos y lugares.
  - `testigos`: «Quién» y «Dónde lo dice». Para un autor antiguo no cristiano.
  - `manuscritos`: «Quién lo copió» y «Qué es».
  - `cristianos`: un autor cristiano antiguo.
- `fuente`: el enlace a la fuente original (paper, DOI, museo, comunicado). `noticia` es opcional: el artículo de prensa que te avisó.
- `pregunta`: una afirmación para «¿Facto o fake?», con `respuesta` = `firme`, `discutido` o `falso`. Es la que alguien escucharía en redes.
- Si más tarde sale algo que contradice una ficha publicada, corrígela o ponle `"retirado": true`. Nunca borres la ficha, y anótalo en el registro.

## Formato
```json
{
  "id": "minusculas-con-guiones",
  "publicado": "AAAA-MM-DD",
  "grupo": "piedras",
  "grado": "probable",
  "titulo": { "es": "…", "en": "…" },
  "autor": { "es": "…", "en": "…" },
  "obra": { "es": "…", "en": "…" },
  "fecha": { "es": "…", "en": "…" },
  "cita": { "es": "…", "en": "…" },
  "establece": { "es": "…", "en": "…" },
  "noEstablece": { "es": "…", "en": "…" },
  "versos": ["43.1.28"],
  "fuente": "https://…",
  "noticia": "https://…",
  "imagen": { "src": "https://upload.wikimedia.org/…", "titulo": { "es": "…", "en": "…" }, "autor": "…", "fecha": "…", "licencia": "CC BY-SA 4.0", "pagina": "https://commons.wikimedia.org/wiki/File:…" },
  "pregunta": { "texto": { "es": "…", "en": "…" }, "respuesta": "falso" }
}
```
