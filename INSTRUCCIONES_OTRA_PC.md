# Cómo abrir este proyecto en otra PC

## 1. Requisitos
- Instalar **Node.js**: https://nodejs.org (versión LTS)
- Instalar **Claude Code**: https://claude.ai/code

## 2. Ejecutar el servidor
1. Descomprime el ZIP en el Escritorio
2. Abre una terminal dentro de la carpeta `basquet-image-generator`
3. Ejecuta:
   ```
   node server.js
   ```
4. Abre el navegador en: **http://localhost:3456**

## 3. Restaurar la memoria en Claude Code
Para que Claude recuerde el contexto del proyecto:

1. Abre Claude Code
2. En la nueva PC, Claude buscará la carpeta `.claude` en tu perfil de usuario
3. Copia la carpeta `memory` que está dentro del ZIP a:
   ```
   C:\Users\TU_USUARIO\.claude\projects\C--Program-Files-Git\memory\
   ```
   (crea las carpetas si no existen)
4. Los archivos a copiar son:
   - `MEMORY.md`
   - `feedback_change_discipline.md`

## 4. Archivos del proyecto incluidos
- `index.html` — App completa
- `library.js` — Base de datos de ligas y equipos
- `server.js` — Servidor local
- `generate-library.js` — Para regenerar library.js si agregas imágenes
- `CLAUDE_PROJECT_CONTEXT.md` — Contexto para Claude
- Todas las carpetas de imágenes (fondos, escudos, media days)
