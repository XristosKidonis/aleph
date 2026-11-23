"""Genera las texturas de la portada de libro (papel impreso y escaneado).

Sale una imagen en escala de grises, centrada en gris 50 % para mezclarse en modo «overlay»
sobre el azul y las letras, así fondo y letras comparten la misma hoja:

  public/img/portada-grano.webp    mosaico de 512 px que se repite sin costuras:
                                   fibras del papel + poros donde la tinta no cargó

La portada la usa al 45 % de opacidad (app.css). Hubo también una capa de «manchas» (nubes de
carga dispareja), pero el dueño la encontró demasiado texturizada y se sacó.

Uso:  python herramientas/textura_portada.py
Requiere numpy y Pillow. La semilla es fija: siempre produce las mismas imágenes.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / 'public' / 'img'
LADO = 512
rng = np.random.default_rng(7)


def desenfoque_ciclico(a, sigma):
    """Desenfoque gaussiano que da la vuelta por los bordes (mantiene el mosaico sin costuras)."""
    fy = np.fft.fftfreq(a.shape[0])[:, None]
    fx = np.fft.fftfreq(a.shape[1])[None, :]
    nucleo = np.exp(-2 * (np.pi * sigma) ** 2 * (fx ** 2 + fy ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * nucleo))


def fibras():
    """Trazos cortos y curvos dibujados en un lienzo 3×3 y plegados sobre uno: el mosaico cierra solo."""
    grande = Image.new('L', (LADO * 3, LADO * 3), 0)
    claras, oscuras = ImageDraw.Draw(grande), None
    capa_osc = Image.new('L', grande.size, 0)
    oscuras = ImageDraw.Draw(capa_osc)
    for _ in range(9 * 2400):
        x, y = rng.uniform(0, LADO * 3), rng.uniform(0, LADO * 3)
        ang, largo = rng.uniform(0, np.pi), rng.gamma(2.0, 8)
        pts = [(x, y)]
        for _k in range(6):
            ang += rng.normal(0, 0.28)
            x += np.cos(ang) * largo / 6
            y += np.sin(ang) * largo / 6
            pts.append((x, y))
        lapiz = oscuras if rng.random() < 0.3 else claras
        lapiz.line(pts, fill=int(rng.uniform(25, 70)), width=1)
    a = np.asarray(grande, np.float32) - np.asarray(capa_osc, np.float32)
    plegado = a.reshape(3, LADO, 3, LADO).sum(axis=(0, 2)) / 255
    return desenfoque_ciclico(plegado, 0.7)


def poros():
    """Grano fino: ruido blanco apenas desenfocado, con algunos puntos claros marcados (papel sin tinta)."""
    g = desenfoque_ciclico(rng.normal(0, 1, (LADO, LADO)), 0.8)
    g /= g.std()
    claros = np.clip(g - 1.6, 0, None) * 1.4   # los picos se vuelven motas claras
    return g * 0.5 + claros


def normalizar(a, contraste):
    a = (a - a.mean()) / (a.std() + 1e-6)
    return np.clip(0.5 + a * contraste, 0, 1)



def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    grano = normalizar(fibras() * 1.2 + poros(), 0.055)
    Image.fromarray(np.uint8(grano * 255)).save(SALIDA / 'portada-grano.webp', quality=78, method=6)
    print('portada-grano.webp', (SALIDA / 'portada-grano.webp').stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
