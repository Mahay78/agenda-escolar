/**
 * ai-tools.js - Herramientas de IA de estudio de la Agenda Escolar
 *
 * Implementa los items del roadmap:
 *  - 2:  Preguntas de desarrollo con calificación y rúbrica.
 *  - 3:  Detección de deberes a partir de una foto de la pizarra.
 *  - 4:  Escaneo del horario en papel a partir de una foto.
 *  - 8:  Creador de esquemas y mapas conceptuales.
 *  - 18: Técnica Feynman guiada.
 *  - 59: Simulador de examen oral y roleplay.
 *  - 64: Modo "Pregúntame a mí".
 *
 * Todas las funciones tienen un fallback local para funcionar sin conexión ni
 * clave de Gemini, de forma que la app sigue siendo usable offline.
 */

import { getAIApiKey, speakText } from '../ai-assistant.js';
import { AppState } from './state.js';
import { saveItem, setSetting } from '../db.js';

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-1.5-flash', 'gemini-2.0-flash'];

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(
    /[&<>'"]/g,
    (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[tag] || tag
  );
}

function parseJsonLoose(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    /* continúa con heurística */
  }
  const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/([{[][\s\S]*[}\]])/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * Llama a Gemini. Devuelve el texto (o JSON parseado) o null si no hay clave
 * o falla, en cuyo caso el llamante usa su fallback local.
 */
async function callGemini(prompt, { imageBase64 = null, json = true } = {}) {
  const apiKey = await getAIApiKey();
  if (!apiKey) return null;

  const parts = [{ text: prompt }];
  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
        data: imageBase64.replace(/^data:[^,]+,/, '')
      }
    });
  }

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: json ? { responseMimeType: 'application/json' } : {}
          })
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || '')
          .join('')
          .trim() || '';
      if (!text) continue;
      return json ? parseJsonLoose(text) || text : text;
    } catch (e) {
      continue;
    }
  }
  return null;
}

function getSubjectName(subjectId) {
  const sub = AppState.subjects.find((s) => s.id === subjectId);
  return sub ? sub.name : 'general';
}

// ==========================================================================
// ITEM 2: PREGUNTAS DE DESARROLLO CON CALIFICACIÓN
// ==========================================================================
export async function generateOpenQuestions({ subjectId = 'all', topic = '', count = 3 } = {}) {
  const subjectName = subjectId === 'all' ? 'varias asignaturas' : getSubjectName(subjectId);
  const prompt = `Genera ${count} preguntas de desarrollo tipo examen de bachillerato sobre "${topic || subjectName}".
Devuelve un JSON: {"questions":[{"question":"...","rubric":"criterios de corrección","keywords":["palabra1","palabra2"],"idealAnswer":"respuesta modelo breve"}]}`;

  const ai = await callGemini(prompt);
  if (ai && Array.isArray(ai.questions) && ai.questions.length) return ai.questions;
  return buildOfflineOpenQuestions(topic || subjectName, count);
}

function buildOfflineOpenQuestions(topic, count) {
  const templates = [
    {
      question: `Explica con tus palabras qué es "${topic}" y por qué es importante.`,
      rubric: 'Definición correcta, contextualización y un ejemplo.',
      keywords: topic
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4)
    },
    {
      question: `Describe los elementos principales de "${topic}" y su relación entre ellos.`,
      rubric: 'Enumera al menos 3 elementos y explica su relación.',
      keywords: ['elementos', 'relación', 'principal']
    },
    {
      question: `Compara "${topic}" con un concepto relacionado e indica semejanzas y diferencias.`,
      rubric: 'Establece semejanzas y diferencias claras.',
      keywords: ['semejanzas', 'diferencias', 'comparación']
    }
  ];
  return templates.slice(0, count);
}

