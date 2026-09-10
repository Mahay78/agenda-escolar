@echo off
chcp 65001 > nul
echo =======================================================
echo 🎒 INICIANDO DESPLIEGUE SUITE AGENDA ESCOLAR (v3.5)
echo =======================================================

echo.
echo [1/4] Comprobando repositorio local Git...
if not exist ".git" (
    echo [*] Inicializando repositorio Git...
    git init
    git remote add origin https://github.com/Mahay78/agenda-escolar.git
)

echo.
echo [2/4] Creando carpetas de arquitectura (Tablet, Mobile y Assets)...
if not exist "tablet" mkdir tablet
if not exist "mobile" mkdir mobile
if not exist "js" mkdir js
if not exist "css" mkdir css
if not exist "docs" mkdir docs

echo.
echo [3/4] Creando archivo indice de verificacion README_SUITE.md...
(
echo # 🎒 Agenda Escolar PWA - Suite Multidispositivo
echo - 🖥 **Desktop Suite:** Raiz del repositorio ^(/^)
echo - 📱 **Tablet Suite:** ^(/tablet/^)
echo - 📲 **Mobile Suite:** ^(/mobile/^)
echo.
echo Despliegue automatico sincronizado con exito para GitHub Pages.
) > README_SUITE.md

echo.
echo [4/4] Añadiendo cambios a Git y preparando commit...
git add .
git commit -m "feat(suite): bundle unificado desktop, tablet y mobile con soporte offline pwa"
echo.
echo =======================================================
echo  ¡Estructura y archivos preparados con exito!
echo Para subir los cambios a GitHub ejecuta:
echo    git branch -M main
echo    git push -u origin main
echo =======================================================
pause
