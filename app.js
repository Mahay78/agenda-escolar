/**
 * app.js - Lógica principal de la aplicación Agenda Escolar
 * Gestiona el enrutamiento de pestañas, renderizado, eventos, IndexedDB y PWA.
 */

import {
  initDB,
  getAll,
  getById,
  saveItem,
  deleteItem,
  getSetting,
  setSetting,
  seedInitialDataIfNeeded,
  applySubjectPreset,
  exportBackup,
  importBackup,
  compressImage,
  moveToTrash,
  getTrashItems,
  restoreFromTrash,
  deletePermanentlyFromTrash,
  emptyTrash
} from './db.js';

import { initCameraModule, openCamera, openImageViewer } from './camera.js';
import { initAnnotationModule, openAnnotationEditor } from './annotations.js';
import {
  exportSchedulePDF,
  exportGradesReportPDF,
  exportProjectDossierPDF
} from './pdf-export.js';
import {
  downloadICS,
  generateExamsICS,
  generateScheduleICS,
  exportSingleExam
} from './ics-export.js';
import {
  getGamificationStats,
  recordStudyActivity,
  ACHIEVEMENTS
} from './gamification.js';
import {
  areNotificationsSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
  checkDueReminders
} from './notifications.js';
import {
  initFirebase,
  loginWithGoogle,
  loginAnonymously,
  logoutFirebase,
  getCurrentUser,
  uploadToCloud,
  downloadFromCloud
} from './firebase-sync.js';
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  getConnectedGoogleUser,
  getSavedGoogleUser,
  isGoogleDriveConnected,
  getGoogleClientId,
  setGoogleClientId,
  uploadBackupToGoogleDrive,
  listBackupsFromGoogleDrive,
  downloadBackupFromGoogleDrive
} from './google-drive-sync.js';
import {
  createFlashcard,
  getDueFlashcards,
  calculateFlashcardStats,
  processCardReview,
  seedSampleFlashcardsIfNeeded,
  LEITNER_INTERVALS,
  BOX_NAMES
} from './flashcards.js';
import {
  startRecording,
  stopRecording,
  cancelRecording,
  playPomodoroBell,
  playBreakBell,
  startSpeechDictation,
  stopSpeechDictation,
  isSpeechRecognitionSupported,
  isDictating
} from './audio.js';
import {
  renderQRCodeToCanvas,
  formatTasksForWhatsApp,
  formatExamsForWhatsApp,
  formatScheduleForWhatsApp,
  sendToWhatsApp
} from './qr.js';
import {
  recognizeImageText,
  loadTesseractScript,
  getCachedOcrText,
  setCachedOcrText,
  cleanOcrText,
  formatAsBulletList,
  recognizeWithGemini,
  recognizeWithDeviceAI,
  isDeviceAISupported
} from './ocr.js';
import {
  registerAppCallbacks,
  askAIAssistant,
  generateFlashcardsWithAI,
  getAIApiKey,
  saveAIApiKey,
  speakText,
  stopSpeaking,
  isSpeaking,
  appendToChatHistory,
  clearChatHistory,
  getChatHistory
} from './ai-assistant.js';

// Estado global de la aplicación
const AppState = {
  activeTab: 'tab-today',
  selectedScheduleDay: new Date().getDay() >= 1 && new Date().getDay() <= 5 ? new Date().getDay() : 1,
  taskFilter: 'all',
  termFilter: 'all',
  materialFilter: 'all',
  projectFilter: 'all',
  gallerySearchQuery: '',
  globalSearchActiveFilter: 'all',
  subjects: [],
  schedule: [],
  tasks: [],
  exams: [],
  grades: [],
  projects: [],
  materials: [],
  flashcards: [],
  flashcardsSubjectFilter: 'all',
  flashcardsBoxFilter: 'all',
  flashcardsMode: 'study',
  studySessionCards: [],
  currentStudyCardIndex: 0,
  isStudyCardFlipped: false,
  timeSlots: [],
  studentInfo: {},
  tempTaskPhotos: [],
  tempExamPhotos: [],
  tempProjectPhotos: [],
  tempTaskAudio: null,
  tempExamAudio: null,
  tempProjectAudio: null,
  currentViewedImageSrc: null,
  isRecordingAudio: false,
  isRecordingExamAudio: false,
  isRecordingProjectAudio: false,
  pomodoro: {
    timeLeft: 25 * 60,
    totalTime: 25 * 60,
    isRunning: false,
    mode: 'work',
    timerId: null,
    countToday: 0,
    totalFocusMinutes: 0
  },
  trash: []
};

// Variable para el evento de instalación PWA
let deferredPrompt = null;

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Iniciar IndexedDB y datos iniciales
    await initDB();
    await seedInitialDataIfNeeded();

    // 2. Cargar datos en el estado
    await loadAllData();

    // 3. Inicializar módulos UI, Cámara, Anotaciones y Audio
    initCameraModule();
    initAnnotationModule();
    initAudioRecorder();
    initPomodoro();
    initTheme();
    initNavigation();
    initConnectionStatus();
    initServiceWorker();
    initPWAInstallPrompt();
    initEventListeners();
    initSubjectIconPicker();
    initVoiceDictation();
    initGradeSimulator();
    initPrintActions();
    initGlobalSearch();
    initOcrModule();
    initGallerySearch();
    initGamification();
    initTrashModule();
    initSubjectResourcesModule();
    initNotificationsModule();
    initPdfExportModule();
    initIcsExportModule();
    initGoogleDriveModule();
    initFirebaseSyncModule();
    initFlashcardsModule();
    initAIAssistantModule();

    // 4. Renderizar vistas
    renderAllViews();

    console.log('Agenda Escolar lista y operativa.');
  } catch (err) {
    console.error('Error al inicializar la aplicación:', err);
    showToast('Error al inicializar la agenda: ' + err.message, 'error');
  }
});

/**
 * Carga todos los datos de IndexedDB a la memoria
 */
async function loadAllData() {
  AppState.subjects = await getAll('subjects');
  AppState.schedule = await getAll('schedule');
  AppState.tasks = await getAll('tasks');
  AppState.exams = await getAll('exams');
  AppState.grades = await getAll('grades');
  AppState.projects = await getAll('projects');
  AppState.materials = await getAll('materials');
  AppState.flashcards = await getAll('flashcards');
  if (AppState.flashcards.length === 0) {
    AppState.flashcards = await seedSampleFlashcardsIfNeeded(AppState.subjects);
  }
  AppState.trash = await getTrashItems();
  AppState.timeSlots = await getSetting('timeSlots', []);
  AppState.studentInfo = await getSetting('studentInfo', {
    studentName: 'Estudiante',
    schoolName: 'Instituto de Educación Secundaria',
    course: '1º Bachillerato de Artes',
    theme: 'dark'
  });
  
  const savedPomo = await getSetting('pomodoroStats');
  if (savedPomo && savedPomo.date === getTodayDateString()) {
    AppState.pomodoro.countToday = savedPomo.countToday || 0;
    AppState.pomodoro.totalFocusMinutes = savedPomo.totalFocusMinutes || 0;
  }

  updateTrashCounters();
}

/**
 * Registra el Service Worker para funcionamiento Offline
 */
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registrado con éxito en scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Error al registrar Service Worker:', err);
        });
    });
  }
}

/**
 * Maneja el estado de conexión Online / Offline
 */
function initConnectionStatus() {
  const statusEl = document.getElementById('connection-status');
  const textEl = document.getElementById('connection-text');

  function updateStatus() {
    if (navigator.onLine) {
      statusEl.classList.remove('offline');
      textEl.textContent = 'Online';
    } else {
      statusEl.classList.add('offline');
      textEl.textContent = 'Modo Offline';
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
function initPWAInstallPrompt() {
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

/**
 * Configuración del tema Oscuro / Claro
 */
window.toggleTheme = async function () {
  document.body.classList.toggle('light-theme');
  const isLight = document.body.classList.contains('light-theme');
  if (!AppState.studentInfo) AppState.studentInfo = {};
  AppState.studentInfo.theme = isLight ? 'light' : 'dark';
  await setSetting('studentInfo', AppState.studentInfo);
  showToast(isLight ? 'Tema Claro activado ☀️' : 'Tema Oscuro activado 🌙');
};

function initTheme() {
  const toggleBtn = document.getElementById('btn-toggle-theme');
  const currentTheme = AppState.studentInfo?.theme || 'dark';

  if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', window.toggleTheme);
  }
}

/**
 * Navegación por pestañas y Menú Lateral (Drawer)
 */
function initNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab');
      if (targetId) {
        switchTab(targetId);
      }
    });
  });

  // Inicializar navegación del cajón lateral (Drawer)
  initDrawerNavigation();
}

function initDrawerNavigation() {
  const drawer = document.getElementById('app-drawer');
  const overlay = document.getElementById('drawer-overlay');
  const btnOpen = document.getElementById('btn-open-drawer');
  const btnClose = document.getElementById('btn-close-drawer');
  const btnMobileMore = document.getElementById('btn-mobile-more');

  window.openDrawer = function () {
    if (drawer && overlay) {
      drawer.classList.add('open');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeDrawer = function () {
    if (drawer && overlay) {
      drawer.classList.remove('open');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  window.toggleDrawer = function () {
    if (drawer && drawer.classList.contains('open')) {
      window.closeDrawer();
    } else {
      window.openDrawer();
    }
  };

  btnOpen?.addEventListener('click', window.openDrawer);
  btnClose?.addEventListener('click', window.closeDrawer);
  overlay?.addEventListener('click', window.closeDrawer);
  btnMobileMore?.addEventListener('click', window.toggleDrawer);

  // Navegación dentro del menú lateral
  document.querySelectorAll('.drawer-nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      if (targetTab) {
        switchTab(targetTab);
        window.closeDrawer();
      }
    });
  });

  // Botones de pie en el Drawer
  document.getElementById('drawer-btn-theme')?.addEventListener('click', () => {
    window.toggleTheme();
  });

  document.getElementById('drawer-btn-share')?.addEventListener('click', () => {
    window.closeDrawer();
    openShareModal();
  });

  // Cerrar menú con la tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer && drawer.classList.contains('open')) {
      window.closeDrawer();
    }
  });

  // Soporte táctil / swipe para cerrar menú lateral deslizando a la izquierda
  let touchStartX = 0;
  let touchStartY = 0;

  drawer?.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  drawer?.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    const diffX = touchStartX - touchEndX;
    const diffY = Math.abs(touchStartY - touchEndY);
    if (diffX > 50 && diffY < 90) {
      window.closeDrawer();
    }
  }, { passive: true });
}

function switchTab(tabId) {
  if (!tabId) return;
  AppState.activeTab = tabId;

  // Sincronizar barra superior
  document.querySelectorAll('.nav-tab').forEach((t) => {
    t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
  });

  // Sincronizar menú lateral (Drawer)
  document.querySelectorAll('.drawer-nav-item').forEach((item) => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
  });

  // En móvil, si la sección activa es secundaria, resaltar botón "Menú"
  const mobileMoreBtn = document.getElementById('btn-mobile-more');
  if (mobileMoreBtn) {
    const mainTabs = ['tab-today', 'tab-tasks', 'tab-schedule', 'tab-backpack'];
    mobileMoreBtn.classList.toggle('active', !mainTabs.includes(tabId));
  }

  // Paneles de contenido
  document.querySelectorAll('.tab-panel').forEach((p) => {
    p.classList.toggle('active', p.id === tabId);
  });

  // Re-renderizar la vista activa para asegurar datos frescos
  if (tabId === 'tab-today') renderTodayView();
  else if (tabId === 'tab-tasks') renderTasksView();
  else if (tabId === 'tab-schedule') renderScheduleView();
  else if (tabId === 'tab-backpack') renderBackpackView();
  else if (tabId === 'tab-projects') renderProjectsView();
  else if (tabId === 'tab-pomodoro') renderPomodoroView();
  else if (tabId === 'tab-exams') renderExamsView();
  else if (tabId === 'tab-grades') renderGradesView();
  else if (tabId === 'tab-gallery') renderGalleryView();
  else if (tabId === 'tab-flashcards') renderFlashcardsView();
  else if (tabId === 'tab-settings') renderSettingsView();
}

// ==========================================================================
// ERGONOMÍA MÓVIL: GESTOS SWIPE, BOTTOM SHEETS Y ATAJOS DE FECHA
// ==========================================================================

/**
 * Configura los botones de selección rápida de fecha (Hoy, Mañana, +1 sem)
 */
function setupQuickDateButtons() {
  document.querySelectorAll('.btn-quick-date').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      triggerHaptic('light');
      const targetId = btn.getAttribute('data-date-target');
      const daysOffset = parseInt(btn.getAttribute('data-days') || '0', 10);
      const d = new Date();
      d.setDate(d.getDate() + daysOffset);
      const input = document.getElementById(targetId);
      if (input) {
        input.value = getLocalDateString(d);
        input.dispatchEvent(new Event('change'));
      }
      if (btn.parentElement) {
        btn.parentElement.querySelectorAll('.btn-quick-date').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      }
    });
  });
}

/**
 * Gestos de deslizamiento (Swipe) táctil en tarjetas de tareas:
 * - Deslizar a la derecha (> 60px): Marcar completada / pendiente
 * - Deslizar a la izquierda (< -60px): Mover a papelera o eliminar
 */
function setupTaskSwipeGestures() {
  let touchStartX = 0;
  let touchStartY = 0;
  let currentItem = null;
  let isSwiping = false;

  document.addEventListener('touchstart', (e) => {
    const item = e.target.closest('.task-item');
    if (!item) return;
    if (e.target.closest('button, input, select, audio, a')) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    currentItem = item;
    isSwiping = false;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!currentItem) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartX;
    const diffY = currentY - touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 12) {
      isSwiping = true;
      currentItem.classList.add('swiping');
      const clampedX = Math.max(-110, Math.min(110, diffX));
      currentItem.style.transform = `translateX(${clampedX}px)`;

      if (diffX > 45) {
        currentItem.classList.add('swipe-complete-hint');
        currentItem.classList.remove('swipe-delete-hint');
      } else if (diffX < -45) {
        currentItem.classList.add('swipe-delete-hint');
        currentItem.classList.remove('swipe-complete-hint');
      } else {
        currentItem.classList.remove('swipe-complete-hint', 'swipe-delete-hint');
      }
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!currentItem) return;
    const item = currentItem;
    currentItem = null;

    if (!isSwiping) return;
    item.classList.remove('swiping');

    const endX = e.changedTouches[0].clientX;
    const diffX = endX - touchStartX;

    item.classList.remove('swipe-complete-hint', 'swipe-delete-hint');
    item.style.transform = '';

    if (diffX > 60) {
      const checkbox = item.querySelector('.task-checkbox');
      if (checkbox) {
        triggerHaptic('success');
        checkbox.click();
      }
    } else if (diffX < -60) {
      const deleteBtn = item.querySelector('.btn-action-small.danger');
      if (deleteBtn) {
        triggerHaptic('medium');
        deleteBtn.click();
      }
    }
  }, { passive: true });
}

/**
 * Deslizar hacia abajo (Pull-to-Dismiss) para cerrar Bottom Sheets en móvil
 */
function setupBottomSheetDismiss() {
  let startY = 0;
  let activeModal = null;
  let isDraggingModal = false;

  document.addEventListener('touchstart', (e) => {
    if (window.innerWidth > 640) return;
    const handle = e.target.closest('.sheet-handle-bar, .modal-header');
    if (!handle) return;
    const modalContent = handle.closest('.modal-content');
    if (!modalContent) return;

    activeModal = modalContent.closest('.modal-overlay');
    startY = e.touches[0].clientY;
    isDraggingModal = true;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!isDraggingModal || !activeModal) return;
    const currentY = e.touches[0].clientY;
    const diffY = currentY - startY;
    if (diffY > 0) {
      const content = activeModal.querySelector('.modal-content');
      if (content) {
        content.style.transform = `translateY(${diffY}px)`;
      }
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!isDraggingModal || !activeModal) return;
    const endY = e.changedTouches[0].clientY;
    const diffY = endY - startY;
    const content = activeModal.querySelector('.modal-content');
    if (content) content.style.transform = '';

    if (diffY > 75) {
      triggerHaptic('light');
      activeModal.classList.add('hidden');
    }
    isDraggingModal = false;
    activeModal = null;
  }, { passive: true });
}

// ==========================================================================
// EVENT LISTENERS & MODALES
// ==========================================================================
function initEventListeners() {
  // Inicializar ergonomía móvil
  setupQuickDateButtons();
  setupTaskSwipeGestures();
  setupBottomSheetDismiss();

  // Actualizar tarjeta de clase actual periódicamente (cada 30 seg)
  setInterval(() => {
    if (AppState.activeTab === 'tab-today') {
      updateCurrentLiveCard();
    }
  }, 30000);

  // Botón flotante FAB
  const fabMain = document.getElementById('fab-main-btn');
  const fabMenu = document.getElementById('fab-menu');

  if (fabMain && fabMenu) {
    fabMain.addEventListener('click', () => {
      triggerHaptic('light');
      fabMain.classList.toggle('open');
      fabMenu.classList.toggle('show');
    });

    document.getElementById('fab-new-task')?.addEventListener('click', () => {
      fabMain.classList.remove('open');
      fabMenu.classList.remove('show');
      openTaskModal();
    });

    document.getElementById('fab-new-exam')?.addEventListener('click', () => {
      fabMain.classList.remove('open');
      fabMenu.classList.remove('show');
      openExamModal();
    });

    document.getElementById('fab-take-photo')?.addEventListener('click', () => {
      fabMain.classList.remove('open');
      fabMenu.classList.remove('show');
      openQuickCamera();
    });
  }

  // Cerrar modales con botones de cerrar
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      document.getElementById(modalId)?.classList.add('hidden');
    });
  });

  // Cerrar modal al hacer clic en el fondo oscuro exterior
  document.querySelectorAll('.modal-overlay').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });

  // Cerrar modales abiertos con la tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach((modal) => {
        modal.classList.add('hidden');
      });
    }
  });

  // Botones de abrir modales en pestañas
  document.getElementById('btn-open-new-task')?.addEventListener('click', () => openTaskModal());
  document.getElementById('btn-quick-add-task')?.addEventListener('click', () => openTaskModal());
  document.getElementById('btn-open-new-exam')?.addEventListener('click', () => openExamModal());
  document.getElementById('btn-open-new-grade')?.addEventListener('click', () => openGradeModal());
  document.getElementById('btn-quick-photo-capture')?.addEventListener('click', () => openQuickCamera());
  document.getElementById('btn-add-subject')?.addEventListener('click', () => openSubjectModal());

  // Filtros de tareas
  document.querySelectorAll('[data-task-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-task-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.taskFilter = btn.getAttribute('data-task-filter');
      renderTasksView();
    });
  });

  // Filtros de materiales (Mochila)
  document.querySelectorAll('[data-material-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-material-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.materialFilter = btn.getAttribute('data-material-filter');
      renderBackpackView();
    });
  });

  // Filtros de proyectos
  document.querySelectorAll('[data-project-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-project-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.projectFilter = btn.getAttribute('data-project-filter');
      renderProjectsView();
    });
  });

  // Botones de Mochila y Proyectos
  document.getElementById('btn-add-material')?.addEventListener('click', () => openMaterialModal());
  document.getElementById('btn-reset-backpack')?.addEventListener('click', handleResetBackpack);
  document.getElementById('btn-open-new-project')?.addEventListener('click', () => openProjectModal());

  // Filtros de horario por día
  document.querySelectorAll('.day-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.day-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      AppState.selectedScheduleDay = parseInt(pill.getAttribute('data-day'), 10);
      renderScheduleView();
    });
  });

  // Filtros de calificaciones por trimestre
  document.querySelectorAll('[data-term-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-term-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.termFilter = btn.getAttribute('data-term-filter');
      renderGradesView();
    });
  });

  // Formularios
  document.getElementById('task-form')?.addEventListener('submit', handleTaskFormSubmit);
  document.getElementById('exam-form')?.addEventListener('submit', handleExamFormSubmit);
  document.getElementById('grade-form')?.addEventListener('submit', handleGradeFormSubmit);
  document.getElementById('slot-form')?.addEventListener('submit', handleSlotFormSubmit);
  document.getElementById('subject-form')?.addEventListener('submit', handleSubjectFormSubmit);
  document.getElementById('material-form')?.addEventListener('submit', handleMaterialFormSubmit);
  document.getElementById('project-form')?.addEventListener('submit', handleProjectFormSubmit);

  // Botón Anotar en el Visor de fotos
  document.getElementById('btn-viewer-annotate')?.addEventListener('click', () => {
    const imgEl = document.getElementById('image-viewer-img');
    if (imgEl && imgEl.src) {
      openAnnotationEditor(imgEl.src, (annotatedDataUrl) => {
        imgEl.src = annotatedDataUrl;
        showToast('✏️ Anotación guardada', 'success');
      });
    }
  });

  // Botón Eliminar en el Visor de fotos
  document.getElementById('btn-viewer-delete')?.addEventListener('click', async () => {
    const imgEl = document.getElementById('image-viewer-img');
    const src = imgEl?.src;
    if (!src) return;

    if (!confirm('¿Seguro que deseas eliminar esta fotografía?')) return;

    // 1. Eliminar de arrays temporales
    const tIdx = AppState.tempTaskPhotos.indexOf(src);
    if (tIdx !== -1) {
      AppState.tempTaskPhotos.splice(tIdx, 1);
      renderPhotosPreview('task-photos-preview', AppState.tempTaskPhotos);
    }

    const eIdx = AppState.tempExamPhotos.indexOf(src);
    if (eIdx !== -1) {
      AppState.tempExamPhotos.splice(eIdx, 1);
      renderPhotosPreview('exam-photos-preview', AppState.tempExamPhotos);
    }

    const pIdx = AppState.tempProjectPhotos.indexOf(src);
    if (pIdx !== -1) {
      AppState.tempProjectPhotos.splice(pIdx, 1);
      renderPhotosPreview('project-photos-preview', AppState.tempProjectPhotos);
    }

    // 2. Eliminar de tareas persistidas
    for (const task of AppState.tasks) {
      if (task.photos && task.photos.includes(src)) {
        task.photos = task.photos.filter((p) => p !== src);
        await saveItem('tasks', task);
      }
    }

    // 3. Eliminar de exámenes persistidos
    for (const exam of AppState.exams) {
      if (exam.photos && exam.photos.includes(src)) {
        exam.photos = exam.photos.filter((p) => p !== src);
        await saveItem('exams', exam);
      }
    }

    // 4. Eliminar de proyectos persistidos
    for (const project of AppState.projects) {
      if (project.photos && project.photos.includes(src)) {
        project.photos = project.photos.filter((p) => p !== src);
        await saveItem('projects', project);
      }
    }

    // Cerrar visor a pantalla completa
    document.getElementById('image-viewer-modal')?.classList.add('hidden');
    if (imgEl) imgEl.src = '';

    await loadAllData();
    renderAllViews();
    showToast('🗑️ Fotografía eliminada con éxito', 'success');
  });

  // Botón Compartir / WhatsApp / QR
  document.getElementById('btn-open-share')?.addEventListener('click', openShareModal);

  // Pestañas del Modal Compartir
  document.getElementById('share-tab-wa-btn')?.addEventListener('click', () => switchShareTab('wa'));
  document.getElementById('share-tab-qr-btn')?.addEventListener('click', () => switchShareTab('qr'));
  document.getElementById('share-tab-scan-btn')?.addEventListener('click', () => switchShareTab('scan'));

  // Cambios de selección en WhatsApp y QR
  document.getElementById('wa-content-type')?.addEventListener('change', updateWhatsAppPreview);
  document.getElementById('qr-content-type')?.addEventListener('change', updateQRCode);

  // Acciones de envío WhatsApp y descarga QR
  document.getElementById('btn-send-whatsapp')?.addEventListener('click', handleSendWhatsApp);
  document.getElementById('btn-copy-wa-text')?.addEventListener('click', handleCopyWhatsAppText);
  document.getElementById('btn-download-qr')?.addEventListener('click', handleDownloadQRCode);
  document.getElementById('btn-start-qr-scan')?.addEventListener('click', handleStartQRScan);

  // Perfil en Ajustes
  document.getElementById('btn-save-profile')?.addEventListener('click', handleSaveProfile);

  // Plantillas de Bachillerato de Artes
  document.getElementById('btn-load-preset-plasticas')?.addEventListener('click', async () => {
    if (confirm('¿Cargar las asignaturas de Bachillerato de Artes Plásticas, Imagen y Diseño? Se actualizará tu catálogo de asignaturas.')) {
      await applySubjectPreset('artes_plasticas');
      await loadAllData();
      renderAllViews();
      showToast('🎨 Asignaturas de Artes Plásticas cargadas', 'success');
    }
  });

  document.getElementById('btn-load-preset-escenicas')?.addEventListener('click', async () => {
    if (confirm('¿Cargar las asignaturas de Bachillerato de Música y Artes Escénicas? Se actualizará tu catálogo de asignaturas.')) {
      await applySubjectPreset('artes_escenicas');
      await loadAllData();
      renderAllViews();
      showToast('🎭 Asignaturas de Artes Escénicas cargadas', 'success');
    }
  });

  // Copia de seguridad
  document.getElementById('btn-export-backup')?.addEventListener('click', handleExportBackup);
  const backupTrigger = document.getElementById('btn-import-backup-trigger');
  const backupInput = document.getElementById('backup-file-input');
  if (backupTrigger && backupInput) {
    backupTrigger.addEventListener('click', () => backupInput.click());
    backupInput.addEventListener('change', handleImportBackup);
  }

  // Botones de cámara en modales
  document.getElementById('btn-task-camera')?.addEventListener('click', () => {
    openCamera((photoDataUrl) => {
      AppState.tempTaskPhotos.push(photoDataUrl);
      renderPhotosPreview('task-photos-preview', AppState.tempTaskPhotos);
      showToast('📸 Foto adjuntada a la tarea');
    });
  });

  document.getElementById('btn-task-gallery')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      if (e.target.files && e.target.files[0]) {
        const compressed = await compressImage(e.target.files[0], 1280, 1280, 0.78);
        AppState.tempTaskPhotos.push(compressed);
        renderPhotosPreview('task-photos-preview', AppState.tempTaskPhotos);
      }
    };
    input.click();
  });

  document.getElementById('btn-exam-camera')?.addEventListener('click', () => {
    openCamera((photoDataUrl) => {
      AppState.tempExamPhotos.push(photoDataUrl);
      renderPhotosPreview('exam-photos-preview', AppState.tempExamPhotos);
      showToast('📸 Foto adjuntada al examen');
    });
  });

  document.getElementById('btn-project-camera')?.addEventListener('click', () => {
    openCamera((photoDataUrl) => {
      AppState.tempProjectPhotos.push(photoDataUrl);
      renderPhotosPreview('project-photos-preview', AppState.tempProjectPhotos);
      showToast('📸 Foto adjuntada al proyecto');
    });
  });

  document.getElementById('btn-project-gallery')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      if (e.target.files && e.target.files[0]) {
        const compressed = await compressImage(e.target.files[0], 1280, 1280, 0.78);
        AppState.tempProjectPhotos.push(compressed);
        renderPhotosPreview('project-photos-preview', AppState.tempProjectPhotos);
      }
    };
    input.click();
  });
}

