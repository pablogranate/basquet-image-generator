#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validador de fotos Media Day vs Rosters Liga Nacional de Basquet 2026
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import os
import re
import unicodedata
import requests
from bs4 import BeautifulSoup

BASE_DIR = r"C:\Users\Daniel Sander\Desktop\basquet-image-generator\MEDIADAY-2026\MEDIADAY"
BASE_URL = "https://www.laliganacional.com.ar"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

TEAMS = {
    "ARG":           "/laliga/equipo/1932/88917/argentino-j/roster",
    "ATENAS":        "/laliga/equipo/1498/89552/atenas-c/roster",
    "BOCA":          "/laliga/equipo/19/88922/boca/roster",
    "FERRO":         "/laliga/equipo/46/88969/ferro/roster",
    "GIMNASIA":      "/laliga/equipo/1474/88693/gimnasia-cr/roster",
    "INDEPENDIENTE": "/laliga/equipo/2025/89515/independiente-o/roster",
    "INSTITUTO":     "/laliga/equipo/1790/89036/instituto/roster",
    "LA UNION":      "/laliga/equipo/1541/89128/la-union-fsa/roster",
    "OBERA":         "/laliga/equipo/2305/89125/obera/roster",
    "OBRAS":         "/laliga/equipo/76/89434/obras/roster",
    "OLIMPICO":      "/laliga/equipo/1882/89207/olimpico-lb/roster",
    "PENIAROL":      "/laliga/equipo/2376/89254/penarol-mdp/roster",
    "PLATENSE":      "/laliga/equipo/80/89148/platense/roster",
    "QUIMSA":        "/laliga/equipo/1869/89416/quimsa/roster",
    "RACING CH":     "/laliga/equipo/1992/89551/racing-ch/roster",
    "REGATAS":       "/laliga/equipo/1424/89517/regatas-c/roster",
    "SAN LORENZO":   "/laliga/equipo/88/89192/san-lorenzo/roster",
    "SAN MARTIN":    "/laliga/equipo/1426/88964/san-martin-c/roster",
    "UNION":         "/laliga/equipo/1913/89177/union-sf/roster",
}

# Mapeo de nombre de carpeta local a clave en TEAMS (para carpetas con caracteres especiales)
FOLDER_TO_KEY = {
    "ARG": "ARG",
    "ATENAS": "ATENAS",
    "BOCA": "BOCA",
    "FERRO": "FERRO",
    "GIMNASIA": "GIMNASIA",
    "INDEPENDIENTE": "INDEPENDIENTE",
    "INSTITUTO": "INSTITUTO",
    "LA UNION": "LA UNION",
    "OBERA": "OBERA",
    "OBRAS": "OBRAS",
    "OLIMPICO": "OLIMPICO",
    "PENIAROL": "PENIAROL",
    "PLATENSE": "PLATENSE",
    "QUIMSA": "QUIMSA",
    "RACING CH": "RACING CH",
    "REGATAS": "REGATAS",
    "SAN LORENZO": "SAN LORENZO",
    "SAN MARTIN": "SAN MARTIN",
    "UNION": "UNION",
}

# Mapeo de nombre de carpeta real (puede tener acentos) a clave
REAL_FOLDERS = {
    "ARG": "ARG",
    "ATENAS": "ATENAS",
    "BOCA": "BOCA",
    "FERRO": "FERRO",
    "GIMNASIA": "GIMNASIA",
    "INDEPENDIENTE": "INDEPENDIENTE",
    "INSTITUTO": "INSTITUTO",
    "LA UNION": "LA UNION",
    "OBERA": "OBERA",
    "OBRAS": "OBRAS",
    "OLIMPICO": "OLIMPICO",
    "PEÑAROL": "PENIAROL",
    "PLATENSE": "PLATENSE",
    "QUIMSA": "QUIMSA",
    "RACING CH": "RACING CH",
    "REGATAS": "REGATAS",
    "SAN LORENZO": "SAN LORENZO",
    "SAN MARTIN": "SAN MARTIN",
    "UNION": "UNION",
}

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def normalize(text):
    """Normaliza: mayusculas, sin acentos, solo letras y espacios."""
    text = text.upper().strip()
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^A-Z\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def name_tokens(text):
    return set(normalize(text).split())


def get_roster_from_web(url):
    try:
        r = requests.get(BASE_URL + url, headers=HEADERS, timeout=15)
        if r.status_code != 200:
            return None, f"HTTP {r.status_code}"
        soup = BeautifulSoup(r.text, "html.parser")
        players = []
        for el in soup.find_all("strong", class_="nombre-jugador"):
            name = el.get_text(strip=True)
            if name:
                players.append(name)
        return players, None
    except Exception as e:
        return None, str(e)


