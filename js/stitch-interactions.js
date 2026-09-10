/**
 * stitch-interactions.js
 * Capa interactiva completa para la suite de Agenda Escolar (Google Stitch).
 * Activa botones, temporizador Pomodoro, tareas, mochila, buscador ⌘K,
 * copiloto IA, flashcards, reproductor de podcast y escáner OCR.
 * 100% Vanilla JavaScript (sin dependencias, compatible con todos los navegadores).
 */

(function () {
  'use strict';

  // Helper para buscar elementos por texto de forma segura
  function findElementsByText(selector, textSubstring) {
    const elements = Array.from(document.querySelectorAll(selector));
    return elements.filter(el => (el.textContent || '').toLowerCase().includes(textSubstring.toLowerCase()));
  }

  // =========================================================================
  // 1. SISTEMA DE TOASTS Y NOTIFICACIONES VISUALES
  // =========================================================================
  function showToast(message, type = 'info') {
    let container = document.getElementById('stitch-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'stitch-toast-container';
      container.className = 'fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-emerald-600 text-white'
      : type === 'error' ? 'bg-rose-600 text-white'
      : type === 'warning' ? 'bg-amber-500 text-white'
      : 'bg-slate-900 text-white';

    toast.className = `${bgClass} px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold transform transition-all duration-300 translate-y-[-10px] opacity-0 pointer-events-auto select-none`;
    
    const icon = type === 'success' ? 'check_circle'
      : type === 'error' ? 'error'
      : type === 'warning' ? 'warning'
      : 'info';

    toast.innerHTML = `
      <span class="material-symbols-outlined text-[18px]">${icon}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-[-10px]', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'scale-95');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // =========================================================================
  // 2. MOTOR POMODORO GLOBAL (SINCRONIZADO)
  // =========================================================================
  const Pomodoro = {
    duration: 25 * 60, // 25 min
    timeLeft: 25 * 60,
    timerId: null,
    isRunning: false,
    mode: 'focus',

    formatTime(seconds) {
      const m = Math.floor(seconds / 60).toString().padStart(2, '0');
      const s = (seconds % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    },

    updateDisplays() {
      const formatted = this.formatTime(this.timeLeft);
      document.querySelectorAll('.font-code-sm, span').forEach(el => {
        const txt = el.textContent.trim();
        if ((txt === '25:00' || txt === '24:59' || el.dataset.isPomodoro === 'true') && el.children.length === 0) {
          el.dataset.isPomodoro = 'true';
          el.textContent = formatted;
        }
      });

      // Update play icons
      document.querySelectorAll('button[title*="Pomodoro"], .btn-pomodoro-play').forEach(btn => {
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) {
          icon.textContent = this.isRunning ? 'pause' : 'play_arrow';
        }
      });
    },

    toggle() {
      if (this.isRunning) {
        this.pause();
      } else {
        this.start();
      }
    },

    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      showToast(this.mode === 'focus' ? '🎯 Pomodoro iniciado (25 min de enfoque)' : '☕ Descanso iniciado (5 min)', 'success');
      this.timerId = setInterval(() => {
        if (this.timeLeft > 0) {
          this.timeLeft--;
          this.updateDisplays();
        } else {
          this.complete();
        }
      }, 1000);
      this.updateDisplays();
    },

    pause() {
      this.isRunning = false;
      clearInterval(this.timerId);
      this.timerId = null;
      showToast('⏸️ Pomodoro pausado', 'info');
      this.updateDisplays();
    },

    reset() {
      this.pause();
      this.timeLeft = this.duration;
      this.updateDisplays();
      showToast('🔄 Pomodoro reiniciado a 25:00', 'info');
    },

    complete() {
      this.pause();
      playBeep();
      if (this.mode === 'focus') {
        this.mode = 'break';
        this.duration = 5 * 60;
        this.timeLeft = this.duration;
        showToast('🎉 ¡Sesión de estudio completada! Tómate 5 min de descanso.', 'success');
        incrementStreak();
      } else {
        this.mode = 'focus';
        this.duration = 25 * 60;
        this.timeLeft = this.duration;
        showToast('⏰ ¡Fin del descanso! Listo para otra sesión de enfoque.', 'info');
      }
      this.updateDisplays();
    }
  };

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      // Ignorar si no hay interacción previa
    }
  }

  function incrementStreak() {
    let streak = parseInt(localStorage.getItem('study_streak') || '14', 10);
    streak++;
    localStorage.setItem('study_streak', streak.toString());
    document.querySelectorAll('.font-display').forEach(el => {
      if (el.textContent === '14') el.textContent = streak.toString();
    });
  }

  // =========================================================================
  // 3. TAREAS Y DEBERES (CHECKBOXES, AÑADIR, FILTROS)
  // =========================================================================
  function initTasks() {
    // 3.1. Marcar tareas como completadas al pulsar el botón check o input
    document.addEventListener('click', (e) => {
      const checkBtn = e.target.closest('button[aria-label="Marcar como completada"], .task-checkbox, label input[type="checkbox"]');
      if (checkBtn) {
        // Verificar si es de la mochila
        const isBackpack = checkBtn.closest('section') && (checkBtn.closest('section').textContent || '').includes('Mochila');
        if (isBackpack) return; // Se gestiona en initBackpack

        const card = checkBtn.closest('.group, #task-card-1, .task-card') || checkBtn.parentElement;
        if (!card) return;

        const isInput = checkBtn.tagName === 'INPUT';
        let isDone = false;

        if (isInput) {
          isDone = checkBtn.checked;
        } else {
          isDone = !card.classList.contains('task-completed');
          const checkIcon = checkBtn.querySelector('.material-symbols-outlined');
          if (isDone) {
            checkBtn.classList.add('bg-emerald-600', 'text-white');
            checkBtn.classList.remove('bg-surface-card', 'text-transparent');
            if (checkIcon) checkIcon.classList.remove('opacity-0');
          } else {
            checkBtn.classList.remove('bg-emerald-600', 'text-white');
            checkBtn.classList.add('bg-surface-card', 'text-transparent');
            if (checkIcon) checkIcon.classList.add('opacity-0');
          }
        }

        const title = card.querySelector('h4, h3, p.font-body-md, .task-title');
        if (isDone) {
          card.classList.add('task-completed', 'opacity-60');
          if (title) title.classList.add('line-through', 'text-slate-400');
          showToast('✅ ¡Tarea completada!', 'success');
        } else {
          card.classList.remove('task-completed', 'opacity-60');
          if (title) title.classList.remove('line-through', 'text-slate-400');
          showToast('↩️ Tarea marcada como pendiente', 'info');
        }
      }
    });

    // 3.2. Filtro de pestañas (Todos, Urgentes, Para Mañana, Esta Semana, Con OCR)
    const filterButtons = document.querySelectorAll('section button.rounded-full');
    filterButtons.forEach(btn => {
      const text = btn.textContent.trim().toLowerCase();
      if (text.includes('todos') || text.includes('urgentes') || text.includes('mañana') || text.includes('semana') || text.includes('ocr')) {
        btn.addEventListener('click', () => {
          filterButtons.forEach(b => {
            b.classList.remove('bg-primary-container', 'text-surface-card', 'shadow-inner', 'bg-blue-600', 'text-white');
            b.classList.add('bg-surface-container', 'text-on-surface-variant');
          });
          btn.classList.add('bg-primary-container', 'text-surface-card', 'shadow-inner');
          btn.classList.remove('bg-surface-container', 'text-on-surface-variant');

          const allCards = document.querySelectorAll('.space-y-space-sm > div.p-space-base, main .space-y-3 > div');
          allCards.forEach(card => {
            const cardText = card.textContent.toLowerCase();
            if (text.includes('todos')) {
              card.style.display = '';
            } else if (text.includes('urgente') && (cardText.includes('urgente') || cardText.includes('🚨'))) {
              card.style.display = '';
            } else if (text.includes('mañana') && cardText.includes('mañana')) {
              card.style.display = '';
            } else if (text.includes('ocr') && (cardText.includes('ocr') || cardText.includes('foto'))) {
              card.style.display = '';
            } else if (!text.includes('todos')) {
              card.style.display = 'none';
            }
          });
          showToast(`Filtro: ${btn.textContent.trim()}`, 'info');
        });
      }
    });

    // 3.3. Input rápido de añadir deberes
    const quickInput = document.querySelector('input[placeholder*="Escribe un deber rápido"]');
    const saveBtn = quickInput ? quickInput.closest('div').querySelector('button:last-child') : null;

    function addQuickTask() {
      if (!quickInput) return;
      const text = quickInput.value.trim();
      if (!text) {
        showToast('Escribe una descripción para el deber', 'warning');
        return;
      }

      const taskContainer = document.querySelector('.space-y-space-sm');
      if (taskContainer) {
        const newCard = document.createElement('div');
        newCard.className = 'p-space-base rounded-xl bg-surface-bright hover:bg-surface-container-low transition-all shadow-sm hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-space-sm group';
        newCard.innerHTML = `
          <div class="flex items-start gap-space-sm flex-1 min-w-0">
            <button aria-label="Marcar como completada" class="mt-1 w-5 h-5 rounded flex items-center justify-center bg-surface-card shadow-sm text-transparent hover:text-emerald-streak group-hover:bg-surface-container-high transition-all" type="button">
              <span class="material-symbols-outlined text-[16px]">check</span>
            </button>
            <div class="space-y-1 min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-label-sm font-label-sm font-bold">
                  <span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span> Personal
                </span>
                <span class="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-label-sm font-label-sm">
                  Hoy
                </span>
              </div>
              <h4 class="font-headline-sm text-headline-sm font-semibold text-on-surface truncate">${text}</h4>
              <p class="font-body-sm text-body-sm text-on-surface-variant">Añadido recientemente a tu lista de deberes.</p>
            </div>
          </div>
          <div class="flex items-center justify-end gap-space-sm shrink-0 pl-7 md:pl-0">
            <button class="px-3 py-1.5 rounded-lg bg-secondary text-surface-card font-label-md text-label-md hover:bg-on-secondary-fixed-variant transition-colors shadow-xs" type="button">
              Detalles
            </button>
          </div>
        `;
        taskContainer.prepend(newCard);
        quickInput.value = '';
        showToast('📝 ¡Nuevo deber añadido con éxito!', 'success');
      }
    }

    if (quickInput) {
      quickInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addQuickTask();
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        addQuickTask();
      });
    }
  }

  // =========================================================================
  // 4. MOCHILA INTELIGENTE (CHECKBOXES Y PERSISTENCIA)
  // =========================================================================
  function initBackpack() {
    // Buscar la sección de la mochila
    const allSections = Array.from(document.querySelectorAll('section, div.bg-surface-card'));
    const backpackSection = allSections.find(s => (s.textContent || '').includes('Mochila Inteligente') || (s.textContent || '').includes('Mochila Rápida'));
    
    if (!backpackSection) return;

    const backpackLabels = backpackSection.querySelectorAll('label');
    const badge = backpackSection.querySelector('.font-code-sm, span.bg-surface-container-high, span.font-bold');

    function updateCounter() {
      let total = 0;
      let checked = 0;
      backpackLabels.forEach(lbl => {
        const chk = lbl.querySelector('input[type="checkbox"]');
        if (chk) {
          total++;
          if (chk.checked) checked++;
        }
      });

      if (badge && total > 0 && badge.textContent.includes('/')) {
        badge.textContent = `${checked}/${total} Listos`;
      }
    }

    backpackLabels.forEach(lbl => {
      const chk = lbl.querySelector('input[type="checkbox"]');
      if (chk) {
        chk.addEventListener('change', () => {
          const spanText = lbl.querySelector('span.truncate, span.font-body-sm');
          if (chk.checked) {
            if (spanText) spanText.classList.add('line-through', 'text-on-surface-variant/70');
            showToast('🎒 Objeto guardado en la mochila', 'success');
          } else {
            if (spanText) spanText.classList.remove('line-through', 'text-on-surface-variant/70');
            showToast('⚠️ Objeto pendiente de meter', 'warning');
          }
          updateCounter();
        });
      }
    });

    // Botón añadir recordatorio de material
    const addMaterialBtn = findElementsByText('button', 'recordatorio de material')[0] || findElementsByText('button', 'Añadir material')[0];
    if (addMaterialBtn) {
      addMaterialBtn.addEventListener('click', () => {
        const item = prompt('¿Qué material o libro necesitas recordar para mañana?');
        if (item && item.trim()) {
          const list = addMaterialBtn.previousElementSibling;
          if (list) {
            const newLabel = document.createElement('label');
            newLabel.className = 'flex items-center justify-between p-2 rounded-lg bg-surface-bright hover:bg-surface-container-low transition-colors cursor-pointer group';
            newLabel.innerHTML = `
              <div class="flex items-center gap-space-sm min-w-0">
                <input class="w-4 h-4 rounded text-emerald-streak focus:ring-emerald-streak border-border-subtle" type="checkbox"/>
                <span class="font-body-sm text-body-sm text-on-surface truncate">${item.trim()}</span>
              </div>
              <span class="material-symbols-outlined text-[16px] text-emerald-streak">check</span>
            `;
            list.appendChild(newLabel);
            showToast(`✅ "${item.trim()}" añadido a tu mochila`, 'success');
            initBackpack();
          }
        }
      });
    }
  }

  // =========================================================================
  // 5. MODAL DE BÚSQUEDA RÁPIDA ⌘K / PALETA DE COMANDOS
  // =========================================================================
  function createSearchModal() {
    if (document.getElementById('stitch-search-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'stitch-search-modal';
    modal.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm hidden flex items-start justify-center pt-20 px-4 transition-opacity';
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
        <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <span class="material-symbols-outlined text-blue-600 text-[24px]">search</span>
          <input id="stitch-search-input" type="text" placeholder="Buscar asignaturas, tareas, fechas o apuntes..." class="w-full bg-transparent text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none text-base font-medium" autocomplete="off" />
          <kbd class="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 rounded font-mono">ESC</kbd>
        </div>
        <div id="stitch-search-results" class="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800">
          <a href="horario-mochila.html" class="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
            <div class="flex items-center gap-3">
              <span class="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 text-sm">📐</span>
              <div>
                <div class="text-sm font-bold text-slate-800 dark:text-white">Matemáticas II • Matrices y Determinantes</div>
                <div class="text-xs text-slate-400">Examen en 3 días • Aula 102</div>
              </div>
            </div>
            <span class="text-xs text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Ir ➔</span>
          </a>
          <a href="notebook.html" class="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
            <div class="flex items-center gap-3">
              <span class="p-2 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/30 text-sm">⚡</span>
              <div>
                <div class="text-sm font-bold text-slate-800 dark:text-white">Física & Química • Ley de Faraday-Lenz</div>
                <div class="text-xs text-slate-400">Cuaderno LM • 2 fotos de pizarra</div>
              </div>
            </div>
            <span class="text-xs text-purple-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Abrir apuntes ➔</span>
          </a>
          <a href="pomodoro-flashcards.html" class="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
            <div class="flex items-center gap-3">
              <span class="p-2 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/30 text-sm">🧠</span>
              <div>
                <div class="text-sm font-bold text-slate-800 dark:text-white">Historia de España • Crisis del Antiguo Régimen</div>
                <div class="text-xs text-slate-400">34 fichas Leitner pendientes</div>
              </div>
            </div>
            <span class="text-xs text-amber-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Repasar ➔</span>
          </a>
          <a href="english-coach.html" class="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
            <div class="flex items-center gap-3">
              <span class="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 text-sm">🇬🇧</span>
              <div>
                <div class="text-sm font-bold text-slate-800 dark:text-white">English Coach C1 • PAU Mock Test</div>
                <div class="text-xs text-slate-400">Tutor socrático activo</div>
              </div>
            </div>
            <span class="text-xs text-emerald-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Practicar ➔</span>
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector('#stitch-search-input');
    const results = modal.querySelector('#stitch-search-results');
    const allLinks = Array.from(results.children);

    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      allLinks.forEach(link => {
        const t = link.textContent.toLowerCase();
        link.style.display = t.includes(q) ? '' : 'none';
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeSearchModal();
    });
  }

  function openSearchModal() {
    createSearchModal();
    const modal = document.getElementById('stitch-search-modal');
    if (modal) {
      modal.classList.remove('hidden');
      const inp = modal.querySelector('#stitch-search-input');
      if (inp) {
        inp.value = '';
        inp.focus();
      }
    }
  }

  function closeSearchModal() {
    const modal = document.getElementById('stitch-search-modal');
    if (modal) modal.classList.add('hidden');
  }

  // =========================================================================
  // 6. MODAL DE NUEVA TAREA / DEBER
  // =========================================================================
  function createNewTaskModal() {
    if (document.getElementById('stitch-new-task-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'stitch-new-task-modal';
    modal.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-2">
            <span class="text-xl">📋</span>
            <h3 class="font-bold text-slate-900 dark:text-white text-base">Nueva Tarea Escolar</h3>
          </div>
          <button id="stitch-close-task-modal" class="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
        </div>
        <form id="stitch-new-task-form" class="space-y-3">
          <div>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Título de la tarea o deber</label>
            <input id="task-title-input" required placeholder="Ej: Ejercicios 1 al 10 sobre matrices" class="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Asignatura</label>
              <select id="task-subject-select" class="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none">
                <option>Matemáticas II</option>
                <option>Física y Química</option>
                <option>Historia de España</option>
                <option>Lengua Castellana</option>
                <option>Inglés C1</option>
                <option>Dibujo Técnico</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Fecha de Entrega</label>
              <input type="date" id="task-date-input" class="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Prioridad</label>
            <div class="flex gap-2">
              <label class="flex-1 text-center py-1.5 rounded-lg border border-slate-200 text-xs font-semibold cursor-pointer hover:bg-slate-50">
                <input type="radio" name="priority" value="normal" checked class="sr-only" />
                Normal
              </label>
              <label class="flex-1 text-center py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 text-xs font-bold cursor-pointer">
                <input type="radio" name="priority" value="urgente" class="sr-only" />
                🚨 Urgente
              </label>
            </div>
          </div>
          <div class="pt-3 flex justify-end gap-2">
            <button type="button" id="stitch-cancel-task-btn" class="px-4 py-2 text-xs font-bold rounded-xl text-slate-500 hover:bg-slate-100">Cancelar</button>
            <button type="submit" class="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white shadow-md hover:bg-blue-500">Guardar Tarea</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.classList.add('hidden');
    modal.querySelector('#stitch-close-task-modal').addEventListener('click', close);
    modal.querySelector('#stitch-cancel-task-btn').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    modal.querySelector('#stitch-new-task-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = modal.querySelector('#task-title-input').value.trim();
      const subject = modal.querySelector('#task-subject-select').value;
      if (!title) return;

      const taskContainer = document.querySelector('.space-y-space-sm');
      if (taskContainer) {
        const newCard = document.createElement('div');
        newCard.className = 'p-space-base rounded-xl bg-surface-bright hover:bg-surface-container-low transition-all shadow-sm hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-space-sm group';
        newCard.innerHTML = `
          <div class="flex items-start gap-space-sm flex-1 min-w-0">
            <button aria-label="Marcar como completada" class="mt-1 w-5 h-5 rounded flex items-center justify-center bg-surface-card shadow-sm text-transparent hover:text-emerald-streak group-hover:bg-surface-container-high transition-all" type="button">
              <span class="material-symbols-outlined text-[16px]">check</span>
            </button>
            <div class="space-y-1 min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-label-sm font-label-sm font-bold">
                  <span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span> ${subject}
                </span>
                <span class="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-label-sm font-label-sm">
                  Próxima entrega
                </span>
              </div>
              <h4 class="font-headline-sm text-headline-sm font-semibold text-on-surface truncate">${title}</h4>
              <p class="font-body-sm text-body-sm text-on-surface-variant">Creada desde la barra superior.</p>
            </div>
          </div>
          <div class="flex items-center justify-end gap-space-sm shrink-0 pl-7 md:pl-0">
            <button class="px-3 py-1.5 rounded-lg bg-secondary text-surface-card font-label-md text-label-md hover:bg-on-secondary-fixed-variant transition-colors shadow-xs" type="button">
              Detalles
            </button>
          </div>
        `;
        taskContainer.prepend(newCard);
      }
      close();
      showToast(`📋 Tarea de ${subject} guardada con éxito`, 'success');
    });
  }

  function openNewTaskModal() {
    createNewTaskModal();
    const modal = document.getElementById('stitch-new-task-modal');
    if (modal) {
      modal.classList.remove('hidden');
      const input = modal.querySelector('#task-title-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  }

  // =========================================================================
  // 7. COPILOTO IA INTERACTIVO
  // =========================================================================
  function initCopilot() {
    const copilotInput = document.querySelector('input[placeholder*="Pregunta algo a tu temario"]');
    const sendBtn = copilotInput ? copilotInput.parentElement.querySelector('button[title*="Enviar"], button:last-child') : null;
    const micBtn = copilotInput ? copilotInput.parentElement.querySelector('button[title*="Dictar"]') : null;
    const quickChips = findElementsByText('button', 'Test de 10 preguntas').concat(findElementsByText('button', 'Resumen del tema'));

    const chatBubble = findElementsByText('p', 'He detectado que tienes examen')[0] || document.querySelector('.bg-surface-container-low p.font-body-sm');

    const responses = {
      test: "🎯 **Simulacro de Matemáticas II:**\n1. ¿Cuál es la condición para que una matriz tenga inversa? (Det ≠ 0)\n2. Si A · B = I, ¿es B = A⁻¹? (Sí)\n3. Calcula el rango de una matriz 3x3 de determinante nulo. (Rango < 3)",
      resumen: "📝 **Resumen Express de Inducción Electromagnética:**\n- **Ley de Faraday:** La f.e.m. inducida es directamente proporcional a la rapidez de variación del flujo magnético: ε = -dΦ/dt.\n- **Ley de Lenz:** El sentido de la corriente inducida siempre se opone a la causa que la produce.",
      general: "💡 He consultado tus apuntes del Cuaderno LM: Para calcular la matriz inversa, aplica la fórmula A⁻¹ = (1 / |A|) · Adj(A)ᵀ tras comprobar que |A| ≠ 0."
    };

    function sendToCopilot(query) {
      if (!chatBubble) return;
      chatBubble.innerHTML = `<span class="inline-block animate-pulse">⏳ Consultando apuntes escolares con IA...</span>`;
      setTimeout(() => {
        let answer = responses.general;
        const q = query.toLowerCase();
        if (q.includes('test') || q.includes('pregunta')) answer = responses.test;
        else if (q.includes('resumen') || q.includes('faraday') || q.includes('lenz') || q.includes('tema')) answer = responses.resumen;
        
        chatBubble.innerHTML = answer.replace(/\n/g, '<br/>');
        showToast('🤖 Copiloto IA ha respondido a tu consulta', 'success');
      }, 700);
    }

    quickChips.forEach(chip => {
      chip.addEventListener('click', () => {
        sendToCopilot(chip.textContent.trim());
      });
    });

    if (sendBtn && copilotInput) {
      sendBtn.addEventListener('click', () => {
        const text = copilotInput.value.trim();
        if (text) {
          sendToCopilot(text);
          copilotInput.value = '';
        }
      });
    }

    if (copilotInput) {
      copilotInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const text = copilotInput.value.trim();
          if (text) {
            sendToCopilot(text);
            copilotInput.value = '';
          }
        }
      });
    }

    if (micBtn) {
      micBtn.addEventListener('click', () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
          const rec = new SpeechRec();
          rec.lang = 'es-ES';
          showToast('🎙️ Escuchando... Di tu pregunta ahora', 'info');
          rec.onresult = (evt) => {
            const transcript = evt.results[0][0].transcript;
            if (copilotInput) copilotInput.value = transcript;
            sendToCopilot(transcript);
          };
          rec.start();
        } else {
          showToast('Simulando dictado: "Explícame el teorema de Bolzano"', 'info');
          if (copilotInput) copilotInput.value = 'Explícame el teorema de Bolzano';
          sendToCopilot('Explícame el teorema de Bolzano');
        }
      });
    }
  }

  // =========================================================================
  // 8. FLASHCARDS LEITNER (GIRAR Y CALIFICAR)
  // =========================================================================
  function initFlashcards() {
    const flashcards = [
      { q: "¿Qué establece la Regla de Sarrus?", a: "Permite calcular determinantes de orden 3 multiplicando diagonales principales menos secundarias.", cat: "Matemáticas II" },
      { q: "Enuncia la Ley de Lenz", a: "El sentido de las corrientes inducidas es tal que se opone a la variación del flujo magnético que las produce.", cat: "Física II" },
      { q: "¿En qué año se promulgó la Constitución de Cádiz ('La Pepa')?", a: "El 19 de marzo de 1812 durante la Guerra de la Independencia española.", cat: "Historia de España" }
    ];
    let cardIdx = 0;

    const cards = Array.from(document.querySelectorAll('div.bg-surface-card, div.rounded-2xl'));
    const flashCardContainer = cards.find(c => (c.textContent || '').includes('¿') || (c.textContent || '').includes('Flashcard'));

    if (flashCardContainer) {
      flashCardContainer.style.cursor = 'pointer';
      flashCardContainer.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const hiddenAnswer = flashCardContainer.querySelector('.text-slate-400, .hidden, p.font-body-md:last-child');
        if (hiddenAnswer) {
          hiddenAnswer.classList.toggle('hidden');
          showToast('🔄 Ficha girada (Respuesta visible)', 'info');
        }
      });
    }

    // Botones de calificación (Fácil, Bien, Difícil)
    const reviewBtns = findElementsByText('button', 'Fácil')
      .concat(findElementsByText('button', 'Bien'))
      .concat(findElementsByText('button', 'Difícil'));

    reviewBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        cardIdx = (cardIdx + 1) % flashcards.length;
        const qEl = flashCardContainer ? flashCardContainer.querySelector('h2, h3, p.font-headline-md') : null;
        if (qEl) {
          qEl.textContent = flashcards[cardIdx].q;
        }
        showToast(`🧠 Ficha registrada: ${btn.textContent.trim()} (+1 Repasada)`, 'success');
      });
    });
  }

  // =========================================================================
  // 9. CUADERNO LM: REPRODUCTOR DE PODCAST DE ESTUDIO
  // =========================================================================
  function initPodcastPlayer() {
    const playBtns = findElementsByText('button', '▶').concat(Array.from(document.querySelectorAll('button[title*="Podcast"], button:has(span.material-symbols-outlined)')));
    const playBtn = playBtns.find(b => (b.textContent || '').includes('▶') || (b.closest('div') && (b.closest('div').textContent || '').includes('Podcast')));
    
    let isPlaying = false;
    let podcastInterval = null;
    let secondsElapsed = 0;

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        isPlaying = !isPlaying;
        if (isPlaying) {
          playBtn.innerHTML = playBtn.innerHTML.replace('play_arrow', 'pause').replace('▶', '⏸');
          showToast('🎙️ Reproduciendo podcast: "Lucía & Mateo debaten Faraday y Lenz"', 'success');
          podcastInterval = setInterval(() => {
            secondsElapsed++;
            const parent = playBtn.closest('div');
            const timeEl = parent ? parent.querySelector('.font-mono, .text-xs') : null;
            if (timeEl && timeEl.textContent.includes(':')) {
              const m = Math.floor(secondsElapsed / 60);
              const s = (secondsElapsed % 60).toString().padStart(2, '0');
              timeEl.textContent = `${m}:${s} / 14:15`;
            }
          }, 1000);
        } else {
          playBtn.innerHTML = playBtn.innerHTML.replace('pause', 'play_arrow').replace('⏸', '▶');
          clearInterval(podcastInterval);
          showToast('⏸️ Podcast pausado', 'info');
        }
      });
    }
  }

  // =========================================================================
  // 10. MODAL DE CÁMARA OCR
  // =========================================================================
  function createCameraOCRModal() {
    if (document.getElementById('stitch-camera-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'stitch-camera-modal';
    modal.className = 'fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md hidden flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-slate-900 text-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-800 flex flex-col">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-rose-500">photo_camera</span>
            <h3 class="font-bold text-sm">Escáner OCR de Pizarra & Apuntes</h3>
          </div>
          <button id="stitch-close-ocr-modal" class="text-slate-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div class="relative w-full aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
          <video id="stitch-camera-video" autoplay playsinline class="w-full h-full object-cover hidden"></video>
          <div id="stitch-camera-placeholder" class="text-center p-6 space-y-2">
            <span class="material-symbols-outlined text-[48px] text-slate-600 animate-pulse">document_scanner</span>
            <p class="text-xs text-slate-400">Enfoca la pizarra o tu cuaderno de apuntes</p>
          </div>
          <!-- Cuadrícula guía -->
          <div class="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-20 border border-white/20">
            <div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div>
          </div>
        </div>
        <div class="p-4 bg-slate-950 flex items-center justify-between gap-4">
          <button id="stitch-ocr-engine-btn" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300">
            Motor: ML Kit Local
          </button>
          <button id="stitch-capture-shutter" class="w-12 h-12 rounded-full bg-white text-slate-900 font-bold flex items-center justify-center shadow-lg active:scale-95 transition-transform" title="Hacer foto">
            📸
          </button>
          <button id="stitch-use-sample-btn" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500">
            Escanear Pizarra
          </button>
        </div>
        <div id="stitch-ocr-result-box" class="p-3 bg-slate-800/80 text-xs font-mono text-emerald-400 border-t border-slate-700 hidden">
          ✅ Texto OCR detectado: "ε = - dΦ/dt • Problemas 14 al 22 Termodinámica"
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      modal.classList.add('hidden');
      const video = modal.querySelector('#stitch-camera-video');
      if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
      }
    };

    modal.querySelector('#stitch-close-ocr-modal').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    const startCamera = async () => {
      const video = modal.querySelector('#stitch-camera-video');
      const placeholder = modal.querySelector('#stitch-camera-placeholder');
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          video.srcObject = stream;
          video.classList.remove('hidden');
          placeholder.classList.add('hidden');
        }
      } catch (err) {
        console.log('Cámara simulada.');
      }
    };

    modal.querySelector('#stitch-capture-shutter').addEventListener('click', () => {
      playBeep();
      const resBox = modal.querySelector('#stitch-ocr-result-box');
      resBox.classList.remove('hidden');
      showToast('📸 Foto capturada y procesada con OCR', 'success');
      setTimeout(() => {
        close();
        showToast('📝 Nuevo apunte generado en Cuaderno LM', 'success');
      }, 1500);
    });

    modal.querySelector('#stitch-use-sample-btn').addEventListener('click', () => {
      modal.querySelector('#stitch-capture-shutter').click();
    });

    return { modal, startCamera };
  }

  function openCameraOCR() {
    const { modal, startCamera } = createCameraOCRModal();
    modal.classList.remove('hidden');
    startCamera();
  }

  // =========================================================================
  // 11. ENLACE DE BOTONES DE LA CABECERA Y ACCIONES RÁPIDAS
  // =========================================================================
  function bindGlobalButtons() {
    // 11.1. Pomodoro Play/Pause en barra superior y floating pill
    document.querySelectorAll('button[title*="Pomodoro"], #pomodoroToggleBtn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        Pomodoro.toggle();
      });
    });

    const floatingPomodoro = findElementsByText('button', 'Iniciar Enfoque')[0] || findElementsByText('button', 'Iniciar Pomodoro')[0];
    if (floatingPomodoro) {
      floatingPomodoro.addEventListener('click', (e) => {
        e.preventDefault();
        Pomodoro.toggle();
      });
    }

    // 11.2. Botón OCR en la cabecera
    const ocrBtns = findElementsByText('button', 'OCR');
    ocrBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openCameraOCR();
      });
    });

    // 11.3. Botón "Dictar" en la cabecera
    const dictarBtns = findElementsByText('button', 'Dictar');
    dictarBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
          const rec = new SpeechRec();
          rec.lang = 'es-ES';
          showToast('🎙️ Dictado activo. Habla para añadir una nota...', 'info');
          rec.onresult = (evt) => {
            const transcript = evt.results[0][0].transcript;
            showToast(`📝 Dictado reconocido: "${transcript}"`, 'success');
          };
          rec.start();
        } else {
          showToast('🎙️ Dictado por voz activado (Micrófono listo)', 'info');
        }
      });
    });

    // 11.4. Botón "Nueva Tarea" en la cabecera
    const newTaskBtns = findElementsByText('button', 'Nueva Tarea');
    newTaskBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openNewTaskModal();
      });
    });

    // 11.5. Input de búsqueda en cabecera + atajo ⌘K / Ctrl+K
    const searchInputs = document.querySelectorAll('header input[placeholder*="Buscar"], input[placeholder*="Buscar asignaturas"]');
    searchInputs.forEach(inp => {
      inp.addEventListener('focus', (e) => {
        e.preventDefault();
        inp.blur();
        openSearchModal();
      });
    });

    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearchModal();
      } else if (e.key === 'Escape') {
        closeSearchModal();
      }
    });

    // 11.6. Botón colapsar menú lateral
    const collapseBtn = document.querySelector('button[aria-label="Colapsar menú lateral"]');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        const aside = document.querySelector('aside');
        const mainContent = document.querySelector('.pl-sidebar-width');
        const header = document.querySelector('header.left-sidebar-width, header.fixed');
        if (aside) {
          const isCollapsed = aside.classList.toggle('w-[68px]');
          aside.classList.toggle('w-sidebar-width');
          if (mainContent) mainContent.classList.toggle('pl-[68px]');
          if (header && header.classList.contains('left-sidebar-width')) header.classList.toggle('left-[68px]');
          showToast(isCollapsed ? 'Menú lateral colapsado' : 'Menú lateral expandido', 'info');
        }
      });
    }

    // 11.7. Botón Notificaciones
    const notifBtn = document.querySelector('button[aria-label="Notificaciones"]');
    if (notifBtn) {
      notifBtn.addEventListener('click', () => {
        showToast('🔔 2 Alertas: Examen Matemáticas II (Lunes 28) • Entrega de Física (Mañana)', 'info');
      });
    }

    // 11.8. Botón Sincronizar
    const syncBtns = findElementsByText('button', 'Sincronizar');
    syncBtns.forEach(b => {
      b.addEventListener('click', () => {
        showToast('☁️ Sincronizando con Google Drive y Firebase...', 'info');
        setTimeout(() => {
          showToast('✅ Datos sincronizados correctamente (100% al día)', 'success');
        }, 1200);
      });
    });

    // 11.9. Botón Personalizar Día
    const customBtns = findElementsByText('button', 'Personalizar Día');
    customBtns.forEach(b => {
      b.addEventListener('click', () => {
        showToast('⚙️ Abriendo configuración de vista del día...', 'info');
      });
    });

    // 11.10. Botón "Ver horario semanal completo"
    const scheduleBtns = findElementsByText('button', 'horario semanal');
    scheduleBtns.forEach(b => {
      b.addEventListener('click', () => {
        const prefix = window.location.pathname.includes('/tablet') ? '' : window.location.pathname.includes('/mobile') ? '' : '';
        window.location.href = window.location.pathname.includes('/tablet') ? 'horario-mochila.html' : 'horario-mochila.html';
      });
    });

    // 11.11. Botón "Apuntes" en clase activa
    const notesBtns = findElementsByText('button', 'Apuntes');
    notesBtns.forEach(b => {
      b.addEventListener('click', () => {
        window.location.href = window.location.pathname.includes('/tablet') ? 'cuaderno-lm.html' : 'notebook.html';
      });
    });

    // 11.12. Botón "Generar Test IA con Cuaderno LM"
    const testGenBtns = findElementsByText('button', 'Generar Test IA');
    testGenBtns.forEach(b => {
      b.addEventListener('click', () => {
        window.location.href = window.location.pathname.includes('/tablet') ? 'cuaderno-lm.html' : 'notebook.html';
      });
    });

    // 11.13. Botón "Repasar →"
    const reviewBtns = findElementsByText('button', 'Repasar');
    reviewBtns.forEach(b => {
      b.addEventListener('click', () => {
        window.location.href = window.location.pathname.includes('/tablet') ? 'pomodoro-flashcards.html' : 'pomodoro-flashcards.html';
      });
    });
  }

  // =========================================================================
  // 12. INICIALIZACIÓN AL CARGAR EL DOM
  // =========================================================================
  function initAll() {
    bindGlobalButtons();
    initTasks();
    initBackpack();
    initCopilot();
    initFlashcards();
    initPodcastPlayer();
    createSearchModal();
    createNewTaskModal();
    createCameraOCRModal();
    Pomodoro.updateDisplays();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

})();
