/**
 * ai-assistant.js - Copiloto Escolar Inteligente integrado en toda la Agenda
 * 
 * Capacidades:
 * 1. Conexión multimodal y razonamiento con Google Gemini 1.5 Flash (y respaldo local/offline).
 * 2. Function Calling / Action Dispatcher: Ejecuta acciones directas sobre la agenda:
 *    - Crear/Consultar deberes y tareas.
 *    - Consultar y verificar el horario escolar (hoy y mañana).
 *    - Preparar y verificar la mochila según las clases del día siguiente.
 *    - Consultar y programar exámenes con cuenta atrás.
 *    - Iniciar y controlar el temporizador Pomodoro.
 *    - Generar Fichas de Estudio (Flashcards) automáticas con sistema Leitner.
 * 3. Búsqueda académica e investigación en internet (Wikipedia ES API + Gemini Search).
 * 4. Integración directa con OCR: Conversión de pizarras y apuntes en fichas, tareas y explicaciones.
 * 5. Interfaz de voz bidireccional: Dictado por voz (SpeechRecognition) y síntesis de voz (SpeechSynthesis).
 */

import { getAll, saveItem, getSetting, setSetting } from './db.js';
import { createFlashcard } from './flashcards.js';

// Clave de almacenamiento para la API Key de Gemini
const GEMINI_STORAGE_KEY = 'gemini_api_key';

// Historial de conversación en memoria para contexto continuo
let chatHistory = [];

// Estado del sintetizador de voz
let isSpeakingActive = false;
let currentUtterance = null;

// Callbacks para interactuar con app.js
let appActionCallbacks = {
  onTaskCreated: null,
  onExamCreated: null,
  onFlashcardsCreated: null,
  onPomodoroStarted: null,
  onBackpackOrganized: null,
  onTabNavigate: null,
  onToast: null,
  getAppState: null
};

/**
 * Registra los callbacks de interacción con la aplicación principal
 */
export function registerAppCallbacks(callbacks) {
  appActionCallbacks = { ...appActionCallbacks, ...callbacks };
}

/**
 * Obtiene la API Key de Google Gemini guardada
 */
export async function getAIApiKey() {
  let key = typeof localStorage !== 'undefined' ? localStorage.getItem(GEMINI_STORAGE_KEY) : null;
  if (!key) {
    try {
      key = await getSetting('geminiApiKey');
    } catch (e) {}
  }
  return key ? key.trim() : '';
}

/**
 * Guarda o actualiza la API Key de Google Gemini
 */
export async function saveAIApiKey(key) {
  const cleanKey = (key || '').trim();
  if (cleanKey) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(GEMINI_STORAGE_KEY, cleanKey);
    try {
      await setSetting('geminiApiKey', cleanKey);
    } catch (e) {}
  } else {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(GEMINI_STORAGE_KEY);
    try {
      await setSetting('geminiApiKey', '');
    } catch (e) {}
  }
  return cleanKey;
}

/**
 * Prueba en tiempo real si una API Key de Google Gemini es válida y tiene cuota activa
 * @param {string} key
 * @returns {Promise<{ ok: boolean, message?: string, error?: string }>}
 */
export async function testGeminiApiKey(key) {
  const cleanKey = (key || '').trim();
  if (!cleanKey) {
    return { ok: false, error: 'Por favor introduce una clave antes de probar.' };
  }

  const candidateModels = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-1.5-flash', 'gemini-2.0-flash'];

  for (const model of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Responde únicamente con la palabra OK.' }] }]
        })
      });

      if (res.ok) {
        return { ok: true, message: `¡Conexión verificada con éxito! Modelo activo: ${model}.` };
      }

      const err = await res.json().catch(() => ({}));
      const msg = err.error?.message || `Error HTTP ${res.status}`;

      if (res.status === 400 || msg.toLowerCase().includes('api key not valid') || msg.toLowerCase().includes('invalid')) {
        return { ok: false, error: 'Clave no válida. Asegúrate de copiarla completa desde Google AI Studio.' };
      }
      if (res.status === 429) {
        return { ok: false, error: 'Límite de peticiones alcanzado. Espera un momento y vuelve a probar.' };
      }
      // Si fue 404 de modelo, probar el siguiente modelo en la lista
      if (res.status === 404) {
        continue;
      }

      return { ok: false, error: msg };
    } catch (netErr) {
      // Continuar al siguiente si error de red temporal o salir
    }
  }

  return { ok: false, error: 'No se pudo conectar con los servidores de Google. Comprueba tu conexión a internet.' };
}

/**
 * Comprueba si la IA nativa del navegador/teléfono está disponible (Chrome Prompt API / Gemini Nano)
 */
export function isDevicePromptAIAvailable() {
  return typeof window !== 'undefined' && 
         (Boolean(window.ai?.languageModel) || Boolean(window.model?.languageModel));
}

/**
 * Obtiene la fecha y hora en formato amigable español
 */
