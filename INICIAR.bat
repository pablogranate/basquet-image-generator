@echo off
title BasquetPass.TV — Image Generator
color 0A
echo.
echo  ============================================
echo   BasquetPass.TV  Image Generator
echo  ============================================
echo.
cd /d "%~dp0"
if not exist node_modules\sharp (
    echo  [0/2] Instalando dependencias (sharp, para miniaturas)...
    call npm install --no-audit --no-fund --omit=dev
)
echo  [1/2] Actualizando library.js y miniaturas...
echo        (LN, LUB, LF, LA, Chile, Federal, Dos, LBP Fem, LDA + fondos)
echo.
node generate-library.js
if errorlevel 1 (
    echo.
    echo  ERROR: no se pudo regenerar library.js
    echo  Revisa que Node.js este instalado.
    echo.
    pause
    exit /b 1
)
echo.
echo  [2/2] Iniciando servidor en localhost:3456...
echo.
start "" "http://localhost:3456"
node server.js
pause
