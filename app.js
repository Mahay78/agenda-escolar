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
  compressImage
} from './db.js';

import { initCameraModule, openCamera, openImageViewer } from './camera.js';
import { initAnnotationModule, openAnnotationEditor } from './annotations.js';
import { startRecording, stopRecording, cancelRecording, playPomodoroBell, playBreakBell } from './audio.js';
import {
  renderQRCodeToCanvas,
  formatTasksForWhatsApp,
  formatExamsForWhatsApp,
  formatScheduleForWhatsApp,
  sendToWhatsApp
} from './qr.js';

// Estado global de la aplicación
const AppState = {
  activeTab: 'tab-today',
  selectedScheduleDay: new Date().getDay() >= 1 && new Date().getDay() <= 5 ? new Date().getDay() : 1,
  taskFilter: 'all',
  termFilter: 'all',
  materialFilter: 'all',
  projectFilter: 'all',
  subjects: [],
  schedule: [],
  tasks: [],
  exams: [],
  grades: [],
  projects: [],
  materials: [],
  timeSlots: [],
  studentInfo: {},
  tempTaskPhotos: [],
  tempExamPhotos: [],
  tempProjectPhotos: [],
  tempTaskAudio: null,
  currentViewedImageSrc: null,
  isRecordingAudio: false,
  pomodoro: {
    timeLeft: 25 * 60,
    totalTime: 25 * 60,
    isRunning: false,
    mode: 'work',
    timerId: null,
    countToday: 0,
    totalFocusMinutes: 0
  }
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
function initTheme() {
  const toggleBtn = document.getElementById('btn-toggle-theme');
  const currentTheme = AppState.studentInfo?.theme || 'dark';

  if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      AppState.studentInfo.theme = isLight ? 'light' : 'dark';
      await setSetting('studentInfo', AppState.studentInfo);
      showToast(isLight ? 'Tema Claro activado ☀️' : 'Tema Oscuro activado 🌙');
    });
  }
}

/**
 * Navegación por pestañas
 */
function initNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab');
      switchTab(targetId);
    });
  });
}

function switchTab(tabId) {
  AppState.activeTab = tabId;
  document.querySelectorAll('.nav-tab').forEach((t) => {
    t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
  });
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
  else if (tabId === 'tab-settings') renderSettingsView();
}

