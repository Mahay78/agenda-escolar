/**
 * utils.js - Utilidades compartidas de la Agenda Escolar.
 *
 * Reúne funciones puras y de interfaz reutilizadas por el resto de módulos:
 * escapado seguro para HTML/atributos, saneado de colores y URLs, formato de
 * fechas, vibración háptica y notificaciones tipo toast.
 */

/**
 * Emite una vibración háptica suave en dispositivos móviles compatibles
 */
export function triggerHaptic(type = 'light') {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      if (type === 'light') navigator.vibrate(15);
      else if (type === 'medium') navigator.vibrate(28);
      else if (type === 'success') navigator.vibrate([15, 60, 25]);
      else if (type === 'error') navigator.vibrate([35, 50, 35]);
      else if (typeof type === 'number') navigator.vibrate(type);
    } catch {
      // Ignorar restricciones de contexto o permisos
    }
  }
}

/**
 * Muestra una notificación temporal en pantalla (sin usar innerHTML)
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  if (type === 'success') triggerHaptic('success');
  else if (type === 'error') triggerHaptic('error');

  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  const iconEl = document.createElement('span');
  iconEl.textContent = icon;
  toast.appendChild(iconEl);
  toast.appendChild(document.createTextNode(' ' + message));

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

export function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTomorrowDateString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return getLocalDateString(d);
}

export function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDaysDifference(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return 0;
  const [y1, m1, d1] = dateStr1.split('-').map(Number);
  const [y2, m2, d2] = dateStr2.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

export function formatDateSpanish(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Escapa texto para insertarlo de forma segura en HTML (contenido o atributos)
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

/**
 * Valida un color CSS permitido (#hex, rgb, rgba, hsl, hsla o nombre simple)
 */
export function safeColor(color, fallback = '#3b82f6') {
  if (typeof color !== 'string') return fallback;
  const value = color.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value;
  if (/^(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/i.test(value)) return value;
  if (/^[a-zA-Z]{3,20}$/.test(value)) return value;
  return fallback;
}

/**
 * Serializa un valor como literal seguro para incrustar en un manejador inline
 * (onclick="..."), evitando el escape del contexto JS mediante entidades HTML.
 */
export function escapeJsArg(value) {
  const json = JSON.stringify(String(value ?? ''));
  return escapeHTML(json);
}

/**
 * Sanea una URL para usarla en atributos href/src, bloqueando esquemas
 * peligrosos como javascript: o data: (excepto imágenes data:image).
 */
export function safeUrl(url) {
  if (typeof url !== 'string') return '#';
  const value = url.trim();
  if (/^(https?:|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(value)) return value;
  if (/^data:image\//i.test(value)) return value;
  return '#';
}
