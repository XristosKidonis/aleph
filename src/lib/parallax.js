// Parallax del Inicio (elegido por el dueño el 2026-11-23, nivel «entre medio y marcado»): el mouse mueve un poco
// la cámara. El plano gira hasta 3,2°, cada capa se corre según su profundidad (hasta 19 px la más cercana) y la
// lámina del margen se desenfoca apenas lejos del centro. La marca y las letras nunca se desenfocan.
// Además, la entrada bajo el mouse se acerca a la pantalla y las demás se aclaran (clases .cerca y .con-cerca):
// el :hover de CSS no es fiable mientras el plano gira, así que la entrada la marca el código.
// Solo con mouse, en pantallas anchas, sin «reducir movimiento» y con el ajuste Movimiento en «inmersivo».
// Con el mouse quieto 2,5 s vuelve al centro.

const NIVEL = { px: 19, giro: 3.2, desenfoque: 1 };
const CAPAS = [['.inicio-edicion', 0.35], ['.marca-grande', 0.6], ['.inicio-entradas', 1], ['.inicio-ultima', 0.85], ['.inicio-cultura', 1.6]];
const SUAVIDAD = 0.06; // cuánto se acerca al mouse en cada cuadro: más bajo, más «flotante»
const VUELTA = 2500;    // ms con el mouse quieto antes de volver al centro

export function parallax(nodo) {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)');
  const apto = matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine)');
  let meta = { x: 0, y: 0 };
  const ahora = { x: 0, y: 0 };
  let ultimo = 0;
  let cuadro = 0;
  let cerca = null;
  let sobreLamina = false;

  function marcar(entrada) {
    if (entrada === cerca) return;
    cerca?.classList.remove('cerca');
    cerca = entrada;
    cerca?.classList.add('cerca');
    nodo.querySelector('.inicio-entradas')?.classList.toggle('con-cerca', !!cerca);
  }

  function pintar(t) {
    cuadro = 0;
    const objetivo = t - ultimo > VUELTA ? { x: 0, y: 0 } : meta;
    ahora.x += (objetivo.x - ahora.x) * SUAVIDAD;
    ahora.y += (objetivo.y - ahora.y) * SUAVIDAD;
    const plano = nodo.querySelector('.inicio-centro');
    if (plano) plano.style.transform = `rotateY(${(ahora.x * NIVEL.giro).toFixed(3)}deg) rotateX(${(-ahora.y * NIVEL.giro).toFixed(3)}deg)`;
    for (const [sel, p] of CAPAS) {
      for (const el of nodo.querySelectorAll(sel)) {
        // `translate` (no `transform`): no pisa los efectos que ya tiene cada pieza
        el.style.translate = `${(-ahora.x * NIVEL.px * p).toFixed(2)}px ${(-ahora.y * NIVEL.px * p).toFixed(2)}px`;
      }
    }
    const lamina = nodo.querySelector('.inicio-cultura');
    if (lamina) lamina.style.filter = sobreLamina ? '' : `blur(${(Math.min(1, Math.hypot(ahora.x, ahora.y)) * NIVEL.desenfoque).toFixed(2)}px)`;
    const quieta = Math.abs(objetivo.x - ahora.x) + Math.abs(objetivo.y - ahora.y) < 0.001;
    if (!quieta || t - ultimo <= VUELTA) cuadro = requestAnimationFrame(pintar);
  }
  const arrancar = () => { if (!cuadro) cuadro = requestAnimationFrame(pintar); };

  function mover(e) {
    const inmersivo = (document.documentElement.dataset.movimiento || 'inmersivo') === 'inmersivo';
    if (e.pointerType !== 'mouse' || quieto.matches || !apto.matches || !inmersivo) return;
    meta = { x: (e.clientX / innerWidth) * 2 - 1, y: (e.clientY / innerHeight) * 2 - 1 };
    ultimo = performance.now();
    const bajo = document.elementFromPoint(e.clientX, e.clientY);
    marcar(bajo?.closest('.inicio-entrada') || null);
    sobreLamina = !!bajo?.closest('.inicio-cultura');
    arrancar();
  }
  function salir() {
    meta = { x: 0, y: 0 };
    marcar(null);
    arrancar();
  }

  nodo.addEventListener('pointermove', mover);
  nodo.addEventListener('pointerleave', salir);
  return {
    destroy() {
      cancelAnimationFrame(cuadro);
      nodo.removeEventListener('pointermove', mover);
      nodo.removeEventListener('pointerleave', salir);
    },
  };
}
