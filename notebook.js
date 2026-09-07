/**
 * notebook.js - Motor Inteligente de Estudio Estilo NotebookLM
 * 
 * Capacidades:
 * 1. Gestión de Fuentes (Sources): Textos, fotos de pizarra y apuntes.
 * 2. Grounded Chat: Chat con citas obligatorias [Fuente X].
 * 3. Studio Pedagógico:
 *    - Guía de Estudio estructurada.
 *    - Preguntas de Examen interactivas (Quiz).
 *    - Generador de Fichas de Estudio con exportación a la Agenda Escolar.
 *    - Audio Overview / Podcast de Estudio narrado en voz alta con Web Speech API.
 *    - Resumen Ejecutivo.
 */

import { saveItem, getAll } from './db.js';
import { createFlashcard } from './flashcards.js';

// Clave de API de Gemini compartida con la agenda
const GEMINI_STORAGE_KEY = 'gemini_api_key';
const NOTEBOOK_SOURCES_KEY = 'notebook_sources_v1';

// Estado de la aplicación Cuaderno LM
const NotebookState = {
  sources: [],
  activeSourceIds: new Set(),
  chatHistory: [],
  isAudioPlaying: false,
  currentAudioScript: '',
  audioUtterance: null,
  audioSpeed: 1.0
};

// Cargar fuentes almacenadas o sembrar ejemplos
function loadSources() {
  try {
    const raw = localStorage.getItem(NOTEBOOK_SOURCES_KEY);
    if (raw) {
      NotebookState.sources = JSON.parse(raw);
    }
  } catch (e) {
    NotebookState.sources = [];
  }

  // Si no hay fuentes, sembrar apuntes de ejemplo
  if (!NotebookState.sources || NotebookState.sources.length === 0) {
    NotebookState.sources = [
      {
        id: 'src_1',
        title: 'Historia del Arte: La Arquitectura Gótica',
        type: 'text',
        content: `TEMA 4: LA ARQUITECTURA GÓTICA (Siglos XII - XV)
1. Contexto Histórico:
Surge en la región de Île-de-France (Francia) a mediados del siglo XII. Coincide con el renacer de las ciudades, el auge de la burguesía y las universidades.
2. Elementos Constructivos Fundamentales:
- Arco apuntado u ojival: Distribuye mejor las presiones laterales que el arco de medio punto románico.
- Bóveda de crucería: Formada por el cruce de arcos ojivales. Concentra el peso en cuatro puntos específicos.
- Arbotantes y contrafuertes exteriores: Arbotantes transmiten el empuje de las bóvedas hacia contrafuertes exteriores con pináculos.
- Desmaterialización del muro: Al liberar al muro de soportar el peso, se abren inmensos ventanales con vidrieras policromadas.
3. Filosofía de la Luz:
La luz gótica representa la manifestación de la divinidad (Teología de la Luz del Abad Suger de Saint-Denis).
4. Edificios Clave:
Catedral de Saint-Denis, Notre Dame de París, Catedral de Chartres, y en España las catedrales de Burgos, Toledo y León.`,
        date: new Date().toLocaleDateString('es-ES'),
        active: true
      },
      {
        id: 'src_2',
        title: 'Biología: La Célula y la Mitosis',
        type: 'text',
        content: `UNIDAD 2: LA DIVISIÓN CELULAR Y LA MITOSIS
1. El Ciclo Celular:
Consta de Interfase (G1, S donde se duplica el ADN, G2) y Fase M (Mitosis y Citocinesis).
2. Fases de la Mitosis:
- Profase: La cromatina se condensa en cromosomas visibles. Desaparece la envoltura nuclear. Se forma el huso acromático.
- Metafase: Los cromosomas se alinean en el plano ecuatorial de la célula unidos a los microtúbulos por el cinetocoro.
- Anafase: Las cromátidas hermanas se separan y son arrastradas hacia los polos opuestos.
- Telofase: Se reconstruyen las envolturas nucleares alrededor de cada juego cromosómico. Los cromosomas se descondensan.
3. Importancia Biológica:
Permite el crecimiento de organismos pluricelulares, la reparación de tejidos y la reproducción asexual en organismos unicelulares. Produce dos células hijas genéticamente idénticas (2n).`,
        date: new Date().toLocaleDateString('es-ES'),
        active: true
      }
    ];
    saveSources();
  }

  // Activar todas por defecto
  NotebookState.sources.forEach(s => NotebookState.activeSourceIds.add(s.id));
}

