/**
 * theme.js - Gestión de temas visuales y tipografías accesibles.
 *
 * Extraído de app.js (Roadmap Items 32 y 33). Expone las funciones en
 * `window` para que sigan siendo accesibles desde manejadores inline.
 */

import { AppState } from './state.js';
import { setSetting } from '../db.js';
import { showToast } from './utils.js';

export const THEMES_LIST = ['dark', 'light', 'oled', 'lavender', 'forest', 'pastel'];

/**
 * Aplica un tema visual específico (Roadmap Item 32)
 */
window.applyTheme = async function (themeName, notify = true) {
  THEMES_LIST.forEach((t) => {
    document.body.classList.remove(`theme-${t}`);
  });
  document.body.classList.remove('light-theme');

  if (themeName === 'light') {
    document.body.classList.add('light-theme');
  } else if (themeName && themeName !== 'dark') {
    document.body.classList.add(`theme-${themeName}`);
  }

  if (!AppState.studentInfo) AppState.studentInfo = {};
  AppState.studentInfo.theme = themeName;
  try {
    await setSetting('studentInfo', AppState.studentInfo);
  } catch (err) {
    console.warn('Persistencia de tema:', err);
  }

  const themeSelect = document.getElementById('setting-theme-select');
  if (themeSelect && themeSelect.value !== themeName) {
    themeSelect.value = themeName;
  }

  if (notify) {
    const themeLabels = {
      dark: 'Tema Oscuro Moderno 🌙',
      light: 'Tema Claro Luminoso ☀️',
      oled: 'Tema OLED Negro Puro 🖤',
      lavender: 'Tema Lavanda Suave 🪻',
      forest: 'Tema Bosque Esmeralda 🌲',
      pastel: 'Tema Pastel Cálido 🎨'
    };
    showToast(themeLabels[themeName] || 'Tema de color actualizado');
  }
};

/**
 * Conmuta entre los temas principales al pulsar el botón del encabezado
 */
window.toggleTheme = async function () {
  const isLight = document.body.classList.contains('light-theme') || AppState?.studentInfo?.theme === 'light';
  const nextTheme = isLight ? 'dark' : 'light';
  await window.applyTheme(nextTheme, true);
};

/**
 * Aplica una tipografía accesible (Roadmap Item 33)
 */
window.applyFont = async function (fontName, notify = true) {
  document.body.classList.remove('font-dyslexic', 'font-hyperlegible');
  if (fontName === 'dyslexic') {
    document.body.classList.add('font-dyslexic');
  } else if (fontName === 'hyperlegible') {
    document.body.classList.add('font-hyperlegible');
  }

  if (!AppState.studentInfo) AppState.studentInfo = {};
  AppState.studentInfo.fontAccessibility = fontName;
  await setSetting('studentInfo', AppState.studentInfo);

  const fontSelect = document.getElementById('setting-font-select');
  if (fontSelect && fontSelect.value !== fontName) {
    fontSelect.value = fontName;
  }

  if (notify) {
    const fontLabels = {
      default: 'Tipografía Estándar del Sistema',
      dyslexic: 'Tipografía para Dislexia activada 📖',
      hyperlegible: 'Tipografía Atkinson Hyperlegible activada 👓'
    };
    showToast(fontLabels[fontName] || 'Fuente actualizada');
  }
};

export function initTheme() {
  const toggleBtn = document.getElementById('btn-toggle-theme');
  const currentTheme = AppState.studentInfo?.theme || 'dark';
  const currentFont = AppState.studentInfo?.fontAccessibility || 'default';

  window.applyTheme(currentTheme, false);
  window.applyFont(currentFont, false);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', window.toggleTheme);
  }

  const themeSelect = document.getElementById('setting-theme-select');
  if (themeSelect) {
    themeSelect.value = currentTheme;
    themeSelect.addEventListener('change', (e) => {
      window.applyTheme(e.target.value, true);
    });
  }

  const fontSelect = document.getElementById('setting-font-select');
  if (fontSelect) {
    fontSelect.value = currentFont;
    fontSelect.addEventListener('change', (e) => {
      window.applyFont(e.target.value, true);
    });
  }
}
