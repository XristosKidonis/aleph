"""Lee las fuentes serias de arqueología e historia bíblica y deja los candidatos de la semana.

Solo usa la biblioteca estándar. Imprime un JSON con las noticias de los últimos N días que tocan
la Biblia (filtro por palabras clave), la más relevante primero. La rutina semanal decide con eso.

    python herramientas/hallazgos/leer_fuentes.py [--dias 8]

Fuentes comprobadas el 2026-11-23 (ver .claude/relevos/historia-contenido.md).
"""
import argparse
import html
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

FUENTES = [
    # (nombre, url, seriedad) · seriedad: "academica", "seria" o "aviso" (solo para enterarse, nunca fuente de la ficha)
    ("PaleoJudaica", "https://paleojudaica.blogspot.com/feeds/posts/default", "academica"),
    ("Biblical Archaeology Society", "https://www.biblicalarchaeology.org/feed/", "seria"),
    ("Haaretz Archaeology", "https://www.haaretz.com/srv/archaeology-rss", "seria"),
    ("ScienceDaily Archaeology", "https://www.sciencedaily.com/rss/fossils_ruins/archaeology.xml", "seria"),
    ("ScienceDaily Ancient Civilizations", "https://www.sciencedaily.com/rss/fossils_ruins/ancient_civilizations.xml", "seria"),
    ("Phys.org Archaeology", "https://phys.org/rss-feed/science-news/archaeology-fossils/", "seria"),
    ("Live Science Archaeology", "https://www.livescience.com/feeds/tag/archaeology", "aviso"),
]

# Palabras que acercan una noticia a la Biblia (peso 2 = muy bíblica, 1 = contexto)
CLAVES = {
    2: ["bible", "biblical", "jesus", "john the baptist", "jerusalem", "temple mount", "second temple", "first temple",
        "dead sea scroll", "qumran", "galilee", "nazareth", "bethlehem", "capernaum", "judea", "judaea", "judah",
        "king david", "solomon", "hezekiah", "herod", "pontius pilate", "caiaphas", "josephus", "ossuary",
        "septuagint", "codex", "papyrus", "gospel", "apostle", "early christian", "hebrew inscription",
        "paleo-hebrew", "israelite", "philistine", "canaanite", "samaria", "jericho", "megiddo", "hazor", "lachish",
        "city of david", "siloam", "masada", "caesarea", "nebuchadnezzar", "babylonian exile", "cyrus",
        "sennacherib", "moabite", "edomite", "aramaic"],
    1: ["israel antiquities authority", "israel", "jordan", "levant", "near east", "iron age", "roman judea",
        "byzantine church", "synagogue", "inscription", "seal", "bulla", "assyria", "babylon", "persian", "egypt",
        "phoenicia", "tyre", "sidon", "damascus", "corinth", "ephesus", "rome"],
}
NS = {"atom": "http://www.w3.org/2005/Atom"}
UA = {"User-Agent": "Mozilla/5.0 (aleph-hallazgos; https://github.com/XristosKidonis/aleph)"}


def limpio(texto):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", texto or ""))).strip()


def fecha(texto):
    if not texto:
        return None
    try:
        d = parsedate_to_datetime(texto)
    except (TypeError, ValueError):
        try:
            d = datetime.fromisoformat(texto.replace("Z", "+00:00"))
        except ValueError:
            return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def entradas(xml):
    raiz = ET.fromstring(xml)
    for it in raiz.iter("item"):  # RSS
        yield it.findtext("title"), it.findtext("link"), it.findtext("description"), it.findtext("pubDate")
    for it in raiz.iter("{http://www.w3.org/2005/Atom}entry"):  # Atom
        enlace = next((l.get("href") for l in it.findall("atom:link", NS) if l.get("rel") in (None, "alternate")), None)
        yield (it.findtext("atom:title", namespaces=NS), enlace,
               it.findtext("atom:summary", namespaces=NS) or it.findtext("atom:content", namespaces=NS),
               it.findtext("atom:published", namespaces=NS) or it.findtext("atom:updated", namespaces=NS))


def puntaje(texto):
    t = texto.lower()
    encontradas = [k for peso in CLAVES for k in CLAVES[peso] if re.search(r"\b" + re.escape(k) + r"\b", t)]
    return sum(peso for peso in CLAVES for k in CLAVES[peso] if k in encontradas), encontradas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dias", type=int, default=8)
    args = ap.parse_args()
    desde = datetime.now(timezone.utc) - timedelta(days=args.dias)
    candidatos, fallidas, vistos = [], [], set()
    for nombre, url, seriedad in FUENTES:
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
                xml = r.read()
            lista = list(entradas(xml))
        except Exception as e:  # una fuente caída no frena a las demás
            fallidas.append(f"{nombre}: {e}")
            continue
        for titulo, enlace, resumen, publicado in lista:
            d = fecha(publicado)
            if d and d < desde:
                continue
            titulo, resumen = limpio(titulo), limpio(resumen)[:600]
            if titulo.lower() in vistos:  # la misma nota en dos feeds
                continue
            vistos.add(titulo.lower())
            pts, claves = puntaje(f"{titulo} {resumen}")
            if pts >= 2:
                candidatos.append({"puntaje": pts, "fuente": nombre, "seriedad": seriedad, "titulo": titulo,
                                   "enlace": enlace, "fecha": d.date().isoformat() if d else None,
                                   "claves": claves, "resumen": resumen})
    candidatos.sort(key=lambda c: (-c["puntaje"], c["seriedad"] == "aviso"))
    json.dump({"desde": desde.date().isoformat(), "fuentes_caidas": fallidas, "candidatos": candidatos},
              sys.stdout, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