// ==========================================================================
// RENDERIZADO DE VISTAS
// ==========================================================================

function renderAllViews() {
  updateHeaderInfo();
  renderTodayView();
  renderTasksView();
  renderScheduleView();
  renderBackpackView();
  renderProjectsView();
  renderPomodoroView();
  renderExamsView();
  renderGradesView();
  renderGalleryView();
  renderFlashcardsView();
  renderSettingsView();
  updateBadges();
}

function updateHeaderInfo() {
  const nameEl = document.getElementById('header-student-name');
  const schoolEl = document.getElementById('header-school-name');
  const drawerNameEl = document.getElementById('drawer-student-name');
  const drawerSchoolEl = document.getElementById('drawer-school-name');

  const studentTitle = AppState.studentInfo?.studentName ? `Agenda de ${AppState.studentInfo.studentName}` : 'Agenda Escolar';
  const schoolSubtitle = `${AppState.studentInfo?.schoolName || 'Instituto'} - ${AppState.studentInfo?.course || ''}`;

  if (nameEl) nameEl.textContent = studentTitle;
  if (schoolEl) schoolEl.textContent = schoolSubtitle;
  if (drawerNameEl) drawerNameEl.textContent = studentTitle;
  if (drawerSchoolEl) drawerSchoolEl.textContent = schoolSubtitle;
}

function updateBadges() {
  const pendingTasks = AppState.tasks.filter((t) => t.status !== 'completed').length;
  const badgeTasks = document.getElementById('badge-pending-tasks');
  const drawerBadgeTasks = document.getElementById('drawer-badge-pending-tasks');

  if (badgeTasks) {
    if (pendingTasks > 0) {
      badgeTasks.textContent = pendingTasks;
      badgeTasks.classList.remove('hidden');
    } else {
      badgeTasks.classList.add('hidden');
    }
  }
  if (drawerBadgeTasks) {
    if (pendingTasks > 0) {
      drawerBadgeTasks.textContent = pendingTasks;
      drawerBadgeTasks.classList.remove('hidden');
    } else {
      drawerBadgeTasks.classList.add('hidden');
    }
  }

  const todayStr = getTodayDateString();
  const upcomingExams = AppState.exams.filter((e) => e.date >= todayStr).length;
  const badgeExams = document.getElementById('badge-upcoming-exams');
  const drawerBadgeExams = document.getElementById('drawer-badge-upcoming-exams');

  if (badgeExams) {
    if (upcomingExams > 0) {
      badgeExams.textContent = upcomingExams;
      badgeExams.classList.remove('hidden');
    } else {
      badgeExams.classList.add('hidden');
    }
  }
  if (drawerBadgeExams) {
    if (upcomingExams > 0) {
      drawerBadgeExams.textContent = upcomingExams;
      drawerBadgeExams.classList.remove('hidden');
    } else {
      drawerBadgeExams.classList.add('hidden');
    }
  }

  // Fichas de estudio pendientes para hoy
  const dueCards = getDueFlashcards(AppState.flashcards || [], todayStr, 'all').length;
  const badgeCards = document.getElementById('badge-due-flashcards');
  const drawerBadgeCards = document.getElementById('drawer-badge-due-flashcards');

  if (badgeCards) {
    if (dueCards > 0) {
      badgeCards.textContent = dueCards;
      badgeCards.classList.remove('hidden');
    } else {
      badgeCards.classList.add('hidden');
    }
  }
  if (drawerBadgeCards) {
    if (dueCards > 0) {
      drawerBadgeCards.textContent = dueCards;
      drawerBadgeCards.classList.remove('hidden');
    } else {
      drawerBadgeCards.classList.add('hidden');
    }
  }
}

// ----------------------------------------------------
// 1. VISTA: HOY (DASHBOARD)
// ----------------------------------------------------

/**
 * Actualiza la tarjeta "En Este Instante / Ahora Mismo" en la pantalla de Inicio
 */
