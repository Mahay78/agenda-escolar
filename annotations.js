/**
 * annotations.js - Editor de anotaciones y correcciones sobre fotografías y láminas
 * Permite dibujar flechas, recuadros, texto y trazos libres para marcar correcciones de profesores.
 */

import { compressImage } from './db.js';

let canvas = null;
let ctx = null;
let currentTool = 'brush'; // 'brush', 'arrow', 'rect', 'circle', 'text'
let currentColor = '#ef4444'; // Rojo corrección por defecto
let currentLineWidth = 4;
let isDrawing = false;
let startX = 0;
let startY = 0;
let baseImage = null;
let historyStack = [];
let onSaveCallback = null;

const annotationModal = document.getElementById('annotation-modal');

export function initAnnotationModule() {
  canvas = document.getElementById('annotation-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  // Eventos de ratón / táctiles en el canvas
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', endDraw);
  canvas.addEventListener('mouseleave', endDraw);

  // Soporte táctil en móviles
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    startDraw({ clientX: touch.clientX, clientY: touch.clientY });
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    draw({ clientX: touch.clientX, clientY: touch.clientY });
  }, { passive: false });

  canvas.addEventListener('touchend', endDraw);

  // Herramientas
  document.querySelectorAll('[data-anno-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-anno-tool]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.getAttribute('data-anno-tool');
    });
  });

  // Colores
  document.querySelectorAll('[data-anno-color]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-anno-color]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentColor = btn.getAttribute('data-anno-color');
    });
  });

  // Grosor
  document.getElementById('anno-line-width')?.addEventListener('change', (e) => {
    currentLineWidth = parseInt(e.target.value, 10);
  });

  // Deshacer (Undo)
  document.getElementById('btn-anno-undo')?.addEventListener('click', undoLastAction);

  // Guardar y Cancelar
  document.getElementById('btn-anno-save')?.addEventListener('click', saveAnnotatedImage);
  document.getElementById('btn-anno-cancel')?.addEventListener('click', closeAnnotationModal);
}

/**
 * Abre el editor de anotaciones con una imagen existente
 * @param {string} imageSrc DataURL o ruta de la foto
 * @param {Function} callback Función que recibe la foto con las anotaciones guardadas
 */
export function openAnnotationEditor(imageSrc, callback) {
  if (!canvas || !annotationModal) return;
  onSaveCallback = callback;
  historyStack = [];

  baseImage = new Image();
  baseImage.onload = () => {
    // Dimensionar canvas manteniendo aspecto
    const maxWidth = Math.min(window.innerWidth * 0.9, 900);
    const maxHeight = Math.min(window.innerHeight * 0.65, 650);

    let width = baseImage.width;
    let height = baseImage.height;

    if (width > height) {
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
    } else {
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(baseImage, 0, 0, width, height);

    // Guardar estado inicial
    saveStateToHistory();

    annotationModal.classList.remove('hidden');
  };
  baseImage.src = imageSrc;
}

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function startDraw(e) {
  isDrawing = true;
  const pos = getCanvasPos(e);
  startX = pos.x;
  startY = pos.y;

  if (currentTool === 'brush') {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentLineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  } else if (currentTool === 'text') {
    isDrawing = false;
    const text = prompt('Escribe el texto o corrección para la lámina:');
    if (text) {
      ctx.font = `bold ${Math.max(16, currentLineWidth * 5)}px sans-serif`;
      ctx.fillStyle = currentColor;
      ctx.fillText(text, startX, startY);
      saveStateToHistory();
    }
  }
}

function draw(e) {
  if (!isDrawing) return;
  const pos = getCanvasPos(e);

  if (currentTool === 'brush') {
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  } else {
    // Para formas geométricas, restaurar el último estado y previsualizar
    restoreLastHistoryState();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentLineWidth;

    if (currentTool === 'arrow') {
      drawArrow(ctx, startX, startY, pos.x, pos.y, currentLineWidth * 3);
    } else if (currentTool === 'rect') {
      ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
    } else if (currentTool === 'circle') {
      const radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
      ctx.beginPath();
      ctx.arc(startX, startY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function endDraw() {
  if (isDrawing) {
    isDrawing = false;
    if (currentTool === 'brush') {
      ctx.closePath();
    }
    saveStateToHistory();
  }
}

function drawArrow(context, fromx, fromy, tox, toy, headlen = 12) {
  const dx = tox - fromx;
  const dy = toy - fromy;
  const angle = Math.atan2(dy, dx);

  context.beginPath();
  context.moveTo(fromx, fromy);
  context.lineTo(tox, toy);
  context.stroke();

  context.beginPath();
  context.moveTo(tox, toy);
  context.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
  context.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fillStyle = currentColor;
  context.fill();
}

function saveStateToHistory() {
  if (historyStack.length > 20) historyStack.shift();
  historyStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
}

function restoreLastHistoryState() {
  if (historyStack.length > 0) {
    ctx.putImageData(historyStack[historyStack.length - 1], 0, 0);
  }
}

function undoLastAction() {
  if (historyStack.length > 1) {
    historyStack.pop(); // Quitar estado actual
    const previous = historyStack[historyStack.length - 1];
    ctx.putImageData(previous, 0, 0);
  }
}

async function saveAnnotatedImage() {
  try {
    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const compressed = await compressImage(rawDataUrl, 1280, 1280, 0.82);
    if (onSaveCallback) {
      onSaveCallback(compressed);
    }
    closeAnnotationModal();
  } catch (err) {
    alert('Error al guardar la imagen anotada: ' + err.message);
  }
}

export function closeAnnotationModal() {
  if (annotationModal) annotationModal.classList.add('hidden');
  onSaveCallback = null;
  historyStack = [];
}
