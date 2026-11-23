# 14. Pulido general (22 de noviembre de 2026)

> **Estado:** en la rama `diseno/white-industrial`, **sin commit, sin publicar** y sin instalador nuevo.
> El dueño pidió revisar animaciones, diseño, carga, espacio, código flojo, seguridad, conectividad e ideas nuevas.
> Se revisó por áreas (tres revisiones independientes más el linter oxlint) y se aplicó solo lo que **no cambia el
> look aprobado**. Lo que sí lo cambiaría quedó como propuesta (sección «Para decidir»).

## Lo nuevo (para el usuario)

| Qué | Dónde | Archivos |
|---|---|---|
| **Un día como hoy**: si hace uno o más años escribiste una nota en esta fecha (±1 día), el inicio la recuerda en una línea, con enlace al pasaje. Si no hay, no aparece nada | Inicio, bajo «Última lectura» | `Inicio.svelte`, `app.css` (`.inicio-recuerdo`) |
| **Notas en Markdown**: todas las notas, por libro y versículo, con tipo, «Respondida» y fecha. Para Obsidian, Notion o imprimir | Ajustes → Más → Respaldo | `dialogos/Respaldo.svelte`, `archivos.js` |
| **La web abre al instante**: si se lee en la NTV o la NLT, ya no espera los 67 MB de Biblias. Inicio en 0,2 s y Génesis 1 de la NTV real en 0,9 s en la primera visita; la base sigue bajando por detrás | Web | `App.svelte`, `biblia.js`, `versiones.svelte.js` (nuevo), `conteos.js` (nuevo) |
| **Búsqueda unas 7 veces más rápida** (89 → 12 ms en «the», mismos resultados) | Buscar | `biblia.js` (`tramoVersion`) |
| **Aviso claro al agotar las 500 consultas diarias** de la clave de prueba de Tyndale (antes decía solo «respondió 429») | Lector | `nlt.js`, `i18n` (`nlt.limite`) |

## Arreglos

**Seguridad**
- El motor de pronunciación de la voz natural (`piper_phonemize.js`, que se ejecuta dentro de la app) se comprueba con su **huella SHA-256** al bajarlo y antes de usarlo. Si no coincide, se borra y no corre. Las huellas son las que publica jsDelivr para la 1.0.0 (`vozNeural.js`, `HUELLAS`).
- Las **claves** de Tyndale y Bible Brain ya no salen en los mensajes de error (el error de Rust traía la URL con `key=`) ni viajan en el respaldo JSON (`bd.js` `sinClaves`, `usuario.svelte.js` `exportar`).
- **Definiciones del léxico**: solo pueden mostrar `<b>`, `<i>` y `<br>`, sin atributos, aunque la base llegue alterada (`Original.svelte`). El constructor de datos también quita atributos (`construir_datos.py`). La base actual estaba limpia.
- **Importar un respaldo** dañado o editado a mano ya no puede meter filas que rompan la app (`usuario.svelte.js` `importar`).
- **CSP en la versión web** (meta en `index.html`, solo con `WEB=1`; `vite.config.js`). Probada con la suite.
- **Acciones de GitHub fijadas por huella** (17 usos en los 3 flujos). Antes usaban etiquetas que se pueden mover, y una corre con la clave que firma las actualizaciones.

**Conectividad**
- Toda llamada a internet se corta a los 15 s si el servidor no contesta (antes podía quedar en «Cargando…» para siempre). El plazo vale hasta las cabeceras; la descarga de voces no tiene plazo (`bd.js` `pedir`, `vozNeural.js` `bajar`).
- La NTV reintenta también si el servidor cae un momento (5xx), con esperas crecientes. Un 429 no se reintenta (`nlt.js`).
- El nombre de libro que acepta la NTV se recuerda entre sesiones (ajuste `formatoNLT`, solo un número). Antes se gastaban consultas de la clave de prueba probando nombres en cada arranque.
- Los capítulos largos de la NTV se parten con una tabla fija de versículos por capítulo, sin esperar la base (`conteos.js`).
- Si falla la descarga de la base en la web, el próximo uso vuelve a intentar en vez de quedar roto. Al cerrar o recargar la página no se reintenta (`bd.js`).

