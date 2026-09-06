/**
 * camera.js - Módulo de captura de cámara y gestión de fotografías
 * Soporta cámara en vivo (getUserMedia), alternar cámara trasera/delantera,
 * captura con flash, vista previa instantánea y subida desde galería como alternativa.
 */

import { compressImage } from './db.js';

let stream = null;
let currentFacingMode = 'environment'; // Por defecto cámara trasera (ideal para pizarras y libros)
let onPhotoCapturedCallback = null;

// Elementos del DOM del modal de cámara
const cameraModal = document.getElementById('camera-modal');
const cameraVideo = document.getElementById('camera-video');
const cameraCanvas = document.getElementById('camera-canvas');
const cameraFlash = document.getElementById('camera-flash');
const cameraControls = document.getElementById('camera-controls');
const previewControls = document.getElementById('preview-controls');
const cameraPreviewImg = document.getElementById('camera-preview-img');
const cameraFileInput = document.getElementById('camera-file-input');
const switchCameraBtn = document.getElementById('btn-switch-camera');
const cameraZoomBar = document.getElementById('camera-zoom-bar');
const cameraZoomSlider = document.getElementById('camera-zoom-slider');
const cameraZoomText = document.getElementById('camera-zoom-text');
const btnZoomPreview = document.getElementById('btn-zoom-preview');

let tempCapturedPhoto = null;
let currentZoom = 1;
let isHardwareZoom = false;
let isPreviewZoomed = false;
let initialPinchDistance = null;
let initialPinchZoom = 1;

/**
 * Inicializa los eventos de la cámara
 */
export function initCameraModule() {
  const closeCameraBtn = document.getElementById('btn-close-camera');
  const captureBtn = document.getElementById('btn-capture-photo');
  const retakeBtn = document.getElementById('btn-retake-photo');
  const acceptBtn = document.getElementById('btn-accept-photo');
  const uploadGalleryBtn = document.getElementById('btn-upload-gallery');

  if (closeCameraBtn) closeCameraBtn.addEventListener('click', closeCamera);
  if (captureBtn) captureBtn.addEventListener('click', captureSnapshot);
  if (retakeBtn) retakeBtn.addEventListener('click', retakePhoto);
  if (acceptBtn) acceptBtn.addEventListener('click', acceptPhoto);
  if (switchCameraBtn) switchCameraBtn.addEventListener('click', switchCamera);

  // Inicializar controles de Zoom (Píldoras 1x/2x/3x, slider y pinch-to-zoom táctil)
  initZoomControls();

  if (uploadGalleryBtn && cameraFileInput) {
    uploadGalleryBtn.addEventListener('click', () => {
      cameraFileInput.click();
    });

    cameraFileInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        try {
          const compressed = await compressImage(e.target.files[0], 1280, 1280, 0.78);
          showPreview(compressed);
        } catch (err) {
          alert('Error al cargar la foto: ' + err.message);
        }
      }
    });
  }

  // Inicializar visor de fotos a pantalla completa
  initImageViewer();
}

/**
 * Abre el modal de la cámara
 * @param {Function} callback Función que recibe el string base64 de la foto aceptada
 */
export async function openCamera(callback) {
  onPhotoCapturedCallback = callback;
  tempCapturedPhoto = null;

  cameraModal.classList.remove('hidden');
  resetToLiveView();

  try {
    await startCameraStream();
  } catch (err) {
    console.warn('No se pudo acceder a la cámara en vivo:', err);
    // Si falla el acceso en vivo (por permisos o HTTP), ofrecer la carga de archivos
    const useGallery = confirm(
      'No se pudo abrir la cámara en vivo (es posible que falten permisos en el navegador).\n\n¿Deseas seleccionar una foto desde tu galería o usar la cámara del móvil mediante archivo?'
    );
    if (useGallery && cameraFileInput) {
      cameraFileInput.click();
    } else {
      closeCamera();
    }
  }
}

/**
 * Inicia el stream de video de la cámara
 */
async function startCameraStream() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Cámara no disponible directamente en este navegador (requiere HTTPS o localhost)');
  }

  if (stream) {
    stopCameraStream();
  }

  const constraints = {
    audio: false,
    video: {
      facingMode: currentFacingMode,
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraVideo.srcObject = stream;
    await cameraVideo.play();
    await applyZoom(currentZoom);
  } catch (err) {
    // Si falla con 'environment' (ej. en PC que solo tiene webcam frontal)
    if (currentFacingMode === 'environment') {
      currentFacingMode = 'user';
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true
      });
      cameraVideo.srcObject = stream;
      await cameraVideo.play();
      await applyZoom(currentZoom);
    } else {
      throw err;
    }
  }
}

