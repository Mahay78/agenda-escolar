#!/usr/bin/env bash
set -e

echo "======================================================="
echo "🎒 INICIANDO SINCRONIZACIÓN SUITE AGENDA ESCOLAR (v3.5)"
echo "======================================================="

# 1. Comprobar Git
if [ ! -d ".git" ]; then
  echo "📦 Inicializando nuevo repositorio Git..."
  git init
  git remote add origin https://github.com/Mahay78/agenda-escolar.git 2>/dev/null || true
fi

# 2. Crear carpetas de las suites
echo "📁 Generando árbol de carpetas: tablet/ y mobile/..."
mkdir -p tablet mobile js/modules css/themes docs assets/icons

# 3. Generar archivo de configuración y enlaces de navegación
cat << 'EOF' > README_SUITE.md
# 🎒 Agenda Escolar PWA - Suite Multidispositivo (v3.5)
> Repositorio oficial: https://github.com/Mahay78/agenda-escolar

### 🌐 Distribución de Vistas:
1. **Desktop Suite (PC / Mac):**
   - `/index.html` (Dashboard Mi Día & Agenda)
   - `/notebook.html` (Cuaderno LM RAG)
   - `/horario-mochila.html` (Horario Semanal & Mochila)
   - `/progreso-ebau.html` (Calificaciones & EBAU)
   - `/pomodoro-flashcards.html` (Pomodoro Zen & Fichas)
   - `/portafolio-artistico.html` (Portafolio & Taller)
   - `/english-coach.html` (English Coach & Tutor)
   - `/deberes-examenes.html` (Deberes & OCR)
   - `/ajustes-nube.html` (Ajustes Google Drive / Firebase)

2. **Tablet Suite (iPad / Stylus):**
   - `/tablet/index.html` (Mi Día Tablet)
   - `/tablet/cuaderno-lm.html` (Cuaderno LM 3 Columnas)
   - `/tablet/horario-mochila.html`
   - `/tablet/progreso-ebau.html`
   - `/tablet/pomodoro-flashcards.html`
   - `/tablet/portafolio-artistico.html`
   - `/tablet/english-coach.html`
   - `/tablet/deberes-examenes.html`
   - `/tablet/ajustes-nube.html`

3. **Mobile Suite (PWA Smartphone):**
   - `/mobile/index.html` (Mi Día Móvil)
   - `/mobile/agenda.html` (Deberes, Exámenes & Horario)
   - `/mobile/cuaderno-lm.html` (Cuaderno LM & Podcast)
   - `/mobile/pomodoro-flashcards.html`
   - `/mobile/progreso-ebau.html`
   - `/mobile/english-coach.html`
   - `/mobile/camera-ocr.html` (Cámara con Zoom y OCR)
EOF

# 4. Commit y Estado
git add .
git commit -m "feat(suite): bundle unificado desktop, tablet y mobile con soporte offline pwa" || echo "Sin cambios pendientes para commitear."

echo ""
echo "======================================================="
echo " Despliegue local completado."
echo "Para sincronizar con GitHub Pages ejecuta:"
echo "   git branch -M main"
echo "   git push -u origin main"
echo "======================================================="