export async function gradeOpenAnswer({ question = '', rubric = '', keywords = [], answer = '' } = {}) {
  const prompt = `Eres un profesor corrigiendo una respuesta de examen.
Pregunta: ${question}
Criterios: ${rubric}
Respuesta del alumno: ${answer}
Devuelve JSON: {"score": nota de 0 a 10 con un decimal, "feedback":"comentario breve", "strengths":["..."], "improvements":["..."]}`;

  const ai = await callGemini(prompt);
  if (ai && typeof ai.score !== 'undefined') return ai;

  // Fallback: corrección por palabras clave
  const lower = answer.toLowerCase();
  const found = (keywords || []).filter((k) => k && lower.includes(String(k).toLowerCase()));
  const lengthFactor = Math.min(1, answer.trim().split(/\s+/).length / 40);
  const keywordFactor = keywords.length ? found.length / keywords.length : 0.5;
  const score = Math.round((keywordFactor * 0.7 + lengthFactor * 0.3) * 100) / 10;
  return {
    score,
    feedback:
      answer.trim().length < 20
        ? 'Tu respuesta es demasiado breve. Desarrolla más tus ideas.'
        : 'Corrección aproximada basada en las ideas clave incluidas.',
    strengths: found.length ? [`Incluye: ${found.join(', ')}`] : [],
    improvements: (keywords || []).filter((k) => k && !found.includes(k)).map((k) => `Te faltó mencionar: ${k}`)
  };
}

// ==========================================================================
// ITEM 3: DETECCIÓN DE DEBERES POR FOTO DE PIZARRA
// ==========================================================================
export async function detectHomeworkFromImage(imageBase64) {
  const prompt = `Analiza la foto de una pizarra o cuaderno escolar y extrae los deberes.
Devuelve JSON: {"tasks":[{"title":"...","subject":"...","dueDate":"YYYY-MM-DD o ''","priority":"baja|media|alta"}]}
Si no hay deberes, devuelve {"tasks":[]}.`;

  const ai = await callGemini(prompt, { imageBase64 });
  if (ai && Array.isArray(ai.tasks)) return ai.tasks;
  return [];
}

// ==========================================================================
// ITEM 4: ESCANEO DEL HORARIO EN PAPEL
// ==========================================================================
export async function scanScheduleFromImage(imageBase64) {
  const prompt = `Analiza la foto de un horario escolar en papel. Las columnas son días (1=Lunes..5=Viernes) y las filas franjas horarias (0,1,2...).
Devuelve JSON: {"slots":[{"day":1,"slotIndex":0,"subject":"Matemáticas","classroom":"Aula 12"}]}`;

  const ai = await callGemini(prompt, { imageBase64 });
  if (ai && Array.isArray(ai.slots)) return ai.slots;
  return [];
}

// ==========================================================================
// ITEM 8: ESQUEMAS Y MAPAS CONCEPTUALES
// ==========================================================================
export async function generateConceptMap({ subjectId = 'all', topic = '' } = {}) {
  const subjectName = subjectId === 'all' ? 'varias asignaturas' : getSubjectName(subjectId);
  const prompt = `Crea un mapa conceptual sobre "${topic || subjectName}" en formato Mermaid (graph TD).
Devuelve JSON: {"title":"...","mermaid":"graph TD\\n A[Tema] --> B[Idea 1]\\n ...","summary":"breve resumen"}`;

  const ai = await callGemini(prompt);
  if (ai && ai.mermaid) return ai;
  const name = topic || subjectName;
  return {
    title: `Mapa conceptual: ${name}`,
    mermaid: `graph TD\n  A[${name}] --> B[Definición]\n  A --> C[Características]\n  A --> D[Ejemplos]\n  A --> E[Importancia]`,
    summary: 'Esquema básico generado sin conexión. Configura tu clave de Gemini para un mapa detallado.'
  };
}

// ==========================================================================
// ITEM 18: TÉCNICA FEYNMAN GUIADA
// ==========================================================================
export async function generateFeynmanGuide({ subjectId = 'all', topic = '' } = {}) {
  const subjectName = subjectId === 'all' ? 'varias asignaturas' : getSubjectName(subjectId);
  const prompt = `Diseña una guía de estudio con la Técnica Feynman sobre "${topic || subjectName}".
Devuelve JSON: {"title":"...","keyIdeas":["..."],"steps":[{"title":"...","prompt":"pregunta guía para el alumno"}],"analogy":"una analogía sencilla"}`;

  const ai = await callGemini(prompt);
  if (ai && Array.isArray(ai.steps)) return ai;
  const name = topic || subjectName;
  return {
    title: `Técnica Feynman: ${name}`,
    keyIdeas: [`Qué es ${name}`, 'Para qué sirve', 'Un ejemplo claro'],
    steps: [
      { title: '1. Explícalo como a un niño de 10 años', prompt: `Escribe ${name} sin tecnicismos.` },
      { title: '2. Detecta los huecos', prompt: '¿Qué partes no sabes explicar? Apúntalas.' },
      { title: '3. Simplifica y usa analogías', prompt: 'Reescribe con una comparación cotidiana.' },
      { title: '4. Repásalo en voz alta', prompt: 'Dilo en voz alta sin mirar los apuntes.' }
    ],
    analogy: `Piensa en ${name} como algo que ya conoces de tu día a día.`
  };
}