/**
 * Detiene el stream de video
 */
function stopCameraStream() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  if (cameraVideo) {
    cameraVideo.srcObject = null;
  }
}

/**
 * Alterna entre cámara delantera y trasera
 */
async function switchCamera() {
  currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
  try {
    await startCameraStream();
  } catch (err) {
    console.error('Error al cambiar de cámara:', err);
  }
}

/**
 * Inicializa los controles de Zoom
 */
function initZoomControls() {
  // Botones de presets (1x, 2x, 3x)
  const zoomBtns = document.querySelectorAll('.zoom-pill-btn');
  zoomBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const z = parseFloat(btn.getAttribute('data-zoom') || '1');
      applyZoom(z);
    });
  });

  // Slider de Zoom continuo
  if (cameraZoomSlider) {
    cameraZoomSlider.addEventListener('input', (e) => {
      applyZoom(parseFloat(e.target.value));
    });
  }

  // Gesto táctil Pinch-to-Zoom en el video
  if (cameraVideo) {
    cameraVideo.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDistance = Math.hypot(dx, dy);
        initialPinchZoom = currentZoom;
      }
    }, { passive: true });

    cameraVideo.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && initialPinchDistance) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / initialPinchDistance;
        const targetZoom = Math.min(Math.max(initialPinchZoom * factor, 1), 4);
        applyZoom(targetZoom);
      }
    }, { passive: true });

    cameraVideo.addEventListener('touchend', () => {
      initialPinchDistance = null;
    }, { passive: true });
  }

  // Zoom de inspección en vista previa de la foto
  if (btnZoomPreview) {
    btnZoomPreview.addEventListener('click', togglePreviewZoom);
  }
  if (cameraPreviewImg) {
    cameraPreviewImg.addEventListener('click', togglePreviewZoom);
  }
}

/**
 * Alterna el zoom de inspección (2.5x) en la vista previa
 */
function togglePreviewZoom() {
  isPreviewZoomed = !isPreviewZoomed;
  if (cameraPreviewImg) {
    cameraPreviewImg.classList.toggle('inspect-zoom', isPreviewZoomed);
  }
  if (btnZoomPreview) {
    btnZoomPreview.textContent = isPreviewZoomed ? '🔍 Normal (1x)' : '🔍 Zoom 2.5x';
    btnZoomPreview.classList.toggle('btn-primary', isPreviewZoomed);
    btnZoomPreview.classList.toggle('btn-secondary', !isPreviewZoomed);
  }
}

/**
 * Aplica el nivel de zoom a la cámara (Hardware o Software/Canvas)
 */
async function applyZoom(level) {
  currentZoom = Math.min(Math.max(level, 1), 4);
  currentZoom = Math.round(currentZoom * 10) / 10;

  if (cameraZoomText) cameraZoomText.textContent = `${currentZoom.toFixed(1)}x`;
  if (cameraZoomSlider) cameraZoomSlider.value = String(currentZoom);

  const zoomBtns = document.querySelectorAll('.zoom-pill-btn');
  zoomBtns.forEach((btn) => {
    const zVal = parseFloat(btn.getAttribute('data-zoom') || '1');
    btn.classList.toggle('active', Math.abs(zVal - currentZoom) < 0.2);
  });

  // 1. Intentar aplicar zoom óptico/digital por hardware si el navegador lo soporta
  let hwSuccess = false;
  if (stream) {
    const [track] = stream.getVideoTracks();
    if (track && typeof track.getCapabilities === 'function') {
      const caps = track.getCapabilities();
      if (caps && 'zoom' in caps) {
        try {
          const hwZoom = Math.min(Math.max(currentZoom, caps.zoom.min || 1), caps.zoom.max || 4);
          await track.applyConstraints({ advanced: [{ zoom: hwZoom }] });
          hwSuccess = true;
          isHardwareZoom = true;
        } catch (e) {
          hwSuccess = false;
        }
      }
    }
  }

  // 2. Zoom digital CSS suave para previsualización inmediata
  if (cameraVideo) {
    cameraVideo.style.setProperty('--current-zoom', currentZoom);
    if (!hwSuccess) {
      cameraVideo.style.transform = `scale(${currentZoom})`;
      isHardwareZoom = false;
    } else {
      cameraVideo.style.transform = 'scale(1)';
    }
  }
}

/**
 * Toma la captura del cuadro actual del video con animación de zoom y recorte
 */
