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

let tempCapturedPhoto = null;

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
 * Toma la captura del cuadro actual del video
 */
async function captureSnapshot() {
  if (!cameraVideo.videoWidth) return;

  // Efecto flash
  cameraFlash.classList.add('flash-active');
  setTimeout(() => cameraFlash.classList.remove('flash-active'), 250);

  // Dibujar en canvas
  cameraCanvas.width = cameraVideo.videoWidth;
  cameraCanvas.height = cameraVideo.videoHeight;
  const ctx = cameraCanvas.getContext('2d');

  // Si la cámara es frontal, reflejar para que parezca un espejo
  if (currentFacingMode === 'user') {
    ctx.translate(cameraCanvas.width, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);

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
  cameraPreviewImg.src = dataUrl;
  cameraPreviewImg.classList.remove('hidden');
  cameraVideo.classList.add('hidden');
  cameraControls.classList.add('hidden');
  previewControls.classList.remove('hidden');

  // Pausar video de fondo
  if (cameraVideo) cameraVideo.pause();
}

/**
 * Vuelve a la vista en vivo de la cámara
 */
function resetToLiveView() {
  tempCapturedPhoto = null;
  cameraPreviewImg.src = '';
  cameraPreviewImg.classList.add('hidden');
  cameraVideo.classList.remove('hidden');
  cameraControls.classList.remove('hidden');
  previewControls.classList.add('hidden');
  if (cameraFileInput) cameraFileInput.value = '';

  if (cameraVideo && stream) {
    cameraVideo.play().catch(() => {});
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
