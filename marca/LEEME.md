# Marca Aleph

El logo de Aleph es el símbolo ℵ (aleph) junto al nombre, vectorizado del tablero original del dueño. Va siempre
nítido: sin texturas, halos, sombras, filtros ni desenfoque, a cualquier tamaño.

| Archivo | Qué es |
|---|---|
| `aleph-logo.svg` | Logo horizontal (símbolo + nombre en una línea): Inicio, arranque e instaladores |
| `aleph-logo-apilado.svg` | Logo apilado (símbolo arriba, nombre abajo): cabecera de la app |
| `aleph-simbolo.svg`, `aleph-nombre.svg` | El símbolo y el nombre por separado |
| `aleph-icono-claro.svg`, `aleph-icono-oscuro.svg`, `aleph-icono-1024.png` | Icono de la app |

- En la app, los trazos viven en `src/lib/marcaAleph.js` y los dibuja `src/componentes/Marca.svelte`.
- Las imágenes de los instaladores salen de `herramientas/instalador.mjs`, que usa `aleph-logo.svg` de esta carpeta.
- La app se llamó Chi-Ro Heirs hasta la v0.14; desde la v0.15.0 es Aleph, y el repositorio se renombró a `aleph`.