**Carga y espacio**
- Escritorio: la base (175 MB) ya no se copia en cada versión nueva si no cambió. Se compara el tamaño y la cabecera SQLite, se copia a un temporal y se renombra, y se borran restos del diario WAL (`src-tauri/src/lib.rs`).
- El capítulo principal y el paralelo se piden a la vez (`ui.svelte.js`).
- Los deslizadores (tamaño, interlineado, velocidad) guardan al soltar, no por cada píxel (`usuario.svelte.js` `ajustar`).
- La música ambiente suspende el motor de audio tras el fundido: no gasta batería en silencio (`ambiente.svelte.js`).
- 8 fuentes que nada usaba (Bodoni, Archivo 400, Inter Tight estáticas): −150 KB. `LICENCIAS.txt` actualizado.

**Animaciones y diseño (sin cambiar el look)**
- Quien pide «menos movimiento» en su sistema ya no recibe desplazamientos suaves desde el código (lector, Historia y voz que sigue el versículo) ni los zooms de Historia y de los colores (`ui.svelte.js` `desplazamiento`, `app.css`).
- Tema **Sistema** en oscuro: los subrayados, la barra de selección y la navegación móvil tenían colores del modo claro. Ahora usan los mismos que el lector oscuro.
- La palabra marcada al pasar el mouse y la elegida para «Estudiar» se ven en el lector oscuro (antes eran tinta negra sobre negro).
- El aviso (toast) sube arriba cuando la barra de selección está abierta: ya no tapa los botones recién tocados. Entra con un fundido de 0,18 s.
- El anillo de foco del teclado ya no se recorta en la barra del lector ni en las pestañas.
- Zona de toque invisible más grande en los colores de subrayado y en «Clave»; «Salir de Calma» más fácil de tocar.

**Código flojo**
- 120 textos de interfaz huérfanos (60 por idioma), 6 funciones exportadas sin uso, CSS muerto. Los dos idiomas siguen con las mismas 681 claves.
- Fallos que eran silenciosos ahora se dicen: Memoria avisa si repasas en una versión incluida (y en el idioma correcto, ya no siempre RV1909); Mi archivo avisa si no cargaron los textos.

## Portada de libro (azul impreso; desde los skins, la del Editorial en lima)

Aparece al abrir un libro por su capítulo 1: otro libro (selector, Biblioteca, o de Malaquías 4 a Mateo 1) o cualquiera
desde la Biblioteca. No sale con «Continuar leyendo», al saltar a un versículo puntual ni al arrancar la app.
Se apaga en Ajustes → «Portadas» (`ajustes.portadas`, por defecto encendida). Con las portadas encendidas, el grabado
de Doré sobre el capítulo 1 (`grabados`, `Frontis.svelte`) no se muestra: la portada lo reemplaza.
Fondo con grano leve: solo `portada-grano.webp` al 45 % de opacidad. El dueño rechazó una textura más fuerte y
luego también la capa de manchas: le pareció demasiado texturizado.

- Movimiento «revelado», elegido por el dueño (la entrada anterior, palabra por palabra subiendo en cascada, le pareció
  «muy PowerPoint»): la hoja aparece entera y las letras pasan de borrosas a nítidas todas juntas; las notas asoman
  después. Al salir, las letras se desenfocan mientras el azul se disuelve. Dura unos 2,3 s en total.
  Para que corra fluido no se anima ningún filtro: cada palabra está dos veces (`.pt-nitida` con la tinta y
  `.pt-desenfocada` con `blur`) y el revelado solo cruza sus opacidades. La primera versión animaba el `blur` y se
  veía a unos 30 fps: repintaba letras gigantes con el filtro SVG en cada cuadro.

- Diseño elegido por el dueño tras varias rondas: renglones grandes a la izquierda (nombre, frase partida en tres,
  «Gn 1:1») y una nota por renglón a la derecha (libro n de 66, sección, autor, capítulos y versículos, de qué trata).
  Azul de impresión `#034ab3`, letras de papel `#e6ecf4`, sin líneas entre renglones.
- Letra: TeX Gyre Heros Bold (clon de Helvetica, GUST Font License; ver `public/fuentes/LICENCIAS.txt`).
- Textura: una sola capa encima de todo (fondo y letras) en modo overlay: `public/img/portada-grano.webp` (mosaico de
  512 px sin costuras: fibras y poros). Se regenera con
  `python herramientas/textura_portada.py`. Las letras llevan además el filtro SVG `#pt-impreso` (bordes comidos y suaves).