export function getFriendlyDateTime() {
  const now = new Date();
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  
  const dayName = days[now.getDay()];
  const dayNum = now.getDate();
  const monthName = months[now.getMonth()];
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return {
    dayOfWeek: now.getDay(), // 0 = Domingo, 1 = Lunes, etc.
    dayName,
    dateString: `${dayName}, ${dayNum} de ${monthName} de ${year}`,
    timeString: `${hours}:${minutes}`,
    isoDate: `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
  };
}

/**
 * Recopila el contexto vivo completo del alumno desde AppState
 */
export function buildLiveStudentContext() {
  const { dateString, timeString, dayOfWeek, isoDate } = getFriendlyDateTime();
  const state = appActionCallbacks.getAppState ? appActionCallbacks.getAppState() : null;

  if (!state) {
    return `Fecha actual: ${dateString}, ${timeString}.`;
  }

  // 1. Perfil del alumno
  const studentName = state.studentName || localStorage.getItem('agenda_student_name') || 'Estudiante';
  const studentCourse = state.studentCourse || localStorage.getItem('agenda_student_course') || 'Secundaria / Bachillerato';

  // 2. Asignaturas disponibles
  const subjectsMap = {};
  (state.subjects || []).forEach(s => {
    subjectsMap[s.id] = s.name;
  });
  const subjectsListStr = (state.subjects || []).map(s => `- ID: "${s.id}" -> ${s.name} (Aula: ${s.room || 'General'}, Profesor: ${s.teacher || 'N/A'})`).join('\n');

  // 3. Horario de hoy y de mañana
  const todayDayIndex = dayOfWeek >= 1 && dayOfWeek <= 5 ? dayOfWeek : 1;
  const tomorrowDayIndex = (todayDayIndex % 5) + 1;

  const getScheduleForDay = (d) => {
    return (state.schedule || [])
      .filter(entry => Number(entry.day) === d)
      .sort((a, b) => (Number(a.period) || 0) - (Number(b.period) || 0))
      .map(entry => {
        const subName = subjectsMap[entry.subjectId] || 'Clase';
        return `   • Periodo ${entry.period || 1} (${entry.startTime || ''}-${entry.endTime || ''}): ${subName} (Aula: ${entry.room || 'Aula habitual'})`;
      })
      .join('\n') || '   • No hay clases registradas para este día.';
  };

  const scheduleTodayStr = getScheduleForDay(todayDayIndex);
  const scheduleTomorrowStr = getScheduleForDay(tomorrowDayIndex);

  // 4. Deberes pendientes
  const pendingTasks = (state.tasks || [])
    .filter(t => !t.completed)
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
    .slice(0, 10);

  const tasksStr = pendingTasks.map(t => {
    const subName = subjectsMap[t.subjectId] || 'General';
    return `   • [${t.dueDate || 'Sin fecha'}] ${subName}: ${t.title} (Prioridad: ${t.priority || 'normal'})`;
  }).join('\n') || '   • ¡No hay deberes pendientes! Todo al día.';

  // 5. Próximos exámenes
  const upcomingExams = (state.exams || [])
    .filter(e => !e.completed && (e.date || '') >= isoDate)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .slice(0, 5);

  const examsStr = upcomingExams.map(e => {
    const subName = subjectsMap[e.subjectId] || 'General';
    return `   • [${e.date}] ${subName}: ${e.title} (Temas: ${e.topics || 'Temario general'})`;
  }).join('\n') || '   • No hay exámenes programados próximamente.';

  // 6. Mochila / Materiales
  const materials = state.materials || [];
  const checkedMaterialsCount = materials.filter(m => m.checked).length;
  const totalMaterials = materials.length;

  // 7. Fichas de estudio
  const flashcards = state.flashcards || [];
  const dueFlashcards = flashcards.filter(f => !f.nextReviewDate || f.nextReviewDate <= isoDate).length;

  return `
--- CONTEXTO VIVO DEL ESTUDIANTE ---
• Alumno: ${studentName} (${studentCourse})
• Fecha actual: ${dateString}, ${timeString}
• Asignaturas registradas:
${subjectsListStr || '   (Sin asignaturas específicas)'}

• Horario de Hoy (${dayOfWeek >= 1 && dayOfWeek <= 5 ? 'Día de clases' : 'Fin de semana'}):
${scheduleTodayStr}

• Horario de Mañana (Día escolar siguiente):
${scheduleTomorrowStr}

• Deberes pendientes para próximos días:
${tasksStr}

• Próximos Exámenes:
${examsStr}

• Estado de la Mochila: ${checkedMaterialsCount}/${totalMaterials} materiales preparados.
• Fichas de Estudio Leitner: ${dueFlashcards} fichas pendientes de repaso hoy de un total de ${flashcards.length}.
-------------------------------------`;
}

/**
 * Búsqueda enciclopédica y académica en la Wikipedia en español (sin API key, CORS amigable)
 */
export async function searchAcademicWeb(query) {
  if (!query || !query.trim()) return null;
  const cleanQuery = query.trim().replace(/^¿|^\?|¡|!|\.$/g, '');

  try {
    // 1. Buscar títulos relevantes
    const searchUrl = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&origin=*&utf8=1&srlimit=3`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const hits = searchData?.query?.search || [];

    if (hits.length === 0) return null;

    // 2. Obtener resumen de la página principal
    const bestTitle = hits[0].title;
    const summaryUrl = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`;
    const summaryRes = await fetch(summaryUrl);
    if (!summaryRes.ok) return null;
    const summaryData = await summaryRes.json();

    return {
      title: summaryData.title || bestTitle,
      description: summaryData.description || '',
      extract: summaryData.extract || hits[0].snippet.replace(/<[^>]+>/g, ''),
      url: summaryData.content_urls?.desktop?.page || `https://es.wikipedia.org/wiki/${encodeURIComponent(bestTitle)}`,
      thumbnail: summaryData.thumbnail?.source || null,
      related: hits.slice(1).map(h => ({
        title: h.title,
        url: `https://es.wikipedia.org/wiki/${encodeURIComponent(h.title)}`
      }))
    };
  } catch (err) {
    console.warn('Error en búsqueda académica web:', err);
    return null;
  }
}