function saveSources() {
  localStorage.setItem(NOTEBOOK_SOURCES_KEY, JSON.stringify(NotebookState.sources));
}

function getApiKey() {
  return localStorage.getItem(GEMINI_STORAGE_KEY) || '';
}

// ==========================================================================
// RENDERIZADO DE FUENTES
// ==========================================================================
function renderSourcesList() {
  const container = document.getElementById('sources-list-container');
  const countBadge = document.getElementById('sources-count-badge');
  const mobileCount = document.getElementById('mobile-sources-count');
  if (!container) return;

  const count = NotebookState.sources.length;
  if (countBadge) countBadge.textContent = String(count);
  if (mobileCount) mobileCount.textContent = String(count);

  if (count === 0) {
    container.innerHTML = `
      <div class="empty-sources">
        <p>📂 <strong>No hay fuentes añadidas</strong></p>
        <p style="margin-top: 6px;">Pulsa en <strong>➕ Añadir Fuente</strong> para pegar apuntes de clase o subir fotos de la pizarra.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = NotebookState.sources.map((src, index) => {
    const isChecked = NotebookState.activeSourceIds.has(src.id);
    return `
      <div class="source-card ${isChecked ? 'selected' : ''}" data-source-id="${src.id}">
        <div class="source-header">
          <input type="checkbox" class="source-checkbox" data-source-checkbox="${src.id}" ${isChecked ? 'checked' : ''} style="margin-top: 3px; cursor: pointer;" />
          <span class="source-icon">${src.type === 'image' ? '📸' : '📝'}</span>
          <div class="source-info">
            <div class="source-title" title="${src.title}">${src.title}</div>
            <div class="source-meta">Fuente ${index + 1} • ${src.date || 'Reciente'}</div>
          </div>
          <button type="button" class="btn-delete-source" data-delete-source="${src.id}" title="Eliminar fuente">✕</button>
        </div>
        <div class="source-preview">${src.content || '(Foto / Imagen cargada)'}</div>
      </div>
    `;
  }).join('');

  // Listeners de checkboxes
  container.querySelectorAll('[data-source-checkbox]').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-source-checkbox');
      if (e.target.checked) {
        NotebookState.activeSourceIds.add(id);
      } else {
        NotebookState.activeSourceIds.delete(id);
      }
      renderSourcesList();
      updateStudioStatus();
    });
  });

  // Listeners de eliminación
  container.querySelectorAll('[data-delete-source]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-delete-source');
      if (confirm('¿Deseas eliminar esta fuente de estudio?')) {
        NotebookState.sources = NotebookState.sources.filter(s => s.id !== id);
        NotebookState.activeSourceIds.delete(id);
        saveSources();
        renderSourcesList();
        updateStudioStatus();
      }
    });
  });
}

function updateStudioStatus() {
  const status = document.getElementById('studio-status');
  if (status) {
    const activeCount = NotebookState.activeSourceIds.size;
    status.textContent = `${activeCount} fuente(s) activa(s) seleccionada(s) para análisis.`;
  }
}

// Obtiene el texto de todas las fuentes activas estructurado para Gemini
function getActiveSourcesContext() {
  const activeSources = NotebookState.sources.filter(s => NotebookState.activeSourceIds.has(s.id));
  if (activeSources.length === 0) return '';

  return activeSources.map((s, idx) => {
    return `[FUENTE ${idx + 1}: "${s.title}"]:\n${s.content}\n[FIN DE FUENTE ${idx + 1}]`;
  }).join('\n\n');
}

// ==========================================================================
// LLAMADAS A GEMINI CON GROUNDING ESTRICTO
// ==========================================================================
async function callGroundedGemini(systemInstruction, userPrompt) {
  const apiKey = getApiKey();
  const context = getActiveSourcesContext();

  if (!context) {
    throw new Error('Debes seleccionar al menos una fuente activa en el panel izquierdo.');
  }

  if (!apiKey) {
    // Si no hay clave, fallback a generador local
    return generateLocalFallback(userPrompt, context);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const fullPrompt = `${systemInstruction}

AQUÍ ESTÁN LAS FUENTES DISPONIBLES:
${context}

SOLICITUD DEL ESTUDIANTE:
${userPrompt}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }]
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Error con Gemini (${response.status})`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Fallback local en caso de estar offline o sin clave
function generateLocalFallback(promptType, context) {
  return `### 📖 Síntesis Extraída de tus Fuentes (Modo Offline)