// ==========================================================================
// ITEM 59: SIMULADOR DE EXAMEN ORAL Y ROLEPLAY
// ==========================================================================
export async function generateOralExam({ subjectId = 'all', topic = '', level = 'medio' } = {}) {
  const subjectName = subjectId === 'all' ? 'varias asignaturas' : getSubjectName(subjectId);
  const prompt = `Actúa como tribunal de examen oral de bachillerato (nivel ${level}) sobre "${topic || subjectName}".
Devuelve JSON: {"questions":[{"question":"...","idealAnswer":"...","hint":"..."}]} con 5 preguntas.`;

  const ai = await callGemini(prompt);
  if (ai && Array.isArray(ai.questions) && ai.questions.length) return ai.questions;
  return [
    {
      question: `Preséntame brevemente qué es ${topic || subjectName}.`,
      idealAnswer: 'Introducción clara y ordenada.',
      hint: 'Empieza por el contexto.'
    },
    {
      question: `¿Cuáles son los conceptos clave de ${topic || subjectName}?`,
      idealAnswer: 'Menciona al menos 3.',
      hint: 'Usa los apuntes.'
    },
    {
      question: `Pon un ejemplo práctico de ${topic || subjectName}.`,
      idealAnswer: 'Un ejemplo real y razonado.',
      hint: 'Conéctalo con la vida diaria.'
    },
    {
      question: `¿Qué relación tiene con otros temas que has estudiado?`,
      idealAnswer: 'Relación coherente.',
      hint: 'Piensa en paralelismos.'
    },
    {
      question: `Conclusión: ¿por qué es importante ${topic || subjectName}?`,
      idealAnswer: 'Cierre con idea global.',
      hint: 'Sintetiza.'
    }
  ];
}

// ==========================================================================
// ITEM 64: MODO "PREGÚNTAME A MÍ"
// ==========================================================================
export async function generateQuizMe({ subjectId = 'all', topic = '', count = 5 } = {}) {
  const subjectName = subjectId === 'all' ? 'varias asignaturas' : getSubjectName(subjectId);
  const prompt = `Genera ${count} preguntas de repaso activo sobre "${
    topic || subjectName
  }" para que el alumno se autoevalúe.
Devuelve JSON: {"questions":[{"question":"...","answer":"...","hint":"..."}]}`;

  const ai = await callGemini(prompt);
  if (ai && Array.isArray(ai.questions) && ai.questions.length) return ai.questions;
  const name = topic || subjectName;
  return [
    {
      question: `¿Qué es ${name}?`,
      answer: 'Su definición principal según tus apuntes.',
      hint: 'Piensa en la idea central.'
    },
    { question: `Cita dos características de ${name}.`, answer: 'Dos rasgos distintivos.', hint: 'Revisa el tema.' },
    { question: `Pon un ejemplo de ${name}.`, answer: 'Un ejemplo concreto.', hint: 'Relaciónalo con lo cotidiano.' }
  ];
}

// ==========================================================================
// INTERFAZ: MODAL DE HERRAMIENTAS IA
// ==========================================================================
let toolsModal = null;
let currentToolId = null;
let currentResult = null;