/**
 * Genera Flashcards estructuradas a partir de un texto o tema escolar
 * @param {Object} options
 * @param {string} options.text Texto de apuntes o tema
 * @param {string} [options.subjectId] ID de la asignatura
 * @param {number} [options.count=4] Número aproximado de tarjetas
 * @returns {Promise<Array<{ front: string, back: string, hint: string, subjectId: string }>>}
 */
export async function generateFlashcardsWithAI({ text, subjectId = 'all', count = 4, topic = '' }) {
  const apiKey = await getAIApiKey();
  const state = appActionCallbacks.getAppState ? appActionCallbacks.getAppState() : null;
  
  // Asignatura de respaldo
  const targetSubId = subjectId !== 'all' ? subjectId : (state?.subjects?.[0]?.id || 'sub_general');
  const targetSubName = state?.subjects?.find(s => s.id === targetSubId)?.name || 'General';

  // Si hay API Key de Gemini, usar la IA avanzada
  if (apiKey) {
    try {
      const prompt = `Actúa como un profesor y tutor de estudio experto.
Genera exactamente entre 3 y ${Math.max(3, count)} Fichas de Estudio (Flashcards) para memorizar y repasar con el sistema de repetición espaciada de Leitner.
Asignatura: "${targetSubName}".
${topic ? `Tema específico: "${topic}".` : ''}

Texto base de apuntes o temario:
"""
${text}
"""

Reglas para cada ficha:
- "front": Pregunta clara, directa, concepto clave o término a definir (máximo 120 caracteres).
- "back": Respuesta completa, pedagógica y precisa (entre 1 y 4 oraciones).
- "hint": Una pista breve mnemotécnica o sugerencia para cuando el alumno no recuerde la respuesta.

RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA EXACTA (SIN TEXTO EXTRA NI MARKDOWN EXTERIOR):
{
  "flashcards": [
    {
      "front": "¿Pregunta o concepto?",
      "back": "Respuesta clara y didáctica.",
      "hint": "Pista orientativa"
    }
  ]
}`;

      const candidateModels = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-1.5-flash', 'gemini-2.0-flash'];
      for (const model of candidateModels) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' }
            })
          });

          if (res.ok) {
            const data = await res.json();
            const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            const parsed = JSON.parse(jsonText);
            if (Array.isArray(parsed.flashcards) && parsed.flashcards.length > 0) {
              return parsed.flashcards.map(c => ({
                subjectId: targetSubId,
                front: c.front || '',
                back: c.back || '',
                hint: c.hint || ''
              }));
            }
          }
          if (res.status === 404) continue;
        } catch (mErr) {}
      }
    } catch (err) {
      console.warn('Fallo con Gemini al crear flashcards, usando extractor local:', err);
    }
  }

  // Fallback 100% Offline: Extractor Heurístico Local Inteligente
  return extractLocalFlashcardsHeuristic(text, targetSubId, count);
}

/**
 * Extractor Heurístico Local para crear flashcards sin conexión ni API Key (0 MB)
 */