> **Nota:** Para generar análisis pedagógicos avanzados y podcast narrativo con Gemini Flash, añade tu clave gratuita en el botón **⚙️ Clave IA**.

#### Puntos Clave Detectados:
${context.split('\n')
  .filter(l => l.trim().startsWith('-') || l.trim().startsWith('•') || l.includes(':'))
  .slice(0, 10)
  .map(l => `• ${l.trim().replace(/^[\-\•]\s*/, '')}`)
  .join('\n')}

#### Resumen General:
El contenido abarca las fuentes seleccionadas en tu cuaderno. Puedes estudiarlo, repasarlo y memorizar los términos clave arriba indicados.`;
}

// ==========================================================================
// HERRAMIENTAS DE ESTUDIO (STUDIO)
// ==========================================================================

// 1. Guía de Estudio
async function handleGenerateStudyGuide() {
  showStudioLoading('📖 Creando Guía de Estudio Completa...');

  try {
    const system = `Actúa como un profesor experto y crea una "Guía de Estudio" exhaustiva, estructurada y pedagógica.
Tu respuesta debe estar BASADA ESTRICTAMENTE en las fuentes dadas.
Incluye:
1. Resumen General del Tema.
2. Glosario de Conceptos y Términos Clave.
3. Ideas Principales y Cronología / Pasos si corresponde.
4. Preguntas Esenciales que el alumno debe saber responder para aprobar.
Cita siempre las fuentes utilizadas con formato [Fuente X].`;

    const text = await callGroundedGemini(system, 'Genera la guía de estudio.');
    renderArtifactCard('📖 Guía de Estudio Completa', text);
  } catch (err) {
    renderArtifactCard('⚠️ Error al generar', `<p style="color:var(--accent-rose);">${err.message}</p>`);
  }
}

// 2. Preguntas de Examen (Quiz)
async function handleGenerateQuiz() {
  showStudioLoading('❓ Diseñando Examen de Autoevaluación...');

  try {
    const system = `Genera un examen de prueba / quiz para que el estudiante evalúe sus conocimientos basándose ÚNICAMENTE en las fuentes.
Incluye:
- 3 Preguntas de opción múltiple (Tipo test A, B, C, D) con la solución explicada.
- 2 Preguntas de desarrollo corto.
Cita la fuente de donde sale cada pregunta con [Fuente X].`;

    const text = await callGroundedGemini(system, 'Genera el examen de prueba con preguntas y respuestas explicadas.');
    renderArtifactCard('❓ Simulacro de Examen y Preguntas Clave', text);
  } catch (err) {
    renderArtifactCard('⚠️ Error al generar', `<p style="color:var(--accent-rose);">${err.message}</p>`);
  }
}

// 3. Fichas de Estudio (Flashcards)
async function handleGenerateFlashcards() {
  showStudioLoading('🎴 Generando Fichas de Repaso Leitner...');

  try {
    const system = `Extrae entre 4 y 6 fichas de estudio (pregunta y respuesta directa) a partir de las fuentes.
Formato para cada ficha:
**Ficha X:**
- **Pregunta:** ...
- **Respuesta:** ...
- **Pista:** ...
Cita las fuentes [Fuente X].`;

    const text = await callGroundedGemini(system, 'Crea fichas de estudio para repasar conceptos clave.');
    renderArtifactCard('🎴 Fichas de Estudio Extraídas', text, true);
  } catch (err) {
    renderArtifactCard('⚠️ Error al generar', `<p style="color:var(--accent-rose);">${err.message}</p>`);
  }
}

// 4. Resumen Ejecutivo
async function handleGenerateSummary() {
  showStudioLoading('⚡ Extrayendo Resumen Ejecutivo...');

  try {
    const system = `Crea un resumen conciso, directo y visual en viñetas de las fuentes proporcionadas. Destaca cifras, nombres y conceptos vitales.`;
    const text = await callGroundedGemini(system, 'Haz un resumen ejecutivo rápido.');
    renderArtifactCard('⚡ Resumen Ejecutivo Rápido', text);
  } catch (err) {
    renderArtifactCard('⚠️ Error al generar', `<p style="color:var(--accent-rose);">${err.message}</p>`);
  }
}

// 5. Podcast de Estudio / Audio Overview
async function handleGenerateAudioOverview() {
  showStudioLoading('🎙️ Creando Guion del Podcast de Estudio...');

  try {
    const system = `Actúa como dos estudiantes inteligentes y simpáticos (Mario y Lucía) que están repasando juntos la lección antes del examen.