def get_photos_from_folder(folder_name):
    folder_path = os.path.join(BASE_DIR, folder_name)
    if not os.path.isdir(folder_path):
        return []
    files = []
    for f in os.listdir(folder_path):
        name, ext = os.path.splitext(f)
        if ext.lower() in IMAGE_EXTENSIONS:
            files.append(name)
    return files


def match_player_to_photo(player_web, photo_names):
    """
    Busca la mejor foto para un jugador del roster web.
    Web: "APELLIDO, NOMBRE" o "APELLIDO APELLIDO, NOMBRE"
    Foto: "## - Nombre Apellido" o "NombreApellido"
    """
    web_tokens = name_tokens(player_web)
    best_match = None
    best_score = 0.0

    for photo in photo_names:
        clean = re.sub(r"^\d+\s*[-\u2013]\s*", "", photo).strip()
        photo_tokens = name_tokens(clean)
        if not photo_tokens:
            continue
        common = web_tokens & photo_tokens
        if len(common) > 0:
            ratio = len(common) / max(len(web_tokens), len(photo_tokens))
            if ratio > best_score:
                best_score = ratio
                best_match = photo

    return best_match if best_score >= 0.4 else None


def run_validation():
    SEP = "=" * 70
    sep2 = "-" * 70

    lines = []

    def p(s=""):
        print(s)
        lines.append(s)

    p(SEP)
    p("  VALIDACION ROSTERS vs FOTOS - LIGA NACIONAL BASQUET 2026")
    p(SEP)
    p()

    summary = []

    for folder_name, team_key in REAL_FOLDERS.items():
        roster_url = TEAMS[team_key]

        p()
        p(SEP)
        p(f"  EQUIPO: {folder_name}  (carpeta: {folder_name})")
        p(SEP)

        web_players, error = get_roster_from_web(roster_url)
        if error:
            p(f"  [ERROR] No se pudo obtener roster web: {error}")
            summary.append((folder_name, 0, 0, 0, ["ERROR WEB"]))
            continue

        photo_names = get_photos_from_folder(folder_name)

        p(f"  Jugadores en web :  {len(web_players)}")
        p(f"  Fotos en carpeta :  {len(photo_names)}")

        matched = []
        sin_foto = []
        used_photos = set()

        for player in web_players:
            m = match_player_to_photo(player, photo_names)
            if m and m not in used_photos:
                matched.append((player, m))
                used_photos.add(m)
            else:
                sin_foto.append(player)

        fotos_sin_jugador = [x for x in photo_names if x not in used_photos]

        p()
        p(f"  [OK] CON FOTO ({len(matched)}):")
        for player, photo in matched:
            p(f"       {player:<40} <- {photo}")

        if sin_foto:
            p()
            p(f"  [FALTA FOTO] SIN FOTO ({len(sin_foto)}) -- No encontrada en la carpeta:")
            for player in sin_foto:
                p(f"       {player}")

        if fotos_sin_jugador:
            p()
            p(f"  [REVISAR] FOTOS SIN MATCH EN ROSTER ({len(fotos_sin_jugador)}) -- posible baja o nombre diferente:")
            for f in fotos_sin_jugador:
                p(f"       {f}")

        summary.append((folder_name, len(web_players), len(matched), len(sin_foto), sin_foto))

    p()
    p(SEP)
    p("  RESUMEN GENERAL")
    p(SEP)
    header = f"  {'EQUIPO':<20} {'EN WEB':>8} {'CON FOTO':>10} {'SIN FOTO':>10} {'COMPLETO':>10}"
    p(header)
    p(f"  {sep2}")
    total_web = total_con_foto = total_sin_foto = 0
    for team, n_web, n_foto, n_sin, _ in summary:
        estado = "SI" if n_sin == 0 and n_web > 0 else "NO"
        p(f"  {team:<20} {n_web:>8} {n_foto:>10} {n_sin:>10} {estado:>10}")
        total_web += n_web
        total_con_foto += n_foto
        total_sin_foto += n_sin
    p(f"  {sep2}")
    p(f"  {'TOTAL':<20} {total_web:>8} {total_con_foto:>10} {total_sin_foto:>10}")
    p()

    # Guardar reporte
    report_path = os.path.join(BASE_DIR, "..", "reporte_mediaday_2026.txt")
    report_path = os.path.abspath(report_path)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    p(f"  Reporte guardado en: {report_path}")


if __name__ == "__main__":
    run_validation()