function extractLocalFlashcardsHeuristic(text, subjectId, maxCount = 4) {
  if (!text) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const cards = [];

  // Patrón 1: Concepto: Definición o Concepto - Definición
  for (const line of lines) {
    if (cards.length >= maxCount) break;
    const match = line.match(/^([^:\-–]{3,45})[:\-–]\s+(.{15,})$/i);
    if (match) {
      const term = match[1].replace(/^[•\*\d\.\)\s]+/, '').trim();
      const def = match[2].trim();
      if (term.length > 2 && def.length > 10) {
        cards.push({
          subjectId,
          front: `¿Qué es o qué define a "${term}"?`,
          back: def,
          hint: `Concepto clave de ${term.split(' ')[0]}`
        });
      }
    }
  }

  // Patrón 2: Preguntas y respuestas existentes (¿...?)
  if (cards.length < maxCount) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (cards.length >= maxCount) break;
      const curr = lines[i];
      const next = lines[i + 1];
      if (/^¿.+\?$/.test(curr) && next.length > 8 && !next.startsWith('¿')) {
        cards.push({
          subjectId,
          front: curr,
          back: next,
          hint: 'Revisa los apuntes de clase'
        });
      }
    }
  }

  // Patrón 3: Si no detectó suficientes, crear preguntas de resumen por párrafos
  if (cards.length === 0) {
    const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 25);
    for (let i = 0; i < Math.min(paragraphs.length, maxCount); i++) {
      const p = paragraphs[i];
      const firstSentence = p.split('.')[0] + '.';
      const rest = p.substring(firstSentence.length).trim() || p;
      cards.push({
        subjectId,
        front: `Explica la idea principal: "${firstSentence.substring(0, 80)}..."`,
        back: rest.length > 15 ? rest : p,
        hint: 'Resumen extraído de los apuntes'
      });
    }
  }

  return cards;
}

/**
 * Prompt del Sistema para el Asistente Copiloto Escolar
 */
function buildSystemPrompt() {
  const liveContext = buildLiveStudentContext();

  return `Eres el "Copiloto Escolar IA", el asistente pedagógico y organizativo integrado en la aplicación web "Agenda Escolar".
Tu objetivo es ayudar al estudiante a organizar sus estudios, responder dudas sobre sus asignaturas, ayudarle a preparar la mochila, exámenes, deberes y crear fichas de estudio.

${liveContext}

DIRECTRICES DE PERSONALIDAD:
- Sé motivador, cercano, claro, empático y estructurado (habla en español peninsular/neutro amigable).
- Utiliza formato Markdown limpio: listas con viñetas, negritas para términos importantes y emojis oportunos.
- Si el alumno te hace una pregunta académica (ej: sobre historia, biología, matemáticas), dale una explicación brillante adaptada a su nivel escolar, paso a paso y con ejemplos cotidianos.

EJECUCIÓN DE ACCIONES EN LA APP (FUNCTION CALLING):
Cuando el estudiante te pida hacer algo concreto en la agenda (o sea evidente que quiere realizar una acción), incluye AL FINAL de tu respuesta un bloque especial con formato JSON etiquetado con \`\`\`app_action ... \`\`\` para que la aplicación ejecute la orden automáticamente.

Puedes emitir UNA de las siguientes acciones si corresponde:

1. Crear Tarea / Deberes:
\`\`\`app_action
{
  "action": "create_task",
  "data": {
    "title": "Ejercicios 1 a 4 pág 56",
    "subjectId": "id_asignatura_o_nombre",
    "dueDate": "YYYY-MM-DD",
    "priority": "alta|normal|baja",
    "description": "Detalles adicionales"
  }
}
\`\`\`

2. Crear Examen:
\`\`\`app_action
{
  "action": "create_exam",
  "data": {
    "title": "Examen Tema 4 y 5",
    "subjectId": "id_asignatura_o_nombre",
    "date": "YYYY-MM-DD",
    "topics": "Resumen de temas a evaluar"
  }
}
\`\`\`

3. Crear Lote de Fichas de Estudio (Flashcards):
\`\`\`app_action
{
  "action": "create_flashcards",
  "data": {
    "subjectId": "id_asignatura_o_nombre",
    "cards": [
      {
        "front": "¿Pregunta o concepto?",
        "back": "Definición o respuesta",
        "hint": "Pista mnemotécnica opcional"
      }
    ]
  }
}
\`\`\`

4. Iniciar Temporizador Pomodoro:
\`\`\`app_action
{
  "action": "start_pomodoro",
  "data": {
    "minutes": 25,
    "mode": "work"
  }
}
\`\`\`

5. Navegar a una pantalla de la agenda:
\`\`\`app_action
{
  "action": "navigate_tab",
  "data": {
    "tabId": "tab-today|tab-tasks|tab-schedule|tab-backpack|tab-exams|tab-grades|tab-pomodoro|tab-flashcards|tab-gallery"
  }
}
\`\`\`

6. Buscar en la Web / Wikipedia:
Si el alumno pregunta por un tema enciclopédico específico y quieres ofrecer información verificada, la app también consultará Wikipedia.

¡Comienza respondiendo al alumno con la máxima ayuda!`;
}