Escribe un diálogo dinámico, entretenido, claro y coloquial donde se expliquen todos los puntos clave de las fuentes.
Estructura el diálogo alternando líneas cortas como:
Mario: ...
Lucía: ...`;

    const script = await callGroundedGemini(system, 'Crea el diálogo explicativo tipo podcast de las fuentes.');

    // Mostrar reproductor de audio
    const audioCard = document.getElementById('audio-overview-container');
    const snippet = document.getElementById('audio-transcript-snippet');
    if (audioCard) audioCard.classList.remove('hidden');
    if (snippet) snippet.textContent = script.substring(0, 220) + '...';

    NotebookState.currentAudioScript = script;
    renderArtifactCard('🎙️ Guion del Podcast de Estudio', script);

    // Iniciar lectura automática si el usuario lo desea
    playAudioOverview(script);
  } catch (err) {
    renderArtifactCard('⚠️ Error al generar podcast', `<p style="color:var(--accent-rose);">${err.message}</p>`);
  }
}

// Reproduce el podcast de estudio con SpeechSynthesis
function playAudioOverview(text) {
  if (!('speechSynthesis' in window)) {
    alert('Tu navegador no cuenta con soporte de síntesis de voz.');
    return;
  }

  stopAudioOverview();

  // Limpiar formato para lectura fluida
  const clean = text
    .replace(/Mario:\s*/gi, '')
    .replace(/Lucía:\s*/gi, '')
    .replace(/\[Fuente\s*\d+\]/gi, '')
    .replace(/[\*#_]/g, '')
    .trim();

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'es-ES';
  utterance.rate = NotebookState.audioSpeed || 1.0;

  utterance.onend = () => {
    NotebookState.isAudioPlaying = false;
    updateAudioPlayButton();
  };

  utterance.onerror = () => {
    NotebookState.isAudioPlaying = false;
    updateAudioPlayButton();
  };

  NotebookState.audioUtterance = utterance;
  NotebookState.isAudioPlaying = true;
  window.speechSynthesis.speak(utterance);
  updateAudioPlayButton();
}

function stopAudioOverview() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  NotebookState.isAudioPlaying = false;
  NotebookState.audioUtterance = null;
  updateAudioPlayButton();
}

function updateAudioPlayButton() {
  const btn = document.getElementById('btn-audio-play-pause');
  if (btn) {
    btn.innerHTML = NotebookState.isAudioPlaying ? '⏸️ Pausar' : '▶️ Reproducir';
  }
}

// ==========================================================================
// RENDERIZADOR DE ARTEFACTOS Y FORMATEO
// ==========================================================================
function switchToMobileStudio() {
  if (window.innerWidth <= 900) {
    document.querySelectorAll('.mobile-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-mobile-view') === 'col-studio');
    });
    document.querySelectorAll('.col-sources, .col-studio, .col-chat').forEach(col => {
      col.classList.remove('active-mobile-view');
    });
    document.getElementById('col-studio')?.classList.add('active-mobile-view');
  }
}

function showStudioLoading(message) {
  switchToMobileStudio();
  const welcome = document.getElementById('studio-welcome-card');
  if (welcome) welcome.classList.add('hidden');

  const container = document.getElementById('artifact-dynamic-container');
  if (container) {
    container.innerHTML = `
      <div class="generated-artifact-card" style="text-align:center; padding: 40px 20px;">
        <div style="font-size: 2rem; margin-bottom: 12px; animation: spin 1s infinite linear;">✨</div>
        <p style="font-weight: 700; color: #fff;">${message}</p>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px;">Analizando tus fuentes y sintetizando el contenido...</p>
      </div>
    `;
  }
}

function renderArtifactCard(title, markdownContent, hasExportButton = false) {
  const container = document.getElementById('artifact-dynamic-container');
  if (!container) return;

  const html = formatMarkdownToHTML(markdownContent);

  container.innerHTML = `
    <div class="generated-artifact-card">
      <div class="artifact-header">
        <h3>${title}</h3>
        <div class="artifact-actions">
          ${hasExportButton ? `
            <button type="button" id="btn-export-to-agenda-flashcards" class="btn-header-action" style="background:#10b981; color:#fff; border:none;" title="Añadir estas fichas al mazo de la Agenda Escolar">
              📥 Exportar a Agenda
            </button>
          ` : ''}
          <button type="button" class="btn-header-action" id="btn-copy-artifact">
            📋 Copiar
          </button>
        </div>
      </div>
      <div class="artifact-body">
        ${html}
      </div>
    </div>
  `;

  // Copiar
  document.getElementById('btn-copy-artifact')?.addEventListener('click', () => {
    navigator.clipboard.writeText(markdownContent).then(() => {
      alert('📋 Contenido copiado al portapapeles.');
    });
  });

  // Exportar fichas a la agenda escolar
  document.getElementById('btn-export-to-agenda-flashcards')?.addEventListener('click', async () => {
    try {
      // Parsear preguntas y respuestas del markdown
      const regex = /Pregunta:\s*(.*?)\n\s*-\s*Respuesta:\s*(.*?)(?:\n\s*-\s*Pista:\s*(.*?))?(?=\n\s*\*\*Ficha|\n\s*$)/gs;
      let match;
      let count = 0;

      while ((match = regex.exec(markdownContent)) !== null) {
        const front = match[1].trim();
        const back = match[2].trim();
        const hint = match[3] ? match[3].trim() : '';

        if (front && back) {
          const card = createFlashcard({
            subjectId: 'sub_general',
            front,
            back,
            hint
          });
          await saveItem('flashcards', card);
          count++;
        }
      }

      if (count > 0) {
        alert(`🎉 ¡${count} fichas de estudio han sido exportadas a tu mazo de la Agenda Escolar!`);
      } else {
        alert('Guarda el texto manualmente o cópialo en tu mazo.');
      }
    } catch (e) {
      alert('Error exportando fichas: ' + e.message);
    }
  });
}

function formatMarkdownToHTML(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Citas tipo [Fuente 1]
  html = html.replace(/\[Fuente\s*(\d+)\]/gi, '<span class="chat-citation" title="Cita a la Fuente $1">[Fuente $1]</span>');

  // Encabezados
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Negrita y Cursiva
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Listas
  html = html.replace(/^\s*[\-\•]\s+(.*)/gim, '<li>$1</li>');

  return html;
}

// ==========================================================================
// CHAT BASADO EN FUENTES (GROUNDED CHAT)
// ==========================================================================
async function handleSendChatMessage() {
  const input = document.getElementById('chat-input');
  const query = (input?.value || '').trim();
  if (!query) return;

  const messagesContainer = document.getElementById('chat-messages');

  // 1. Mensaje del usuario
  appendChatBubble('user', query);
  input.value = '';

  // 2. Indicador de pensando
  const thinkingBubble = document.createElement('div');
  thinkingBubble.className = 'chat-bubble chat-bubble-bot';
  thinkingBubble.innerHTML = '<span>✨ Buscando en tus fuentes...</span>';
  messagesContainer.appendChild(thinkingBubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const system = `Eres el asistente de Cuaderno LM. Tu misión es responder a las preguntas del alumno basándote ESTRICTAMENTE en las fuentes provistas.