// ==========================================================================
// EVENT LISTENERS & MODALES
// ==========================================================================
function initEventListeners() {
  // Botón flotante FAB
  const fabMain = document.getElementById('fab-main-btn');
  const fabMenu = document.getElementById('fab-menu');

  if (fabMain && fabMenu) {
    fabMain.addEventListener('click', () => {
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
  renderSettingsView();
  updateBadges();
}

function updateHeaderInfo() {
  const nameEl = document.getElementById('header-student-name');
  const schoolEl = document.getElementById('header-school-name');
  if (nameEl) nameEl.textContent = AppState.studentInfo.studentName ? `Agenda de ${AppState.studentInfo.studentName}` : 'Agenda Escolar';
  if (schoolEl) schoolEl.textContent = `${AppState.studentInfo.schoolName || 'Instituto'} - ${AppState.studentInfo.course || ''}`;
}

function updateBadges() {
  const pendingTasks = AppState.tasks.filter((t) => t.status !== 'completed').length;
  const badgeTasks = document.getElementById('badge-pending-tasks');
  if (badgeTasks) {
    if (pendingTasks > 0) {
      badgeTasks.textContent = pendingTasks;
      badgeTasks.classList.remove('hidden');
    } else {
      badgeTasks.classList.add('hidden');
    }
  }

  const todayStr = getTodayDateString();
  const upcomingExams = AppState.exams.filter((e) => e.date >= todayStr).length;
  const badgeExams = document.getElementById('badge-upcoming-exams');
  if (badgeExams) {
    if (upcomingExams > 0) {
      badgeExams.textContent = upcomingExams;
      badgeExams.classList.remove('hidden');
    } else {
      badgeExams.classList.add('hidden');
    }
  }
}

// ----------------------------------------------------
// 1. VISTA: HOY (DASHBOARD)
// ----------------------------------------------------
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
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
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
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
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

          <div class="task-actions" style="margin-top: 12px;">
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
          <div class="task-actions">
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

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px;">
      ${allPhotos
        .map(
          (item) => `
        <div class="card" style="padding: 8px; cursor: pointer; margin-bottom: 0;" onclick="window.openImageViewer('${item.src}', '${escapeHTML(item.title)}')">
          <img src="${item.src}" alt="${escapeHTML(item.title)}" style="width: 100%; height: 140px; object-fit: cover; border-radius: var(--radius-sm);" />
          <div style="margin-top: 6px; font-size: 0.8rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHTML(item.title)}
          </div>
          <span class="tag-subject" style="background: ${item.color}; font-size: 0.7rem; margin-top: 4px;">${item.icon} ${item.subject}</span>
        </div>
      `
        )
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
    showToast(task.status === 'completed' ? '🎉 ¡Tarea completada!' : 'Tarea marcada como pendiente');
  }
};

window.confirmDeleteTask = async function (taskId) {
  if (confirm('¿Seguro que deseas eliminar esta tarea?')) {
    await deleteItem('tasks', taskId);
    await loadAllData();
    renderAllViews();
    showToast('🗑️ Tarea eliminada');
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
    }
  } else {
    titleEl.textContent = 'Nuevo Examen';
    idInput.value = '';
    titleInput.value = '';
    dateInput.value = getTomorrowDateString();
    topicsInput.value = '';
    AppState.tempExamPhotos = [];
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
    updatedAt: new Date().toISOString()
  };

  await saveItem('exams', exam);
  await loadAllData();
  renderAllViews();
  document.getElementById('exam-modal').classList.add('hidden');
  showToast('✅ Examen guardado con éxito', 'success');
}

window.confirmDeleteExam = async function (examId) {
  if (confirm('¿Seguro que deseas eliminar este examen?')) {
    await deleteItem('exams', examId);
    await loadAllData();
    renderAllViews();
    showToast('🗑️ Examen eliminado');
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
  await loadAllData();
  renderAllViews();
  document.getElementById('grade-modal').classList.add('hidden');
  showToast('✅ Calificación guardada');
}

window.confirmDeleteGrade = async function (gradeId) {
  if (confirm('¿Eliminar esta calificación?')) {
    await deleteItem('grades', gradeId);
    await loadAllData();
    renderAllViews();
    showToast('🗑️ Calificación eliminada');
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

// --- GESTIÓN DE ASIGNATURAS ---
window.openSubjectModal = function (subId = null) {
  const modal = document.getElementById('subject-modal');
  const titleEl = document.getElementById('subject-modal-title');
  const idInput = document.getElementById('subject-id');
  const nameInput = document.getElementById('subject-name-input');
  const iconInput = document.getElementById('subject-icon-input');
  const colorInput = document.getElementById('subject-color-input');
  const teacherInput = document.getElementById('subject-teacher-input');
  const classInput = document.getElementById('subject-classroom-input');

  if (subId) {
    const sub = AppState.subjects.find((s) => s.id === subId);
    if (sub) {
      titleEl.textContent = 'Editar Asignatura';
      idInput.value = sub.id;
      nameInput.value = sub.name;
      iconInput.value = sub.icon || '📖';
      colorInput.value = sub.color || '#3b82f6';
      teacherInput.value = sub.teacher || '';
      classInput.value = sub.classroom || '';
    }
  } else {
    titleEl.textContent = 'Nueva Asignatura';
    idInput.value = '';
    nameInput.value = '';
    iconInput.value = '📖';
    colorInput.value = '#3b82f6';
    teacherInput.value = '';
    classInput.value = '';
  }

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
  const btnRecord = document.getElementById('btn-record-audio');
  const btnCancel = document.getElementById('btn-cancel-recording');
  const btnRemove = document.getElementById('btn-remove-audio');

  btnRecord?.addEventListener('click', handleToggleAudioRecording);
  btnCancel?.addEventListener('click', handleCancelAudioRecording);
  btnRemove?.addEventListener('click', handleRemoveAudio);
}

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
  if (confirm('¿Eliminar este material de la lista?')) {
    await deleteItem('materials', matId);
    await loadAllData();
    renderBackpackView();
    showToast('🗑️ Material eliminado');
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
    updatedAt: new Date().toISOString()
  };

  await saveItem('projects', project);
  await loadAllData();
  renderAllViews();
  document.getElementById('project-modal')?.classList.add('hidden');
  showToast('🎨 Proyecto guardado en el portafolio', 'success');
}

window.confirmDeleteProject = async function (projectId) {
  if (confirm('¿Eliminar este proyecto de arte y sus fotos?')) {
    await deleteItem('projects', projectId);
    await loadAllData();
    renderAllViews();
    showToast('🗑️ Proyecto eliminado');
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

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

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