/**
 * Consulta al Asistente Copiloto Escolar (con streaming / llamada multimodal)
 * @param {Object} options
 * @param {string} options.userMessage Mensaje del alumno
 * @param {string} [options.imageBase64] Foto opcional de la pizarra o apunte
 * @param {Array} [options.history] Historial previo
 * @returns {Promise<{ replyText: string, actionsExecuted: Array, webSearch: Object|null }>}
 */
export async function askAIAssistant({ userMessage, imageBase64 = null, history = [] }) {
  const apiKey = await getAIApiKey();

  // Comprobar si es una solicitud de búsqueda web explícita o implícita
  let webSearchResult = null;
  const searchMatch = userMessage.match(/(?:busca|investiga|qué dice internet|información sobre|wikipedia)\s+(.+)/i);
  if (searchMatch && searchMatch[1]) {
    try {
      webSearchResult = await searchAcademicWeb(searchMatch[1]);
    } catch (e) {}
  }

  // 1. Si no hay API Key de Gemini: Modo Offline Inteligente con despachador local y Wikipedia
  if (!apiKey) {
    return handleOfflineLocalAssistant(userMessage, webSearchResult);
  }

  // 2. Conexión con Gemini (1.5 Flash con respaldo 2.0 Flash)
  try {
    const systemInstruction = buildSystemPrompt();

    // Inyectar búsqueda web en el contexto si existe
    let augmentedMessage = userMessage;
    if (webSearchResult) {
      augmentedMessage += `\n\n[Datos enciclopédicos encontrados en Wikipedia para "${webSearchResult.title}": "${webSearchResult.extract}"]`;
    }

    // Preparar contenido de la petición
    const contents = [];

    // Incluir mensajes previos de historial si existen
    const recentHistory = (history || []).slice(-6);
    recentHistory.forEach(item => {
      contents.push({
        role: item.role === 'user' ? 'user' : 'model',
        parts: [{ text: item.text }]
      });
    });

    // Mensaje actual del usuario
    const currentParts = [{ text: augmentedMessage }];

    // Si viene con imagen adjunta (pizarra o apunte escolar)
    if (imageBase64) {
      const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, '');
      currentParts.push({
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64
        }
      });
    }

    contents.push({
      role: 'user',
      parts: currentParts
    });

    const payload = {
      contents,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      }
    };

    const candidateModels = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-1.5-flash', 'gemini-2.0-flash'];
    let response = null;

    for (const model of candidateModels) {
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) break;
        if (response.status === 404) continue;
        break;
      } catch (mErr) {}
    }

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const rawMsg = errJson.error?.message || `Error HTTP ${response.status}`;
      if (response.status === 400 || rawMsg.toLowerCase().includes('api key not valid') || rawMsg.toLowerCase().includes('invalid')) {
        throw new Error('Tu clave de Google Gemini no es válida o está incompleta. Pulsa en ⚙️ para revisarla o crear una nueva gratis en Google AI Studio.');
      }
      if (response.status === 429) {
        throw new Error('Se ha superado temporalmente la cuota gratuita de Gemini. Espera unos momentos y vuelve a preguntar.');
      }
      throw new Error(rawMsg);
    }

    const resData = await response.json();
    let rawReply = resData.candidates?.[0]?.content?.parts?.[0]?.text || 'No pude procesar la respuesta en este momento.';

    // Procesar y ejecutar acciones estructuradas emitidas por la IA
    const { cleanText, executedActions } = await processAndExecuteActions(rawReply);

    return {
      replyText: cleanText,
      actionsExecuted: executedActions,
      webSearch: webSearchResult
    };
  } catch (apiErr) {
    console.warn('Error al llamar a Gemini Flash, recurriendo a asistente local:', apiErr);
    const offlineRes = await handleOfflineLocalAssistant(userMessage, webSearchResult);
    offlineRes.replyText = `⚠️ **Aviso de IA:** ${apiErr.message}\n\n---\n\n` + offlineRes.replyText;
    return offlineRes;
  }
}

/**
 * Analiza el texto de respuesta en busca de bloques ```app_action ... ``` y los ejecuta
 */
async function processAndExecuteActions(text) {
  const actionRegex = /```app_action\s*([\s\S]*?)\s*```/g;
  const executedActions = [];
  let cleanText = text;
  let match;

  while ((match = actionRegex.exec(text)) !== null) {
    try {
      const actionObj = JSON.parse(match[1]);
      const result = await executeSingleAction(actionObj);
      if (result) {
        executedActions.push(result);
      }
    } catch (parseErr) {
      console.warn('Error al parsear app_action:', parseErr);
    }
  }

  // Quitar los bloques de código internos de app_action para no ensuciar la visualización del chat
  cleanText = cleanText.replace(actionRegex, '').trim();

  return { cleanText, executedActions };
}

/**
 * Ejecuta una acción individual sobre los almacenes de la agenda
 */