- Código: `src/componentes/Portada.svelte`, datos de los 66 libros en `src/lib/portadas.js` (es/en), disparo en
  `irA()` de `ui.svelte.js` (`ui.portada`). Un toque o cualquier tecla la salta; la primera tecla no llega al lector.
  Con «menos movimiento» aparece quieta 1,8 s y se desvanece.
- Prueba nueva en `pruebas/navegador.mjs`: abre Deuteronomio, revisa las notas y que el nombre largo no pise la nota.

## Skins: Blanco, Imprenta y Editorial

Ajustes → «Aspecto» (`ajustes.skin`: `blanco` por defecto, `imprenta`, `editorial`). `App.svelte` pone
`data-skin` en `<html>` (Blanco no lo lleva) y `src/skins.css` (cargado después de `app.css`) aplica la capa. El
diseño base de siempre es el skin Blanco y no se tocó.

- Reglas del dueño: decisiones extremas (si hay color, es la pantalla entera), un solo color por skin además de papel y
  tinta, líneas finas, sin cajas, y el texto bíblico siempre sobre papel claro u oscuro.
- Imprenta: papel crema `#F4F1EA`, tinta `#161616`, amarillo `#F2CE2E` (solo el Inicio entero, la portada y lo marcado).
  Títulos en Archivo variable condensada (68 %, peso 760, mayúsculas). Marco fino de 1,5 px a 12 px del borde
  (no en móvil). Sin fotos en el inicio ni en el lector (el dueño no las quiso).
- Editorial: se llega en lima y se lee en blanco. Inicio, Biblioteca, Archivo, Láminas e Historia enteras en lima
  `#D8F24A`; el lector y los diálogos en blanco `#FAFAF7` con el lima solo como relleno (cuadro del número del capítulo,
  resaltador, pestaña activa). De noche: negro `#0E0E0E` con lima (ahí el lima sí puede ser letra). Letra: TeX Gyre
  Heros regular y bold (`public/fuentes/texgyreheros-regular.woff2`, nueva).
- Biblioteca en Imprenta y Editorial: índice en columnas (4 y 5) en vez de cubiertas. El rótulo de sección va en
  `data-sec` del primer libro de cada familia, así nunca queda huérfano; el libro actual lleva `.actual`.
- Portadas al abrir un libro, una por skin: Blanco estrena una hoja clara con Inter Tight fina (la azul no era de su
  estilo), Editorial hereda la portada en renglones en lima con letra negra, Imprenta en amarillo con condensada negra
  y marco. `Portada.svelte` espera la letra que tenga el skin.
- Pruebas: `SKIN=imprenta|editorial node pruebas/solapes.mjs` elige el skin desde Ajustes antes de medir.
- Widescreen: la app ya no tiene tope de 1920 px (`.app` ocupa todo el ancho; cada vista limita su contenido). El
  estudio mide `--ancho-estudio: clamp(340px, 24vw, 560px)` y llega al borde derecho; la cruz de cerrar va fuera de la
  franja de pestañas (`.estudio-cabeza`), así no se pierde si las pestañas no caben. La barra de selección se centra
  con ese mismo ancho.
- Comparar traducciones: el botón de la versión ya no lleva la paralela; al lado hay un botón «∥ Comparar» (o «∥ KJV»
  si ya compara) que abre el menú con la lista enfocada. La lista «Comparar con» viene en grupos Español / Inglés,
  igual que la de versión. `pruebas/solapes.mjs` ahora descuenta lo que un contenedor recorta.
- Maquetas de la exploración (referencias, tres direcciones y sus vueltas) quedaron fuera del repo, en el scratchpad
  de la sesión del 2026-11-22.
- Color por skin (Ajustes → «Color», bajo «Aspecto»; no aparece en Blanco). Imprenta: Amarillo (por defecto), Celeste
  `#A9D8F0` o Menta `#A9E2C0`. Editorial: Lima (por defecto), Rosa `#FDD0E0` o Cian `#B9E8F0` (el dueño pidió rosa y
  cian calmos, a la claridad del lima). Cada skin recuerda el suyo (`ajustes.colorSkin`). `App.svelte` pone `data-color`
  en `<html>` y `skins.css` cambia el color y sus grises con variables (`--imp-*`, `--ed-*`); el resaltador sale del
  mismo color con `color-mix`. Todos con letra negra a 10:1 o más. Para medir: `SKIN=editorial COLOR=rosa node pruebas/solapes.mjs`.