function updateCurrentLiveCard(now = new Date(), dayOfWeek = now.getDay()) {
  const card = document.getElementById('today-current-live-card');
  if (!card) return;

  const titleEl = document.getElementById('current-live-title');
  const subEl = document.getElementById('current-live-sub');
  const timerEl = document.getElementById('current-live-timer');
  const iconEl = document.getElementById('current-live-icon');
  const nextEl = document.getElementById('current-live-next');
  const locationEl = document.getElementById('current-live-location');
  const statusLabelEl = document.getElementById('current-live-status-label');

  // Si es fin de semana (Sábado o Domingo)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    if (statusLabelEl) statusLabelEl.textContent = 'FIN DE SEMANA';
    if (iconEl) iconEl.textContent = '🌴';
    if (titleEl) titleEl.textContent = '¡Tiempo de Descanso y Repaso!';
    if (subEl) subEl.textContent = 'No hay clases lectivas hoy. Buen momento para repasar fichas Leitner o desconectar.';
    if (timerEl) timerEl.textContent = 'Fin de semana';
    if (nextEl) nextEl.textContent = 'Próxima jornada escolar: Lunes por la mañana';
    if (locationEl) locationEl.textContent = '';
    return;
  }

  // Día lectivo de Lunes a Viernes
  const todaySlots = AppState.schedule.filter((s) => s.day === dayOfWeek);
  if (!AppState.timeSlots || AppState.timeSlots.length === 0) {
    if (statusLabelEl) statusLabelEl.textContent = 'HORARIO';
    if (iconEl) iconEl.textContent = '📅';
    if (titleEl) titleEl.textContent = 'Sin tramos horarios configurados';
    if (subEl) subEl.textContent = 'Entra en Ajustes para definir tus horas de clase.';
    if (timerEl) timerEl.textContent = '--:--';
    if (nextEl) nextEl.textContent = '';
    return;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  function timeToMin(tStr) {
    if (!tStr) return 0;
    const [h, m] = tStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  const slotsWithTimes = AppState.timeSlots
    .map((slot) => ({
      ...slot,
      startMin: timeToMin(slot.start),
      endMin: timeToMin(slot.end)
    }))
    .sort((a, b) => a.startMin - b.startMin);

  const firstSlot = slotsWithTimes[0];
  const lastSlot = slotsWithTimes[slotsWithTimes.length - 1];

  // 1. Antes de empezar las clases hoy
  if (currentMinutes < firstSlot.startMin) {
    const diff = firstSlot.startMin - currentMinutes;
    const match = todaySlots.find((s) => s.slotIndex === firstSlot.index);
    const sub = match ? AppState.subjects.find((s) => s.id === match.subjectId) : null;

    if (statusLabelEl) statusLabelEl.textContent = 'ANTES DE EMPEZAR';
    if (iconEl) iconEl.textContent = sub?.icon || '🎒';
    if (titleEl) titleEl.textContent = `Próxima: ${sub ? sub.name : (firstSlot.isBreak ? 'Recreo' : 'Hora Libre')}`;
    if (subEl) subEl.textContent = `Comienza a las ${firstSlot.start} ${match?.classroom ? 'en aula ' + match.classroom : ''}`;
    if (timerEl) timerEl.textContent = diff < 60 ? `En ${diff} min` : `A las ${firstSlot.start}`;
    if (nextEl) nextEl.textContent = `Jornada escolar de ${slotsWithTimes.length} tramos`;
    if (locationEl) locationEl.textContent = match?.classroom || sub?.classroom || '';
    return;
  }

  // 2. Ya terminaron las clases de hoy
  if (currentMinutes >= lastSlot.endMin) {
    const tomorrowStr = getTomorrowDateString();
    const pendingTomorrow = AppState.tasks.filter((t) => t.dueDate === tomorrowStr && t.status !== 'completed').length;
    if (statusLabelEl) statusLabelEl.textContent = 'JORNADA FINALIZADA';
    if (iconEl) iconEl.textContent = '🎉';
    if (titleEl) titleEl.textContent = '¡Clases terminadas por hoy!';
    if (subEl) subEl.textContent = pendingTomorrow > 0 ? `Tienes ${pendingTomorrow} tarea(s) pendiente(s) para mañana.` : '¡Genial! No tienes tareas pendientes para mañana.';
    if (timerEl) timerEl.textContent = 'Libre';
    if (nextEl) nextEl.textContent = 'Próxima jornada escolar: Mañana a las ' + firstSlot.start;
    if (locationEl) locationEl.textContent = '';
    return;
  }

  // 3. Estamos dentro de un tramo horario activo
  let activeSlot = null;
  let activeIndex = -1;
  for (let i = 0; i < slotsWithTimes.length; i++) {
    const s = slotsWithTimes[i];
    if (currentMinutes >= s.startMin && currentMinutes < s.endMin) {
      activeSlot = s;
      activeIndex = i;
      break;
    }
  }

  if (activeSlot) {
    const minutesLeft = activeSlot.endMin - currentMinutes;
    const match = todaySlots.find((s) => s.slotIndex === activeSlot.index);
    const sub = match ? AppState.subjects.find((s) => s.id === match.subjectId) : null;
    const nextSlot = slotsWithTimes[activeIndex + 1];
    let nextInfo = 'Última sesión de hoy';
    if (nextSlot) {
      const nextMatch = todaySlots.find((s) => s.slotIndex === nextSlot.index);
      const nextSub = nextMatch ? AppState.subjects.find((s) => s.id === nextMatch.subjectId) : null;
      nextInfo = `Siguiente: ${nextSlot.isBreak ? '🥪 Recreo' : (nextSub ? nextSub.name : 'Hora libre')} (${nextSlot.start})`;
    }

    if (activeSlot.isBreak) {
      if (statusLabelEl) statusLabelEl.textContent = 'RECREO / DESCANSO';
      if (iconEl) iconEl.textContent = '🥪';
      if (titleEl) titleEl.textContent = 'Hora del Recreo';
      if (subEl) subEl.textContent = `Descanso hasta las ${activeSlot.end}`;
      if (timerEl) timerEl.textContent = `Quedan ${minutesLeft} min`;
    } else {
      if (statusLabelEl) statusLabelEl.textContent = 'EN CLASE AHORA';
      if (iconEl) iconEl.textContent = sub?.icon || '📖';
      if (titleEl) titleEl.textContent = sub ? sub.name : 'Hora Libre / Estudio';
      const prof = sub?.teacher ? `Prof. ${sub.teacher}` : '';
      const aula = match?.classroom || sub?.classroom ? `Aula: ${match?.classroom || sub?.classroom}` : '';
      if (subEl) subEl.textContent = [prof, aula].filter(Boolean).join(' • ') || `Hasta las ${activeSlot.end}`;
      if (timerEl) timerEl.textContent = `Quedan ${minutesLeft} min`;
    }
    if (nextEl) nextEl.textContent = nextInfo;
    if (locationEl) locationEl.textContent = match?.classroom || sub?.classroom || '';
    return;
  }

  // 4. Entre clases (en cambio de hora)
  const upcomingSlot = slotsWithTimes.find((s) => s.startMin > currentMinutes);
  if (upcomingSlot) {
    const minUntil = upcomingSlot.startMin - currentMinutes;
    const match = todaySlots.find((s) => s.slotIndex === upcomingSlot.index);
    const sub = match ? AppState.subjects.find((s) => s.id === match.subjectId) : null;
    if (statusLabelEl) statusLabelEl.textContent = 'CAMBIO DE CLASE';
    if (iconEl) iconEl.textContent = '🚶‍♂️';
    if (titleEl) titleEl.textContent = `Toca: ${upcomingSlot.isBreak ? '🥪 Recreo' : (sub ? sub.name : 'Hora Libre')}`;
    if (subEl) subEl.textContent = `Comienza a las ${upcomingSlot.start} (en ${minUntil} min)`;
    if (timerEl) timerEl.textContent = `En ${minUntil} min`;
    if (nextEl) nextEl.textContent = match?.classroom || sub?.classroom ? `Ubicación: ${match?.classroom || sub?.classroom}` : '';
    if (locationEl) locationEl.textContent = '';
  }
}

function renderTodayView() {
  const now = new Date();
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const dayOfWeek = now.getDay();
  const dayName = days[dayOfWeek];
  const dateFormatted = `${dayName}, ${now.getDate()} de ${months[now.getMonth()]}`;

  const greetingEl = document.getElementById('today-greeting');
  const dateBadgeEl = document.getElementById('today-date-badge');
  const summaryEl = document.getElementById('today-summary');
  const dayNameEl = document.getElementById('today-day-name');

  const studentFirstName = (AppState.studentInfo.studentName || 'Estudiante').split(' ')[0];
  const hour = now.getHours();
  let greeting = `¡Hola, ${studentFirstName}! 👋`;
  if (hour < 13) greeting = `¡Buenos días, ${studentFirstName}! ☀️`;
  else if (hour < 20) greeting = `¡Buenas tardes, ${studentFirstName}! 🌤️`;
  else greeting = `¡Buenas noches, ${studentFirstName}! 🌙`;

  if (greetingEl) greetingEl.textContent = greeting;
  if (dateBadgeEl) dateBadgeEl.textContent = dateFormatted;
  if (dayNameEl) dayNameEl.textContent = dayName;

  // Actualizar tarjeta "En Este Instante"
  updateCurrentLiveCard(now, dayOfWeek);

  // Clases de hoy
  const scheduleContainer = document.getElementById('today-schedule-list');
  if (scheduleContainer) {
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const todaySlots = AppState.schedule.filter((s) => s.day === dayOfWeek);
      if (todaySlots.length === 0) {
        scheduleContainer.innerHTML = `
          <p class="section-subtitle">No has configurado clases para el ${dayName}.</p>
          <button class="btn-action-small" onclick="document.querySelector('[data-tab=tab-schedule]').click()">📅 Configurar Horario</button>
        `;
      } else {
        scheduleContainer.innerHTML = AppState.timeSlots
          .map((slot) => {
            if (slot.isBreak) {
              return `
                <div class="schedule-slot-card is-break">
                  <div class="slot-time">${slot.start} - ${slot.end}</div>
                  <div class="slot-info">
                    <div class="slot-subject-name">🥪 Recreo / Descanso</div>
                  </div>
                </div>
              `;
            }
            const match = todaySlots.find((s) => s.slotIndex === slot.index);
            const sub = match ? AppState.subjects.find((s) => s.id === match.subjectId) : null;
            return `
              <div class="schedule-slot-card">
                <div class="slot-time">${slot.start} - ${slot.end}</div>
                <div class="slot-info">
                  <div class="slot-subject-name" style="color: ${sub ? sub.color : 'inherit'}">
                    <span>${sub ? sub.icon || '📖' : '⚪'}</span> ${sub ? sub.name : 'Hora libre'}
                  </div>
                  <div class="slot-details">
                    <span>${match?.classroom || sub?.classroom || ''}</span>
                    <span>${sub?.teacher || ''}</span>
                  </div>
                </div>
              </div>
            `;
          })
          .join('');
      }
    } else {
      scheduleContainer.innerHTML = `<p class="section-subtitle">¡Es fin de semana! 🎉 No hay clases hoy.</p>`;
    }
  }

  // Tareas para mañana
  const tomorrowStr = getTomorrowDateString();
  const urgentTasksContainer = document.getElementById('today-urgent-tasks');
  const tomorrowTasks = AppState.tasks.filter((t) => t.dueDate === tomorrowStr && t.status !== 'completed');

  if (urgentTasksContainer) {
    if (tomorrowTasks.length === 0) {
      urgentTasksContainer.innerHTML = `<p class="section-subtitle">🎉 No hay deberes pendientes para mañana.</p>`;
    } else {
      urgentTasksContainer.innerHTML = tomorrowTasks
        .map((task) => {
          const sub = AppState.subjects.find((s) => s.id === task.subjectId);
          return `
            <div class="task-item" style="border-left-color: ${sub?.color || '#3b82f6'}">
              <div class="task-top">
                <input type="checkbox" class="task-checkbox" onchange="window.toggleTaskComplete('${task.id}')" />
                <div class="task-content">
                  <div class="task-title">${escapeHTML(task.title)}</div>
                  <div class="task-meta">
                    <span class="tag-subject" style="background: ${sub?.color || '#3b82f6'}">${sub?.icon || ''} ${sub?.name || 'General'}</span>
                  </div>
                </div>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }

  // Próximo examen
  const todayStr = getTodayDateString();
  const upcomingExams = AppState.exams
    .filter((e) => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  const nextExamContainer = document.getElementById('today-next-exam');
  if (nextExamContainer) {
    if (upcomingExams.length === 0) {
      nextExamContainer.innerHTML = `<p class="section-subtitle">No tienes exámenes pendientes programados.</p>`;
    } else {
      const next = upcomingExams[0];
      const sub = AppState.subjects.find((s) => s.id === next.subjectId);
      const daysLeft = getDaysDifference(todayStr, next.date);
      let countdownText = `En ${daysLeft} días`;
      let badgeClass = 'countdown-later';
      if (daysLeft === 0) {
        countdownText = '¡HOY!';
        badgeClass = 'countdown-urgent';
      } else if (daysLeft === 1) {
        countdownText = 'Mañana';
        badgeClass = 'countdown-soon';
      }

      nextExamContainer.innerHTML = `
        <div class="exam-card" style="border-left: 5px solid ${sub?.color || '#8b5cf6'}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span class="tag-subject" style="background: ${sub?.color || '#8b5cf6'}">${sub?.icon || ''} ${sub?.name || ''}</span>
              <h4 style="font-size: 1.1rem; margin-top: 6px;">${escapeHTML(next.title)}</h4>
            </div>
            <span class="countdown-badge ${badgeClass}">${countdownText}</span>
          </div>
          <div class="section-subtitle">📅 ${formatDateSpanish(next.date)}</div>
          ${next.topics ? `<div class="task-description">${escapeHTML(next.topics)}</div>` : ''}
        </div>
      `;
    }
  }

  // Resumen general
  const pendingCount = AppState.tasks.filter((t) => t.status !== 'completed').length;
  if (summaryEl) {
    summaryEl.textContent = `Tienes ${pendingCount} deberes pendientes y ${upcomingExams.length} próximos exámenes.`;
  }
}

// ----------------------------------------------------
// 2. VISTA: TAREAS Y DEBERES
// ----------------------------------------------------
function renderTasksView() {
  const container = document.getElementById('tasks-container');
  if (!container) return;

  const todayStr = getTodayDateString();
  let filtered = [...AppState.tasks];

  // Aplicar filtros
  if (AppState.taskFilter === 'pending') {
    filtered = filtered.filter((t) => t.status !== 'completed');
  } else if (AppState.taskFilter === 'today') {
    filtered = filtered.filter((t) => t.dueDate === todayStr);
  } else if (AppState.taskFilter === 'week') {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = getLocalDateString(nextWeek);
    filtered = filtered.filter((t) => t.dueDate >= todayStr && t.dueDate <= nextWeekStr);
  } else if (AppState.taskFilter === 'photos') {
    filtered = filtered.filter((t) => t.photos && t.photos.length > 0);
  } else if (AppState.taskFilter === 'done') {
    filtered = filtered.filter((t) => t.status === 'completed');
  }

  // Ordenar por fecha de entrega
  filtered.sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 40px 20px;">
        <span style="font-size: 2.5rem;">📝</span>
        <h3 style="margin-top: 10px;">No hay tareas en esta vista</h3>
        <p class="section-subtitle" style="margin-bottom: 16px;">¡Buen trabajo! O puedes añadir una nueva tarea pulsando abajo.</p>
        <button class="btn-primary" style="width: auto; margin: 0 auto;" onclick="window.openTaskModal()">➕ Añadir Tarea</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((task) => {
      const sub = AppState.subjects.find((s) => s.id === task.subjectId);
      const isCompleted = task.status === 'completed';
      const daysDiff = getDaysDifference(todayStr, task.dueDate);
      let dateBadge = formatDateSpanish(task.dueDate);
      if (daysDiff === 0) dateBadge = '🚨 ¡Para Hoy!';
      else if (daysDiff === 1) dateBadge = '⏰ Para Mañana';
      else if (daysDiff < 0) dateBadge = `⚠️ Vencida (${Math.abs(daysDiff)} días)`;

      const photosHtml =
        task.photos && task.photos.length > 0
          ? `
            <div class="task-photos-grid">
              ${task.photos
                .map(
                  (photo, idx) => `
                <img src="${photo}" alt="Foto tarea" class="photo-thumb" onclick="window.openImageViewer('${photo}', '${escapeHTML(task.title)}')" />
              `
                )
                .join('')}
            </div>
          `
          : '';

      return `
        <div class="task-item ${isCompleted ? 'completed' : ''}" style="border-left-color: ${sub?.color || '#3b82f6'}">
          <div class="task-top">
            <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''} onchange="window.toggleTaskComplete('${task.id}')" />
            <div class="task-content">
              <div class="task-title">${escapeHTML(task.title)}</div>
              <div class="task-meta">
                <span class="tag-subject" style="background: ${sub?.color || '#3b82f6'}">${sub?.icon || ''} ${sub?.name || 'General'}</span>
                <span class="tag-priority priority-${task.priority || 'media'}">${task.priority ? task.priority.toUpperCase() : 'NORMAL'}</span>
                <span>📅 ${dateBadge}</span>
              </div>
              ${task.description ? `<div class="task-description">${escapeHTML(task.description)}</div>` : ''}
              ${photosHtml}
              ${
                task.audioUrl
                  ? `
                <div style="margin-top: 8px;">
                  <audio controls src="${task.audioUrl}" style="width: 100%; max-width: 320px; height: 32px;"></audio>
                </div>
              `
                  : ''
              }
            </div>
          </div>
          <div class="task-actions">
            <button class="btn-action-small" onclick="window.openTaskModal('${task.id}')">✏️ Editar</button>
            <button class="btn-action-small danger" onclick="window.confirmDeleteTask('${task.id}')">🗑️ Eliminar</button>
          </div>
        </div>
      `;
    })
    .join('');
}

// ----------------------------------------------------
// 3. VISTA: HORARIO ESCOLAR
// ----------------------------------------------------
function renderScheduleView() {
  const container = document.getElementById('schedule-timeline-container');
  if (!container) return;

  const day = AppState.selectedScheduleDay;
  const daySlots = AppState.schedule.filter((s) => s.day === day);

  container.innerHTML = AppState.timeSlots
    .map((slot) => {
      if (slot.isBreak) {
        return `
          <div class="schedule-slot-card is-break">
            <div class="slot-time">${slot.start} - ${slot.end}</div>
            <div class="slot-info">
              <div class="slot-subject-name">🥪 Recreo / Descanso</div>
            </div>
          </div>
        `;
      }

      const match = daySlots.find((s) => s.slotIndex === slot.index);
      const sub = match ? AppState.subjects.find((s) => s.id === match.subjectId) : null;

      return `
        <div class="schedule-slot-card" style="cursor: pointer;" onclick="window.openSlotModal(${day}, ${slot.index})">
          <div class="slot-time">${slot.start} - ${slot.end}</div>
          <div class="slot-info">
            <div class="slot-subject-name" style="color: ${sub ? sub.color : 'inherit'}">
              <span>${sub ? sub.icon || '📖' : '➕'}</span> ${sub ? sub.name : '<span style="color: var(--text-dim);">Tocar para asignar asignatura</span>'}
            </div>
            <div class="slot-details">
              <span>${match?.classroom || sub?.classroom || ''}</span>
              <span>${sub?.teacher || ''}</span>
            </div>
          </div>
          <button class="btn-action-small">✏️</button>
        </div>
      `;
    })
    .join('');
}

// ----------------------------------------------------
// 3.1. VISTA: MOCHILA Y MATERIALES DE TALLER
// ----------------------------------------------------
function renderBackpackView() {
  const container = document.getElementById('materials-container');
  const progressText = document.getElementById('backpack-progress-text');
  const progressFill = document.getElementById('backpack-progress-fill');
  if (!container) return;

  // Calcular porcentaje de mochila preparada
  const totalMaterials = AppState.materials.length;
  const packedMaterials = AppState.materials.filter((m) => m.isPacked).length;
  const percentage = totalMaterials > 0 ? Math.round((packedMaterials / totalMaterials) * 100) : 0;

  if (progressText) progressText.textContent = `${percentage}% lista (${packedMaterials}/${totalMaterials})`;
  if (progressFill) progressFill.style.width = `${percentage}%`;

  let filtered = [...AppState.materials];

  if (AppState.materialFilter === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    let tomorrowDay = tomorrow.getDay();
    if (tomorrowDay === 0 || tomorrowDay === 6) tomorrowDay = 1; // Si es fin de semana, considerar Lunes

    const tomorrowSubjectIds = AppState.schedule
      .filter((s) => s.day === tomorrowDay && s.subjectId)
      .map((s) => s.subjectId);

    filtered = filtered.filter((m) => !m.subjectId || tomorrowSubjectIds.includes(m.subjectId));
  } else if (AppState.materialFilter === 'unpacked') {
    filtered = filtered.filter((m) => !m.isPacked);
  } else if (AppState.materialFilter === 'packed') {
    filtered = filtered.filter((m) => m.isPacked);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 30px;">
        <span style="font-size: 2.2rem;">🎒</span>
        <h4 style="margin-top: 8px;">No hay materiales en esta vista</h4>
        <p class="section-subtitle">¡Todo en orden! O pulsa arriba para añadir un nuevo material.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((mat) => {
      const sub = AppState.subjects.find((s) => s.id === mat.subjectId);
      const isPacked = Boolean(mat.isPacked);

      return `
        <div class="material-item-row ${isPacked ? 'is-packed' : ''}">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
            <input type="checkbox" class="task-checkbox" ${isPacked ? 'checked' : ''} onchange="window.toggleMaterialPacked('${mat.id}')" />
            <span style="font-size: 1.3rem;">${mat.icon || '✏️'}</span>
            <div>
              <div class="material-name" style="font-weight: 700; font-size: 0.95rem;">${escapeHTML(mat.name)}</div>
              ${
                sub
                  ? `<span class="tag-subject" style="background: ${sub.color}; font-size: 0.7rem; margin-top: 3px;">${sub.icon || ''} ${sub.name}</span>`
                  : `<span class="tag-subject" style="background: #64748b; font-size: 0.7rem; margin-top: 3px;">Material General</span>`
              }
            </div>
          </div>
          <button class="btn-action-small danger" onclick="window.confirmDeleteMaterial('${mat.id}')">🗑️</button>
        </div>
      `;
    })
    .join('');
}

// ----------------------------------------------------
// 3.2. VISTA: PORTAFOLIO DE PROYECTOS Y OBRAS
// ----------------------------------------------------
function renderProjectsView() {
  const container = document.getElementById('projects-container');
  if (!container) return;

  let filtered = [...AppState.projects];
  if (AppState.projectFilter !== 'all') {
    filtered = filtered.filter((p) => p.status === AppState.projectFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 40px 20px;">
        <span style="font-size: 2.5rem;">🎨</span>
        <h3 style="margin-top: 10px;">No hay proyectos en esta categoría</h3>
        <p class="section-subtitle" style="margin-bottom: 16px;">Registra tus obras artísticas, bocetos y láminas de taller.</p>
        <button class="btn-primary" style="width: auto; margin: 0 auto;" onclick="window.openProjectModal()">➕ Nuevo Proyecto</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((project) => {
      const sub = AppState.subjects.find((s) => s.id === project.subjectId);
      const statusMap = {
        boceto: { label: '✏️ Boceto / Idea', cls: 'stage-boceto' },
        proceso: { label: '⏳ En Proceso', cls: 'stage-proceso' },
        terminado: { label: '✅ Obra Terminada', cls: 'stage-terminado' },
        entregado: { label: '🏆 Entregado / Evaluado', cls: 'stage-entregado' }
      };
      const statusInfo = statusMap[project.status] || { label: 'En Proceso', cls: 'stage-proceso' };

      const photosHtml =
        project.photos && project.photos.length > 0
          ? `
            <div class="task-photos-grid" style="margin-top: 10px;">
              ${project.photos
                .map(
                  (photo) => `
                <img src="${photo}" alt="Foto proyecto" class="photo-thumb" onclick="window.openImageViewer('${photo}', '${escapeHTML(project.title)}')" />
              `
                )
                .join('')}
            </div>
          `
          : '';

      return `
        <div class="project-card" style="border-left: 5px solid ${sub?.color || '#ec4899'};">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
            <div>
              <span class="tag-subject" style="background: ${sub?.color || '#ec4899'}">${sub?.icon || '🎨'} ${sub?.name || 'Arte'}</span>
              <h3 style="font-size: 1.15rem; margin-top: 6px;">${escapeHTML(project.title)}</h3>
            </div>
            <span class="project-stage-pill ${statusInfo.cls}">${statusInfo.label}</span>
          </div>

          ${project.technique ? `<div class="section-subtitle" style="margin-top: 4px;">🎨 <strong>Técnica:</strong> ${escapeHTML(project.technique)}</div>` : ''}
          ${project.dueDate ? `<div class="section-subtitle">📅 <strong>Entrega:</strong> ${formatDateSpanish(project.dueDate)}</div>` : ''}
          ${project.description ? `<div class="task-description" style="margin-top: 8px;">${escapeHTML(project.description)}</div>` : ''}
          ${photosHtml}
          ${
            project.audioUrl
              ? `
            <div style="margin-top: 8px;">
              <audio controls src="${project.audioUrl}" style="width: 100%; max-width: 320px; height: 32px;"></audio>
            </div>
          `
              : ''
          }

          <div class="task-actions" style="margin-top: 12px;">
            <button class="btn-action-small" onclick="window.handleExportProjectPDF('${project.id}')" title="Descargar Dossier del Proyecto en PDF">📄 Dossier PDF</button>
            <button class="btn-action-small" onclick="window.openProjectModal('${project.id}')">✏️ Editar</button>
            <button class="btn-action-small danger" onclick="window.confirmDeleteProject('${project.id}')">🗑️ Eliminar</button>
          </div>
        </div>
      `;
    })
    .join('');
}

// ----------------------------------------------------
// 3.3. VISTA: TEMPORIZADOR POMODORO
// ----------------------------------------------------
function renderPomodoroView() {
  const display = document.getElementById('pomodoro-display');
  const statusText = document.getElementById('pomodoro-status-text');
  const countToday = document.getElementById('pomo-count-today');
  const focusTime = document.getElementById('pomo-focus-time');
  const btnStart = document.getElementById('btn-pomo-start');
  const btnPause = document.getElementById('btn-pomo-pause');

  if (display) {
    const mins = Math.floor(AppState.pomodoro.timeLeft / 60);
    const secs = AppState.pomodoro.timeLeft % 60;
    display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  if (statusText) {
    if (AppState.pomodoro.mode === 'work') statusText.textContent = 'Modo Concentración 🎯 ¡A por ello!';
    else if (AppState.pomodoro.mode === 'short') statusText.textContent = 'Descanso Corto ☕ Despeja la mente';
    else statusText.textContent = 'Descanso Largo 🌴 Respira y relájate';
  }

  if (countToday) countToday.textContent = AppState.pomodoro.countToday;
  if (focusTime) focusTime.textContent = `${AppState.pomodoro.totalFocusMinutes} min`;

  if (btnStart && btnPause) {
    if (AppState.pomodoro.isRunning) {
      btnStart.classList.add('hidden');
      btnPause.classList.remove('hidden');
    } else {
      btnStart.classList.remove('hidden');
      btnPause.classList.add('hidden');
    }
  }
}

// ----------------------------------------------------
// 4. VISTA: EXÁMENES
// ----------------------------------------------------
function renderExamsView() {
  const container = document.getElementById('exams-container');
  if (!container) return;

  const todayStr = getTodayDateString();
  const sortedExams = [...AppState.exams].sort((a, b) => a.date.localeCompare(b.date));

  if (sortedExams.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 40px 20px;">
        <span style="font-size: 2.5rem;">📝</span>
        <h3 style="margin-top: 10px;">No hay exámenes registrados</h3>
        <p class="section-subtitle" style="margin-bottom: 16px;">Añade tus fechas de examen para tener la cuenta atrás y fotos del temario.</p>
        <button class="btn-primary" style="width: auto; margin: 0 auto;" onclick="window.openExamModal()">➕ Nuevo Examen</button>
      </div>
    `;
    return;
  }

  container.innerHTML = sortedExams
    .map((exam) => {
      const sub = AppState.subjects.find((s) => s.id === exam.subjectId);
      const daysLeft = getDaysDifference(todayStr, exam.date);
      let countdownText = `En ${daysLeft} días`;
      let badgeClass = 'countdown-later';
      if (daysLeft < 0) {
        countdownText = 'Realizado';
        badgeClass = '';
      } else if (daysLeft === 0) {
        countdownText = '¡HOY!';
        badgeClass = 'countdown-urgent';
      } else if (daysLeft === 1) {
        countdownText = 'Mañana';
        badgeClass = 'countdown-soon';
      }

      const photosHtml =
        exam.photos && exam.photos.length > 0
          ? `
            <div class="task-photos-grid">
              ${exam.photos
                .map(
                  (photo) => `
                <img src="${photo}" alt="Temario examen" class="photo-thumb" onclick="window.openImageViewer('${photo}', '${escapeHTML(exam.title)}')" />
              `
                )
                .join('')}
            </div>
          `
          : '';

      return `
        <div class="exam-card" style="border-left: 5px solid ${sub?.color || '#8b5cf6'}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span class="tag-subject" style="background: ${sub?.color || '#8b5cf6'}">${sub?.icon || ''} ${sub?.name || 'General'}</span>
              <h3 style="font-size: 1.15rem; margin-top: 6px;">${escapeHTML(exam.title)}</h3>
            </div>
            ${countdownText ? `<span class="countdown-badge ${badgeClass}">${countdownText}</span>` : ''}
          </div>
          <div class="section-subtitle">📅 Fecha: ${formatDateSpanish(exam.date)}</div>
          ${exam.topics ? `<div class="task-description"><strong>Temario:</strong>\n${escapeHTML(exam.topics)}</div>` : ''}
          ${photosHtml}
          ${
            exam.audioUrl
              ? `
            <div style="margin-top: 8px;">
              <audio controls src="${exam.audioUrl}" style="width: 100%; max-width: 320px; height: 32px;"></audio>
            </div>
          `
              : ''
          }
          <div class="task-actions">
            <button class="btn-action-small" onclick="window.handleExportSingleExamICS('${exam.id}')" title="Añadir este examen a Google/Apple Calendar (.ics)">📅 Calendario</button>
            <button class="btn-action-small" onclick="window.openExamModal('${exam.id}')">✏️ Editar</button>
            <button class="btn-action-small danger" onclick="window.confirmDeleteExam('${exam.id}')">🗑️ Eliminar</button>
          </div>
        </div>
      `;
    })
    .join('');
}

// ----------------------------------------------------
// 5. VISTA: CALIFICACIONES / NOTAS
// ----------------------------------------------------
function renderGradesView() {
  const container = document.getElementById('grades-list-container');
  const avgEl = document.getElementById('stat-overall-average');
  const totalEl = document.getElementById('stat-total-grades');
  if (!container) return;

  let filtered = [...AppState.grades];
  if (AppState.termFilter !== 'all') {
    filtered = filtered.filter((g) => String(g.term) === String(AppState.termFilter));
  }

  // Calcular media global
  if (AppState.grades.length > 0) {
    const sum = AppState.grades.reduce((acc, g) => acc + parseFloat(g.score || 0), 0);
    const avg = (sum / AppState.grades.length).toFixed(2);
    if (avgEl) avgEl.textContent = avg;
    if (totalEl) totalEl.textContent = AppState.grades.length;
  } else {
    if (avgEl) avgEl.textContent = '--';
    if (totalEl) totalEl.textContent = '0';
  }

  if (filtered.length === 0) {
    container.innerHTML = `<p class="section-subtitle" style="text-align: center; padding: 30px;">No hay notas registradas para este filtro.</p>`;
    return;
  }

  container.innerHTML = filtered
    .map((grade) => {
      const sub = AppState.subjects.find((s) => s.id === grade.subjectId);
      const score = parseFloat(grade.score);
      let scoreClass = 'score-aprobado';
      if (score >= 9) scoreClass = 'score-sobresaliente';
      else if (score >= 7) scoreClass = 'score-notable';
      else if (score < 5) scoreClass = 'score-suspenso';

      return `
        <div class="grade-item-row">
          <div>
            <div style="font-weight: 700; font-size: 0.95rem;">${escapeHTML(grade.title)}</div>
            <div class="task-meta">
              <span class="tag-subject" style="background: ${sub?.color || '#3b82f6'}">${sub?.icon || ''} ${sub?.name || 'General'}</span>
              <span>Trimestre ${grade.term}º</span>
              ${grade.date ? `<span>📅 ${grade.date}</span>` : ''}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="grade-score-pill ${scoreClass}">${score.toFixed(1)}</div>
            <button class="btn-action-small danger" onclick="window.confirmDeleteGrade('${grade.id}')">🗑️</button>
          </div>
        </div>
      `;
    })
    .join('');
}

// ----------------------------------------------------
// 6. VISTA: GALERÍA DE FOTOS DE APUNTES
// ----------------------------------------------------
function renderGalleryView() {
  const container = document.getElementById('gallery-container');
  if (!container) return;

  // Recolectar todas las fotos de tareas y exámenes
  const allPhotos = [];
  AppState.tasks.forEach((t) => {
    if (t.photos && t.photos.length > 0) {
      const sub = AppState.subjects.find((s) => s.id === t.subjectId);
      t.photos.forEach((p) => {
        allPhotos.push({
          src: p,
          title: t.title,
          subject: sub?.name || 'General',
          color: sub?.color || '#3b82f6',
          icon: sub?.icon || '📸',
          date: t.dueDate
        });
      });
    }
  });

  AppState.exams.forEach((e) => {
    if (e.photos && e.photos.length > 0) {
      const sub = AppState.subjects.find((s) => s.id === e.subjectId);
      e.photos.forEach((p) => {
        allPhotos.push({
          src: p,
          title: `Temario: ${e.title}`,
          subject: sub?.name || 'General',
          color: sub?.color || '#8b5cf6',
          icon: sub?.icon || '📝',
          date: e.date
        });
      });
    }
  });

  AppState.projects.forEach((proj) => {
    if (proj.photos && proj.photos.length > 0) {
      const sub = AppState.subjects.find((s) => s.id === proj.subjectId);
      proj.photos.forEach((p) => {
        allPhotos.push({
          src: p,
          title: `Obra: ${proj.title}`,
          subject: sub?.name || 'Arte',
          color: sub?.color || '#ec4899',
          icon: sub?.icon || '🎨',
          date: proj.dueDate || ''
        });
      });
    }
  });

  // Filtrar fotos por consulta de búsqueda (incluyendo texto OCR reconocido)
  let filteredPhotos = allPhotos;
  if (AppState.gallerySearchQuery) {
    const q = AppState.gallerySearchQuery.toLowerCase().trim();
    filteredPhotos = allPhotos.filter((item) => {
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchSub = (item.subject || '').toLowerCase().includes(q);
      const ocrText = getCachedOcrText(item.src) || '';
      const matchOcr = ocrText.toLowerCase().includes(q);
      return matchTitle || matchSub || matchOcr;
    });
  }

  if (allPhotos.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 40px 20px;">
        <span style="font-size: 2.5rem;">📷</span>
        <h3 style="margin-top: 10px;">Aún no tienes fotos guardadas</h3>
        <p class="section-subtitle" style="margin-bottom: 16px;">Saca fotos a la pizarra, esquemas o ejercicios del libro con la cámara para encontrarlas aquí al instante.</p>
        <button class="btn-primary" style="width: auto; margin: 0 auto;" onclick="window.openQuickCamera()">📷 Sacar Foto Ahora</button>
      </div>
    `;
    return;
  }

  if (filteredPhotos.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 30px 20px;">
        <span style="font-size: 2rem;">🔍</span>
        <h4 style="margin-top: 8px;">No hay fotos que coincidan</h4>
        <p class="section-subtitle">Prueba a buscar por otra palabra clave o limpia el filtro.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px;">
      ${filteredPhotos
        .map((item) => {
          const hasOcr = !!getCachedOcrText(item.src);
          return `
        <div class="card" style="padding: 8px; cursor: pointer; margin-bottom: 0; position: relative;" onclick="window.openImageViewer('${item.src}', '${escapeHTML(item.title)}')">
          <div style="position: relative;">
            <img src="${item.src}" alt="${escapeHTML(item.title)}" style="width: 100%; height: 140px; object-fit: cover; border-radius: var(--radius-sm);" />
            ${hasOcr ? `<span style="position: absolute; bottom: 6px; right: 6px; background: rgba(16, 185, 129, 0.9); color: #fff; font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: var(--radius-full);">🔍 OCR</span>` : ''}
          </div>
          <div style="margin-top: 6px; font-size: 0.8rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHTML(item.title)}
          </div>
          <span class="tag-subject" style="background: ${item.color}; font-size: 0.7rem; margin-top: 4px;">${item.icon} ${item.subject}</span>
        </div>
      `;
        })
        .join('')}
    </div>
  `;
}

// ----------------------------------------------------
// 7. VISTA: AJUSTES
// ----------------------------------------------------
function renderSettingsView() {
  // Rellenar campos de perfil
  const studentInput = document.getElementById('setting-student-name');
  const courseInput = document.getElementById('setting-student-course');
  const schoolInput = document.getElementById('setting-school-name');

  if (studentInput) studentInput.value = AppState.studentInfo.studentName || '';
  if (courseInput) courseInput.value = AppState.studentInfo.course || '';
  if (schoolInput) schoolInput.value = AppState.studentInfo.schoolName || '';

  // Lista de asignaturas editables
  const subjectsContainer = document.getElementById('settings-subjects-list');
  if (subjectsContainer) {
    subjectsContainer.innerHTML = AppState.subjects
      .map(
        (sub) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-input); border-radius: var(--radius-sm); margin-bottom: 6px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.2rem;">${sub.icon || '📖'}</span>
          <span style="font-weight: 700; color: ${sub.color};">${escapeHTML(sub.name)}</span>
          <span style="font-size: 0.8rem; color: var(--text-dim);">(${sub.teacher || 'Sin prof.'})</span>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="btn-action-small" onclick="window.openSubjectModal('${sub.id}')">✏️</button>
          <button class="btn-action-small danger" onclick="window.confirmDeleteSubject('${sub.id}')">🗑️</button>
        </div>
      </div>
    `
      )
      .join('');
  }
}

// ==========================================================================
// CONTROLADORES DE FORMULARIOS Y ACCIONES
// ==========================================================================

// --- TAREAS ---
window.openTaskModal = function (taskId = null) {
  const modal = document.getElementById('task-modal');
  const titleEl = document.getElementById('task-modal-title');
  const idInput = document.getElementById('task-id');
  const titleInput = document.getElementById('task-title-input');
  const subjectSelect = document.getElementById('task-subject-select');
  const dueInput = document.getElementById('task-due-date');
  const prioritySelect = document.getElementById('task-priority-select');
  const descInput = document.getElementById('task-desc-input');
  const audioPreview = document.getElementById('task-audio-preview');
  const audioPlayer = document.getElementById('task-audio-player');

  populateSubjectSelect(subjectSelect);

  if (taskId) {
    const task = AppState.tasks.find((t) => t.id === taskId);
    if (task) {
      titleEl.textContent = 'Editar Tarea / Deber';
      idInput.value = task.id;
      titleInput.value = task.title;
      subjectSelect.value = task.subjectId;
      dueInput.value = task.dueDate;
      prioritySelect.value = task.priority || 'media';
      descInput.value = task.description || '';
      AppState.tempTaskPhotos = [...(task.photos || [])];
      AppState.tempTaskAudio = task.audioUrl || null;
      if (AppState.tempTaskAudio && audioPreview && audioPlayer) {
        audioPlayer.src = AppState.tempTaskAudio;
        audioPreview.classList.remove('hidden');
      } else if (audioPreview) {
        audioPreview.classList.add('hidden');
        if (audioPlayer) audioPlayer.src = '';
      }
    }
  } else {
    titleEl.textContent = 'Nueva Tarea / Deber';
    idInput.value = '';
    titleInput.value = '';
    dueInput.value = getTomorrowDateString();
    prioritySelect.value = 'media';
    descInput.value = '';
    AppState.tempTaskPhotos = [];
    AppState.tempTaskAudio = null;
    if (audioPreview) audioPreview.classList.add('hidden');
    if (audioPlayer) audioPlayer.src = '';
  }

  renderPhotosPreview('task-photos-preview', AppState.tempTaskPhotos);
  modal.classList.remove('hidden');
};

async function handleTaskFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('task-id').value || `task_${Date.now()}`;
  const title = document.getElementById('task-title-input').value.trim();
  const subjectId = document.getElementById('task-subject-select').value;
  const dueDate = document.getElementById('task-due-date').value;
  const priority = document.getElementById('task-priority-select').value;
  const description = document.getElementById('task-desc-input').value.trim();

  const existing = AppState.tasks.find((t) => t.id === id);
  const status = existing ? existing.status : 'pending';

  const task = {
    id,
    title,
    subjectId,
    dueDate,
    priority,
    description,
    photos: [...AppState.tempTaskPhotos],
    audioUrl: AppState.tempTaskAudio || null,
    status,
    updatedAt: new Date().toISOString()
  };

  await saveItem('tasks', task);
  await loadAllData();
  renderAllViews();
  document.getElementById('task-modal').classList.add('hidden');
  showToast('✅ Tarea guardada con éxito', 'success');
}

window.toggleTaskComplete = async function (taskId) {
  const task = AppState.tasks.find((t) => t.id === taskId);
  if (task) {
    task.status = task.status === 'completed' ? 'pending' : 'completed';
    await saveItem('tasks', task);
    await loadAllData();
    renderAllViews();
    if (task.status === 'completed') {
      showToast('🎉 ¡Tarea completada!', 'success');
      const { newlyUnlocked } = await recordStudyActivity('task_completed');
      const stats = await getGamificationStats();
      updateGamificationUI(stats);
      if (newlyUnlocked && newlyUnlocked.length > 0) {
        for (const ach of newlyUnlocked) {
          showToast(`🏆 ¡Logro Desbloqueado!: ${ach.title}`, 'success');
        }
      }
    } else {
      showToast('Tarea marcada como pendiente');
    }
  }
};

window.confirmDeleteTask = async function (taskId) {
  const task = AppState.tasks.find((t) => t.id === taskId);
  if (!task) return;
  if (confirm('¿Mover esta tarea a la papelera de reciclaje?')) {
    await moveToTrash('tasks', task, task.title || 'Tarea');
    await loadAllData();
    renderAllViews();
    showToast('🗑️ Tarea movida a la papelera (30 días)');
  }
};

// --- EXÁMENES ---
window.openExamModal = function (examId = null) {
  const modal = document.getElementById('exam-modal');
  const titleEl = document.getElementById('exam-modal-title');
  const idInput = document.getElementById('exam-id');
  const titleInput = document.getElementById('exam-title-input');
  const subjectSelect = document.getElementById('exam-subject-select');
  const dateInput = document.getElementById('exam-date-input');
  const topicsInput = document.getElementById('exam-topics-input');
  const audioPreview = document.getElementById('exam-audio-preview');
  const audioPlayer = document.getElementById('exam-audio-player');

  populateSubjectSelect(subjectSelect);

  if (examId) {
    const exam = AppState.exams.find((e) => e.id === examId);
    if (exam) {
      titleEl.textContent = 'Editar Examen';
      idInput.value = exam.id;
      titleInput.value = exam.title;
      subjectSelect.value = exam.subjectId;
      dateInput.value = exam.date;
      topicsInput.value = exam.topics || '';
      AppState.tempExamPhotos = [...(exam.photos || [])];
      AppState.tempExamAudio = exam.audioUrl || null;
      if (AppState.tempExamAudio && audioPreview && audioPlayer) {
        audioPlayer.src = AppState.tempExamAudio;
        audioPreview.classList.remove('hidden');
      } else if (audioPreview) {
        audioPreview.classList.add('hidden');
        if (audioPlayer) audioPlayer.src = '';
      }
    }
  } else {
    titleEl.textContent = 'Nuevo Examen';
    idInput.value = '';
    titleInput.value = '';
    dateInput.value = getTomorrowDateString();
    topicsInput.value = '';
    AppState.tempExamPhotos = [];
    AppState.tempExamAudio = null;
    if (audioPreview) audioPreview.classList.add('hidden');
    if (audioPlayer) audioPlayer.src = '';
  }

  renderPhotosPreview('exam-photos-preview', AppState.tempExamPhotos);
  modal.classList.remove('hidden');
};

async function handleExamFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('exam-id').value || `exam_${Date.now()}`;
  const title = document.getElementById('exam-title-input').value.trim();
  const subjectId = document.getElementById('exam-subject-select').value;
  const date = document.getElementById('exam-date-input').value;
  const topics = document.getElementById('exam-topics-input').value.trim();

  const exam = {
    id,
    title,
    subjectId,
    date,
    topics,
    photos: [...AppState.tempExamPhotos],
    audioUrl: AppState.tempExamAudio || null,
    updatedAt: new Date().toISOString()
  };

  await saveItem('exams', exam);
  await loadAllData();
  renderAllViews();
  document.getElementById('exam-modal').classList.add('hidden');
  showToast('✅ Examen guardado con éxito', 'success');
}

window.confirmDeleteExam = async function (examId) {
  const exam = AppState.exams.find((e) => e.id === examId);
  if (!exam) return;
  if (confirm('¿Mover este examen a la papelera de reciclaje?')) {
    await moveToTrash('exams', exam, exam.title || exam.topics || 'Examen');
    await loadAllData();
    renderAllViews();
    showToast('🗑️ Examen movido a la papelera (30 días)');
  }
};

// --- NOTAS ---
window.openGradeModal = function () {
  const modal = document.getElementById('grade-modal');
  const subjectSelect = document.getElementById('grade-subject-select');
  populateSubjectSelect(subjectSelect);
  document.getElementById('grade-id').value = '';
  document.getElementById('grade-title-input').value = '';
  document.getElementById('grade-score-input').value = '';
  document.getElementById('grade-date-input').value = getTodayDateString();
  modal.classList.remove('hidden');
};

async function handleGradeFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('grade-id').value || `grade_${Date.now()}`;
  const subjectId = document.getElementById('grade-subject-select').value;
  const term = parseInt(document.getElementById('grade-term-select').value, 10);
  const title = document.getElementById('grade-title-input').value.trim();
  const score = parseFloat(document.getElementById('grade-score-input').value);
  const date = document.getElementById('grade-date-input').value;

  const grade = { id, subjectId, term, title, score, date };
  await saveItem('grades', grade);
  await recordStudyActivity('grade_added');
  await loadAllData();
  renderAllViews();
  document.getElementById('grade-modal').classList.add('hidden');
  showToast('✅ Calificación guardada');
}

window.confirmDeleteGrade = async function (gradeId) {
  const grade = AppState.grades.find((g) => g.id === gradeId);
  if (!grade) return;
  if (confirm('¿Mover esta calificación a la papelera de reciclaje?')) {
    await moveToTrash('grades', grade, `Nota: ${grade.score} (${grade.title || 'Evaluación'})`);
    await loadAllData();
    renderAllViews();
    showToast('🗑️ Calificación movida a la papelera');
  }
};

// --- ASIGNAR EN HORARIO ---
window.openSlotModal = function (day, slotIndex) {
  const modal = document.getElementById('slot-modal');
  const dayInput = document.getElementById('slot-day');
  const indexInput = document.getElementById('slot-index');
  const subjectSelect = document.getElementById('slot-subject-select');
  const classroomInput = document.getElementById('slot-classroom-input');

  dayInput.value = day;
  indexInput.value = slotIndex;

  populateSubjectSelect(subjectSelect, true);

  const existing = AppState.schedule.find((s) => s.day === day && s.slotIndex === slotIndex);
  if (existing) {
    subjectSelect.value = existing.subjectId || '';
    classroomInput.value = existing.classroom || '';
  } else {
    subjectSelect.value = '';
    classroomInput.value = '';
  }

  modal.classList.remove('hidden');
};

async function handleSlotFormSubmit(e) {
  e.preventDefault();
  const day = parseInt(document.getElementById('slot-day').value, 10);
  const slotIndex = parseInt(document.getElementById('slot-index').value, 10);
  const subjectId = document.getElementById('slot-subject-select').value;
  const classroom = document.getElementById('slot-classroom-input').value.trim();

  const id = `slot_${day}_${slotIndex}`;

  if (!subjectId) {
    // Si se dejó en blanco, borrar asignación
    await deleteItem('schedule', id);
  } else {
    await saveItem('schedule', { id, day, slotIndex, subjectId, classroom });
  }

  await loadAllData();
  renderAllViews();
  document.getElementById('slot-modal').classList.add('hidden');
  showToast('📅 Horario actualizado');
}

// --- SELECTOR VISUAL DE ICONOS PARA ASIGNATURAS ---
const SUBJECT_ICON_CATALOG = {
  artes: {
    name: 'Artes y Taller',
    icons: ['🎨', '🖌️', '✏️', '📐', '📏', '🖼️', '🎭', '🏺', '✂️', '🪵', '🧵', '🖍️', '📷', '💡', '🪨', '🗿']
  },
  musica: {
    name: 'Música',
    icons: ['🎵', '🎶', '🎸', '🎹', '🎻', '🥁', '🎷', '🎺', '🎙️', '🎧', '🎼', '📻', '🪗', '🪕']
  },
  ciencias: {
    name: 'Ciencias y Matemáticas',
    icons: ['📐', '🔢', '➕', '🧪', '🔬', '🧬', '🔭', '🧮', '⚗️', '🌍', '⚡', '🌿', '🪐', '📊', '☄️', '⚛️']
  },
  letras: {
    name: 'Letras e Idiomas',
    icons: ['📖', '📚', '✍️', '🗣️', '📜', '🏛️', '✒️', '🇬🇧', '🇫🇷', '🇩🇪', '🗺️', '📝', '🗞️', '💬', '🔤', '🇪🇸']
  },
  tecno: {
    name: 'Tecnología e Informática',
    icons: ['💻', '🖥️', '🤖', '⚙️', '🔌', '🔋', '⌨️', '🖱️', '📡', '💾', '📱', '🔧', '🕹️', '🌐', '🖨️', '🛰️']
  },
  deporte: {
    name: 'Educación Física y Deporte',
    icons: ['⚽', '🏀', '🏐', '🎾', '🏃', '🏊', '🚴', '🥋', '🏆', '🥇', '🏸', '🏓', '🧗', '🥊', '🛹', '🏹']
  },
  humanidades: {
    name: 'Valores y Humanidades',
    icons: ['🧠', '⚖️', '🧭', '🕊️', '🤝', '💡', '🕯️', '👥', '💬', '🌟', '🌱', '🌍', '❤️', '🛡️', '☀️', '⭐']
  }
};

let currentIconCategory = 'all';

function initSubjectIconPicker() {
  const iconInput = document.getElementById('subject-icon-input');
  const previewEl = document.getElementById('subject-icon-preview');
  const toggleBtn = document.getElementById('btn-toggle-icon-picker');
  const pickerBox = document.getElementById('subject-icon-picker');
  const catTabs = document.querySelectorAll('[data-icon-cat]');

  // Alternar visibilidad del catálogo
  toggleBtn?.addEventListener('click', () => {
    if (pickerBox) {
      pickerBox.classList.toggle('hidden');
    }
  });

  // Filtro de pestañas de categorías
  catTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      catTabs.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentIconCategory = btn.getAttribute('data-icon-cat');
      renderSubjectIconGrid(currentIconCategory, iconInput?.value.trim());
    });
  });

  // Entrada manual de emoji / texto en el input
  iconInput?.addEventListener('input', () => {
    const val = iconInput.value.trim();
    if (previewEl) {
      previewEl.textContent = val || '📖';
    }
    // Resaltar en la rejilla si coincide
    document.querySelectorAll('.icon-picker-btn').forEach((b) => {
      b.classList.toggle('active', b.textContent === val);
    });
  });
}

function renderSubjectIconGrid(category = 'all', selectedIcon = '') {
  const grid = document.getElementById('icon-picker-grid');
  const iconInput = document.getElementById('subject-icon-input');
  const previewEl = document.getElementById('subject-icon-preview');
  if (!grid) return;

  grid.innerHTML = '';
  let iconsToShow = [];

  if (category === 'all') {
    Object.values(SUBJECT_ICON_CATALOG).forEach((cat) => {
      iconsToShow.push(...cat.icons);
    });
    iconsToShow = [...new Set(iconsToShow)];
  } else if (SUBJECT_ICON_CATALOG[category]) {
    iconsToShow = SUBJECT_ICON_CATALOG[category].icons;
  }

  iconsToShow.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `icon-picker-btn ${selectedIcon === emoji ? 'active' : ''}`;
    btn.textContent = emoji;
    btn.title = `Elegir icono ${emoji}`;
    btn.addEventListener('click', () => {
      if (iconInput) iconInput.value = emoji;
      if (previewEl) previewEl.textContent = emoji;
      document.querySelectorAll('.icon-picker-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
    grid.appendChild(btn);
  });
}

// --- GESTIÓN DE ASIGNATURAS ---
window.openSubjectModal = function (subId = null) {
  const modal = document.getElementById('subject-modal');
  const titleEl = document.getElementById('subject-modal-title');
  const idInput = document.getElementById('subject-id');
  const nameInput = document.getElementById('subject-name-input');
  const iconInput = document.getElementById('subject-icon-input');
  const previewEl = document.getElementById('subject-icon-preview');
  const colorInput = document.getElementById('subject-color-input');
  const teacherInput = document.getElementById('subject-teacher-input');
  const classInput = document.getElementById('subject-classroom-input');
  const pickerBox = document.getElementById('subject-icon-picker');

  // Asegurar que el catálogo de iconos esté visible
  if (pickerBox) pickerBox.classList.remove('hidden');

  let activeIcon = '📖';

  if (subId) {
    const sub = AppState.subjects.find((s) => s.id === subId);
    if (sub) {
      titleEl.textContent = 'Editar Asignatura';
      idInput.value = sub.id;
      nameInput.value = sub.name;
      activeIcon = sub.icon || '📖';
      iconInput.value = activeIcon;
      colorInput.value = sub.color || '#3b82f6';
      teacherInput.value = sub.teacher || '';
      classInput.value = sub.classroom || '';
    }
  } else {
    titleEl.textContent = 'Nueva Asignatura';
    idInput.value = '';
    nameInput.value = '';
    activeIcon = '📖';
    iconInput.value = '📖';
    colorInput.value = '#3b82f6';
    teacherInput.value = '';
    classInput.value = '';
  }

  if (previewEl) previewEl.textContent = activeIcon;

  // Renderizar catálogo con el icono activo seleccionado
  renderSubjectIconGrid(currentIconCategory, activeIcon);

  modal.classList.remove('hidden');
};

async function handleSubjectFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('subject-id').value || `sub_${Date.now()}`;
  const name = document.getElementById('subject-name-input').value.trim();
  const icon = document.getElementById('subject-icon-input').value.trim() || '📖';
  const color = document.getElementById('subject-color-input').value;
  const teacher = document.getElementById('subject-teacher-input').value.trim();
  const classroom = document.getElementById('subject-classroom-input').value.trim();

  const sub = { id, name, icon, color, teacher, classroom };
  await saveItem('subjects', sub);
  await loadAllData();
  renderAllViews();
  document.getElementById('subject-modal').classList.add('hidden');
  showToast('📚 Asignatura guardada');
}

window.confirmDeleteSubject = async function (subId) {
  if (confirm('¿Eliminar esta asignatura? Ten en cuenta que las tareas y horarios asociados perderán la referencia.')) {
    await deleteItem('subjects', subId);
    await loadAllData();
    renderAllViews();
    showToast('🗑️ Asignatura eliminada');
  }
};

// --- FOTO RÁPIDA ---
window.openQuickCamera = function () {
  openCamera(async (photoDataUrl) => {
    // Al tomar foto rápida, preguntar a qué tarea o si crear una nueva tarea con ella
    const title = prompt('Ingresa un título para esta foto / apunte (ej: Pizarra Tema 4):');
    if (title) {
      const task = {
        id: `task_${Date.now()}`,
        title: title,
        subjectId: AppState.subjects[0]?.id || '',
        dueDate: getTomorrowDateString(),
        priority: 'media',
        description: 'Foto tomada desde la cámara rápida',
        photos: [photoDataUrl],
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await saveItem('tasks', task);
      await loadAllData();
      renderAllViews();
      showToast('📸 Foto y apunte guardados en Deberes', 'success');
    }
  });
};

// --- PERFIL Y COPIAS DE SEGURIDAD ---
async function handleSaveProfile() {
  const studentName = document.getElementById('setting-student-name').value.trim();
  const course = document.getElementById('setting-student-course').value.trim();
  const schoolName = document.getElementById('setting-school-name').value.trim();

  AppState.studentInfo = {
    ...AppState.studentInfo,
    studentName,
    course,
    schoolName
  };

  await setSetting('studentInfo', AppState.studentInfo);
  updateHeaderInfo();
  showToast('💾 Perfil actualizado con éxito', 'success');
}

async function handleExportBackup() {
  try {
    const jsonStr = await exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `copia_agenda_escolar_${getTodayDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📥 Copia de seguridad descargada', 'success');
  } catch (err) {
    alert('Error al exportar copia de seguridad: ' + err.message);
  }
}

async function handleImportBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (confirm('¡Atención! Al restaurar una copia de seguridad se reemplazarán los datos actuales por los de la copia. ¿Deseas continuar?')) {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        await importBackup(event.target.result);
        await loadAllData();
        renderAllViews();
        showToast('🎉 Copia de seguridad restaurada correctamente', 'success');
      } catch (err) {
        alert('Error al restaurar: ' + err.message);
      }
    };
    reader.readAsText(file);
  }
  e.target.value = '';
}

// --- COMPARTIR POR WHATSAPP Y CÓDIGO QR ---
function openShareModal() {
  const modal = document.getElementById('share-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  switchShareTab('wa');
  updateWhatsAppPreview();
}

function switchShareTab(tab) {
  const waBtn = document.getElementById('share-tab-wa-btn');
  const qrBtn = document.getElementById('share-tab-qr-btn');
  const scanBtn = document.getElementById('share-tab-scan-btn');

  const waPanel = document.getElementById('share-panel-wa');
  const qrPanel = document.getElementById('share-panel-qr');
  const scanPanel = document.getElementById('share-panel-scan');

  waBtn?.classList.toggle('active', tab === 'wa');
  qrBtn?.classList.toggle('active', tab === 'qr');
  scanBtn?.classList.toggle('active', tab === 'scan');

  waPanel?.classList.toggle('hidden', tab !== 'wa');
  qrPanel?.classList.toggle('hidden', tab !== 'qr');
  scanPanel?.classList.toggle('hidden', tab !== 'scan');

  if (tab === 'wa') updateWhatsAppPreview();
  if (tab === 'qr') updateQRCode();
}

function getSelectedWhatsAppMessage() {
  const select = document.getElementById('wa-content-type');
  const type = select ? select.value : 'tasks_tomorrow';

  if (type === 'tasks_tomorrow') {
    return formatTasksForWhatsApp(AppState.tasks, AppState.subjects, AppState.studentInfo, 'tomorrow');
  } else if (type === 'tasks_today') {
    return formatTasksForWhatsApp(AppState.tasks, AppState.subjects, AppState.studentInfo, 'today');
  } else if (type === 'tasks_all') {
    return formatTasksForWhatsApp(AppState.tasks, AppState.subjects, AppState.studentInfo, 'all');
  } else if (type === 'exams') {
    return formatExamsForWhatsApp(AppState.exams, AppState.subjects, AppState.studentInfo);
  } else if (type === 'schedule') {
    return formatScheduleForWhatsApp(AppState.schedule, AppState.subjects, AppState.timeSlots, AppState.studentInfo);
  }
  return '';
}

function updateWhatsAppPreview() {
  const preview = document.getElementById('wa-preview-text');
  if (preview) {
    preview.value = getSelectedWhatsAppMessage();
  }
}

function handleSendWhatsApp() {
  const preview = document.getElementById('wa-preview-text');
  const text = preview ? preview.value : getSelectedWhatsAppMessage();
  if (!text) {
    showToast('No hay contenido para enviar', 'warning');
    return;
  }
  sendToWhatsApp(text);
  showToast('💬 Abriendo WhatsApp...');
}

async function handleCopyWhatsAppText() {
  const preview = document.getElementById('wa-preview-text');
  const text = preview ? preview.value : getSelectedWhatsAppMessage();
  if (text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('📋 Texto copiado al portapapeles', 'success');
    } catch {
      showToast('No se pudo copiar automáticamente', 'error');
    }
  }
}

function updateQRCode() {
  const select = document.getElementById('qr-content-type');
  const canvas = document.getElementById('qr-code-canvas');
  const descEl = document.getElementById('qr-description');
  if (!canvas || !select) return;

  const type = select.value;
  let textToEncode = '';
  let description = '';

  if (type === 'app_url') {
    textToEncode = window.location.href;
    description = 'Escanea con la cámara de tu móvil para abrir e instalar la Agenda Escolar.';
  } else if (type === 'tasks_tomorrow') {
    textToEncode = formatTasksForWhatsApp(AppState.tasks, AppState.subjects, AppState.studentInfo, 'tomorrow');
    description = 'Código QR con los deberes para mañana.';
  } else if (type === 'tasks_today') {
    textToEncode = formatTasksForWhatsApp(AppState.tasks, AppState.subjects, AppState.studentInfo, 'today');
    description = 'Código QR con los deberes de hoy.';
  } else if (type === 'exams') {
    textToEncode = formatExamsForWhatsApp(AppState.exams, AppState.subjects, AppState.studentInfo);
    description = 'Código QR con los próximos exámenes y temario.';
  } else if (type === 'schedule') {
    textToEncode = formatScheduleForWhatsApp(AppState.schedule, AppState.subjects, AppState.timeSlots, AppState.studentInfo);
    description = 'Código QR con el horario escolar semanal.';
  }

  try {
    renderQRCodeToCanvas(textToEncode, canvas, 260);
    if (descEl) descEl.textContent = description;
  } catch (err) {
    console.error('Error al generar código QR:', err);
    if (descEl) descEl.textContent = 'El contenido es demasiado largo para un solo código QR. Prueba a seleccionar una sola sección.';
  }
}

function handleDownloadQRCode() {
  const canvas = document.getElementById('qr-code-canvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `codigo_qr_agenda_${getTodayDateString()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('💾 Código QR descargado en imagen');
}

async function handleStartQRScan() {
  const resultCard = document.getElementById('qr-scan-result-card');
  const resultText = document.getElementById('qr-scan-result-text');

  if ('BarcodeDetector' in window) {
    try {
      const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
      openCamera(async (photoDataUrl) => {
        const img = new Image();
        img.onload = async () => {
          try {
            const barcodes = await barcodeDetector.detect(img);
            if (barcodes.length > 0) {
              const rawValue = barcodes[0].rawValue;
              if (resultCard && resultText) {
                resultCard.classList.remove('hidden');
                resultText.textContent = rawValue;
              }
              showToast('✅ Código QR leído con éxito', 'success');
              if (rawValue.startsWith('http://') || rawValue.startsWith('https://')) {
                if (confirm(`Se ha detectado un enlace:\n${rawValue}\n\n¿Deseas abrirlo?`)) {
                  window.open(rawValue, '_blank');
                }
              }
            } else {
              showToast('No se detectó ningún código QR en la foto', 'warning');
            }
          } catch (err) {
            showToast('Error al decodificar QR: ' + err.message, 'error');
          }
        };
        img.src = photoDataUrl;
      });
      return;
    } catch (e) {
      console.warn('BarcodeDetector falló:', e);
    }
  }

  const input = prompt('Introduce o pega el contenido del código QR o enlace:');
  if (input && resultCard && resultText) {
    resultCard.classList.remove('hidden');
    resultText.textContent = input;
    showToast('Texto cargado correctamente');
  }
}

// --- GRABADORA DE NOTAS DE VOZ (AUDIO OFFLINE) ---
function initAudioRecorder() {
  // 1. Tareas
  document.getElementById('btn-record-audio')?.addEventListener('click', handleToggleAudioRecording);
  document.getElementById('btn-cancel-recording')?.addEventListener('click', handleCancelAudioRecording);
  document.getElementById('btn-remove-audio')?.addEventListener('click', handleRemoveAudio);

  // 2. Exámenes
  document.getElementById('btn-record-exam-audio')?.addEventListener('click', handleToggleExamAudioRecording);
  document.getElementById('btn-cancel-exam-recording')?.addEventListener('click', handleCancelExamAudioRecording);
  document.getElementById('btn-remove-exam-audio')?.addEventListener('click', handleRemoveExamAudio);

  // 3. Proyectos
  document.getElementById('btn-record-project-audio')?.addEventListener('click', handleToggleProjectAudioRecording);
  document.getElementById('btn-cancel-project-recording')?.addEventListener('click', handleCancelProjectAudioRecording);
  document.getElementById('btn-remove-project-audio')?.addEventListener('click', handleRemoveProjectAudio);
}

// Audio para tareas
async function handleToggleAudioRecording() {
  const icon = document.getElementById('record-audio-icon');
  const text = document.getElementById('record-audio-text');
  const timer = document.getElementById('record-timer');
  const btnCancel = document.getElementById('btn-cancel-recording');
  const btnRecord = document.getElementById('btn-record-audio');
  const audioPreview = document.getElementById('task-audio-preview');
  const audioPlayer = document.getElementById('task-audio-player');

  if (!AppState.isRecordingAudio) {
    try {
      await startRecording((sec) => {
        const m = String(Math.floor(sec / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        if (timer) timer.textContent = `${m}:${s}`;
      });
      AppState.isRecordingAudio = true;
      if (icon) icon.textContent = '⏹️';
      if (text) text.textContent = 'Detener Grabación';
      if (timer) {
        timer.textContent = '00:00';
        timer.classList.remove('hidden');
      }
      btnCancel?.classList.remove('hidden');
      btnRecord?.classList.add('recording-active');
      showToast('🎙️ Grabando nota de voz...');
    } catch (err) {
      alert('Error al acceder al micrófono: ' + err.message);
    }
  } else {
    try {
      const audioData = await stopRecording();
      AppState.isRecordingAudio = false;
      if (icon) icon.textContent = '🎙️';
      if (text) text.textContent = 'Volver a Grabar';
      timer?.classList.add('hidden');
      btnCancel?.classList.add('hidden');
      btnRecord?.classList.remove('recording-active');

      if (audioData && audioData.dataUrl) {
        AppState.tempTaskAudio = audioData.dataUrl;
        if (audioPreview && audioPlayer) {
          audioPlayer.src = audioData.dataUrl;
          audioPreview.classList.remove('hidden');
        }
        showToast('✅ Nota de voz guardada', 'success');
      }
    } catch (err) {
      alert('Error al procesar el audio: ' + err.message);
    }
  }
}

function handleCancelAudioRecording() {
  cancelRecording();
  AppState.isRecordingAudio = false;
  const icon = document.getElementById('record-audio-icon');
  const text = document.getElementById('record-audio-text');
  const timer = document.getElementById('record-timer');
  const btnCancel = document.getElementById('btn-cancel-recording');
  const btnRecord = document.getElementById('btn-record-audio');

  if (icon) icon.textContent = '🎙️';
  if (text) text.textContent = 'Grabar Nota de Voz';
  timer?.classList.add('hidden');
  btnCancel?.classList.add('hidden');
  btnRecord?.classList.remove('recording-active');
  showToast('Grabación cancelada');
}

function handleRemoveAudio() {
  AppState.tempTaskAudio = null;
  const audioPreview = document.getElementById('task-audio-preview');
  const audioPlayer = document.getElementById('task-audio-player');
  if (audioPreview) audioPreview.classList.add('hidden');
  if (audioPlayer) audioPlayer.src = '';
  showToast('🗑️ Audio eliminado');
}

// Audio para exámenes
async function handleToggleExamAudioRecording() {
  const icon = document.getElementById('record-exam-audio-icon');
  const text = document.getElementById('record-exam-audio-text');
  const timer = document.getElementById('record-exam-timer');
  const btnCancel = document.getElementById('btn-cancel-exam-recording');
  const btnRecord = document.getElementById('btn-record-exam-audio');
  const audioPreview = document.getElementById('exam-audio-preview');
  const audioPlayer = document.getElementById('exam-audio-player');

  if (!AppState.isRecordingExamAudio) {
    try {
      await startRecording((sec) => {
        const m = String(Math.floor(sec / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        if (timer) timer.textContent = `${m}:${s}`;
      });
      AppState.isRecordingExamAudio = true;
      if (icon) icon.textContent = '⏹️';
      if (text) text.textContent = 'Detener Grabación';
      if (timer) {
        timer.textContent = '00:00';
        timer.classList.remove('hidden');
      }
      btnCancel?.classList.remove('hidden');
      btnRecord?.classList.add('recording-active');
      showToast('🎙️ Grabando nota para el examen...');
    } catch (err) {
      alert('Error al acceder al micrófono: ' + err.message);
    }
  } else {
    try {
      const audioData = await stopRecording();
      AppState.isRecordingExamAudio = false;
      if (icon) icon.textContent = '🎙️';
      if (text) text.textContent = 'Volver a Grabar';
      timer?.classList.add('hidden');
      btnCancel?.classList.add('hidden');
      btnRecord?.classList.remove('recording-active');

      if (audioData && audioData.dataUrl) {
        AppState.tempExamAudio = audioData.dataUrl;
        if (audioPreview && audioPlayer) {
          audioPlayer.src = audioData.dataUrl;
          audioPreview.classList.remove('hidden');
        }
        showToast('✅ Nota de voz del examen guardada', 'success');
      }
    } catch (err) {
      alert('Error al procesar el audio: ' + err.message);
    }
  }
}

function handleCancelExamAudioRecording() {
  cancelRecording();
  AppState.isRecordingExamAudio = false;
  const icon = document.getElementById('record-exam-audio-icon');
  const text = document.getElementById('record-exam-audio-text');
  const timer = document.getElementById('record-exam-timer');
  const btnCancel = document.getElementById('btn-cancel-exam-recording');
  const btnRecord = document.getElementById('btn-record-exam-audio');

  if (icon) icon.textContent = '🎙️';
  if (text) text.textContent = 'Grabar Nota de Voz';
  timer?.classList.add('hidden');
  btnCancel?.classList.add('hidden');
  btnRecord?.classList.remove('recording-active');
  showToast('Grabación cancelada');
}

function handleRemoveExamAudio() {
  AppState.tempExamAudio = null;
  const audioPreview = document.getElementById('exam-audio-preview');
  const audioPlayer = document.getElementById('exam-audio-player');
  if (audioPreview) audioPreview.classList.add('hidden');
  if (audioPlayer) audioPlayer.src = '';
  showToast('🗑️ Audio eliminado');
}

// Audio para proyectos artísticos
async function handleToggleProjectAudioRecording() {
  const icon = document.getElementById('record-project-audio-icon');
  const text = document.getElementById('record-project-audio-text');
  const timer = document.getElementById('record-project-timer');
  const btnCancel = document.getElementById('btn-cancel-project-recording');
  const btnRecord = document.getElementById('btn-record-project-audio');
  const audioPreview = document.getElementById('project-audio-preview');
  const audioPlayer = document.getElementById('project-audio-player');

  if (!AppState.isRecordingProjectAudio) {
    try {
      await startRecording((sec) => {
        const m = String(Math.floor(sec / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        if (timer) timer.textContent = `${m}:${s}`;
      });
      AppState.isRecordingProjectAudio = true;
      if (icon) icon.textContent = '⏹️';
      if (text) text.textContent = 'Detener Grabación';
      if (timer) {
        timer.textContent = '00:00';
        timer.classList.remove('hidden');
      }
      btnCancel?.classList.remove('hidden');
      btnRecord?.classList.add('recording-active');
      showToast('🎙️ Grabando memoria artística...');
    } catch (err) {
      alert('Error al acceder al micrófono: ' + err.message);
    }
  } else {
    try {
      const audioData = await stopRecording();
      AppState.isRecordingProjectAudio = false;
      if (icon) icon.textContent = '🎙️';
      if (text) text.textContent = 'Volver a Grabar';
      timer?.classList.add('hidden');
      btnCancel?.classList.add('hidden');
      btnRecord?.classList.remove('recording-active');

      if (audioData && audioData.dataUrl) {
        AppState.tempProjectAudio = audioData.dataUrl;
        if (audioPreview && audioPlayer) {
          audioPlayer.src = audioData.dataUrl;
          audioPreview.classList.remove('hidden');
        }
        showToast('✅ Nota de voz del proyecto guardada', 'success');
      }
    } catch (err) {
      alert('Error al procesar el audio: ' + err.message);
    }
  }
}

function handleCancelProjectAudioRecording() {
  cancelRecording();
  AppState.isRecordingProjectAudio = false;
  const icon = document.getElementById('record-project-audio-icon');
  const text = document.getElementById('record-project-audio-text');
  const timer = document.getElementById('record-project-timer');
  const btnCancel = document.getElementById('btn-cancel-project-recording');
  const btnRecord = document.getElementById('btn-record-project-audio');

  if (icon) icon.textContent = '🎙️';
  if (text) text.textContent = 'Grabar Nota de Voz';
  timer?.classList.add('hidden');
  btnCancel?.classList.add('hidden');
  btnRecord?.classList.remove('recording-active');
  showToast('Grabación cancelada');
}

function handleRemoveProjectAudio() {
  AppState.tempProjectAudio = null;
  const audioPreview = document.getElementById('project-audio-preview');
  const audioPlayer = document.getElementById('project-audio-player');
  if (audioPreview) audioPreview.classList.add('hidden');
  if (audioPlayer) audioPlayer.src = '';
  showToast('🗑️ Audio eliminado');
}

// --- TRANSCRIPCIÓN Y DICTADO POR VOZ A TEXTO (WEB SPEECH API) ---
function initVoiceDictation() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-voice-dictate');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const targetId = btn.getAttribute('data-voice-target');
    const targetInput = document.getElementById(targetId);
    if (!targetInput) return;

    if (!isSpeechRecognitionSupported()) {
      showToast('⚠️ Tu navegador no soporta dictado por voz (Web Speech API)', 'warning');
      return;
    }

    if (btn.classList.contains('listening')) {
      stopSpeechDictation();
      btn.classList.remove('listening');
      showToast('🛑 Dictado detenido');
      return;
    }

    // Detener cualquier otro botón que estuviese escuchando
    document.querySelectorAll('.btn-voice-dictate.listening').forEach((b) => {
      b.classList.remove('listening');
    });

    btn.classList.add('listening');
    showToast('🎙️ Escuchando... habla claramente', 'info');

    startSpeechDictation({
      targetInput,
      lang: 'es-ES',
      onStatusChange: (status, message) => {
        if (status === 'stopped' || status === 'error') {
          btn.classList.remove('listening');
          if (message) {
            showToast(status === 'error' ? `⚠️ ${message}` : message);
          }
        }
      }
    });
  });

  // Si se cierra algún modal, detener dictado activo
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (isDictating()) {
        stopSpeechDictation();
        document.querySelectorAll('.btn-voice-dictate.listening').forEach((b) => b.classList.remove('listening'));
      }
    });
  });
}

// --- SIMULADOR DE NOTAS ("¿QUÉ NOTA NECESITO?") ---
function initGradeSimulator() {
  const card = document.getElementById('grade-simulator-card');
  const btnToggle = document.getElementById('btn-toggle-grade-simulator');
  const btnClose = document.getElementById('btn-close-grade-simulator');
  const btnCalc = document.getElementById('btn-calc-simulator');
  const resultBox = document.getElementById('sim-result-box');

  btnToggle?.addEventListener('click', () => {
    if (!card) return;
    const isHidden = card.classList.contains('hidden');
    if (isHidden) {
      // Autocompletar con la media actual si existe
      const currentAvgEl = document.getElementById('stat-overall-average');
      const currentInput = document.getElementById('sim-current-grade');
      if (currentInput && currentAvgEl && currentAvgEl.textContent !== '--') {
        const val = parseFloat(currentAvgEl.textContent);
        if (!isNaN(val) && !currentInput.value) {
          currentInput.value = val.toFixed(1);
        }
      }
      card.classList.remove('hidden');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      card.classList.add('hidden');
    }
  });

  btnClose?.addEventListener('click', () => {
    card?.classList.add('hidden');
  });

  btnCalc?.addEventListener('click', () => {
    if (!resultBox) return;
    const currentVal = parseFloat(document.getElementById('sim-current-grade')?.value);
    const targetVal = parseFloat(document.getElementById('sim-target-grade')?.value);
    const weightVal = parseFloat(document.getElementById('sim-exam-weight')?.value);

    if (isNaN(currentVal) || isNaN(targetVal) || isNaN(weightVal)) {
      showToast('⚠️ Completa la nota actual, la deseada y el peso del examen', 'warning');
      return;
    }

    if (weightVal <= 0 || weightVal > 100) {
      showToast('⚠️ El peso del examen debe estar entre 1% y 100%', 'warning');
      return;
    }

    const w = weightVal / 100;
    // target = current * (1 - w) + required * w
    // required = (target - current * (1 - w)) / w
    const requiredGrade = (targetVal - currentVal * (1 - w)) / w;
    const rounded = Math.round(requiredGrade * 100) / 100;

    resultBox.className = 'sim-result-box';
    resultBox.classList.remove('hidden');

    if (rounded <= 0) {
      resultBox.classList.add('success');
      resultBox.innerHTML = `
        <strong>🎉 ¡Meta conseguida por adelantado!</strong><br>
        Con tu nota media actual de <strong>${currentVal.toFixed(1)}</strong>, ya alcanzas tu objetivo de <strong>${targetVal.toFixed(1)}</strong> aunque sacaras un <strong>0.00</strong> en este examen.
      `;
    } else if (rounded <= 10) {
      const cls = rounded <= 5 ? 'success' : rounded <= 7 ? 'warning' : 'danger';
      resultBox.classList.add(cls);
      resultBox.innerHTML = `
        <strong>🎯 Nota necesaria calculada:</strong><br>
        Necesitas sacar al menos un <strong style="font-size: 1.25rem;">${rounded.toFixed(2)}</strong> en el próximo examen (peso ${weightVal}%) para lograr una media final de <strong>${targetVal.toFixed(1)}</strong>.
      `;
    } else {
      resultBox.classList.add('danger');
      resultBox.innerHTML = `
        <strong>⚠️ Matemáticamente inalcanzable con este examen solo:</strong><br>
        Necesitarías sacar un <strong>${rounded.toFixed(2)}</strong> (superior a 10) para alcanzar una media de <strong>${targetVal.toFixed(1)}</strong> ponderando al ${weightVal}%. Te recomendamos ajustar tu objetivo o consultar trabajos voluntarios para sumar puntos.
      `;
    }
  });
}

// --- IMPRESIÓN LIMPIA Y DESCARGA A PDF ---
function initPrintActions() {
  document.getElementById('btn-print-schedule')?.addEventListener('click', () => {
    window.print();
  });

  document.getElementById('btn-print-grades')?.addEventListener('click', () => {
    window.print();
  });
}

// --- BUSCADOR GLOBAL INTELIGENTE (SPOTLIGHT / CTRL + K) ---
function initGlobalSearch() {
  const modal = document.getElementById('global-search-modal');
  const input = document.getElementById('global-search-input');
  const resultsContainer = document.getElementById('global-search-results');
  const btnOpenHeader = document.getElementById('btn-open-global-search');
  const btnOpenDrawer = document.getElementById('drawer-btn-search');

  function openSearch() {
    if (!modal || !input) return;
    modal.classList.remove('hidden');
    input.value = '';
    AppState.globalSearchActiveFilter = 'all';
    document.querySelectorAll('.search-tag').forEach((t) => {
      t.classList.toggle('active', t.getAttribute('data-search-filter') === 'all');
    });
    renderSearchResults('');
    setTimeout(() => input.focus(), 60);
  }

  function closeSearch() {
    modal?.classList.add('hidden');
  }

  btnOpenHeader?.addEventListener('click', openSearch);
  btnOpenDrawer?.addEventListener('click', () => {
    document.getElementById('app-drawer')?.classList.remove('open');
    document.getElementById('drawer-overlay')?.classList.remove('active');
    openSearch();
  });

  // Atajos de teclado globales (Ctrl + K, Cmd + K, / y navegación con flechas)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (modal?.classList.contains('hidden')) {
        openSearch();
      } else {
        closeSearch();
      }
      return;
    }

    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      openSearch();
      return;
    }

    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      closeSearch();
      return;
    }

    if (modal && !modal.classList.contains('hidden')) {
      const items = Array.from(resultsContainer?.querySelectorAll('.search-result-item') || []);
      if (items.length === 0) return;
      const currentIdx = items.findIndex((el) => el.classList.contains('selected'));

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = currentIdx < items.length - 1 ? currentIdx + 1 : 0;
        items.forEach((el) => el.classList.remove('selected'));
        items[nextIdx].classList.add('selected');
        items[nextIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : items.length - 1;
        items.forEach((el) => el.classList.remove('selected'));
        items[prevIdx].classList.add('selected');
        items[prevIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = items.find((el) => el.classList.contains('selected')) || items[0];
        if (selected) selected.click();
      }
    }
  });

  // Filtro por etiquetas de categoría
  document.querySelectorAll('.search-tag').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.search-tag').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.globalSearchActiveFilter = btn.getAttribute('data-search-filter') || 'all';
      renderSearchResults(input?.value || '');
    });
  });

  input?.addEventListener('input', (e) => {
    renderSearchResults(e.target.value);
  });

  function renderSearchResults(query) {
    if (!resultsContainer) return;
    const q = query.toLowerCase().trim();
    const filter = AppState.globalSearchActiveFilter || 'all';

    if (!q) {
      resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 25px 0;">
          <span style="font-size: 2.2rem;">🔍</span>
          <p class="section-subtitle" style="margin-top: 6px;">Escribe para buscar deberes, exámenes, apuntes, asignaturas, materiales o notas...</p>
        </div>
      `;
      return;
    }

    const matches = [];

    // 1. Tareas / Deberes
    if (filter === 'all' || filter === 'tasks') {
      AppState.tasks.forEach((t) => {
        const sub = AppState.subjects.find((s) => s.id === t.subjectId);
        const text = `${t.title} ${t.description || ''} ${sub?.name || ''}`.toLowerCase();
        if (text.includes(q)) {
          matches.push({
            type: 'tasks',
            typeLabel: '📋 Deberes',
            title: t.title,
            subtitle: `${sub?.icon || '📘'} ${sub?.name || 'General'} • Entrega: ${t.dueDate}`,
            badge: t.status === 'completed' ? '✅ Hecho' : '⏳ Pendiente',
            badgeColor: t.status === 'completed' ? 'var(--success)' : 'var(--warning)',
            action: () => {
              closeSearch();
              switchTab('tab-tasks');
              openTaskModal(t.id);
            }
          });
        }
      });
    }

    // 2. Exámenes
    if (filter === 'all' || filter === 'exams') {
      AppState.exams.forEach((e) => {
        const sub = AppState.subjects.find((s) => s.id === e.subjectId);
        const text = `${e.title} ${e.topics || ''} ${sub?.name || ''}`.toLowerCase();
        if (text.includes(q)) {
          matches.push({
            type: 'exams',
            typeLabel: '📝 Examen',
            title: e.title,
            subtitle: `${sub?.icon || '📘'} ${sub?.name || 'General'} • Fecha: ${e.date}`,
            badge: '📅 Examen',
            badgeColor: '#8b5cf6',
            action: () => {
              closeSearch();
              switchTab('tab-exams');
              openExamModal(e.id);
            }
          });
        }
      });
    }

    // 3. Proyectos Artísticos
    if (filter === 'all' || filter === 'projects') {
      AppState.projects.forEach((p) => {
        const sub = AppState.subjects.find((s) => s.id === p.subjectId);
        const text = `${p.title} ${p.technique || ''} ${p.description || ''} ${sub?.name || ''}`.toLowerCase();
        if (text.includes(q)) {
          matches.push({
            type: 'projects',
            typeLabel: '🎨 Proyecto',
            title: p.title,
            subtitle: `${sub?.icon || '🎨'} ${sub?.name || 'Arte'} • ${p.technique || 'Técnica libre'}`,
            badge: p.status || 'En Proceso',
            badgeColor: '#ec4899',
            action: () => {
              closeSearch();
              switchTab('tab-projects');
              openProjectModal(p.id);
            }
          });
        }
      });
    }

    // 4. Calificaciones / Notas
    if (filter === 'all' || filter === 'grades') {
      AppState.grades.forEach((g) => {
        const sub = AppState.subjects.find((s) => s.id === g.subjectId);
        const text = `${g.title} ${sub?.name || ''} Trimestre ${g.term}`.toLowerCase();
        if (text.includes(q)) {
          matches.push({
            type: 'grades',
            typeLabel: '📊 Nota',
            title: `${g.title} (${g.score})`,
            subtitle: `${sub?.icon || '📊'} ${sub?.name || 'General'} • ${g.term}º Trimestre`,
            badge: `Nota: ${parseFloat(g.score).toFixed(1)}`,
            badgeColor: parseFloat(g.score) >= 5 ? 'var(--success)' : 'var(--danger)',
            action: () => {
              closeSearch();
              switchTab('tab-grades');
            }
          });
        }
      });
    }

    // 5. Mochila y Materiales
    if (filter === 'all' || filter === 'materials') {
      AppState.materials.forEach((m) => {
        const sub = AppState.subjects.find((s) => s.id === m.subjectId);
        const text = `${m.name} ${sub?.name || ''}`.toLowerCase();
        if (text.includes(q)) {
          matches.push({
            type: 'materials',
            typeLabel: '🎒 Mochila',
            title: `${m.icon || '🎒'} ${m.name}`,
            subtitle: sub ? `Asociado a ${sub.name}` : 'Material general',
            badge: m.isPacked ? '✅ Guardado' : '⏳ Falta meter',
            badgeColor: m.isPacked ? 'var(--success)' : 'var(--warning)',
            action: () => {
              closeSearch();
              switchTab('tab-backpack');
            }
          });
        }
      });
    }

    // 6. Fotos de Pizarra y Apuntes (incluyendo texto OCR)
    if (filter === 'all' || filter === 'photos') {
      const checkedPhotos = new Set();
      const allP = [];
      AppState.tasks.forEach((t) => (t.photos || []).forEach((src) => allP.push({ src, title: t.title, sub: AppState.subjects.find((s) => s.id === t.subjectId) })));
      AppState.exams.forEach((e) => (e.photos || []).forEach((src) => allP.push({ src, title: `Examen: ${e.title}`, sub: AppState.subjects.find((s) => s.id === e.subjectId) })));
      AppState.projects.forEach((pr) => (pr.photos || []).forEach((src) => allP.push({ src, title: `Proyecto: ${pr.title}`, sub: AppState.subjects.find((s) => s.id === pr.subjectId) })));

      allP.forEach((photoObj) => {
        if (checkedPhotos.has(photoObj.src)) return;
        checkedPhotos.add(photoObj.src);

        const ocr = getCachedOcrText(photoObj.src) || '';
        const text = `${photoObj.title} ${photoObj.sub?.name || ''} ${ocr}`.toLowerCase();
        if (text.includes(q)) {
          matches.push({
            type: 'photos',
            typeLabel: '📸 Foto / OCR',
            title: photoObj.title,
            subtitle: ocr ? `Texto OCR: "${ocr.substring(0, 45)}..."` : `Foto de ${photoObj.sub?.name || 'clase'}`,
            badge: ocr ? '🔍 Texto OCR' : '📸 Foto',
            badgeColor: '#10b981',
            action: () => {
              closeSearch();
              openImageViewer(photoObj.src, photoObj.title);
            }
          });
        }
      });
    }

    if (matches.length === 0) {
      resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 25px 0;">
          <span style="font-size: 2rem;">❌</span>
          <p class="section-subtitle" style="margin-top: 6px;">No se encontraron resultados para "<strong>${escapeHTML(q)}</strong>".</p>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = matches
      .map((item, idx) => `
        <div class="search-result-item ${idx === 0 ? 'selected' : ''}" data-match-index="${idx}">
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">
              ${escapeHTML(item.title)}
            </div>
            <div class="search-result-meta">
              <span>${escapeHTML(item.typeLabel)}</span>
              <span>•</span>
              <span>${escapeHTML(item.subtitle)}</span>
            </div>
          </div>
          <span style="background: ${item.badgeColor}; color: #fff; font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: var(--radius-full); white-space: nowrap; margin-left: 8px;">
            ${escapeHTML(item.badge)}
          </span>
        </div>
      `)
      .join('');

    resultsContainer.querySelectorAll('.search-result-item').forEach((el, idx) => {
      el.addEventListener('click', () => {
        matches[idx].action();
      });
    });
  }
}

// --- RECONOCIMIENTO ÓPTICO DE CARACTERES (OCR CON TESSERACT.JS) ---
function initOcrModule() {
  const btnViewerOcr = document.getElementById('btn-viewer-ocr');
  const ocrModal = document.getElementById('ocr-result-modal');
  const ocrTextArea = document.getElementById('ocr-extracted-text');
  const ocrStatusText = document.getElementById('ocr-status-text');
  const ocrPercentageText = document.getElementById('ocr-percentage-text');
  const ocrProgressFill = document.getElementById('ocr-progress-fill');
  const ocrEffectiveBadge = document.getElementById('ocr-effective-badge');
  const ocrModeChips = document.querySelectorAll('#ocr-mode-chips .search-tag');
  const ocrLangSelect = document.getElementById('ocr-lang-select');
  const ocrPreviewImg = document.getElementById('ocr-preview-img');
  const btnClean = document.getElementById('btn-ocr-clean');
  const btnBullets = document.getElementById('btn-ocr-bullets');
  const btnCopy = document.getElementById('btn-ocr-copy');
  const btnToTask = document.getElementById('btn-ocr-to-task');
  const btnToExam = document.getElementById('btn-ocr-to-exam');
  const btnOcrGemini = document.getElementById('btn-ocr-gemini');
  const btnOcrConfigGemini = document.getElementById('btn-ocr-config-gemini');
  const geminiStatusIndicator = document.getElementById('gemini-status-indicator');

  let activeOcrSrc = null;
  let activeOcrMode = 'auto';

  const modeDescriptions = {
    auto: '🪄 Detección Inteligente',
    chalkboard: '🟢 Pizarra Tiza (Invertida)',
    whiteboard: '⚪ Pizarra Blanca (Alto Contraste)',
    document: '📄 Documento / Libro',
    raw: '📷 Foto Original',
    device_ai: '⚡ IA Local del Móvil (ML Kit)',
    gemini_ai: '✨ Google Gemini Flash'
  };

  async function processCurrentOcr(forceReload = false) {
    if (!activeOcrSrc || !ocrModal || !ocrTextArea) return;

    ocrTextArea.value = '';
    if (ocrStatusText) ocrStatusText.textContent = 'Aplicando filtros ópticos...';
    if (ocrPercentageText) ocrPercentageText.textContent = '0%';
    if (ocrProgressFill) ocrProgressFill.style.width = '0%';
    if (ocrEffectiveBadge) ocrEffectiveBadge.textContent = '';

    const lang = ocrLangSelect?.value || 'spa';

    try {
      const result = await recognizeImageText(activeOcrSrc, {
        mode: activeOcrMode,
        lang: lang,
        forceReload: forceReload,
        onProgress: (p) => {
          if (ocrStatusText) ocrStatusText.textContent = p.status;
          const pct = Math.round((p.progress || 0) * 100);
          if (ocrPercentageText) ocrPercentageText.textContent = `${pct}%`;
          if (ocrProgressFill) ocrProgressFill.style.width = `${pct}%`;
        }
      });

      ocrTextArea.value = result.text || '(No se detectó texto legible en la imagen)';
      if (ocrEffectiveBadge && result.effectiveMode) {
        ocrEffectiveBadge.textContent = `Modo: ${modeDescriptions[result.effectiveMode] || result.effectiveMode}`;
      }
      if (ocrPreviewImg && result.previewDataUrl) {
        ocrPreviewImg.src = result.previewDataUrl;
      }
      if (result.effectiveMode === 'device_ai') {
        showToast('⚡ ¡Texto extraído en 0.2s con la IA de tu móvil!', 'success');
      } else {
        showToast('✅ Texto extraído y optimizado', 'success');
      }
      renderGalleryView(); // Refrescar para mostrar el badge OCR en la galería
    } catch (err) {
      console.error('Error OCR:', err);
      if (ocrStatusText) ocrStatusText.textContent = 'Error al procesar';
      ocrTextArea.value = `Hubo un inconveniente al procesar la imagen: ${err.message}`;
      showToast('⚠️ No se pudo extraer el texto de la imagen', 'error');
    }
  }

  btnViewerOcr?.addEventListener('click', () => {
    const imgEl = document.getElementById('image-viewer-img');
    const src = imgEl?.src;
    if (!src) return;

    activeOcrSrc = src;
    activeOcrMode = 'auto';

    // Resetear chips
    ocrModeChips.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-ocr-mode') === 'auto');
    });

    ocrModal.classList.remove('hidden');
    processCurrentOcr(false);
  });

  // Selector de modo / superficie
  ocrModeChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      ocrModeChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      activeOcrMode = chip.getAttribute('data-ocr-mode') || 'auto';
      processCurrentOcr(true);
    });
  });

  // Selector de idioma
  ocrLangSelect?.addEventListener('change', () => {
    processCurrentOcr(true);
  });

  // Botón Limpiar Formato
  btnClean?.addEventListener('click', () => {
    if (!ocrTextArea?.value) return;
    ocrTextArea.value = cleanOcrText(ocrTextArea.value);
    showToast('🧹 Formato y párrafos limpiados', 'info');
  });

  // Botón Formato Lista / Deberes
  btnBullets?.addEventListener('click', () => {
    if (!ocrTextArea?.value) return;
    ocrTextArea.value = formatAsBulletList(ocrTextArea.value);
    showToast('📋 Convertido a lista de ejercicios', 'info');
  });

  // Botón Copiar
  btnCopy?.addEventListener('click', async () => {
    const text = ocrTextArea?.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast('📋 Texto copiado al portapapeles', 'success');
    } catch (e) {
      showToast('No se pudo copiar automáticamente');
    }
  });

  // Crear Fichas con IA a partir del texto OCR
  const btnOcrAiFlashcards = document.getElementById('btn-ocr-ai-flashcards');
  btnOcrAiFlashcards?.addEventListener('click', () => {
    const text = ocrTextArea?.value;
    if (!text || text.startsWith('Extrayendo texto') || text.startsWith('(No se detectó')) {
      showToast('⚠️ Espera a que termine el OCR o introduce texto válido', 'warning');
      return;
    }
    ocrModal?.classList.add('hidden');
    document.getElementById('image-viewer-modal')?.classList.add('hidden');
    if (window.openFlashcardsAiModal) {
      window.openFlashcardsAiModal(text);
    }
  });

  // Explicar con Copiloto IA a partir del texto OCR
  const btnOcrAiExplain = document.getElementById('btn-ocr-ai-explain');
  btnOcrAiExplain?.addEventListener('click', () => {
    const text = ocrTextArea?.value;
    if (!text || text.startsWith('Extrayendo texto') || text.startsWith('(No se detectó')) {
      showToast('⚠️ Espera a que termine el OCR o introduce texto válido', 'warning');
      return;
    }
    ocrModal?.classList.add('hidden');
    document.getElementById('image-viewer-modal')?.classList.add('hidden');
    if (window.openCopilotModal) {
      window.openCopilotModal(`Explícame de forma clara y didáctica estos apuntes de clase que acabo de fotografiar:\n\n${text}`);
    }
  });

  // Añadir a Deberes
  btnToTask?.addEventListener('click', () => {
    const text = ocrTextArea?.value;
    if (!text) return;
    ocrModal?.classList.add('hidden');
    document.getElementById('image-viewer-modal')?.classList.add('hidden');
    switchTab('tab-tasks');
    openTaskModal();
    setTimeout(() => {
      const descInput = document.getElementById('task-desc-input');
      if (descInput) {
        descInput.value = (descInput.value ? descInput.value + '\n\n' : '') + `[Apuntes extraídos por OCR]:\n${text}`;
      }
    }, 100);
  });

  // Añadir a Examen
  btnToExam?.addEventListener('click', () => {
    const text = ocrTextArea?.value;
    if (!text) return;
    ocrModal?.classList.add('hidden');
    document.getElementById('image-viewer-modal')?.classList.add('hidden');
    switchTab('tab-exams');
    openExamModal();
    setTimeout(() => {
      const topicsInput = document.getElementById('exam-topics-input');
      if (topicsInput) {
        topicsInput.value = (topicsInput.value ? topicsInput.value + '\n\n' : '') + `[Temario extraído por OCR]:\n${text}`;
      }
    }, 100);
  });

  // --- GESTIÓN DE CLAVE Y ANÁLISIS CON GOOGLE GEMINI ---
  async function getGeminiApiKey() {
    let key = localStorage.getItem('gemini_api_key');
    if (!key) {
      try {
        key = await getSetting('geminiApiKey');
      } catch (e) {}
    }
    return key || '';
  }

  async function saveGeminiApiKey(key) {
    if (key) {
      localStorage.setItem('gemini_api_key', key);
      try {
        await setSetting('geminiApiKey', key);
      } catch (e) {}
    } else {
      localStorage.removeItem('gemini_api_key');
      try {
        await setSetting('geminiApiKey', '');
      } catch (e) {}
    }
  }

  async function updateGeminiStatus() {
    const key = await getGeminiApiKey();
    if (geminiStatusIndicator) {
      if (key) {
        geminiStatusIndicator.textContent = '🟢 Clave IA lista';
        geminiStatusIndicator.style.color = 'var(--success, #10b981)';
      } else {
        geminiStatusIndicator.textContent = '⚪ Clave no guardada';
        geminiStatusIndicator.style.color = 'var(--text-muted)';
      }
    }
  }

  updateGeminiStatus();

  // Configurar Clave de Gemini
  btnOcrConfigGemini?.addEventListener('click', async () => {
    const currentKey = await getGeminiApiKey();
    const promptMsg = 'Introduce tu API Key gratuita de Google Gemini.\n\n(Puedes crearla gratis en: https://aistudio.google.com/):';
    const newKey = window.prompt(promptMsg, currentKey || '');
    if (newKey !== null) {
      const trimmed = newKey.trim();
      await saveGeminiApiKey(trimmed);
      await updateGeminiStatus();
      if (trimmed) {
        showToast('🔑 Clave de Gemini guardada correctamente', 'success');
      } else {
        showToast('Clave de Gemini eliminada', 'info');
      }
    }
  });

  // Procesar con Gemini
  btnOcrGemini?.addEventListener('click', async () => {
    if (!activeOcrSrc) {
      showToast('⚠️ No hay ninguna imagen seleccionada para analizar', 'warning');
      return;
    }

    let apiKey = await getGeminiApiKey();
    if (!apiKey) {
      const inputKey = window.prompt(
        'Para transcribir y estructurar los deberes con IA, introduce tu API Key gratuita de Google Gemini (consíguela en https://aistudio.google.com/):'
      );
      if (!inputKey || !inputKey.trim()) {
        showToast('Se requiere la clave API de Gemini para usar la IA en la nube', 'info');
        return;
      }
      apiKey = inputKey.trim();
      await saveGeminiApiKey(apiKey);
      await updateGeminiStatus();
    }

    ocrTextArea.value = '';
    if (ocrStatusText) ocrStatusText.textContent = '✨ Analizando imagen con Google Gemini Flash...';
    if (ocrPercentageText) ocrPercentageText.textContent = 'IA...';
    if (ocrProgressFill) ocrProgressFill.style.width = '60%';
    if (ocrEffectiveBadge) ocrEffectiveBadge.textContent = 'Modo: ✨ Google Gemini Flash';

    try {
      const geminiResult = await recognizeWithGemini(activeOcrSrc, apiKey);
      ocrTextArea.value = geminiResult.text;
      if (ocrStatusText) ocrStatusText.textContent = '¡Completado con Google Gemini!';
      if (ocrPercentageText) ocrPercentageText.textContent = '100%';
      if (ocrProgressFill) ocrProgressFill.style.width = '100%';
      showToast('✨ Apuntes procesados y deberes detectados con Gemini', 'success');
      renderGalleryView();
    } catch (err) {
      console.error('Error con Gemini:', err);
      if (ocrStatusText) ocrStatusText.textContent = 'Error en Gemini';
      ocrTextArea.value = `Error con la IA de Gemini: ${err.message}\n\nPuedes revisar tu clave o usar el OCR local offline.`;
      showToast(`⚠️ Error con Gemini: ${err.message}`, 'error');
    }
  });
}

// --- BÚSQUEDA EN LA GALERÍA DE FOTOS ---
function initGallerySearch() {
  const input = document.getElementById('gallery-search-input');
  input?.addEventListener('input', (e) => {
    AppState.gallerySearchQuery = e.target.value || '';
    renderGalleryView();
  });
}

// --- TEMPORIZADOR POMODORO (CONCENTRACIÓN OFFLINE) ---
function initPomodoro() {
  document.getElementById('pomo-mode-work')?.addEventListener('click', () => setPomodoroMode('work', 25));
  document.getElementById('pomo-mode-short')?.addEventListener('click', () => setPomodoroMode('short', 5));
  document.getElementById('pomo-mode-long')?.addEventListener('click', () => setPomodoroMode('long', 15));

  document.getElementById('btn-pomo-start')?.addEventListener('click', startPomodoro);
  document.getElementById('btn-pomo-pause')?.addEventListener('click', pausePomodoro);
  document.getElementById('btn-pomo-reset')?.addEventListener('click', resetPomodoro);
}

function setPomodoroMode(mode, minutes) {
  pausePomodoro();
  AppState.pomodoro.mode = mode;
  AppState.pomodoro.totalTime = minutes * 60;
  AppState.pomodoro.timeLeft = minutes * 60;

  document.querySelectorAll('[data-pomo-time]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-pomo-time') === String(minutes));
  });

  renderPomodoroView();
}

function startPomodoro() {
  if (AppState.pomodoro.isRunning) return;
  AppState.pomodoro.isRunning = true;
  renderPomodoroView();

  AppState.pomodoro.timerId = setInterval(() => {
    if (AppState.pomodoro.timeLeft > 0) {
      AppState.pomodoro.timeLeft--;
      renderPomodoroView();
    } else {
      pausePomodoro();
      if (AppState.pomodoro.mode === 'work') {
        playPomodoroBell();
        AppState.pomodoro.countToday++;
        AppState.pomodoro.totalFocusMinutes += Math.round(AppState.pomodoro.totalTime / 60);
        savePomodoroStats();
        showToast('🔔 ¡Sesión de estudio completada! Tómate un descanso ☕', 'success');
        recordStudyActivity('pomodoro_completed').then(({ newlyUnlocked }) => {
          getGamificationStats().then(updateGamificationUI);
          if (newlyUnlocked && newlyUnlocked.length > 0) {
            newlyUnlocked.forEach(a => showToast(`🏆 ¡Logro Desbloqueado!: ${a.title}`, 'success'));
          }
        });
        setPomodoroMode('short', 5);
      } else {
        playBreakBell();
        showToast('🔔 ¡Descanso terminado! ¿Listo para continuar? 🚀', 'info');
        setPomodoroMode('work', 25);
      }
    }
  }, 1000);
}

function pausePomodoro() {
  if (AppState.pomodoro.timerId) {
    clearInterval(AppState.pomodoro.timerId);
    AppState.pomodoro.timerId = null;
  }
  AppState.pomodoro.isRunning = false;
  renderPomodoroView();
}

function resetPomodoro() {
  pausePomodoro();
  AppState.pomodoro.timeLeft = AppState.pomodoro.totalTime;
  renderPomodoroView();
}

async function savePomodoroStats() {
  await setSetting('pomodoroStats', {
    date: getTodayDateString(),
    countToday: AppState.pomodoro.countToday,
    totalFocusMinutes: AppState.pomodoro.totalFocusMinutes
  });
}

// --- MOCHILA Y MATERIALES ---
window.openMaterialModal = function () {
  const modal = document.getElementById('material-modal');
  const subSelect = document.getElementById('material-subject-select');
  populateSubjectSelect(subSelect, true);
  document.getElementById('material-id').value = '';
  document.getElementById('material-name-input').value = '';
  document.getElementById('material-icon-input').value = '✏️';
  modal?.classList.remove('hidden');
};

async function handleMaterialFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('material-id').value || `mat_${Date.now()}`;
  const name = document.getElementById('material-name-input').value.trim();
  const subjectId = document.getElementById('material-subject-select').value;
  const icon = document.getElementById('material-icon-input').value.trim() || '✏️';

  const material = { id, name, subjectId, icon, isPacked: false };
  await saveItem('materials', material);
  await loadAllData();
  renderAllViews();
  document.getElementById('material-modal')?.classList.add('hidden');
  showToast('🎒 Material añadido a la mochila', 'success');
}

window.toggleMaterialPacked = async function (matId) {
  const mat = AppState.materials.find((m) => m.id === matId);
  if (mat) {
    mat.isPacked = !mat.isPacked;
    await saveItem('materials', mat);
    await loadAllData();
    renderBackpackView();
  }
};

window.confirmDeleteMaterial = async function (matId) {
  const mat = AppState.materials.find((m) => m.id === matId);
  if (!mat) return;
  if (confirm('¿Mover este material a la papelera?')) {
    await moveToTrash('materials', mat, mat.name || 'Material');
    await loadAllData();
    renderBackpackView();
    showToast('🗑️ Material movido a la papelera');
  }
};

async function handleResetBackpack() {
  if (confirm('¿Desmarcar todos los materiales para volver a preparar la mochila?')) {
    for (const m of AppState.materials) {
      m.isPacked = false;
      await saveItem('materials', m);
    }
    await loadAllData();
    renderBackpackView();
    showToast('🔄 Mochila reseteada para un nuevo día');
  }
}

// --- PORTAFOLIO DE PROYECTOS ARTÍSTICOS ---
window.openProjectModal = function (projectId = null) {
  const modal = document.getElementById('project-modal');
  const titleEl = document.getElementById('project-modal-title');
  const idInput = document.getElementById('project-id');
  const titleInput = document.getElementById('project-title-input');
  const subSelect = document.getElementById('project-subject-select');
  const statusSelect = document.getElementById('project-status-select');
  const techInput = document.getElementById('project-technique-input');
  const dueInput = document.getElementById('project-due-date');
  const descInput = document.getElementById('project-desc-input');
  const audioPreview = document.getElementById('project-audio-preview');
  const audioPlayer = document.getElementById('project-audio-player');

  populateSubjectSelect(subSelect);

  if (projectId) {
    const project = AppState.projects.find((p) => p.id === projectId);
    if (project) {
      if (titleEl) titleEl.textContent = 'Editar Proyecto Artístico';
      if (idInput) idInput.value = project.id;
      if (titleInput) titleInput.value = project.title;
      if (subSelect) subSelect.value = project.subjectId;
      if (statusSelect) statusSelect.value = project.status || 'proceso';
      if (techInput) techInput.value = project.technique || '';
      if (dueInput) dueInput.value = project.dueDate || '';
      if (descInput) descInput.value = project.description || '';
      AppState.tempProjectPhotos = [...(project.photos || [])];
      AppState.tempProjectAudio = project.audioUrl || null;
      if (AppState.tempProjectAudio && audioPreview && audioPlayer) {
        audioPlayer.src = AppState.tempProjectAudio;
        audioPreview.classList.remove('hidden');
      } else if (audioPreview) {
        audioPreview.classList.add('hidden');
        if (audioPlayer) audioPlayer.src = '';
      }
    }
  } else {
    if (titleEl) titleEl.textContent = 'Nuevo Proyecto Artístico';
    if (idInput) idInput.value = '';
    if (titleInput) titleInput.value = '';
    if (statusSelect) statusSelect.value = 'proceso';
    if (techInput) techInput.value = '';
    if (dueInput) dueInput.value = '';
    if (descInput) descInput.value = '';
    AppState.tempProjectPhotos = [];
    AppState.tempProjectAudio = null;
    if (audioPreview) audioPreview.classList.add('hidden');
    if (audioPlayer) audioPlayer.src = '';
  }

  renderPhotosPreview('project-photos-preview', AppState.tempProjectPhotos);
  modal?.classList.remove('hidden');
};

async function handleProjectFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('project-id').value || `proj_${Date.now()}`;
  const title = document.getElementById('project-title-input').value.trim();
  const subjectId = document.getElementById('project-subject-select').value;
  const status = document.getElementById('project-status-select').value;
  const technique = document.getElementById('project-technique-input').value.trim();
  const dueDate = document.getElementById('project-due-date').value;
  const description = document.getElementById('project-desc-input').value.trim();

  const project = {
    id,
    title,
    subjectId,
    status,
    technique,
    dueDate,
    description,
    photos: [...AppState.tempProjectPhotos],
    audioUrl: AppState.tempProjectAudio || null,
    updatedAt: new Date().toISOString()
  };

  await saveItem('projects', project);
  await loadAllData();
  renderAllViews();
  document.getElementById('project-modal')?.classList.add('hidden');
  showToast('🎨 Proyecto guardado en el portafolio', 'success');
}

window.confirmDeleteProject = async function (projectId) {
  const project = AppState.projects.find((p) => p.id === projectId);
  if (!project) return;
  if (confirm('¿Mover este proyecto y sus fotos a la papelera?')) {
    await moveToTrash('projects', project, project.title || 'Proyecto');
    await loadAllData();
    renderAllViews();
    showToast('🗑️ Proyecto movido a la papelera');
  }
};

// ==========================================================================
// HELPERS Y UTILIDADES
// ==========================================================================

function populateSubjectSelect(selectEl, includeEmpty = false) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  if (includeEmpty) {
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '-- Sin Asignatura --';
    selectEl.appendChild(emptyOpt);
  }

  AppState.subjects.forEach((sub) => {
    const opt = document.createElement('option');
    opt.value = sub.id;
    opt.textContent = `${sub.icon || '📖'} ${sub.name}`;
    selectEl.appendChild(opt);
  });
}

function renderPhotosPreview(containerId, photosArray) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (photosArray.length === 0) {
    container.innerHTML = '<p class="section-subtitle" style="font-size: 0.75rem;">Sin fotos adjuntas todavía</p>';
    return;
  }

  container.innerHTML = photosArray
    .map(
      (photo, idx) => `
    <div style="position: relative; display: inline-block;">
      <img src="${photo}" class="photo-thumb" onclick="window.openImageViewer('${photo}')" />
      <button type="button" style="position: absolute; top: -6px; right: -6px; background: var(--danger); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 11px; cursor: pointer;" onclick="window.removeTempPhoto('${containerId}', ${idx})">&times;</button>
    </div>
  `
    )
    .join('');
}

window.removeTempPhoto = function (containerId, index) {
  if (containerId === 'task-photos-preview') {
    AppState.tempTaskPhotos.splice(index, 1);
    renderPhotosPreview(containerId, AppState.tempTaskPhotos);
  } else if (containerId === 'exam-photos-preview') {
    AppState.tempExamPhotos.splice(index, 1);
    renderPhotosPreview(containerId, AppState.tempExamPhotos);
  } else if (containerId === 'project-photos-preview') {
    AppState.tempProjectPhotos.splice(index, 1);
    renderPhotosPreview(containerId, AppState.tempProjectPhotos);
  }
};

window.openImageViewer = openImageViewer;

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
    } catch (e) {
      // Ignorar restricciones de contexto o permisos
    }
  }
}
window.triggerHaptic = triggerHaptic;

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  if (type === 'success') triggerHaptic('success');
  else if (type === 'error') triggerHaptic('error');

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span> ${message}`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTomorrowDateString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysDifference(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return 0;
  const [y1, m1, d1] = dateStr1.split('-').map(Number);
  const [y2, m2, d2] = dateStr2.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

function formatDateSpanish(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

// ==========================================================================
// 1. MÓDULO: GAMIFICACIÓN, RACHAS Y LOGROS
// ==========================================================================

async function initGamification() {
  const { stats, newlyUnlocked } = await recordStudyActivity('app_opened');
  updateGamificationUI(stats);
  if (newlyUnlocked && newlyUnlocked.length > 0) {
    for (const ach of newlyUnlocked) {
      showToast(`🏆 ¡Logro Desbloqueado!: ${ach.title}`, 'success');
    }
  }

  const btnStreak = document.getElementById('btn-open-streak');
  const drawerBtnStreak = document.getElementById('drawer-btn-streak');
  const modal = document.getElementById('achievements-modal');

  const openAchievements = async () => {
    const currentStats = await getGamificationStats();
    updateGamificationUI(currentStats);
    renderAchievementsList(currentStats);
    modal?.classList.remove('hidden');
    window.closeDrawer?.();
  };

  btnStreak?.addEventListener('click', openAchievements);
  drawerBtnStreak?.addEventListener('click', openAchievements);
}

function updateGamificationUI(stats) {
  const headerDays = document.getElementById('header-streak-days');
  const drawerText = document.getElementById('drawer-streak-text');
  const modalStreakDays = document.getElementById('modal-streak-days');
  const statBestStreak = document.getElementById('stat-best-streak');
  const statTasksDone = document.getElementById('stat-tasks-done');
  const statPomoSessions = document.getElementById('stat-pomo-sessions');

  const days = stats.currentStreak || 1;
  if (headerDays) headerDays.textContent = days;
  if (drawerText) drawerText.textContent = `${days} ${days === 1 ? 'día' : 'días'}`;
  if (modalStreakDays) modalStreakDays.textContent = `${days} ${days === 1 ? 'Día' : 'Días'} en Racha`;
  if (statBestStreak) statBestStreak.textContent = stats.bestStreak || 1;
  if (statTasksDone) statTasksDone.textContent = stats.completedTasksCount || 0;
  if (statPomoSessions) statPomoSessions.textContent = stats.pomodoroSessionsCount || 0;
}

function renderAchievementsList(stats) {
  const container = document.getElementById('achievements-container');
  if (!container) return;

  const unlockedSet = new Set(stats.unlockedAchievements || []);
  container.innerHTML = ACHIEVEMENTS.map(ach => {
    const isUnlocked = unlockedSet.has(ach.id);
    return `
      <div class="achievement-card ${isUnlocked ? 'unlocked' : ''}">
        <div class="achievement-icon-box">${ach.icon}</div>
        <div class="achievement-info">
          <h4>${escapeHTML(ach.title)} ${isUnlocked ? '✅' : '🔒'}</h4>
          <p>${escapeHTML(ach.desc)}</p>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================================================
// 2. MÓDULO: PAPELERA DE RECICLAJE (30 DÍAS)
// ==========================================================================

function updateTrashCounters() {
  const count = (AppState.trash || []).length;
  const badge1 = document.getElementById('settings-trash-count');
  const badge2 = document.getElementById('drawer-badge-trash');
  if (badge1) badge1.textContent = count;
  if (badge2) {
    badge2.textContent = count;
    badge2.classList.toggle('hidden', count === 0);
  }
}

function initTrashModule() {
  const btnSettings = document.getElementById('btn-open-trash-settings');
  const btnDrawer = document.getElementById('drawer-btn-trash');
  const btnEmpty = document.getElementById('btn-empty-trash');
  const modal = document.getElementById('trash-modal');

  const openTrash = async () => {
    AppState.trash = await getTrashItems();
    updateTrashCounters();
    renderTrashItems();
    modal?.classList.remove('hidden');
    window.closeDrawer?.();
  };

  btnSettings?.addEventListener('click', openTrash);
  btnDrawer?.addEventListener('click', openTrash);

  btnEmpty?.addEventListener('click', async () => {
    if ((AppState.trash || []).length === 0) return;
    if (confirm('¿Vaciar toda la papelera de reciclaje? Esta acción eliminará permanentemente todos los elementos.')) {
      await emptyTrash();
      AppState.trash = [];
      updateTrashCounters();
      renderTrashItems();
      showToast('🗑️ Papelera vaciada');
    }
  });
}

function renderTrashItems() {
  const container = document.getElementById('trash-items-container');
  if (!container) return;

  if (!AppState.trash || AppState.trash.length === 0) {
    container.innerHTML = '<p class="section-subtitle">La papelera está vacía. ¡Todo al día!</p>';
    return;
  }

  container.innerHTML = AppState.trash.map(item => {
    const typeBadgeClass = `trash-badge-${item.originalStore === 'tasks' ? 'task' : item.originalStore === 'exams' ? 'exam' : item.originalStore === 'projects' ? 'project' : 'grade'}`;
    const typeLabel = item.originalStore === 'tasks' ? 'Tarea' : item.originalStore === 'exams' ? 'Examen' : item.originalStore === 'projects' ? 'Proyecto' : item.originalStore === 'materials' ? 'Material' : 'Nota';
    const dateStr = new Date(item.deletedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });

    return `
      <div class="trash-item-card" id="trash-card-${item.id}">
        <div class="trash-item-info">
          <div class="trash-item-title">${escapeHTML(item.label)}</div>
          <div class="trash-item-meta">
            <span class="trash-type-badge ${typeBadgeClass}">${typeLabel}</span>
            <span>Borrado: ${dateStr}</span>
          </div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="btn-action-small" onclick="window.handleRestoreTrash('${item.id}')" title="Restaurar elemento">
            🔄 Restaurar
          </button>
          <button class="btn-action-small" style="color: var(--danger); border-color: rgba(239,68,68,0.3);" onclick="window.handlePermanentDeleteTrash('${item.id}')" title="Eliminar definitivamente">
            ✕
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.handleRestoreTrash = async function(trashId) {
  const restored = await restoreFromTrash(trashId);
  if (restored) {
    await loadAllData();
    renderAllViews();
    renderTrashItems();
    showToast('✅ Elemento restaurado con éxito', 'success');
  }
};

window.handlePermanentDeleteTrash = async function(trashId) {
  if (confirm('¿Eliminar permanentemente este elemento?')) {
    await deletePermanentlyFromTrash(trashId);
    AppState.trash = await getTrashItems();
    updateTrashCounters();
    renderTrashItems();
    showToast('🗑️ Eliminado permanentemente');
  }
};

// ==========================================================================
// 3. MÓDULO: RECURSOS Y ENLACES POR ASIGNATURA
// ==========================================================================

function initSubjectResourcesModule() {
  const btnSettings = document.getElementById('btn-open-resources-settings');
  const btnDrawer = document.getElementById('drawer-btn-resources');
  const modal = document.getElementById('subject-resources-modal');
  const selectSubject = document.getElementById('resources-subject-select');
  const formAdd = document.getElementById('form-add-resource');

  const openResourcesModal = (subId = null) => {
    populateSubjectSelect(selectSubject);
    if (subId && selectSubject) {
      selectSubject.value = subId;
    }
    renderSubjectResourcesList();
    modal?.classList.remove('hidden');
    window.closeDrawer?.();
  };

  btnSettings?.addEventListener('click', () => openResourcesModal());
  btnDrawer?.addEventListener('click', () => openResourcesModal());
  selectSubject?.addEventListener('change', () => renderSubjectResourcesList());

  formAdd?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subId = selectSubject.value;
    if (!subId) {
      showToast('Por favor selecciona una asignatura', 'error');
      return;
    }

    const sub = AppState.subjects.find(s => s.id === subId);
    if (!sub) return;

    const titleInput = document.getElementById('resource-title');
    const typeSelect = document.getElementById('resource-type');
    const urlInput = document.getElementById('resource-url');

    const newResource = {
      id: `res_${Date.now()}`,
      title: titleInput.value.trim(),
      type: typeSelect.value,
      url: urlInput.value.trim()
    };

    if (!sub.resources) sub.resources = [];
    sub.resources.push(newResource);
    await saveItem('subjects', sub);
    await loadAllData();

    titleInput.value = '';
    urlInput.value = '';
    renderSubjectResourcesList();
    showToast(`🔗 Enlace guardado para ${sub.name}`, 'success');
  });

  window.openSubjectResourcesModal = openResourcesModal;
}

function renderSubjectResourcesList() {
  const selectSubject = document.getElementById('resources-subject-select');
  const container = document.getElementById('subject-resources-container');
  if (!selectSubject || !container) return;

  const subId = selectSubject.value;
  const sub = AppState.subjects.find(s => s.id === subId);
  const resources = sub?.resources || [];

  if (resources.length === 0) {
    container.innerHTML = '<p class="section-subtitle">No hay enlaces o recursos guardados para esta materia.</p>';
    return;
  }

  const iconMap = {
    classroom: '🏫',
    drive: '📁',
    moodle: '🎓',
    youtube: '📺',
    web: '🌐'
  };

  container.innerHTML = resources.map(res => {
    const icon = iconMap[res.type] || '🔗';
    return `
      <div class="resource-link-item">
        <a href="${escapeHTML(res.url)}" target="_blank" rel="noopener noreferrer" class="resource-link-btn" title="Abrir en nueva pestaña">
          <span>${icon}</span>
          <span>${escapeHTML(res.title)}</span>
          <span style="font-size: 0.72rem; opacity: 0.7;">↗</span>
        </a>
        <button class="btn-action-small" style="color: var(--danger); border-color: rgba(239,68,68,0.25);" onclick="window.handleDeleteResource('${sub.id}', '${res.id}')" title="Eliminar recurso">
          ✕
        </button>
      </div>
    `;
  }).join('');
}

window.handleDeleteResource = async function(subId, resId) {
  const sub = AppState.subjects.find(s => s.id === subId);
  if (!sub || !sub.resources) return;
  sub.resources = sub.resources.filter(r => r.id !== resId);
  await saveItem('subjects', sub);
  await loadAllData();
  renderSubjectResourcesList();
  showToast('Enlace eliminado');
};

// ==========================================================================
// 4. MÓDULO: NOTIFICACIONES PUSH LOCALES
// ==========================================================================

async function initNotificationsModule() {
  const toggleBtn = document.getElementById('btn-toggle-notifications');
  const testBtn = document.getElementById('btn-test-notification');
  const permBadge = document.getElementById('notification-perm-badge');
  const statusText = document.getElementById('notification-status-text');

  const updateUI = () => {
    const perm = getNotificationPermission();
    if (permBadge) {
      if (perm === 'granted') {
        permBadge.textContent = 'Permiso: Concedido ✅';
        permBadge.style.color = 'var(--success)';
        if (statusText) statusText.textContent = 'Notificaciones Activas';
      } else if (perm === 'denied') {
        permBadge.textContent = 'Permiso: Denegado ❌';
        permBadge.style.color = 'var(--danger)';
        if (statusText) statusText.textContent = 'Permiso Denegado';
      } else {
        permBadge.textContent = 'Permiso: No solicitado';
        permBadge.style.color = 'var(--text-muted)';
        if (statusText) statusText.textContent = 'Activar Notificaciones';
      }
    }
  };

  updateUI();

  toggleBtn?.addEventListener('click', async () => {
    try {
      const perm = await requestNotificationPermission();
      updateUI();
      if (perm === 'granted') {
        showToast('🔔 ¡Notificaciones y recordatorios activados!', 'success');
        checkDueReminders(AppState.tasks, AppState.exams, AppState.subjects);
      } else {
        showToast('Permiso de notificaciones no concedido', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  testBtn?.addEventListener('click', async () => {
    try {
      await sendTestNotification();
      showToast('🔔 Notificación de prueba enviada', 'success');
    } catch (err) {
      showToast('Error al enviar prueba: ' + err.message, 'error');
    }
  });

  // Comprobar avisos al inicio y cuando la pestaña vuelve a ser visible
  checkDueReminders(AppState.tasks, AppState.exams, AppState.subjects);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkDueReminders(AppState.tasks, AppState.exams, AppState.subjects);
    }
  });
}

// ==========================================================================
// 5. MÓDULO: EXPORTACIÓN A CALENDARIOS NATIVOS (.ICS)
// ==========================================================================

function initIcsExportModule() {
  const btnScheduleICS = document.getElementById('btn-export-schedule-ics');
  const btnExamsICS = document.getElementById('btn-export-exams-ics');

  btnScheduleICS?.addEventListener('click', () => {
    try {
      const ics = generateScheduleICS(AppState.schedule, AppState.subjects, AppState.timeSlots);
      downloadICS(ics, 'Horario_Escolar_Agenda.ics');
      showToast('📅 Horario exportado a calendario (.ics)', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al exportar horario: ' + err.message, 'error');
    }
  });

  btnExamsICS?.addEventListener('click', () => {
    try {
      if ((AppState.exams || []).length === 0) {
        showToast('No hay exámenes registrados para exportar', 'info');
        return;
      }
      const ics = generateExamsICS(AppState.exams, AppState.subjects);
      downloadICS(ics, 'Examenes_Agenda_Escolar.ics');
      showToast('📅 Exámenes exportados a calendario (.ics) con alarmas', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al exportar exámenes: ' + err.message, 'error');
    }
  });

  window.handleExportSingleExamICS = function(examId) {
    const exam = AppState.exams.find(e => e.id === examId);
    if (!exam) return;
    const sub = AppState.subjects.find(s => s.id === exam.subjectId);
    exportSingleExam(exam, sub);
    showToast('📅 Examen exportado a calendario (.ics)', 'success');
  };
}

// ==========================================================================
// 6. MÓDULO: GENERADOR Y EXPORTADOR A PDF OFFLINE
// ==========================================================================

function initPdfExportModule() {
  const btnSchedulePDF = document.getElementById('btn-export-schedule-pdf');
  const btnGradesPDF = document.getElementById('btn-export-grades-pdf');

  btnSchedulePDF?.addEventListener('click', async () => {
    try {
      showToast('📄 Generando PDF del horario semanal...', 'info');
      await exportSchedulePDF(AppState.schedule, AppState.subjects, AppState.timeSlots, AppState.studentInfo);
      showToast('✅ Horario en PDF descargado', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error generando PDF: ' + err.message, 'error');
    }
  });

  btnGradesPDF?.addEventListener('click', async () => {
    try {
      showToast('📄 Generando Boletín Oficial en PDF...', 'info');
      await exportGradesReportPDF(AppState.grades, AppState.subjects, AppState.studentInfo);
      showToast('✅ Boletín en PDF descargado', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error generando PDF: ' + err.message, 'error');
    }
  });

  window.handleExportProjectPDF = async function(projectId) {
    const proj = AppState.projects.find(p => p.id === projectId);
    if (!proj) return;
    const sub = AppState.subjects.find(s => s.id === proj.subjectId);
    try {
      showToast('📄 Generando Dossier de Proyecto en PDF...', 'info');
      await exportProjectDossierPDF(proj, sub);
      showToast('✅ Dossier PDF descargado', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al generar PDF: ' + err.message, 'error');
    }
  };
}

// ==========================================================================
// 7. MÓDULO: COPIAS DE SEGURIDAD EN GOOGLE DRIVE (INDEPENDIENTE)
// ==========================================================================

function initGoogleDriveModule() {
  const btnOpenModal = document.getElementById('btn-open-gdrive-modal');
  const btnDrawerDrive = document.getElementById('drawer-btn-gdrive');
  const btnQuickUpload = document.getElementById('btn-gdrive-quick-upload');
  const modal = document.getElementById('google-drive-modal');
  const btnDisconnect = document.getElementById('btn-gdrive-disconnect');
  const statusBadge = document.getElementById('gdrive-status-badge');
  const accountCard = document.getElementById('gdrive-account-card');
  const userAvatar = document.getElementById('gdrive-user-avatar');
  const userNameEl = document.getElementById('gdrive-user-name');
  const userEmailEl = document.getElementById('gdrive-user-email');

  // Elementos dentro del modal
  const modalAvatar = document.getElementById('modal-gdrive-avatar');
  const modalFallback = document.getElementById('modal-gdrive-icon-fallback');
  const modalName = document.getElementById('modal-gdrive-name');
  const modalEmail = document.getElementById('modal-gdrive-email');
  const btnModalAuth = document.getElementById('btn-modal-gdrive-auth');
  const clientIdInput = document.getElementById('gdrive-client-id-input');
  const btnSaveClientId = document.getElementById('btn-save-gdrive-client-id');
  const btnUploadNow = document.getElementById('btn-gdrive-upload-now');
  const btnRefreshList = document.getElementById('btn-gdrive-refresh-list');
  const backupsList = document.getElementById('gdrive-backups-list');

  const updateDriveUI = (user, isLiveToken = false) => {
    if (user) {
      if (statusBadge) {
        statusBadge.textContent = isLiveToken ? 'Conectado ✅' : 'Vinculado (Token renovable)';
        statusBadge.style.background = isLiveToken ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)';
        statusBadge.style.color = isLiveToken ? 'var(--success)' : '#f59e0b';
      }
      if (accountCard) accountCard.classList.remove('hidden');
      if (userAvatar) {
        if (user.picture) {
          userAvatar.src = user.picture;
          userAvatar.style.display = 'block';
        } else {
          userAvatar.style.display = 'none';
        }
      }
      if (userNameEl) userNameEl.textContent = user.name || 'Usuario Google';
      if (userEmailEl) userEmailEl.textContent = user.email || '';

      if (modalAvatar) {
        if (user.picture) {
          modalAvatar.src = user.picture;
          modalAvatar.style.display = 'block';
          if (modalFallback) modalFallback.style.display = 'none';
        } else {
          modalAvatar.style.display = 'none';
          if (modalFallback) modalFallback.style.display = 'block';
        }
      }
      if (modalName) modalName.textContent = user.name || 'Usuario Google';
      if (modalEmail) modalEmail.textContent = user.email || '';
      if (btnModalAuth) btnModalAuth.textContent = isLiveToken ? '🚪 Cerrar Sesión' : '🔑 Reconectar Google';
    } else {
      if (statusBadge) {
        statusBadge.textContent = 'No conectado';
        statusBadge.style.background = 'rgba(59, 130, 246, 0.12)';
        statusBadge.style.color = 'var(--primary)';
      }
      if (accountCard) accountCard.classList.add('hidden');
      if (modalAvatar) modalAvatar.style.display = 'none';
      if (modalFallback) modalFallback.style.display = 'block';
      if (modalName) modalName.textContent = 'No conectado';
      if (modalEmail) modalEmail.textContent = 'Pulsa conectar para vincular tu Drive';
      if (btnModalAuth) btnModalAuth.textContent = '🔑 Conectar Google';
      if (backupsList) {
        backupsList.innerHTML = '<p class="section-subtitle" style="text-align: center; padding: 12px 0;">Conecta tu cuenta para ver tus copias en Google Drive.</p>';
      }
    }
  };

  // Cargar Client ID y usuario guardado previamente
  getGoogleClientId().then((cid) => {
    if (clientIdInput && cid) clientIdInput.value = cid;
  });

  getSavedGoogleUser().then((user) => {
    if (user) {
      updateDriveUI(user, isGoogleDriveConnected());
    }
  });

  const openDriveModal = async () => {
    modal?.classList.remove('hidden');
    window.closeDrawer?.();
    const user = await getSavedGoogleUser();
    updateDriveUI(user, isGoogleDriveConnected());
    if (isGoogleDriveConnected()) {
      fetchAndRenderBackups();
    }
  };

  btnOpenModal?.addEventListener('click', openDriveModal);
  btnDrawerDrive?.addEventListener('click', openDriveModal);

  btnSaveClientId?.addEventListener('click', async () => {
    const val = clientIdInput?.value.trim();
    if (!val) {
      showToast('Por favor introduce un Client ID válido', 'error');
      return;
    }
    await setGoogleClientId(val);
    showToast('⚙️ Google Client ID guardado con éxito', 'success');
  });

  btnModalAuth?.addEventListener('click', async () => {
    if (isGoogleDriveConnected()) {
      await disconnectGoogleDrive();
      updateDriveUI(null);
      showToast('Sesión de Google Drive cerrada');
    } else {
      try {
        showToast('Abriendo inicio de sesión de Google...', 'info');
        const { user } = await connectGoogleDrive((token, u) => {
          updateDriveUI(u, true);
        });
        showToast(`✅ Conectado a Google Drive como ${user?.name || user?.email}`, 'success');
        fetchAndRenderBackups();
      } catch (err) {
        console.error(err);
        showToast(err.message, 'error');
      }
    }
  });

  btnDisconnect?.addEventListener('click', async () => {
    await disconnectGoogleDrive();
    updateDriveUI(null);
    showToast('Sesión de Google Drive cerrada');
  });

  const performDriveUpload = async () => {
    if (!isGoogleDriveConnected()) {
      showToast('Primero conecta tu cuenta de Google para subir a Drive', 'info');
      openDriveModal();
      return;
    }
    try {
      showToast('⬆️ Subiendo copia de seguridad a tu Google Drive...', 'info');
      const backupData = await exportBackup();
      await uploadBackupToGoogleDrive(backupData);
      showToast('✅ Copia guardada en la carpeta "🎒 Agenda Escolar" de tu Google Drive', 'success');
      fetchAndRenderBackups();
    } catch (err) {
      console.error(err);
      showToast('Error al subir a Google Drive: ' + err.message, 'error');
    }
  };

  btnQuickUpload?.addEventListener('click', performDriveUpload);
  btnUploadNow?.addEventListener('click', performDriveUpload);

  const fetchAndRenderBackups = async () => {
    if (!isGoogleDriveConnected()) {
      if (backupsList) {
        backupsList.innerHTML = '<p class="section-subtitle" style="text-align: center; padding: 12px 0;">Debes conectar tu cuenta de Google para consultar tus copias.</p>';
      }
      return;
    }

    if (backupsList) {
      backupsList.innerHTML = '<p class="section-subtitle" style="text-align: center; padding: 12px 0;">Consultando copias en Google Drive...</p>';
    }

    try {
      const files = await listBackupsFromGoogleDrive();
      if (!files || files.length === 0) {
        if (backupsList) {
          backupsList.innerHTML = '<p class="section-subtitle" style="text-align: center; padding: 12px 0;">No se encontraron copias de seguridad anteriores en tu Google Drive.</p>';
        }
        return;
      }

      backupsList.innerHTML = files.map((f) => {
        const dateStr = f.createdTime ? new Date(f.createdTime).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'Fecha desconocida';
        const sizeKb = f.size ? Math.round(Number(f.size) / 1024) + ' KB' : 'N/A';
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: var(--bg-input); border-radius: var(--radius-sm); margin-bottom: 6px; border: 1px solid var(--border-color);">
            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px;">
              <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-main);">📄 ${escapeHTML(f.name)}</div>
              <div style="font-size: 0.74rem; color: var(--text-muted);">${dateStr} &bull; ${sizeKb}</div>
            </div>
            <div style="display: flex; gap: 6px; flex-shrink: 0;">
              <button type="button" class="btn-action-small" onclick="window.handleRestoreFromGoogleDrive('${f.id}')" title="Restaurar esta copia de seguridad">
                🔄 Restaurar
              </button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      if (backupsList) {
        backupsList.innerHTML = `<p class="section-subtitle" style="text-align: center; padding: 12px 0; color: var(--danger);">Error al listar copias: ${escapeHTML(err.message)}</p>`;
      }
    }
  };

  btnRefreshList?.addEventListener('click', fetchAndRenderBackups);

  window.handleRestoreFromGoogleDrive = async function (fileId) {
    if (!confirm('¿Deseas restaurar esta copia de seguridad de Google Drive en tu agenda escolar? Los datos locales se actualizarán.')) {
      return;
    }
    try {
      showToast('⬇️ Descargando copia desde Google Drive...', 'info');
      const jsonContent = await downloadBackupFromGoogleDrive(fileId);
      await importBackup(jsonContent);
      await loadAllData();
      renderAllViews();
      showToast('✅ ¡Agenda escolar restaurada con éxito desde Google Drive!', 'success');
      modal?.classList.add('hidden');
    } catch (err) {
      console.error(err);
      showToast('Error al restaurar desde Google Drive: ' + err.message, 'error');
    }
  };
}

// ==========================================================================
// 8. MÓDULO: BASE DE DATOS EN LA NUBE CON FIREBASE / FIRESTORE
// ==========================================================================

function initFirebaseSyncModule() {
  const btnOpenConfig = document.getElementById('btn-open-firebase-config');
  const btnDrawerCloud = document.getElementById('drawer-btn-cloud');
  const btnSyncNow = document.getElementById('btn-firebase-sync-now');
  const modal = document.getElementById('firebase-modal');
  const formConfig = document.getElementById('firebase-config-form');
  const jsonInput = document.getElementById('firebase-config-json');
  const btnLoginGoogle = document.getElementById('btn-firebase-login-google');
  const btnLoginAnon = document.getElementById('btn-firebase-login-anon');
  const btnUpload = document.getElementById('btn-sync-cloud-upload');
  const btnDownload = document.getElementById('btn-sync-cloud-download');
  const userIndicator = document.getElementById('firebase-user-indicator');
  const userNameEl = document.getElementById('firebase-user-name');
  const userEmailEl = document.getElementById('firebase-user-email');
  const statusBadge = document.getElementById('firebase-status-badge');

  const openFirebaseModal = async () => {
    const savedConfig = await getSetting('firebaseConfig');
    if (savedConfig && jsonInput) {
      jsonInput.value = typeof savedConfig === 'string' ? savedConfig : JSON.stringify(savedConfig, null, 2);
    }
    modal?.classList.remove('hidden');
    window.closeDrawer?.();
  };

  btnOpenConfig?.addEventListener('click', openFirebaseModal);
  btnDrawerCloud?.addEventListener('click', openFirebaseModal);

  const updateFirebaseUI = (user) => {
    if (user) {
      const name = user.isAnonymous ? 'Usuario Anónimo' : (user.displayName || user.email || 'Conectado');
      const email = user.isAnonymous ? 'Sesión Temporal Anónima' : (user.email || 'Cuenta vinculada');
      if (userIndicator) userIndicator.textContent = `Firestore: ${name}`;
      if (userNameEl) userNameEl.textContent = name;
      if (userEmailEl) userEmailEl.textContent = email;
      if (btnLoginGoogle) btnLoginGoogle.textContent = '🚪 Cerrar Sesión';
      if (statusBadge) {
        statusBadge.textContent = 'Online ✅';
        statusBadge.style.background = 'rgba(34, 197, 94, 0.15)';
        statusBadge.style.color = 'var(--success)';
      }
    } else {
      if (userIndicator) userIndicator.textContent = 'Modo 100% Offline Local';
      if (userNameEl) userNameEl.textContent = 'No conectado';
      if (userEmailEl) userEmailEl.textContent = 'Sin cuenta asociada';
      if (btnLoginGoogle) btnLoginGoogle.textContent = '🔑 Iniciar con Google';
      if (statusBadge) {
        statusBadge.textContent = 'Offline';
        statusBadge.style.background = 'rgba(245, 158, 11, 0.12)';
        statusBadge.style.color = '#f59e0b';
      }
    }
  };

  // Inicializar Firebase si ya hay configuración
  getSetting('firebaseConfig').then(async (config) => {
    if (config) {
      try {
        const parsed = typeof config === 'string' ? JSON.parse(config) : config;
        await initFirebase(parsed, (user) => {
          updateFirebaseUI(user);
        });
      } catch (e) {
        console.warn('Configuración de Firebase no válida:', e);
      }
    }
  });

  formConfig?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = jsonInput.value.trim();
    if (!raw) {
      showToast('Pega la configuración de tu proyecto Firebase', 'error');
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      await setSetting('firebaseConfig', parsed);
      await initFirebase(parsed, (user) => updateFirebaseUI(user));
      showToast('⚙️ Configuración de Firebase guardada', 'success');
    } catch (err) {
      showToast('JSON de configuración no válido: ' + err.message, 'error');
    }
  });

  btnLoginGoogle?.addEventListener('click', async () => {
    const user = getCurrentUser();
    if (user) {
      await logoutFirebase();
      updateFirebaseUI(null);
      showToast('Sesión de Firebase cerrada', 'info');
    } else {
      try {
        showToast('Iniciando sesión en Firebase...', 'info');
        const loggedUser = await loginWithGoogle();
        updateFirebaseUI(loggedUser);
        showToast(`¡Bienvenido/a a Firestore, ${loggedUser.displayName || loggedUser.email}!`, 'success');
      } catch (err) {
        showToast('Error de inicio de sesión: ' + err.message, 'error');
      }
    }
  });

  btnLoginAnon?.addEventListener('click', async () => {
    try {
      showToast('Iniciando sesión anónima en Firebase...', 'info');
      const anonUser = await loginAnonymously();
      updateFirebaseUI(anonUser);
      showToast('Sesión anónima iniciada en Firestore', 'success');
    } catch (err) {
      showToast('Error al iniciar anónimo: ' + err.message, 'error');
    }
  });

  const performCloudUpload = async () => {
    try {
      showToast('🔥 Sincronizando con Cloud Firestore...', 'info');
      const backupData = JSON.parse(await exportBackup());
      await uploadToCloud(backupData);
      showToast('✅ Datos sincronizados en Cloud Firestore con éxito', 'success');
    } catch (err) {
      showToast('Error al subir a Firestore: ' + err.message, 'error');
    }
  };

  const performCloudDownload = async () => {
    try {
      showToast('🔥 Descargando datos de Cloud Firestore...', 'info');
      const cloudData = await downloadFromCloud();
      if (!cloudData) {
        showToast('No se encontraron datos en tu casillero de Firestore', 'info');
        return;
      }
      if (confirm('¿Restaurar los datos de Firestore en este dispositivo? Se actualizará tu agenda escolar.')) {
        await importBackup(JSON.stringify(cloudData));
        await loadAllData();
        renderAllViews();
        showToast('✅ Agenda actualizada desde Cloud Firestore con éxito', 'success');
      }
    } catch (err) {
      showToast('Error al descargar de Firestore: ' + err.message, 'error');
    }
  };

  btnUpload?.addEventListener('click', performCloudUpload);
  btnSyncNow?.addEventListener('click', performCloudUpload);
  btnDownload?.addEventListener('click', performCloudDownload);
}

// ==========================================================================
// 9. MÓDULO: FICHAS DE ESTUDIO Y REPASO ESPACIADO (LEITNER)
// ==========================================================================

function renderFlashcardsView() {
  const cards = AppState.flashcards || [];
  const todayStr = getTodayDateString();

  // 1. Estadísticas globales
  const stats = calculateFlashcardStats(cards, todayStr);
  const elDue = document.getElementById('stat-flashcards-due');
  const elTotal = document.getElementById('stat-flashcards-total');
  const elMastered = document.getElementById('stat-flashcards-mastered');
  const elRate = document.getElementById('stat-flashcards-rate');

  if (elDue) elDue.textContent = stats.dueToday;
  if (elTotal) elTotal.textContent = stats.total;
  if (elMastered) elMastered.textContent = stats.mastered;
  if (elRate) elRate.textContent = `${stats.masteryRate}%`;

  // 2. Filtros por Materia
  renderFlashcardSubjectChips();

  // 3. Renderizar según el modo seleccionado (Estudio vs Gestión)
  const studyView = document.getElementById('flashcards-study-view');
  const manageView = document.getElementById('flashcards-manage-view');
  const btnStudy = document.getElementById('btn-flashcards-mode-study');
  const btnManage = document.getElementById('btn-flashcards-mode-manage');

  if (AppState.flashcardsMode === 'study') {
    studyView?.classList.remove('hidden');
    manageView?.classList.add('hidden');
    if (btnStudy) {
      btnStudy.className = 'btn-primary';
    }
    if (btnManage) {
      btnManage.className = 'btn-secondary';
    }
    renderStudySession();
  } else {
    studyView?.classList.add('hidden');
    manageView?.classList.remove('hidden');
    if (btnStudy) {
      btnStudy.className = 'btn-secondary';
    }
    if (btnManage) {
      btnManage.className = 'btn-primary';
    }
    renderManageGrid();
  }
}

function renderFlashcardSubjectChips() {
  const container = document.getElementById('flashcards-subject-chips');
  if (!container) return;

  const subjects = AppState.subjects || [];
  let html = `
    <button type="button" class="filter-chip ${AppState.flashcardsSubjectFilter === 'all' ? 'active' : ''}" data-fc-subject="all">
      📚 Todas las Materias
    </button>
  `;

  subjects.forEach((sub) => {
    const isActive = AppState.flashcardsSubjectFilter === sub.id;
    html += `
      <button type="button" class="filter-chip ${isActive ? 'active' : ''}" data-fc-subject="${sub.id}">
        <span>${sub.icon || '📖'}</span> ${escapeHTML(sub.name)}
      </button>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('[data-fc-subject]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const subId = btn.getAttribute('data-fc-subject');
      AppState.flashcardsSubjectFilter = subId;
      AppState.studySessionCards = [];
      AppState.currentStudyCardIndex = 0;
      renderFlashcardsView();
    });
  });
}

function renderStudySession() {
  const todayStr = getTodayDateString();

  // Cargar lote si está vacío
  if (!AppState.studySessionCards || AppState.studySessionCards.length === 0) {
    AppState.studySessionCards = getDueFlashcards(
      AppState.flashcards || [],
      todayStr,
      AppState.flashcardsSubjectFilter
    );
    AppState.currentStudyCardIndex = 0;
  }

  const studyHeader = document.getElementById('flashcard-study-header');
  const scene = document.querySelector('.flashcard-scene');
  const ratingBar = document.getElementById('flashcard-rating-controls');
  const completeCard = document.getElementById('flashcard-session-complete');
  const emptyDueCard = document.getElementById('flashcard-empty-due');

  // Caso 1: No hay fichas pendientes para hoy
  if (AppState.studySessionCards.length === 0) {
    studyHeader?.classList.add('hidden');
    scene?.classList.add('hidden');
    ratingBar?.classList.add('hidden');
    completeCard?.classList.add('hidden');
    emptyDueCard?.classList.remove('hidden');
    return;
  }

  // Caso 2: Se completó la sesión actual
  if (AppState.currentStudyCardIndex >= AppState.studySessionCards.length) {
    studyHeader?.classList.add('hidden');
    scene?.classList.add('hidden');
    ratingBar?.classList.add('hidden');
    emptyDueCard?.classList.add('hidden');
    completeCard?.classList.remove('hidden');
    return;
  }

  // Caso 3: Ficha activa para estudiar
  studyHeader?.classList.remove('hidden');
  scene?.classList.remove('hidden');
  ratingBar?.classList.remove('hidden');
  emptyDueCard?.classList.add('hidden');
  completeCard?.classList.add('hidden');

  const card = AppState.studySessionCards[AppState.currentStudyCardIndex];
  const sub = AppState.subjects.find((s) => s.id === card.subjectId);

  // Barra de progreso
  const progressText = document.getElementById('flashcard-session-progress-text');
  const progressFill = document.getElementById('flashcard-session-progress-fill');
  const currentNum = AppState.currentStudyCardIndex + 1;
  const totalNum = AppState.studySessionCards.length;
  if (progressText) progressText.textContent = `Ficha ${currentNum} de ${totalNum}`;
  if (progressFill) progressFill.style.width = `${Math.round((currentNum / totalNum) * 100)}%`;

  // Anverso (Pregunta)
  const subPill = document.getElementById('study-card-subject');
  const boxPips = document.getElementById('study-card-box-pips');
  const qFront = document.getElementById('study-card-front');
  const hintBox = document.getElementById('study-card-hint-box');
  const hintText = document.getElementById('study-card-hint-text');
  const btnHint = document.getElementById('btn-toggle-study-hint');

  if (subPill) {
    subPill.innerHTML = `<span>${sub?.icon || '📖'}</span> ${escapeHTML(sub?.name || 'Materia')}`;
    subPill.style.background = sub?.color ? `${sub.color}22` : 'rgba(59, 130, 246, 0.15)';
    subPill.style.color = sub?.color || 'var(--primary)';
  }

  // Pips Leitner (Cajas 1 a 5)
  if (boxPips) {
    const boxNum = card.box || 1;
    let pipsHtml = '';
    for (let i = 1; i <= 5; i++) {
      pipsHtml += `<span class="box-pip ${i <= boxNum ? 'active' : ''}" title="Nivel ${i} de 5"></span>`;
    }
    boxPips.innerHTML = pipsHtml;
  }

  if (qFront) qFront.textContent = card.front;

  if (card.hint) {
    if (btnHint) btnHint.classList.remove('hidden');
    if (hintText) hintText.textContent = card.hint;
    if (hintBox) hintBox.classList.add('hidden');
  } else {
    if (btnHint) btnHint.classList.add('hidden');
    if (hintBox) hintBox.classList.add('hidden');
  }

  // Reverso (Respuesta)
  const qBack = document.getElementById('study-card-back');
  const boxName = document.getElementById('study-card-box-name');
  if (qBack) qBack.textContent = card.back;
  if (boxName) {
    const b = card.box || 1;
    boxName.textContent = `Caja ${b}: ${BOX_NAMES[b] || 'Aprendiendo'}`;
  }

  // Textos dinámicos en los botones de calificación
  const ratingGoodSub = document.getElementById('rating-good-sub');
  const ratingEasySub = document.getElementById('rating-easy-sub');
  const currentBox = card.box || 1;

  if (ratingGoodSub) {
    const nextGoodBox = currentBox === 1 ? 2 : currentBox;
    ratingGoodSub.textContent = `Caja ${nextGoodBox} &bull; En ${LEITNER_INTERVALS[nextGoodBox]}d`;
  }
  if (ratingEasySub) {
    const nextEasyBox = Math.min(currentBox + 1, 5);
    ratingEasySub.textContent = `Caja ${nextEasyBox} &bull; En ${LEITNER_INTERVALS[nextEasyBox]}d`;
  }

  // Resetear estado volteado
  AppState.isStudyCardFlipped = false;
  document.getElementById('active-study-card')?.classList.remove('is-flipped');
}

function renderManageGrid() {
  const container = document.getElementById('flashcards-manage-grid');
  if (!container) return;

  const cards = AppState.flashcards || [];
  const filtered = cards.filter((c) => {
    const matchSub = AppState.flashcardsSubjectFilter === 'all' || c.subjectId === AppState.flashcardsSubjectFilter;
    const matchBox = AppState.flashcardsBoxFilter === 'all' || (c.box || 1) === Number(AppState.flashcardsBoxFilter);
    return matchSub && matchBox;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 30px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <div style="font-size: 2.2rem; margin-bottom: 8px;">📭</div>
        <h4 style="margin: 0 0 6px 0; font-size: 1.05rem; color: var(--text-main);">No hay fichas con estos filtros</h4>
        <p class="section-subtitle" style="margin-bottom: 12px;">Crea tu primera ficha de estudio o cambia la materia seleccionada.</p>
        <button type="button" class="btn-primary" onclick="window.openNewFlashcardModal()" style="width: auto; margin: 0 auto;">
          ➕ Añadir Nueva Ficha
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map((c) => {
    const sub = AppState.subjects.find((s) => s.id === c.subjectId);
    const boxNum = c.box || 1;
    let pipsHtml = '';
    for (let i = 1; i <= 5; i++) {
      pipsHtml += `<span class="box-pip ${i <= boxNum ? 'active' : ''}"></span>`;
    }
    const nextDate = c.nextReviewDate ? formatDateSpanish(c.nextReviewDate) : 'Hoy';

    return `
      <div class="flashcard-item-card" id="card-${c.id}">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span class="flashcard-subject-pill" style="background: ${sub?.color ? `${sub.color}22` : 'rgba(59,130,246,0.15)'}; color: ${sub?.color || 'var(--primary)'};">
              ${sub?.icon || '📖'} ${escapeHTML(sub?.name || 'Materia')}
            </span>
            <div class="flashcard-box-indicator" title="Caja Leitner ${boxNum} de 5">
              ${pipsHtml}
            </div>
          </div>
          <div class="flashcard-item-front">${escapeHTML(c.front)}</div>
          <div class="flashcard-item-back">${escapeHTML(c.back)}</div>
        </div>
        <div class="flashcard-item-footer">
          <span>📅 Repaso: ${nextDate}</span>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn-action-small" onclick="window.handleEditFlashcard('${c.id}')" title="Editar ficha">
              ✏️
            </button>
            <button type="button" class="btn-action-small danger" onclick="window.handleDeleteFlashcard('${c.id}')" title="Eliminar ficha">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function initFlashcardsModule() {
  const cardElement = document.getElementById('active-study-card');
  const btnFlipBack = document.getElementById('btn-flip-back');
  const btnRateHard = document.getElementById('btn-rate-hard');
  const btnRateGood = document.getElementById('btn-rate-good');
  const btnRateEasy = document.getElementById('btn-rate-easy');
  const btnToggleHint = document.getElementById('btn-toggle-study-hint');
  const hintBox = document.getElementById('study-card-hint-box');

  const btnModeStudy = document.getElementById('btn-flashcards-mode-study');
  const btnModeManage = document.getElementById('btn-flashcards-mode-manage');
  const btnNewCard = document.getElementById('btn-open-new-flashcard');
  const btnQuickNewCard = document.getElementById('btn-quick-new-card-manage');
  const btnEmptyAddCard = document.getElementById('btn-empty-add-card');
  const btnRestart = document.getElementById('btn-session-restart');
  const btnStudyAllAnyway = document.getElementById('btn-study-all-anyway');
  const btnSessionManage = document.getElementById('btn-session-manage');
  const selectBoxFilter = document.getElementById('flashcard-filter-box');

  const modal = document.getElementById('flashcard-modal');
  const form = document.getElementById('flashcard-form');
  const subSelect = document.getElementById('flashcard-subject-select');
  const frontInput = document.getElementById('flashcard-front-input');
  const backInput = document.getElementById('flashcard-back-input');
  const hintInput = document.getElementById('flashcard-hint-input');
  const idInput = document.getElementById('flashcard-id');
  const modalTitle = document.getElementById('flashcard-modal-title');

  // 1. Alternar vistas
  btnModeStudy?.addEventListener('click', () => {
    AppState.flashcardsMode = 'study';
    renderFlashcardsView();
  });

  btnModeManage?.addEventListener('click', () => {
    AppState.flashcardsMode = 'manage';
    renderFlashcardsView();
  });

  btnSessionManage?.addEventListener('click', () => {
    AppState.flashcardsMode = 'manage';
    renderFlashcardsView();
  });

  selectBoxFilter?.addEventListener('change', (e) => {
    AppState.flashcardsBoxFilter = e.target.value;
    renderManageGrid();
  });

  // 2. Flip de la Tarjeta Interactiva
  const toggleFlip = () => {
    triggerHaptic('light');
    AppState.isStudyCardFlipped = !AppState.isStudyCardFlipped;
    cardElement?.classList.toggle('is-flipped', AppState.isStudyCardFlipped);
  };

  cardElement?.addEventListener('click', (e) => {
    // Si hizo clic en un botón interno (como Ver Pista), no hacer flip
    if (e.target.closest('button')) return;
    toggleFlip();
  });

  btnFlipBack?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFlip();
  });

  btnToggleHint?.addEventListener('click', (e) => {
    e.stopPropagation();
    hintBox?.classList.toggle('hidden');
  });

  // 3. Calificación de Respuestas con Leitner
  const handleRating = async (rating) => {
    triggerHaptic(rating === 'easy' ? 'success' : 'medium');
    if (!AppState.studySessionCards || AppState.studySessionCards.length === 0) return;
    const card = AppState.studySessionCards[AppState.currentStudyCardIndex];
    if (!card) return;

    // Calcular nueva caja e intervalo
    const updated = processCardReview(card, rating);

    // Guardar en base de datos
    await saveItem('flashcards', updated);

    // Actualizar en memoria
    const idx = (AppState.flashcards || []).findIndex((c) => c.id === card.id);
    if (idx !== -1) {
      AppState.flashcards[idx] = updated;
    }

    // Registrar actividad para la racha y logros
    try {
      const { newlyUnlocked } = await recordStudyActivity('flashcards_reviewed');
      if (newlyUnlocked && newlyUnlocked.length > 0) {
        for (const ach of newlyUnlocked) {
          showToast(`🏆 ¡Logro Desbloqueado!: ${ach.title}`, 'success');
        }
      }
    } catch (e) {
      console.warn('Error registrando actividad de racha:', e);
    }

    // Feedback especial si la ficha sube a Caja 5 (Dominada)
    if (updated.box === 5 && (card.box || 1) < 5) {
      showToast('🌟 ¡Ficha dominada! Has alcanzado la Caja 5 (Repaso mensual)', 'success');
    }

    // Avanzar a la siguiente ficha
    AppState.currentStudyCardIndex++;
    updateBadges();
    renderStudySession();
  };

  btnRateHard?.addEventListener('click', () => handleRating('hard'));
  btnRateGood?.addEventListener('click', () => handleRating('good'));
  btnRateEasy?.addEventListener('click', () => handleRating('easy'));

  // 4. Reiniciar sesión / Repasar todo
  const startAllCardsSession = () => {
    const all = (AppState.flashcards || []).filter(
      (c) => AppState.flashcardsSubjectFilter === 'all' || c.subjectId === AppState.flashcardsSubjectFilter
    );
    if (all.length === 0) {
      showToast('No hay fichas creadas en esta materia para repasar', 'info');
      return;
    }
    AppState.studySessionCards = [...all];
    AppState.currentStudyCardIndex = 0;
    renderStudySession();
    showToast(`🎯 Repasando todas las ${all.length} fichas`, 'info');
  };

  btnRestart?.addEventListener('click', startAllCardsSession);
  btnStudyAllAnyway?.addEventListener('click', startAllCardsSession);

  // 5. Modal Nueva / Editar Ficha
  const openModal = (card = null) => {
    populateSubjectSelect(subSelect);
    if (card) {
      if (modalTitle) modalTitle.textContent = 'Editar Ficha de Estudio';
      if (idInput) idInput.value = card.id;
      if (subSelect) subSelect.value = card.subjectId;
      if (frontInput) frontInput.value = card.front;
      if (backInput) backInput.value = card.back;
      if (hintInput) hintInput.value = card.hint || '';
    } else {
      if (modalTitle) modalTitle.textContent = 'Nueva Ficha de Estudio';
      if (idInput) idInput.value = '';
      if (subSelect && AppState.flashcardsSubjectFilter !== 'all') {
        subSelect.value = AppState.flashcardsSubjectFilter;
      }
      if (frontInput) frontInput.value = '';
      if (backInput) backInput.value = '';
      if (hintInput) hintInput.value = '';
    }
    modal?.classList.remove('hidden');
    frontInput?.focus();
  };

  window.openNewFlashcardModal = () => openModal();
  btnNewCard?.addEventListener('click', () => openModal());
  btnQuickNewCard?.addEventListener('click', () => openModal());
  btnEmptyAddCard?.addEventListener('click', () => openModal());

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = idInput?.value;
    const subjectId = subSelect?.value;
    const front = frontInput?.value.trim();
    const back = backInput?.value.trim();
    const hint = hintInput?.value.trim();

    if (!subjectId || !front || !back) {
      showToast('Por favor completa los campos obligatorios', 'error');
      return;
    }

    if (id) {
      // Editar existente
      const existing = (AppState.flashcards || []).find((c) => c.id === id);
      if (existing) {
        existing.subjectId = subjectId;
        existing.front = front;
        existing.back = back;
        existing.hint = hint;
        await saveItem('flashcards', existing);
        showToast('✅ Ficha de estudio actualizada', 'success');
      }
    } else {
      // Crear nueva
      const newCard = createFlashcard({ subjectId, front, back, hint });
      await saveItem('flashcards', newCard);
      showToast('🧠 Ficha de estudio guardada', 'success');
    }

    AppState.flashcards = await getAll('flashcards');
    AppState.studySessionCards = [];
    AppState.currentStudyCardIndex = 0;
    renderFlashcardsView();
    updateBadges();
    modal?.classList.add('hidden');
  });

  window.handleEditFlashcard = (id) => {
    const card = (AppState.flashcards || []).find((c) => c.id === id);
    if (card) openModal(card);
  };

  window.handleDeleteFlashcard = async (id) => {
    if (confirm('¿Eliminar esta ficha de estudio?')) {
      await deleteItem('flashcards', id);
      AppState.flashcards = await getAll('flashcards');
      AppState.studySessionCards = [];
      AppState.currentStudyCardIndex = 0;
      renderFlashcardsView();
      updateBadges();
      showToast('🗑️ Ficha eliminada');
    }
  };

  // 6. Botón en Visor OCR: Crear Ficha a partir del texto extraído
  const btnOcrToFlashcard = document.getElementById('btn-ocr-to-flashcard');
  btnOcrToFlashcard?.addEventListener('click', () => {
    const ocrText = document.getElementById('ocr-extracted-text')?.value.trim() || '';
    const ocrModal = document.getElementById('ocr-result-modal');
    ocrModal?.classList.add('hidden');

    openModal();
    if (backInput) {
      backInput.value = ocrText;
    }
    if (frontInput) {
      frontInput.placeholder = 'Escribe el concepto o pregunta sobre el texto extraído...';
      frontInput.focus();
    }
    showToast('📝 Texto OCR añadido al reverso de la ficha', 'info');
  });

  // 7. Atajos de Teclado Ergonómicos (Espacio para flip, 1/2/3 para calificar)
  document.addEventListener('keydown', (e) => {
    const isFlashcardsTab = AppState.activeTab === 'tab-flashcards';
    const isStudy = AppState.flashcardsMode === 'study';
    const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
    const noModalOpen = document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0;

    if (!isFlashcardsTab || !isStudy || isTyping || !noModalOpen) return;

    if (e.code === 'Space') {
      e.preventDefault();
      toggleFlip();
    } else if (e.key === '1') {
      handleRating('hard');
    } else if (e.key === '2') {
      handleRating('good');
    } else if (e.key === '3') {
      handleRating('easy');
    }
  });
}

// ==========================================================================
// MÓDULO DE COPILOTO ESCOLAR IA (CHAT, ACCIONES, BÚSQUEDA Y FLASHCARDS)
// ==========================================================================
function initAIAssistantModule() {
  // 1. Registrar callbacks para que la IA interactúe con el resto de la aplicación
  registerAppCallbacks({
    getAppState: () => AppState,
    onTaskCreated: (task) => {
      renderTasksView();
      updateBadges();
      triggerHaptic('success');
    },
    onExamCreated: (exam) => {
      renderExamsView();
      updateBadges();
      triggerHaptic('success');
    },
    onFlashcardsCreated: (cards) => {
      renderFlashcardsView();
      updateBadges();
      triggerHaptic('success');
    },
    onPomodoroStarted: (minutes, mode) => {
      switchTab('tab-pomodoro');
      setPomodoroMode(mode, minutes);
      startPomodoro();
      triggerHaptic('success');
    },
    onTabNavigate: (tabId) => {
      switchTab(tabId);
    },
    onToast: (msg, type) => showToast(msg, type)
  });

  // 2. Elementos del DOM del Copiloto
  const copilotModal = document.getElementById('ai-copilot-modal');
  const btnOpenCopilotHeader = document.getElementById('btn-open-copilot');
  const drawerBtnCopilot = document.getElementById('drawer-btn-copilot');
  const fabAiCopilot = document.getElementById('fab-ai-copilot');
  const btnAiCopilotFloating = document.getElementById('btn-ai-copilot-floating');
  const copilotMessages = document.getElementById('copilot-messages');
  const copilotForm = document.getElementById('copilot-form');
  const copilotInputText = document.getElementById('copilot-input-text');
  const btnCopilotVoice = document.getElementById('btn-copilot-voice');
  const btnCopilotAttach = document.getElementById('btn-copilot-attach');
  const copilotFileInput = document.getElementById('copilot-file-input');
  const btnSpeechToggle = document.getElementById('btn-copilot-speech-toggle');
  const btnConfigKey = document.getElementById('btn-copilot-config-key');
  const btnClearChat = document.getElementById('btn-copilot-clear');
  const attachmentPreview = document.getElementById('copilot-attachment-preview');
  const attachmentImg = document.getElementById('copilot-attachment-img');
  const btnRemoveAttachment = document.getElementById('btn-copilot-remove-attachment');
  const copilotStatusSubtext = document.getElementById('copilot-status-subtext');

  // Estado del Asistente
  let isSpeechEnabled = false; // Por defecto apagado para no asustar al usuario, activable con 1 toque
  let activeAttachedBase64 = null;
  let isSending = false;
  let isVoiceDictating = false;

  // Actualizar subtítulo según si hay clave IA
  async function updateStatusBadge() {
    const key = await getAIApiKey();
    if (copilotStatusSubtext) {
      if (key) {
        copilotStatusSubtext.textContent = '✨ Gemini Flash listo • Conectado a tu agenda';
      } else {
        copilotStatusSubtext.textContent = '⚡ Modo Local Offline • Pulsa ⚙️ para clave IA';
      }
    }
  }
  updateStatusBadge();

  // Abrir Copiloto
  function openCopilotModal(initialPrompt = null, attachedImage = null) {
    copilotModal?.classList.remove('hidden');
    updateStatusBadge();
    if (attachedImage) {
      setAttachedImage(attachedImage);
    }
    if (initialPrompt) {
      if (copilotInputText) copilotInputText.value = initialPrompt;
      sendMessage();
    } else {
      setTimeout(() => copilotInputText?.focus(), 150);
    }
  }

  window.openCopilotModal = openCopilotModal;

  btnOpenCopilotHeader?.addEventListener('click', () => openCopilotModal());
  drawerBtnCopilot?.addEventListener('click', () => {
    document.getElementById('app-drawer')?.classList.remove('open');
    document.getElementById('drawer-overlay')?.classList.remove('show');
    openCopilotModal();
  });
  fabAiCopilot?.addEventListener('click', () => {
    document.getElementById('fab-menu')?.classList.remove('show');
    document.getElementById('fab-main-btn')?.classList.remove('open');
    openCopilotModal();
  });
  btnAiCopilotFloating?.addEventListener('click', () => openCopilotModal());

  // Sugerencias rápidas (pills)
  document.querySelectorAll('.copilot-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const prompt = pill.getAttribute('data-copilot-prompt');
      if (prompt && copilotInputText) {
        copilotInputText.value = prompt;
        sendMessage();
      }
    });
  });

  // Alternar Lectura en Voz Alta
  btnSpeechToggle?.addEventListener('click', () => {
    isSpeechEnabled = !isSpeechEnabled;
    btnSpeechToggle.textContent = isSpeechEnabled ? '🔊' : '🔇';
    btnSpeechToggle.title = isSpeechEnabled ? 'Voz activada (pulsa para silenciar)' : 'Voz silenciada (pulsa para activar)';
    showToast(isSpeechEnabled ? '🔊 Lectura de voz activada' : '🔇 Voz silenciada', 'info');
    if (!isSpeechEnabled) stopSpeaking();
  });

  // Configurar Clave IA
  btnConfigKey?.addEventListener('click', async () => {
    const currentKey = await getAIApiKey();
    const promptMsg = 'Introduce tu API Key gratuita de Google Gemini para activar el razonamiento escolar profundo y búsqueda:\n\n(Consíguela gratis en: https://aistudio.google.com/):';
    const newKey = window.prompt(promptMsg, currentKey || '');
    if (newKey !== null) {
      const saved = await saveAIApiKey(newKey);
      await updateStatusBadge();
      showToast(saved ? '🔑 Clave IA guardada' : 'Clave IA eliminada', 'info');
    }
  });

  // Limpiar Chat
  btnClearChat?.addEventListener('click', () => {
    clearChatHistory();
    if (copilotMessages) {
      copilotMessages.innerHTML = `
        <div class="copilot-msg copilot-msg-bot">
          <p>🧹 <em>Conversación reiniciada.</em> ¿Qué necesitas consultar o preparar ahora?</p>
        </div>
      `;
    }
    stopSpeaking();
    showToast('Conversación reiniciada');
  });

  // Adjuntar Foto / Apuntes
  function setAttachedImage(dataUrl) {
    activeAttachedBase64 = dataUrl;
    if (attachmentPreview && attachmentImg) {
      attachmentImg.src = dataUrl;
      attachmentPreview.classList.remove('hidden');
    }
  }

  btnCopilotAttach?.addEventListener('click', () => copilotFileInput?.click());
  copilotFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setAttachedImage(ev.target.result);
      reader.readAsDataURL(file);
    }
  });

  btnRemoveAttachment?.addEventListener('click', () => {
    activeAttachedBase64 = null;
    if (attachmentPreview) attachmentPreview.classList.add('hidden');
    if (copilotFileInput) copilotFileInput.value = '';
  });

  // Dictado por Voz
  btnCopilotVoice?.addEventListener('click', () => {
    if (!isSpeechRecognitionSupported()) {
      showToast('Tu navegador no soporta reconocimiento de voz por micrófono', 'warning');
      return;
    }

    if (isVoiceDictating) {
      stopSpeechDictation();
      isVoiceDictating = false;
      btnCopilotVoice.classList.remove('listening');
    } else {
      isVoiceDictating = true;
      btnCopilotVoice.classList.add('listening');
      startSpeechDictation(copilotInputText, 'es-ES', (status) => {
        if (status === 'stopped' || status === 'error') {
          isVoiceDictating = false;
          btnCopilotVoice.classList.remove('listening');
        }
      });
    }
  });

  // Formateador seguro de Markdown para los mensajes
  function renderMarkdownSafe(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Negrita
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Cursiva
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Código inline
    html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-input);padding:2px 5px;border-radius:4px;">$1</code>');
    // Enlaces markdown [texto](url)
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline;">$1 ↗</a>');

    // Listas con viñetas
    const lines = html.split('\n');
    let inList = false;
    let result = '';

    for (let line of lines) {
      const bulletMatch = line.match(/^(\s*)[•\-\*]\s+(.*)/);
      if (bulletMatch) {
        if (!inList) {
          result += '<ul>';
          inList = true;
        }
        result += `<li>${bulletMatch[2]}</li>`;
      } else {
        if (inList) {
          result += '</ul>';
          inList = false;
        }
        if (line.trim().length > 0) {
          result += `<p>${line}</p>`;
        }
      }
    }

    if (inList) result += '</ul>';
    return result || `<p>${html}</p>`;
  }

  // Renderizar Mensaje en el Chat
  function appendMessage(role, text, actions = [], webSearch = null) {
    if (!copilotMessages) return;

    const msgEl = document.createElement('div');
    msgEl.className = `copilot-msg copilot-msg-${role}`;

    if (role === 'user') {
      msgEl.innerHTML = `<div>${renderMarkdownSafe(text)}</div>`;
    } else {
      let bodyHtml = renderMarkdownSafe(text);

      // Renderizar tarjetas de acciones ejecutadas por la IA
      if (Array.isArray(actions) && actions.length > 0) {
        actions.forEach((act) => {
          let btnLabel = 'Ver';
          let targetTab = '';
          if (act.type === 'task_created') {
            btnLabel = 'Ver Deberes';
            targetTab = 'tab-tasks';
          } else if (act.type === 'exam_created') {
            btnLabel = 'Ver Exámenes';
            targetTab = 'tab-exams';
          } else if (act.type === 'flashcards_created') {
            btnLabel = 'Ver Fichas';
            targetTab = 'tab-flashcards';
          } else if (act.type === 'pomodoro_started') {
            btnLabel = 'Ver Pomodoro';
            targetTab = 'tab-pomodoro';
          }

          bodyHtml += `
            <div class="copilot-action-card">
              <span class="copilot-action-card-text">${act.message || 'Acción completada'}</span>
              ${targetTab ? `<button type="button" class="copilot-action-btn-go" data-nav-target="${targetTab}">${btnLabel} ➔</button>` : ''}
            </div>
          `;
        });
      }

      // Renderizar tarjeta de búsqueda en Wikipedia
      if (webSearch) {
        bodyHtml += `
          <div class="copilot-web-card">
            ${webSearch.thumbnail ? `<img src="${webSearch.thumbnail}" alt="${webSearch.title}" class="copilot-web-thumb" />` : ''}
            <div class="copilot-web-body">
              <div class="copilot-web-title">📚 ${webSearch.title}</div>
              <div class="copilot-web-desc">${webSearch.extract.substring(0, 180)}...</div>
              <a href="${webSearch.url}" target="_blank" rel="noopener noreferrer" class="copilot-web-link">Leer artículo completo en Wikipedia ↗</a>
            </div>
          </div>
        `;
      }

      // Botón para escuchar en voz alta
      bodyHtml += `
        <div class="copilot-msg-footer">
          <button type="button" class="btn-speak-msg" title="Escuchar este mensaje en voz alta">🔊 Escuchar</button>
        </div>
      `;

      msgEl.innerHTML = bodyHtml;

      // Event listener para el botón de audio
      const speakBtn = msgEl.querySelector('.btn-speak-msg');
      speakBtn?.addEventListener('click', () => {
        speakText(text);
      });

      // Event listeners para botones de navegación a pestañas
      msgEl.querySelectorAll('.copilot-action-btn-go').forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-nav-target');
          if (target) {
            copilotModal?.classList.add('hidden');
            switchTab(target);
          }
        });
      });
    }

    copilotMessages.appendChild(msgEl);
    copilotMessages.scrollTop = copilotMessages.scrollHeight;

    appendToChatHistory(role, text);
  }

  // Enviar Mensaje
  async function sendMessage() {
    if (isSending) return;
    const text = (copilotInputText?.value || '').trim();
    const image = activeAttachedBase64;

    if (!text && !image) return;

    if (isVoiceDictating) {
      stopSpeechDictation();
      isVoiceDictating = false;
      btnCopilotVoice?.classList.remove('listening');
    }

    // 1. Mostrar mensaje del usuario
    appendMessage('user', text || '(Foto de apuntes adjunta)');
    if (copilotInputText) copilotInputText.value = '';

    // Limpiar adjunto tras enviar
    if (attachmentPreview) attachmentPreview.classList.add('hidden');
    if (copilotFileInput) copilotFileInput.value = '';
    activeAttachedBase64 = null;

    // 2. Mostrar indicador de pensando
    const thinkingEl = document.createElement('div');
    thinkingEl.className = 'copilot-msg copilot-msg-bot';
    thinkingEl.id = 'copilot-thinking-bubble';
    thinkingEl.innerHTML = `<span>✨ Pensando y revisando tu agenda...</span>`;
    copilotMessages?.appendChild(thinkingEl);
    copilotMessages.scrollTop = copilotMessages.scrollHeight;

    isSending = true;

    try {
      const response = await askAIAssistant({
        userMessage: text,
        imageBase64: image,
        history: getChatHistory()
      });

      thinkingEl.remove();

      // 3. Renderizar respuesta del bot
      appendMessage('model', response.replyText, response.actionsExecuted, response.webSearch);

      // 4. Si la voz está activada, leer la respuesta
      if (isSpeechEnabled) {
        speakText(response.replyText);
      }
    } catch (err) {
      thinkingEl.remove();
      appendMessage('model', `⚠️ Lo siento, ocurrió un error: ${err.message}`);
    } finally {
      isSending = false;
    }
  }

  copilotForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });

  // Enter para enviar, Shift+Enter para salto de línea
  copilotInputText?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // ------------------------------------------------------------------------
  // 3. MODAL DEL GENERADOR DE FICHAS CON IA
  // ------------------------------------------------------------------------
  const flashcardAiModal = document.getElementById('flashcard-ai-modal');
  const btnOpenFlashcardsAi = document.getElementById('btn-open-flashcards-ai');
  const flashcardAiForm = document.getElementById('flashcard-ai-form');
  const flashcardAiSubSelect = document.getElementById('flashcard-ai-subject-select');
  const flashcardAiCountSelect = document.getElementById('flashcard-ai-count-select');
  const flashcardAiTopicInput = document.getElementById('flashcard-ai-topic-input');
  const flashcardAiTextInput = document.getElementById('flashcard-ai-text-input');
  const flashcardAiStatus = document.getElementById('flashcard-ai-status');
  const flashcardAiResultsContainer = document.getElementById('flashcard-ai-results-container');
  const flashcardAiResultsGrid = document.getElementById('flashcard-ai-results-grid');
  const flashcardAiCountGenerated = document.getElementById('flashcard-ai-count-generated');
  const btnFlashcardAiSaveAll = document.getElementById('btn-flashcard-ai-save-all');

  let generatedCardsBuffer = [];

  function openFlashcardsAiModal(initialText = '') {
    populateSubjectSelect(flashcardAiSubSelect);
    if (flashcardAiSubSelect && AppState.flashcardsSubjectFilter !== 'all') {
      flashcardAiSubSelect.value = AppState.flashcardsSubjectFilter;
    }
    if (flashcardAiTextInput) {
      flashcardAiTextInput.value = initialText || '';
    }
    if (flashcardAiTopicInput) {
      flashcardAiTopicInput.value = '';
    }
    if (flashcardAiResultsContainer) {
      flashcardAiResultsContainer.classList.add('hidden');
    }
    if (flashcardAiStatus) {
      flashcardAiStatus.textContent = 'Motor: Gemini Flash / IA Local';
    }
    generatedCardsBuffer = [];
    flashcardAiModal?.classList.remove('hidden');
  }

  window.openFlashcardsAiModal = openFlashcardsAiModal;
  btnOpenFlashcardsAi?.addEventListener('click', () => openFlashcardsAiModal());

  flashcardAiForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = flashcardAiTextInput?.value.trim();
    const subjectId = flashcardAiSubSelect?.value;
    const count = parseInt(flashcardAiCountSelect?.value || '5', 10);
    const topic = flashcardAiTopicInput?.value.trim();

    if (!text) {
      showToast('Por favor escribe o pega el texto para generar las fichas', 'warning');
      return;
    }

    if (flashcardAiStatus) {
      flashcardAiStatus.textContent = '✨ Generando fichas pedagógicas con IA...';
    }

    const btnSubmit = document.getElementById('btn-flashcard-ai-generate');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = '⏳ Analizando...';
    }

    try {
      const cards = await generateFlashcardsWithAI({ text, subjectId, count, topic });
      generatedCardsBuffer = cards;

      if (cards.length === 0) {
        showToast('No se pudieron extraer fichas con el texto dado', 'warning');
        if (flashcardAiStatus) flashcardAiStatus.textContent = 'Intenta con más texto o detalles.';
        return;
      }

      // Renderizar previsualización
      if (flashcardAiResultsGrid) {
        flashcardAiResultsGrid.innerHTML = cards.map((c, i) => `
          <div class="flashcards-ai-item-preview">
            <div class="front-text">❓ ${c.front}</div>
            <div class="back-text">💡 ${c.back}</div>
            ${c.hint ? `<div class="hint-text">🔑 Pista: ${c.hint}</div>` : ''}
          </div>
        `).join('');
      }

      if (flashcardAiCountGenerated) {
        flashcardAiCountGenerated.textContent = String(cards.length);
      }

      flashcardAiResultsContainer?.classList.remove('hidden');
      if (flashcardAiStatus) {
        flashcardAiStatus.textContent = `✅ ¡${cards.length} fichas creadas con éxito!`;
      }
      showToast(`✨ ${cards.length} fichas generadas. ¡Revisa y guarda!`, 'success');
    } catch (err) {
      console.error('Error generando flashcards:', err);
      showToast(`Error al generar fichas: ${err.message}`, 'error');
      if (flashcardAiStatus) flashcardAiStatus.textContent = 'Ocurrió un error al procesar.';
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = '✨ Generar Fichas';
      }
    }
  });

  // Guardar todas las fichas en la base de datos
  btnFlashcardAiSaveAll?.addEventListener('click', async () => {
    if (generatedCardsBuffer.length === 0) return;

    for (const item of generatedCardsBuffer) {
      const card = createFlashcard(item);
      await saveItem('flashcards', card);
      if (AppState.flashcards) {
        AppState.flashcards.push(card);
      }
    }

    renderFlashcardsView();
    updateBadges();
    flashcardAiModal?.classList.add('hidden');
    showToast(`🎉 ¡${generatedCardsBuffer.length} fichas guardadas en tu mazo!`, 'success');
    triggerHaptic('success');
  });
}