const TOOLS = [
  {
    id: 'open-questions',
    icon: '📝',
    title: 'Preguntas de desarrollo',
    desc: 'Genera preguntas de examen y corrígete como un profesor.',
    needsTopic: true
  },
  {
    id: 'homework-photo',
    icon: '📸',
    title: 'Deberes por foto',
    desc: 'Sube una foto de la pizarra y detecta los deberes.',
    photo: true
  },
  {
    id: 'schedule-scan',
    icon: '🗓️',
    title: 'Escanear horario',
    desc: 'Sube una foto de tu horario en papel y rellénalo solo.',
    photo: true
  },
  {
    id: 'concept-map',
    icon: '🗺️',
    title: 'Mapa conceptual',
    desc: 'Crea un esquema visual del tema.',
    needsTopic: true
  },
  {
    id: 'feynman',
    icon: '🧠',
    title: 'Técnica Feynman',
    desc: 'Aprende explicando con pasos guiados.',
    needsTopic: true
  },
  {
    id: 'oral-exam',
    icon: '🎙️',
    title: 'Examen oral',
    desc: 'El tribunal IA te pregunta en voz alta.',
    needsTopic: true
  },
  {
    id: 'quiz-me',
    icon: '🎯',
    title: 'Pregúntame a mí',
    desc: 'Repaso activo con preguntas y respuestas.',
    needsTopic: true
  }
];

function ensureModal() {
  if (toolsModal) return toolsModal;
  toolsModal = document.createElement('div');
  toolsModal.id = 'ai-tools-modal';
  toolsModal.className = 'modal-overlay hidden';
  toolsModal.innerHTML = `
    <div class="modal-content" style="max-width: 720px;">
      <div class="modal-header">
        <h3 class="modal-title">🧰 Herramientas de Estudio IA</h3>
        <button type="button" class="btn-close" data-close="ai-tools-modal">&times;</button>
      </div>
      <div id="ai-tools-tabs" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;"></div>
      <div id="ai-tools-panel"></div>
    </div>
  `;
  document.body.appendChild(toolsModal);
  toolsModal.querySelector('[data-close="ai-tools-modal"]')?.addEventListener('click', () => closeAIToolsModal());
  toolsModal.addEventListener('click', (e) => {
    if (e.target === toolsModal) closeAIToolsModal();
  });
  renderToolTabs();
  return toolsModal;
}

export function openAIToolsModal(toolId) {
  ensureModal();
  currentToolId = toolId || currentToolId || TOOLS[0].id;
  renderToolTabs();
  renderToolPanel();
  toolsModal.classList.remove('hidden');
}

export function closeAIToolsModal() {
  toolsModal?.classList.add('hidden');
}

function renderToolTabs() {
  const tabs = document.getElementById('ai-tools-tabs');
  if (!tabs) return;
  tabs.innerHTML = TOOLS.map(
    (tool) =>
      `<button type="button" class="filter-chip ${tool.id === currentToolId ? 'active' : ''}" data-ai-tool="${tool.id}">${tool.icon} ${escapeHtml(tool.title)}</button>`
  ).join('');
  tabs.querySelectorAll('[data-ai-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentToolId = btn.getAttribute('data-ai-tool');
      currentResult = null;
      renderToolTabs();
      renderToolPanel();
    });
  });
}

