# BasquetPass.TV - Image Generator

## Resumen del Proyecto
App web de un solo archivo HTML para generar imágenes promocionales de partidos de basquet en formatos Desktop (2304x720) y Mobile (800x800).

## Archivos Principales
- **index.html** — App completa (HTML + CSS + JS en un solo archivo)
- **library.js** — Base de datos de ligas, equipos, jugadores y fondos (auto-generada, JSON compacto)
- **generate-library.js** — Regenera library.js escaneando carpetas. Colapsa fotos repetidas del mismo jugador y genera miniaturas (`MEDIA_THUMBS/`, `FONDOS_THUMBS/`) si `sharp` está instalado. Flags: `--pretty`, `--strict`.
- **server.js** — Servidor HTTP local (gzip + cache headers, igual que nginx en prod)
- **test/generator.test.js** — Tests del generador contra un árbol de fixtures (`npm test`)
- **test/smoke.test.js** — Smoke test en Chromium headless con Playwright (`npm run smoke`, o `PLAYWRIGHT_PATH=...`)

## Cómo Ejecutar
1. Abrir terminal en la carpeta del proyecto
2. Ejecutar: `node server.js`
3. Abrir en navegador: http://localhost:3456

## Ligas Incluidas
- Liga Nacional (Argentina) - 19 equipos, 253 jugadores media day
- LUB (Uruguay) - 12 equipos, 183 jugadores
- Liga Femenina - 18 equipos, 286 jugadoras
- Liga Argentina - 34 equipos, 475 jugadores
- Liga Federal - logo-only teams
- Liga Dos - logo-only teams
- LNB Chile (Liga Cherry) - 14 equipos, 277 jugadores
- LBP Femenina - 7 equipos, logo-only

## Estructura de Carpetas de Imágenes
- MEDIADAY-2026/ — Fotos media day Liga Nacional
- MEDIA DAY LUB/ — Fotos media day LUB
- MEDIA DAY CHILE/ — Fotos media day Chile
- MEDIA DAY LIGA ARGENTINA/ — Fotos media day Liga Argentina
- MEDIADAY LIGA FEMENINA/ — Fotos media day Liga Femenina
- LOGOS LN/ — Escudos Liga Nacional
- ESCUDOS LUB/ — Escudos LUB
- ESCUDOS LIGA ARGENTINA/ — Escudos Liga Argentina
- ESCUDOS LIGA FEMENINA/ — Escudos Liga Femenina
- ESCUDOS LIGA FEDERAL/ — Escudos Liga Federal
- LOGOS CHERY/ — Escudos Chile
- ESCUDOS LIGA DOS/ — Escudos Liga Dos
- LOGOS BASQUETPRO FEMENINA/ — Escudos LBP Femenina
- LOGOS LIGAS/ — Logos de cada liga
- FONDOS/ — Fondos generados con IA

## Funcionalidades
- Templates de fondo con selector de color aleatorio y custom
- 3 partidos (1 principal + 2 secundarios) con escudos y textos
- Jugadores con fotos media day arrastrables en canvas (Photoshop-style)
- Segundo jugador opcional por equipo
- 20 efectos visuales para jugadores (glow, shadow, neon, glitch, etc.)
- Escala/posición independiente desktop vs mobile
- Logo de liga ajustable independiente desktop/mobile
- Texto personalizable (modo auto o manual)
- Show/hide escudos centrales
- Auto-save/restore con localStorage + IndexedDB
- Subida de fotos custom por equipo (almacenadas en IndexedDB)
- Cuentagotas (EyeDropper API) en todos los selectores de color
- Descarga PNG en alta resolución

## Notas Técnicas
- Requiere localhost (no file://) por CORS en canvas
- crossOrigin='anonymous' en todas las imágenes
- Miniaturas pre-generadas por `generate-library.js` (jugadores 96px en `MEDIA_THUMBS/`, fondos 240px en `FONDOS_THUMBS/`). El navegador nunca descarga una foto completa para mostrar una miniatura; si falta, muestra un placeholder.
- Miniaturas de jugadores cargan bajo demanda (IntersectionObserver) al hacer scroll
- render() se agrupa por frame (requestAnimationFrame); el arrastre redibuja solo el canvas activo
- Capas de jugador procesadas (efectos) se cachean por imagen/tamaño/escala/efectos; mover en X reutiliza la capa
- Auto-save de inputs a localStorage cada 1000ms; imágenes de cada slot van a IndexedDB al asignarse (store `slotImages`)
- IndexedDB para fotos custom persistentes por liga/equipo
- Fuentes Loos en WOFF2 (subset latino) con fallback OTF

## Producción
- Servida en generator.basket-app.com desde `/opt/basquet-image-generator` (nginx, detrás del gate del portal)
- Deploy: scp de index.html y library.js. Carpetas de imágenes se suben aparte con tar+scp.
- Las carpetas MEDIA DAY deben subirse desde la PC que las tiene; sin ellas los jugadores muestran placeholders.