async function executeSingleAction(actionObj) {
  const { action, data } = actionObj;
  const state = appActionCallbacks.getAppState ? appActionCallbacks.getAppState() : null;

  // Resolver ID de asignatura por nombre si vino como texto
  const resolveSubjectId = (subQuery) => {
    if (!subQuery || !state?.subjects) return state?.subjects?.[0]?.id || 'sub_general';
    const found = state.subjects.find(s => 
      s.id === subQuery || 
      s.name.toLowerCase().includes(subQuery.toLowerCase()) || 
      subQuery.toLowerCase().includes(s.name.toLowerCase())
    );
    return found ? found.id : (state.subjects[0]?.id || 'sub_general');
  };

  switch (action) {
    case 'create_task': {
      const subId = resolveSubjectId(data.subjectId);
      const task = {
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: data.title || 'Deberes sin título',
        subjectId: subId,
        dueDate: data.dueDate || new Date().toISOString().split('T')[0],
        priority: data.priority || 'normal',
        description: data.description || '',
        completed: false,
        createdAt: new Date().toISOString()
      };

      await saveItem('tasks', task);
      if (state?.tasks) state.tasks.push(task);
      if (appActionCallbacks.onTaskCreated) appActionCallbacks.onTaskCreated(task);

      const subName = state?.subjects?.find(s => s.id === subId)?.name || 'Asignatura';
      return {
        type: 'task_created',
        message: `✅ Tarea añadida a **${subName}**: "${task.title}" (para el ${task.dueDate})`,
        item: task
      };
    }

    case 'create_exam': {
      const subId = resolveSubjectId(data.subjectId);
      const exam = {
        id: `exam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: data.title || 'Examen',
        subjectId: subId,
        date: data.date || new Date().toISOString().split('T')[0],
        topics: data.topics || '',
        completed: false,
        grade: null,
        createdAt: new Date().toISOString()
      };

      await saveItem('exams', exam);
      if (state?.exams) state.exams.push(exam);
      if (appActionCallbacks.onExamCreated) appActionCallbacks.onExamCreated(exam);

      const subName = state?.subjects?.find(s => s.id === subId)?.name || 'Asignatura';
      return {
        type: 'exam_created',
        message: `📝 Examen agendado en **${subName}**: "${exam.title}" el día ${exam.date}`,
        item: exam
      };
    }

    case 'create_flashcards': {
      const subId = resolveSubjectId(data.subjectId);
      const cardsToAdd = Array.isArray(data.cards) ? data.cards : [];
      const createdCards = [];

      for (const c of cardsToAdd) {
        if (!c.front || !c.back) continue;
        const newCard = createFlashcard({
          subjectId: subId,
          front: c.front,
          back: c.back,
          hint: c.hint || ''
        });
        await saveItem('flashcards', newCard);
        if (state?.flashcards) state.flashcards.push(newCard);
        createdCards.push(newCard);
      }

      if (appActionCallbacks.onFlashcardsCreated) appActionCallbacks.onFlashcardsCreated(createdCards);

      const subName = state?.subjects?.find(s => s.id === subId)?.name || 'Asignatura';
      return {
        type: 'flashcards_created',
        message: `🧠 Se han creado y guardado **${createdCards.length} fichas de estudio** en **${subName}**.`,
        count: createdCards.length,
        items: createdCards
      };
    }

    case 'start_pomodoro': {
      const mins = Number(data.minutes) || 25;
      if (appActionCallbacks.onPomodoroStarted) {
        appActionCallbacks.onPomodoroStarted(mins, data.mode || 'work');
      }
      return {
        type: 'pomodoro_started',
        message: `⏱️ Temporizador Pomodoro iniciado: **${mins} minutos** de concentración.`
      };
    }

    case 'navigate_tab': {
      if (data.tabId && appActionCallbacks.onTabNavigate) {
        appActionCallbacks.onTabNavigate(data.tabId);
      }
      return {
        type: 'navigated',
        message: `Pestaña abierta: ${data.tabId}`
      };
    }

    default:
      return null;
  }
}

/**
 * Asistente Local Offline Heurístico (cuando no hay internet ni API Key)
 */
async function handleOfflineLocalAssistant(userMessage, webSearchResult = null) {
  const lower = userMessage.toLowerCase().trim();
  const state = appActionCallbacks.getAppState ? appActionCallbacks.getAppState() : null;
  const { dateString, dayOfWeek, isoDate } = getFriendlyDateTime();

  // 1. ¿Qué tengo hoy? / Deberes de hoy
  if (lower.includes('qué tengo') || lower.includes('deberes') || lower.includes('tareas')) {
    const pending = (state?.tasks || []).filter(t => !t.completed);
    if (pending.length === 0) {
      return {
        replyText: `🎉 **¡Buenas noticias!** Hoy (${dateString}) no tienes ningún deber pendiente registrado. ¡Todo al día!`,
        actionsExecuted: [],
        webSearch: null
      };
    }
    const list = pending.map(t => {
      const sName = state?.subjects?.find(s => s.id === t.subjectId)?.name || 'General';
      return `• **${sName}**: ${t.title} *(Entrega: ${t.dueDate || 'Sin fecha'})*`;
    }).join('\n');

    return {
      replyText: `📋 **Tus deberes pendientes para estos días:**\n\n${list}\n\n💡 *Consejo:* Puedes pedirme: *"Iniciar pomodoro de 25 minutos"* para comenzar a hacerlos.`,
      actionsExecuted: [],
      webSearch: null
    };
  }

  // 2. Horario / Qué clase me toca
  if (lower.includes('horario') || lower.includes('clase') || lower.includes('aula') || lower.includes('toca')) {
    const todayIndex = dayOfWeek >= 1 && dayOfWeek <= 5 ? dayOfWeek : 1;
    const entries = (state?.schedule || [])
      .filter(e => Number(e.day) === todayIndex)
      .sort((a, b) => (Number(a.period) || 0) - (Number(b.period) || 0));

    if (entries.length === 0) {
      return {
        replyText: `📅 No tienes clases registradas para hoy en tu horario escolar.`,
        actionsExecuted: [],
        webSearch: null
      };
    }

    const scheduleList = entries.map(e => {
      const sName = state?.subjects?.find(s => s.id === e.subjectId)?.name || 'Clase';
      return `• **${e.startTime || ''} - ${e.endTime || ''}**: ${sName} *(Aula: ${e.room || 'General'})*`;
    }).join('\n');

    return {
      replyText: `📅 **Horario escolar para hoy (${dateString}):**\n\n${scheduleList}`,
      actionsExecuted: [],
      webSearch: null
    };
  }

  // 3. Mochila
  if (lower.includes('mochila') || lower.includes('libros')) {
    const materials = state?.materials || [];
    const missing = materials.filter(m => !m.checked);
    if (missing.length === 0) {
      return {
        replyText: `🎒 **¡Mochila 100% lista!** Todos los libros y materiales están marcados como guardados.`,
        actionsExecuted: [],
        webSearch: null
      };
    }
    const missingList = missing.map(m => `• ⭕ ${m.name}`).join('\n');
    return {
      replyText: `🎒 **Aún te faltan por meter en la mochila:**\n\n${missingList}\n\n*Revisa que no se te olvide nada antes de salir.*`,
      actionsExecuted: [],
      webSearch: null
    };
  }

  // 4. Pomodoro
  if (lower.includes('pomodoro') || lower.includes('concentr') || lower.includes('estudiar')) {
    const matchMins = lower.match(/(\d+)\s*(?:min|minutos)/);
    const mins = matchMins ? parseInt(matchMins[1], 10) : 25;
    if (appActionCallbacks.onPomodoroStarted) {
      appActionCallbacks.onPomodoroStarted(mins, 'work');
    }
    return {
      replyText: `⏱️ **¡A por ello!** He iniciado un temporizador Pomodoro de **${mins} minutos** de concentración. ¡Mucho ánimo con el estudio!`,
      actionsExecuted: [{ type: 'pomodoro_started', message: `Pomodoro ${mins}m` }],
      webSearch: null
    };
  }

  // 5. Exámenes
  if (lower.includes('examen') || lower.includes('exámenes')) {
    const exams = (state?.exams || []).filter(e => !e.completed && (e.date || '') >= isoDate);
    if (exams.length === 0) {
      return {
        replyText: `📝 No tienes ningún examen próximo agendado. ¡Momento ideal para repasar fichas!`,
        actionsExecuted: [],
        webSearch: null
      };
    }
    const examList = exams.map(e => {
      const sName = state?.subjects?.find(s => s.id === e.subjectId)?.name || 'General';
      return `• 📌 **${e.date}** -> **${sName}**: ${e.title} *(Temas: ${e.topics || 'Temario'})*`;
    }).join('\n');

    return {
      replyText: `📝 **Tus próximos exámenes:**\n\n${examList}`,
      actionsExecuted: [],
      webSearch: null
    };
  }

  // 6. Si hubo búsqueda en Wikipedia explícita o la encontramos ahora
  if (webSearchResult) {
    return {
      replyText: `📚 **Información encontrada sobre "${webSearchResult.title}":**\n\n${webSearchResult.extract}\n\n🔗 [Ver artículo completo en Wikipedia](${webSearchResult.url})\n\n💡 *Respuesta enciclopédica obtenida de Wikipedia. Para explicaciones pedagógicas detalladas, resolución de problemas y lectura de fotos con IA, conecta Google Gemini gratis en ⚙️.*`,
      actionsExecuted: [],
      webSearch: webSearchResult
    };
  }

  // 7. Búsqueda enciclopédica automática de dudas escolares en Wikipedia
  const cleanSubject = userMessage
    .replace(/^(?:hola|buenas|hey|oye|por favor|dime|sabes|puedes|explícame|explica|cuéntame|qué es|que es|quién fue|quien fue|quién era|quien era|cuál es|cual es|cómo funciona|como funciona|definición de|definicion de|concepto de|resumen de|información de|informacion de|busca|investiga)\s+/i, '')
    .replace(/[¿?\.\!¡]/g, '')
    .trim();

  if (cleanSubject.length >= 3 && !/^(gracias|adiós|adios|hasta luego|ok|vale|nada)$/i.test(cleanSubject)) {
    try {
      const autoSearch = await searchAcademicWeb(cleanSubject);
      if (autoSearch && autoSearch.extract) {
        return {
          replyText: `📚 **${autoSearch.title}**\n\n${autoSearch.extract}\n\n🔗 [Leer artículo completo en Wikipedia](${autoSearch.url})\n\n💡 *Respuesta obtenida de Wikipedia en español. Para que la IA razone ejercicios difíciles, redacte respuestas completas o analice tus apuntes en foto, puedes activar tu clave gratuita de Google Gemini en el botón ⚙️.*`,
          actionsExecuted: [],
          webSearch: autoSearch
        };
      }
    } catch (e) {}
  }

  // 8. Saludos y bienvenida
  if (/^(hola|buenas|buenos días|buenas tardes|buenas noches|hey|saludos|que tal|qué tal)/i.test(lower)) {
    const studentName = state?.student?.name ? ` **${state.student.name}**` : '';
    return {
      replyText: `👋 **¡Hola${studentName}! Soy tu Copiloto Escolar.**
Estoy listo para ayudarte con todo:
• 📅 Pregúntame por tu **horario escolar** de hoy o mañana.
• 📋 Consulta tus **deberes y tareas** pendientes.
• 🎒 Verifica los libros de tu **mochila**.
• 📝 Revisa la fecha de tus **próximos exámenes**.
• ⏱️ Pídeme iniciar un temporizador **Pomodoro**.
• 📚 Hazme preguntas de estudio (ej: *"¿Qué es la fotosíntesis?"*, *"¿Quién fue Pitágoras?"*).

💡 *Para activar el cerebro completo de IA (razonamiento profundo, resolución de problemas paso a paso y análisis de fotos), pulsa en el botón **⚙️ Clave IA** arriba a la derecha.*`,
      actionsExecuted: [],
      webSearch: null
    };
  }

  // 9. Respuesta general de ayuda y orientación
  return {
    replyText: `🤖 **Copiloto Escolar (Modo Básico):**
No encontré una consulta específica en tu mensaje. Aquí tienes algunos ejemplos de lo que puedo hacer ahora mismo:
- 📅 *"¿Qué clases tengo hoy?"*
- 📋 *"¿Qué deberes tengo pendientes?"*
- 🎒 *"¿Qué me falta en la mochila?"*
- 📝 *"¿Cuándo es mi próximo examen?"*
- ⏱️ *"Iniciar pomodoro de 25 minutos"*
- 📚 *"Explícame la revolución francesa"*

💡 *¿Quieres que resuelva dudas complejas o analice fotos de tus apuntes con IA? Pulsa en **⚙️ Clave IA** y conecta tu clave gratuita de Google Gemini en 30 segundos.*`,
    actionsExecuted: [],
    webSearch: null
  };
}

/**
 * Síntesis de voz en español para leer respuestas en voz alta (Text-to-Speech)
 */
export function speakText(text, onEnd) {
  if (!('speechSynthesis' in window)) return;
  stopSpeaking();

  // Limpiar markdown del texto para lectura natural
  const cleanSpeech = text
    .replace(/\*+/g, '')
    .replace(/#+/g, '')
    .replace(/`+/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/[•\-\+]\s+/g, ', ')
    .trim();

  const utterance = new SpeechSynthesisUtterance(cleanSpeech);
  utterance.lang = 'es-ES';
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  // Buscar voz española si está disponible
  const voices = window.speechSynthesis.getVoices();
  const spanishVoice = voices.find(v => v.lang.startsWith('es') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Helena') || v.name.includes('Pablo')));
  if (spanishVoice) {
    utterance.voice = spanishVoice;
  }

  utterance.onend = () => {
    isSpeakingActive = false;
    currentUtterance = null;
    if (onEnd) onEnd();
  };

  utterance.onerror = () => {
    isSpeakingActive = false;
    currentUtterance = null;
    if (onEnd) onEnd();
  };

  isSpeakingActive = true;
  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

/**
 * Detiene cualquier locución de voz activa
 */
export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  isSpeakingActive = false;
  currentUtterance = null;
}

export function isSpeaking() {
  return isSpeakingActive;
}

/**
 * Devuelve y limpia el historial de chat
 */
export function getChatHistory() {
  return chatHistory;
}

export function clearChatHistory() {
  chatHistory = [];
}

export function appendToChatHistory(role, text) {
  chatHistory.push({ role, text, timestamp: Date.now() });
  if (chatHistory.length > 20) {
    chatHistory.shift();
  }
}