function subjectOptions() {
  return (
    '<option value="all">-- Todas las asignaturas --</option>' +
    AppState.subjects
      .map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.icon || '📖')} ${escapeHtml(s.name)}</option>`)
      .join('')
  );
}

function renderToolPanel() {
  const panel = document.getElementById('ai-tools-panel');
  const tool = TOOLS.find((t) => t.id === currentToolId);
  if (!panel || !tool) return;

  panel.innerHTML = `
    <p class="section-subtitle" style="margin-bottom: 12px;">${escapeHtml(tool.desc)}</p>
    ${tool.photo ? '' : `<select id="ai-tool-subject" class="form-input" style="margin-bottom: 10px;">${subjectOptions()}</select>`}
    ${
      tool.needsTopic
        ? '<input type="text" id="ai-tool-topic" class="form-input" placeholder="Tema o concepto (opcional)" style="margin-bottom: 10px;" />'
        : ''
    }
    ${tool.photo ? '<input type="file" id="ai-tool-photo" accept="image/*" class="form-input" style="margin-bottom: 10px;" />' : ''}
    <button type="button" id="ai-tool-run" class="btn-primary" style="width: auto;">✨ Generar</button>
    <div id="ai-tool-result" style="margin-top: 16px;"></div>
  `;
  document.getElementById('ai-tool-run')?.addEventListener('click', runCurrentTool);
  if (currentResult) renderResult(tool.id, currentResult);
}

function resultLoading() {
  const box = document.getElementById('ai-tool-result');
  if (box) box.innerHTML = '<p class="section-subtitle">✨ Pensando… generando con IA.</p>';
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function runCurrentTool() {
  const tool = TOOLS.find((t) => t.id === currentToolId);
  if (!tool) return;
  const subjectId = document.getElementById('ai-tool-subject')?.value || 'all';
  const topic = document.getElementById('ai-tool-topic')?.value || '';
  const runBtn = document.getElementById('ai-tool-run');
  if (runBtn) runBtn.disabled = true;
  resultLoading();
  try {
    if (tool.id === 'open-questions') {
      currentResult = await generateOpenQuestions({ subjectId, topic, count: 3 });
    } else if (tool.id === 'concept-map') {
      currentResult = await generateConceptMap({ subjectId, topic });
    } else if (tool.id === 'feynman') {
      currentResult = await generateFeynmanGuide({ subjectId, topic });
    } else if (tool.id === 'oral-exam') {
      currentResult = await generateOralExam({ subjectId, topic });
    } else if (tool.id === 'quiz-me') {
      currentResult = await generateQuizMe({ subjectId, topic, count: 5 });
    } else if (tool.id === 'homework-photo') {
      const file = document.getElementById('ai-tool-photo')?.files?.[0];
      if (!file) throw new Error('Selecciona una foto de la pizarra.');
      const base64 = await readFileAsDataURL(file);
      currentResult = await detectHomeworkFromImage(base64);
    } else if (tool.id === 'schedule-scan') {
      const file = document.getElementById('ai-tool-photo')?.files?.[0];
      if (!file) throw new Error('Selecciona una foto del horario.');
      const base64 = await readFileAsDataURL(file);
      currentResult = await scanScheduleFromImage(base64);
    }
    renderResult(tool.id, currentResult);
  } catch (err) {
    const box = document.getElementById('ai-tool-result');
    if (box) box.innerHTML = `<p style="color: var(--danger);">⚠️ ${escapeHtml(err.message)}</p>`;
  } finally {
    if (runBtn) runBtn.disabled = false;
  }
}

function renderResult(toolId, result) {
  const box = document.getElementById('ai-tool-result');
  if (!box) return;

  if (toolId === 'open-questions') {
    box.innerHTML = (result || [])
      .map(
        (q, i) => `
      <div class="card" style="margin-bottom: 12px;">
        <div style="font-weight: 700; color: var(--text-main); margin-bottom: 6px;">${i + 1}. ${escapeHtml(q.question)}</div>
        <div style="font-size: 0.78rem; color: var(--text-dim); margin-bottom: 8px;">Rúbrica: ${escapeHtml(q.rubric || '')}</div>
        <textarea class="form-input" data-answer-input="${i}" rows="3" placeholder="Escribe tu respuesta…" style="margin-bottom: 8px;"></textarea>
        <button type="button" class="btn-secondary" style="width: auto;" data-grade="${i}">🧑‍🏫 Corregir respuesta</button>
        <div data-grade-result="${i}" style="margin-top: 8px;"></div>
      </div>
    `
      )
      .join('');
    box.querySelectorAll('[data-grade]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const i = Number(btn.getAttribute('data-grade'));
        const q = result[i];
        const answer = box.querySelector(`[data-answer-input="${i}"]`)?.value || '';
        const out = box.querySelector(`[data-grade-result="${i}"]`);
        out.innerHTML = '<span class="section-subtitle">Corrigiendo…</span>';
        const grade = await gradeOpenAnswer({ question: q.question, rubric: q.rubric, keywords: q.keywords, answer });
        out.innerHTML = `
          <div style="padding: 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
            <div style="font-weight: 800; color: ${grade.score >= 5 ? 'var(--success)' : 'var(--danger)'};">Nota: ${grade.score}/10</div>
            <div style="font-size: 0.82rem; color: var(--text-main); margin-top: 4px;">${escapeHtml(grade.feedback || '')}</div>
            ${(grade.strengths || []).map((s) => `<div style="font-size: 0.78rem; color: var(--success);">✔ ${escapeHtml(s)}</div>`).join('')}
            ${(grade.improvements || []).map((s) => `<div style="font-size: 0.78rem; color: #f59e0b;">✎ ${escapeHtml(s)}</div>`).join('')}
          </div>
        `;
      });
    });
    return;
  }

  if (toolId === 'homework-photo') {
    if (!result || !result.length) {
      box.innerHTML =
        '<p class="section-subtitle">No se detectaron deberes (o no hay clave de Gemini configurada). Prueba con una foto más nítida.</p>';
      return;
    }
    box.innerHTML =
      result
        .map(
          (t, i) => `
        <label style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
          <input type="checkbox" checked data-hw="${i}" />
          <span>${escapeHtml(t.title)} — <em>${escapeHtml(t.subject || 'General')}</em> (${escapeHtml(t.dueDate || 'sin fecha')})</span>
        </label>`
        )
        .join('') +
      '<button type="button" class="btn-primary" style="width: auto; margin-top: 8px;" id="ai-add-homework">➕ Añadir seleccionados a Tareas</button>';
    box.querySelector('#ai-add-homework')?.addEventListener('click', async () => {
      const selected = [...box.querySelectorAll('[data-hw]:checked')].map((c) => Number(c.getAttribute('data-hw')));
      const today = new Date().toISOString().slice(0, 10);
      for (const idx of selected) {
        const t = result[idx];
        await saveItem('tasks', {
          id: 'task_' + Date.now().toString(36) + '_' + idx,
          title: t.title || 'Deber detectado',
          description: 'Detectado automáticamente desde una foto de la pizarra.',
          subjectId: null,
          dueDate: t.dueDate || today,
          status: 'pending',
          priority: t.priority || 'media',
          photos: [],
          subtasks: []
        });
      }
      box.insertAdjacentHTML(
        'beforeend',
        `<p style="color: var(--success); margin-top: 8px;">✅ ${selected.length} deber(es) añadido(s). Recarga la pestaña de Tareas.</p>`
      );
    });
    return;
  }

  if (toolId === 'schedule-scan') {
    if (!result || !result.length) {
      box.innerHTML =
        '<p class="section-subtitle">No se detectaron clases (o no hay clave de Gemini configurada). Prueba con una foto más nítida y recta.</p>';
      return;
    }
    box.innerHTML =
      result
        .map(
          (s) =>
            `<div style="font-size: 0.82rem; color: var(--text-main);">Día ${escapeHtml(s.day)} · Franja ${escapeHtml(s.slotIndex)} → <strong>${escapeHtml(s.subject)}</strong> ${s.classroom ? `(${escapeHtml(s.classroom)})` : ''}</div>`
        )
        .join('') +
      '<button type="button" class="btn-primary" style="width: auto; margin-top: 10px;" id="ai-apply-schedule">📅 Aplicar al horario</button>';
    box.querySelector('#ai-apply-schedule')?.addEventListener('click', async () => {
      await applyScannedSchedule(result);
      box.insertAdjacentHTML(
        'beforeend',
        '<p style="color: var(--success); margin-top: 8px;">✅ Horario actualizado.</p>'
      );
    });
    return;
  }

  if (toolId === 'concept-map') {
    box.innerHTML = `
      <div style="font-weight: 700; color: var(--text-main); margin-bottom: 8px;">${escapeHtml(result.title || '')}</div>
      ${renderMindMap(result.mermaid || '')}
      ${result.summary ? `<p class="section-subtitle" style="margin-top: 10px;">${escapeHtml(result.summary)}</p>` : ''}
      <details style="margin-top: 10px;"><summary style="cursor: pointer; font-size: 0.8rem; color: var(--text-dim);">Ver código Mermaid</summary><pre style="white-space: pre-wrap; font-size: 0.72rem; background: var(--bg-input); padding: 8px; border-radius: 8px;">${escapeHtml(result.mermaid || '')}</pre></details>
    `;
    return;
  }

  if (toolId === 'feynman') {
    box.innerHTML = `
      <div style="font-weight: 700; color: var(--text-main); margin-bottom: 8px;">${escapeHtml(result.title || '')}</div>
      <div style="font-size: 0.82rem; color: var(--text-dim); margin-bottom: 10px;">Ideas clave: ${(result.keyIdeas || []).map((k) => escapeHtml(k)).join(' · ')}</div>
      ${(result.steps || [])
        .map(
          (s) => `<div style="margin-bottom: 10px;">
            <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">${escapeHtml(s.title)}</div>
            <div style="font-size: 0.8rem; color: var(--text-dim); margin-bottom: 4px;">${escapeHtml(s.prompt)}</div>
            <textarea class="form-input" rows="2" placeholder="Escribe aquí…"></textarea>
          </div>`
        )
        .join('')}
      ${result.analogy ? `<p style="font-size: 0.8rem; color: var(--primary);">💡 ${escapeHtml(result.analogy)}</p>` : ''}
    `;
    return;
  }

  if (toolId === 'oral-exam') {
    box.innerHTML = `
      <button type="button" class="btn-primary" style="width: auto; margin-bottom: 10px;" id="ai-oral-start">🎙️ Empezar examen oral</button>
      <div id="ai-oral-area"></div>
    `;
    startOralExam(box, result || []);
    return;
  }

  if (toolId === 'quiz-me') {
    let index = 0;
    const draw = () => {
      const q = (result || [])[index];
      if (!q) {
        box.innerHTML = '<p style="color: var(--success);">🎉 ¡Has repasado todas las preguntas!</p>';
        return;
      }
      box.innerHTML = `
        <div style="font-weight: 700; color: var(--text-main); margin-bottom: 8px;">Pregunta ${index + 1}/${result.length}: ${escapeHtml(q.question)}</div>
        <button type="button" class="btn-secondary" style="width: auto;" id="ai-quiz-reveal">👁️ Ver respuesta</button>
        <div id="ai-quiz-answer" style="margin-top: 8px; display: none; padding: 10px; background: var(--bg-input); border-radius: 8px; color: var(--text-main);">${escapeHtml(q.answer)}</div>
        <div style="margin-top: 10px; display: flex; gap: 8px;">
          <button type="button" class="btn-secondary" style="width: auto;" id="ai-quiz-again">🔁 Otra vez</button>
          <button type="button" class="btn-primary" style="width: auto;" id="ai-quiz-next">➡️ Siguiente</button>
        </div>
      `;
      box.querySelector('#ai-quiz-reveal')?.addEventListener('click', () => {
        box.querySelector('#ai-quiz-answer').style.display = 'block';
      });
      box.querySelector('#ai-quiz-again')?.addEventListener('click', () => {
        index = 0;
        draw();
      });
      box.querySelector('#ai-quiz-next')?.addEventListener('click', () => {
        index++;
        draw();
      });
    };
    draw();
    return;
  }
}

function renderMindMap(mermaid) {
  const lines = mermaid.split('\n').filter((l) => l.includes('-->'));
  if (!lines.length) return '<pre style="white-space: pre-wrap; font-size: 0.75rem;">' + escapeHtml(mermaid) + '</pre>';
  return (
    '<div style="display: flex; flex-direction: column; gap: 6px;">' +
    lines
      .map((line) => {
        const parts = line.split('-->').map((p) => p.trim());
        const clean = (s) => (s.match(/\[(.*?)\]/) ? s.match(/\[(.*?)\]/)[1] : s);
        return `<div style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: var(--text-main);">
          <span style="background: var(--bg-input); padding: 4px 8px; border-radius: 8px;">${escapeHtml(clean(parts[0]))}</span>
          <span style="color: var(--primary);">→</span>
          <span style="background: var(--bg-input); padding: 4px 8px; border-radius: 8px;">${escapeHtml(clean(parts[1] || ''))}</span>
        </div>`;
      })
      .join('') +
    '</div>'
  );
}

function startOralExam(box, questions) {
  let index = 0;
  const area = box.querySelector('#ai-oral-area');
  const btn = box.querySelector('#ai-oral-start');
  if (btn) btn.style.display = 'none';
  const ask = () => {
    const q = questions[index];
    if (!q) {
      area.innerHTML = '<p style="color: var(--success);">🎓 ¡Examen oral completado! Buen trabajo.</p>';
      return;
    }
    area.innerHTML = `
      <div class="card" style="margin-bottom: 10px;">
        <div style="font-size: 0.78rem; color: var(--text-dim);">Pregunta ${index + 1}/${questions.length}</div>
        <div style="font-weight: 700; color: var(--text-main); margin: 6px 0;">${escapeHtml(q.question)}</div>
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <button type="button" class="btn-secondary" style="width: auto;" data-oral-listen>🔊 Escuchar</button>
          <button type="button" class="btn-secondary" style="width: auto;" data-oral-hint>💡 Pista</button>
        </div>
        <textarea class="form-input" rows="3" data-oral-answer placeholder="Responde aquí…"></textarea>
        <button type="button" class="btn-primary" style="width: auto; margin-top: 8px;" data-oral-grade>🧑‍🏫 Corregir y continuar</button>
        <div data-oral-feedback style="margin-top: 8px;"></div>
      </div>
    `;
    area.querySelector('[data-oral-listen]')?.addEventListener('click', () => speakText(q.question));
    area.querySelector('[data-oral-hint]')?.addEventListener('click', () => {
      area.querySelector('[data-oral-feedback]').textContent = `💡 ${q.hint || 'Piensa en la idea principal.'}`;
    });
    area.querySelector('[data-oral-grade]')?.addEventListener('click', async () => {
      const answer = area.querySelector('[data-oral-answer]')?.value || '';
      const fb = area.querySelector('[data-oral-feedback]');
      fb.innerHTML = '<span class="section-subtitle">Evaluando…</span>';
      const grade = await gradeOpenAnswer({ question: q.question, rubric: q.idealAnswer || '', keywords: [], answer });
      fb.innerHTML = `<div style="font-weight: 800; color: ${grade.score >= 5 ? 'var(--success)' : 'var(--danger)'};">Nota: ${grade.score}/10</div>
        <div style="font-size: 0.82rem; color: var(--text-main);">${escapeHtml(grade.feedback || '')}</div>
        <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 6px;">Respuesta modelo: ${escapeHtml(q.idealAnswer || '')}</div>`;
      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'btn-primary';
      nextBtn.style.width = 'auto';
      nextBtn.style.marginTop = '8px';
      nextBtn.textContent = '➡️ Siguiente pregunta';
      nextBtn.addEventListener('click', () => {
        index++;
        ask();
      });
      fb.appendChild(nextBtn);
    });
  };
  ask();
}