async function captureSnapshot() {
  if (!cameraVideo.videoWidth) return;

  // Efecto Flash + Efecto Zoom Dinámico al disparar la foto
  cameraFlash.classList.add('flash-active');
  cameraVideo.classList.add('snap-anim');
  setTimeout(() => cameraFlash.classList.remove('flash-active'), 250);
  setTimeout(() => cameraVideo.classList.remove('snap-anim'), 300);

  // Dibujar en canvas
  cameraCanvas.width = cameraVideo.videoWidth;
  cameraCanvas.height = cameraVideo.videoHeight;
  const ctx = cameraCanvas.getContext('2d');

  // Si la cámara es frontal, reflejar para que parezca un espejo
  if (currentFacingMode === 'user') {
    ctx.translate(cameraCanvas.width, 0);
    ctx.scale(-1, 1);
  }

  // Si se aplicó zoom digital por software, recortar centrado manteniendo la resolución
  if (currentZoom > 1 && !isHardwareZoom) {
    const cropW = cameraVideo.videoWidth / currentZoom;
    const cropH = cameraVideo.videoHeight / currentZoom;
    const cropX = (cameraVideo.videoWidth - cropW) / 2;
    const cropY = (cameraVideo.videoHeight - cropH) / 2;
    ctx.drawImage(cameraVideo, cropX, cropY, cropW, cropH, 0, 0, cameraCanvas.width, cameraCanvas.height);
  } else {
    ctx.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
  }

  const rawDataUrl = cameraCanvas.toDataURL('image/jpeg', 0.9);

  // Comprimir imagen para almacenamiento
  const compressed = await compressImage(rawDataUrl, 1280, 1280, 0.78);
  showPreview(compressed);
}

/**
 * Muestra la vista previa de la foto capturada
 */
function showPreview(dataUrl) {
  tempCapturedPhoto = dataUrl;
  isPreviewZoomed = false;
  cameraPreviewImg.src = dataUrl;
  cameraPreviewImg.classList.remove('hidden', 'inspect-zoom');
  if (btnZoomPreview) {
    btnZoomPreview.textContent = '🔍 Zoom 2.5x';
    btnZoomPreview.classList.remove('btn-primary');
    btnZoomPreview.classList.add('btn-secondary');
  }
  cameraVideo.classList.add('hidden');
  cameraControls.classList.add('hidden');
  if (cameraZoomBar) cameraZoomBar.classList.add('hidden');
  previewControls.classList.remove('hidden');

  // Pausar video de fondo
  if (cameraVideo) cameraVideo.pause();
}

/**
 * Vuelve a la vista en vivo de la cámara
 */
function resetToLiveView() {
  tempCapturedPhoto = null;
  isPreviewZoomed = false;
  cameraPreviewImg.src = '';
  cameraPreviewImg.classList.remove('inspect-zoom');
  cameraPreviewImg.classList.add('hidden');
  cameraVideo.classList.remove('hidden');
  cameraControls.classList.remove('hidden');
  if (cameraZoomBar) cameraZoomBar.classList.remove('hidden');
  previewControls.classList.add('hidden');
  if (cameraFileInput) cameraFileInput.value = '';

  if (cameraVideo && stream) {
    cameraVideo.play().catch(() => {});
    applyZoom(currentZoom);
  }
}

function retakePhoto() {
  resetToLiveView();
}

function acceptPhoto() {
  if (tempCapturedPhoto && onPhotoCapturedCallback) {
    onPhotoCapturedCallback(tempCapturedPhoto);
  }
  closeCamera();
}

export function closeCamera() {
  stopCameraStream();
  cameraModal.classList.add('hidden');
  resetToLiveView();
  onPhotoCapturedCallback = null;
  tempCapturedPhoto = null;
}

// ----------------------------------------------------
// Visor de fotos a pantalla completa (Full-screen Lightbox)
// ----------------------------------------------------
let viewerModal = null;
let viewerImg = null;

function initImageViewer() {
  viewerModal = document.getElementById('image-viewer-modal');
  viewerImg = document.getElementById('image-viewer-img');
  const closeViewerBtn = document.getElementById('btn-close-viewer');

  if (closeViewerBtn && viewerModal) {
    closeViewerBtn.addEventListener('click', () => {
      viewerModal.classList.add('hidden');
      viewerImg.src = '';
    });
  }

  // Cerrar al pulsar fuera de la imagen
  if (viewerModal) {
    viewerModal.addEventListener('click', (e) => {
      if (e.target === viewerModal) {
        viewerModal.classList.add('hidden');
        viewerImg.src = '';
      }
    });
  }
}

/**
 * Abre cualquier foto en el visor a pantalla completa
 */
export function openImageViewer(src, title = '') {
  if (!viewerModal || !viewerImg) return;
  viewerImg.src = src;
  const titleEl = document.getElementById('image-viewer-title');
  if (titleEl) titleEl.textContent = title || 'Fotografía';
  viewerModal.classList.remove('hidden');
}