## Pruebas

- Suite de 33 pasos en **Chromium** (dev): todo en verde, sin errores de consola. **Solapes**: nada se choca (Chromium y WebKit).
- **WebKit** (dev y web compilada): los 33 pasos en verde. Queda un aviso: si la página se recarga mientras la base baja, WebKit anota la descarga cortada como error de página. Pasa en el paso «móvil», que recarga a propósito. Antes no ocurría porque la app no se podía usar hasta tener la base. No afecta nada visible; se comparó contra el código anterior en las mismas condiciones.
- **Web compilada con gzip** (como GitHub Pages, servidor Node propio): 33/33. En una primera pasada falló «voz narrada» porque el servidor de prueba no acepta saltos (Range) dentro de un MP3; GitHub Pages sí. La segunda pasada salió completa.
- `cargo check` del Rust: limpio. La app de escritorio **no se abrió** en esta sesión: ver «Entorno».

## Entorno (Windows del dueño)

- **Windows reservó el puerto 1420** (rango excluido 1362–1461, `netsh int ipv4 show excludedportrange protocol=tcp`). Con eso `npm run dev` y `tauri dev` no arrancan («EACCES»). Suele cambiar al reiniciar. Si sigue, se libera con `net stop winnat` y `net start winnat` (terminal como administrador). Para probar se agregó `chi-ro-dev-5173` en `.claude/launch.json` (fuera del repositorio).

## Para decidir (el dueño)

- Usuario local: nombre al abrir por primera vez (el Inicio saluda) y contraseña opcional. Decidir si la contraseña
  solo bloquea la pantalla o cifra las notas (si la olvida, las pierde).

**Cambios visuales chicos propuestos por la revisión** (necesitan su visto bueno, con opciones):
- Contraste de textos grises que no llegan a 4,5:1: número de capítulo (`#aaa`), «Amén», flecha del inicio, metadatos en las cubiertas.
- Transiciones de 150 a 200 ms al abrir y cerrar el Estudio, el selector de libros, los diálogos y «Más». Hoy aparecen de golpe.
- Unificar duraciones y curvas de animación en dos tokens.
- Etiquetas de 7 a 9 px en la navegación móvil y la barra del lector.
- En el inicio en español dice «STUDIO EDITION» y «VISUAL STUDY» en inglés.

**Técnico, con riesgo o costo (no se hizo):**
- **CSP en la app de escritorio:** la política está escrita en `vite.config.js`. Hay que sumarle `ipc:` y `http://ipc.localhost` y probarla con la app abierta en Windows antes de activarla en `tauri.conf.json`.
- **Firmar las actualizaciones en un paso aparte** del build (hoy la clave privada está en el entorno de `tauri-action`, que también corre Vite y las dependencias).
- Abrir la base incluida directamente, en solo lectura, sin copiarla: −175 MB en disco. Falta comprobar que `tauri-plugin-sql` lo permita.
- Música a AAC de 64 kbps (−14 MB) o bajarla a pedido (−43 MB del instalador).
- El `.wasm` de ONNX (14 MB) se podría bajar junto con la voz natural en vez de ir en el instalador.
- FTS con `columnsize=0` (−4,5 MB). Requiere reconstruir la base.
- Cargar Galería, Historia, Archivo y el Estudio a pedido (−150 a 200 KB del arranque).

## Ideas nuevas propuestas (no construidas)

Pensadas para un joven cristiano al que le gusta lo estético y no quiere culpa ni rachas:
1. **Fondo de escritorio del día**: cada mañana la app pone de fondo la lámina del versículo del día (Tauri puede cambiar el fondo con un comando de Rust). Une las dos cosas que el dueño más quiso: láminas y estética.
2. **Lectio divina guiada**: leer, meditar, orar y contemplar en cuatro pasos sobre el modo Calma, con el Ambiente de fondo y una nota de oración al final.
3. **Modo culto**: durante una prédica, abrir pasajes rápido por voz o con el buscador y tomar notas con hora, que después quedan agrupadas por fecha.
4. **Planes sin culpa** sobre la cuadrícula de cobertura: «el Evangelio de Juan en 21 días», sin rachas ni avisos.
5. **Enlace para compartir un pasaje** que abre la versión web justo ahí.