async function applyScannedSchedule(slots) {
  // Crear franjas horarias por defecto si no existen
  if (!AppState.timeSlots || AppState.timeSlots.length === 0) {
    const defaults = [
      { index: 0, start: '08:00', end: '09:00', isBreak: false },
      { index: 1, start: '09:00', end: '10:00', isBreak: false },
      { index: 2, start: '10:00', end: '11:00', isBreak: false },
      { index: 3, start: '11:30', end: '12:30', isBreak: false },
      { index: 4, start: '12:30', end: '13:30', isBreak: false },
      { index: 5, start: '13:30', end: '14:30', isBreak: false }
    ];
    AppState.timeSlots = defaults;
    await setSetting('timeSlots', defaults);
  }

  const maxSlot = Math.max(
    ...AppState.timeSlots.map((s) => s.index || 0),
    ...slots.map((s) => Number(s.slotIndex) || 0)
  );
  while (AppState.timeSlots.length <= maxSlot) {
    const index = AppState.timeSlots.length;
    AppState.timeSlots.push({ index, start: '', end: '', isBreak: false });
  }
  await setSetting('timeSlots', AppState.timeSlots);

  for (const slot of slots) {
    const name = (slot.subject || '').trim();
    const day = Number(slot.day);
    const slotIndex = Number(slot.slotIndex);
    if (!name || !day) continue;
    let subject = AppState.subjects.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (!subject) {
      subject = {
        id:
          'sub_' +
          name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .slice(0, 20) +
          '_' +
          Date.now().toString(36),
        name,
        color: '#3b82f6',
        icon: '📖'
      };
      await saveItem('subjects', subject);
      AppState.subjects.push(subject);
    }
    await saveItem('schedule', {
      id: `slot_${day}_${slotIndex}`,
      day,
      slotIndex,
      subjectId: subject.id,
      classroom: slot.classroom || '',
      variant: 'all'
    });
  }
}