REGLAS:
- Si la información está en las fuentes, responde con claridad y añade citas explícitas en formato [Fuente X].
- Si la información NO aparece en las fuentes cargadas, dilo honestamente: "Esta información no aparece en los apuntes cargados."`;

    const reply = await callGroundedGemini(system, query);
    thinkingBubble.remove();
    appendChatBubble('bot', reply);
  } catch (err) {
    thinkingBubble.remove();
    appendChatBubble('bot', `⚠️ No se pudo responder: ${err.message}`);
  }
}

function appendChatBubble(role, text) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble chat-bubble-${role}`;
  bubble.innerHTML = formatMarkdownToHTML(text);

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

// ==========================================================================
// INICIALIZACIÓN Y EVENTOS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadSources();
  renderSourcesList();
  updateStudioStatus();

  // Navegación en móvil
  document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mobile-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetId = btn.getAttribute('data-mobile-view');
      document.querySelectorAll('.col-sources, .col-studio, .col-chat').forEach(col => {
        col.classList.remove('active-mobile-view');
      });
      document.getElementById(targetId)?.classList.add('active-mobile-view');
    });
  });

  // Modal Añadir Fuente
  const modalAdd = document.getElementById('modal-add-source');
  const btnOpenAdd = document.getElementById('btn-open-add-source');
  const btnCloseAdd = document.getElementById('btn-close-source-modal');
  const btnCancelAdd = document.getElementById('btn-cancel-add-source');
  const formAdd = document.getElementById('form-add-source');
  const selectType = document.getElementById('source-type-select');
  const groupText = document.getElementById('group-source-text');
  const groupFile = document.getElementById('group-source-file');

  btnOpenAdd?.addEventListener('click', () => modalAdd?.classList.remove('hidden'));
  btnCloseAdd?.addEventListener('click', () => modalAdd?.classList.add('hidden'));
  btnCancelAdd?.addEventListener('click', () => modalAdd?.classList.add('hidden'));

  selectType?.addEventListener('change', (e) => {
    if (e.target.value === 'image') {
      groupText.classList.add('hidden');
      groupFile.classList.remove('hidden');
    } else {
      groupText.classList.remove('hidden');
      groupFile.classList.add('hidden');
    }
  });

  formAdd?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('source-title-input').value.trim();
    const type = selectType.value;
    const textContent = document.getElementById('source-content-input').value.trim();
    const fileInput = document.getElementById('source-file-input');

    if (type === 'text' && !textContent) {
      alert('Por favor introduce el texto o apuntes.');
      return;
    }

    const newSource = {
      id: `src_${Date.now()}`,
      title: title || 'Apuntes sin título',
      type: type,
      content: textContent || 'Fotografía adjunta',
      date: new Date().toLocaleDateString('es-ES'),
      active: true
    };

    NotebookState.sources.unshift(newSource);
    NotebookState.activeSourceIds.add(newSource.id);
    saveSources();
    renderSourcesList();
    updateStudioStatus();

    // Resetear form y cerrar
    formAdd.reset();
    modalAdd.classList.add('hidden');
  });

  // Configuración de clave IA
  document.getElementById('btn-config-key')?.addEventListener('click', () => {
    const curr = getApiKey();
    const key = prompt('Introduce tu API Key gratuita de Google Gemini (de https://aistudio.google.com/):', curr || '');
    if (key !== null) {
      if (key.trim()) {
        localStorage.setItem(GEMINI_STORAGE_KEY, key.trim());
        alert('🔑 Clave de Gemini guardada.');
      } else {
        localStorage.removeItem(GEMINI_STORAGE_KEY);
        alert('Clave eliminada.');
      }
    }
  });

  // Botón Nuevo Cuaderno
  document.getElementById('btn-new-notebook')?.addEventListener('click', () => {
    if (confirm('¿Deseas vaciar las fuentes actuales para iniciar un nuevo cuaderno de estudio?')) {
      NotebookState.sources = [];
      NotebookState.activeSourceIds.clear();
      saveSources();
      renderSourcesList();
      updateStudioStatus();
      document.getElementById('studio-welcome-card')?.classList.remove('hidden');
      document.getElementById('artifact-dynamic-container').innerHTML = '';
      document.getElementById('audio-overview-container')?.classList.add('hidden');
      stopAudioOverview();
    }
  });

  // Botones de Herramientas del Studio
  document.getElementById('btn-tool-guide')?.addEventListener('click', handleGenerateStudyGuide);
  document.getElementById('btn-tool-quiz')?.addEventListener('click', handleGenerateQuiz);
  document.getElementById('btn-tool-flashcards')?.addEventListener('click', handleGenerateFlashcards);
  document.getElementById('btn-tool-summary')?.addEventListener('click', handleGenerateSummary);
  document.getElementById('btn-tool-podcast')?.addEventListener('click', handleGenerateAudioOverview);

  // Controles de Audio Overview
  document.getElementById('btn-audio-play-pause')?.addEventListener('click', () => {
    if (NotebookState.isAudioPlaying) {
      stopAudioOverview();
    } else if (NotebookState.currentAudioScript) {
      playAudioOverview(NotebookState.currentAudioScript);
    }
  });

  document.getElementById('audio-speed-select')?.addEventListener('change', (e) => {
    NotebookState.audioSpeed = parseFloat(e.target.value) || 1.0;
    if (NotebookState.isAudioPlaying && NotebookState.currentAudioScript) {
      playAudioOverview(NotebookState.currentAudioScript);
    }
  });

  // Chat
  document.getElementById('chat-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSendChatMessage();
  });

  document.getElementById('btn-clear-chat')?.addEventListener('click', () => {
    const container = document.getElementById('chat-messages');
    if (container) {
      container.innerHTML = '<div class="chat-bubble chat-bubble-bot">👋 Conversación reiniciada. Pregúntame lo que quieras sobre tus fuentes.</div>';
    }
  });
});
