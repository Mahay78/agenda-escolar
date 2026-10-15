/**
 * pwa.js - Integración con la PWA (Service Worker, conexión e instalación).
 *
 * Extraído de app.js. Gestiona el registro del Service Worker, el estado
 * online/offline y el prompt de instalación en móvil y escritorio.
 */

import { showToast } from './utils.js';

// Prompt de instalación diferido (beforeinstallprompt)
let deferredPrompt = null;

/**
 * Registra el Service Worker para funcionamiento Offline y gestiona actualizaciones
 */
export function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registrado con éxito en scope:', reg.scope);
          // Detectar nuevas versiones
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker?.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                showToast('🚀 Nueva versión disponible. Actualizando aplicación...', 'info');
              }
            });
          });
        })
        .catch((err) => {
          console.warn('[PWA] Error al registrar Service Worker:', err);
        });

      // Recarga limpia automática cuando el nuevo Service Worker toma el control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }
}

/**
 * Maneja el estado de conexión Online / Offline
 */
export function initConnectionStatus() {
  const statusEl = document.getElementById('connection-status');
  const textEl = document.getElementById('connection-text');

  function updateStatus() {
    if (navigator.onLine) {
      statusEl?.classList.remove('offline');
      if (textEl) textEl.textContent = 'Online';
    } else {
      statusEl?.classList.add('offline');
      if (textEl) textEl.textContent = 'Modo Offline';
      showToast('Estás en Modo Offline. Todos tus datos siguen funcionando.', 'info');
    }
  }

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}

/**
 * Captura el evento de instalación de PWA en móvil y PC
 */
export function initPWAInstallPrompt() {
  const installBtn = document.getElementById('btn-install-pwa');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) {
      installBtn.classList.remove('hidden');
      installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          console.log(`PWA Prompt resultado: ${outcome}`);
          deferredPrompt = null;
          installBtn.classList.add('hidden');
        }
      });
    }
  });

  window.addEventListener('appinstalled', () => {
    console.log('PWA instalada en el dispositivo');
    if (installBtn) installBtn.classList.add('hidden');
    showToast('¡Agenda instalada con éxito en tu dispositivo! 🎉', 'success');
  });
}
