/**
 * flashcards.js - Fichas de Estudio y Repaso Espaciado (Sistema Leitner Adaptativo)
 * Optimiza la memoria a largo plazo para exámenes y definiciones clave.
 */

import { getAll, saveItem, deleteItem } from './db.js';

// Intervalos en días según la caja Leitner (1 a 5)
export const LEITNER_INTERVALS = {
  1: 1,   // Caja 1: Aprendizaje inicial -> Repasar cada día
  2: 3,   // Caja 2: Familiar -> Repasar cada 3 días
  3: 7,   // Caja 3: En progreso -> Repasar cada semana (7 días)
  4: 14,  // Caja 4: Avanzado -> Repasar cada 2 semanas (14 días)
  5: 30   // Caja 5: Dominado / Memoria a largo plazo -> Repasar cada mes (30 días)
};

export const BOX_NAMES = {
  1: 'Aprendiendo',
  2: 'Familiar',
  3: 'En progreso',
  4: 'Avanzado',
  5: 'Dominada'
};

/**
 * Retorna la fecha local en formato YYYY-MM-DD
 */
export function getLocalTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Añade N días a una fecha YYYY-MM-DD
 */
export function addDaysToDateString(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const newY = date.getFullYear();
  const newM = String(date.getMonth() + 1).padStart(2, '0');
  const newD = String(date.getDate()).padStart(2, '0');
  return `${newY}-${newM}-${newD}`;
}

/**
 * Crea una nueva ficha de estudio
 */
export function createFlashcard({ subjectId, front, back, hint = '' }) {
  const today = getLocalTodayDateString();
  return {
    id: `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    subjectId,
    front: front.trim(),
    back: back.trim(),
    hint: hint ? hint.trim() : '',
    box: 1,
    repetitions: 0,
    easeFactor: 2.5,  // Factor de Facilidad SM-2 (por defecto 2.5)
    interval: 0,     // Días de intervalo SM-2
    lastReviewed: null,
    nextReviewDate: today,
    createdAt: new Date().toISOString()
  };
}

/**
 * Comprueba si una ficha toca ser repasada en o antes de la fecha dada
 */
export function isCardDue(card, targetDate = getLocalTodayDateString()) {
  if (!card.nextReviewDate) return true;
  return card.nextReviewDate <= targetDate;
}

/**
 * Filtra las fichas pendientes de repaso para hoy
 */
export function getDueFlashcards(cards, targetDate = getLocalTodayDateString(), subjectId = 'all') {
  return cards
    .filter(c => {
      const matchesSubject = subjectId === 'all' || c.subjectId === subjectId;
      return matchesSubject && isCardDue(c, targetDate);
    })
    .sort((a, b) => (a.box || 1) - (b.box || 1));
}

/**
 * Calcula estadísticas globales sobre el mazo de fichas
 */
export function calculateFlashcardStats(cards, targetDate = getLocalTodayDateString()) {
  const total = cards.length;
  if (total === 0) {
    return { total: 0, dueToday: 0, mastered: 0, learning: 0, masteryRate: 0 };
  }

  const dueToday = cards.filter(c => isCardDue(c, targetDate)).length;
  const mastered = cards.filter(c => c.box === 5).length;
  const learning = cards.filter(c => (c.box || 1) <= 2).length;
  const advanced = cards.filter(c => (c.box || 1) >= 4).length;
  const masteryRate = Math.round((advanced / total) * 100);

  return {
    total,
    dueToday,
    mastered,
    learning,
    masteryRate
  };
}

/**
 * Comprueba la similitud textual para el Modo Escritura (Roadmap Item 15)
 * @param {string} userAnswer Respuesta escrita por el estudiante
 * @param {string} correctAnswer Respuesta original de la ficha
 * @returns {{ isCorrect: boolean, similarity: number, feedback: string }}
 */
export function checkAnswerSimilarity(userAnswer, correctAnswer) {
  if (!userAnswer || !correctAnswer) {
    return { isCorrect: false, similarity: 0, feedback: 'Escribe una respuesta para comprobar' };
  }

  const normalize = (str) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const userNorm = normalize(userAnswer);
  const correctNorm = normalize(correctAnswer);

  if (userNorm === correctNorm) {
    return { isCorrect: true, similarity: 100, feedback: '¡Excelente! Respuesta exacta 🎯' };
  }

  // Comprobar si la respuesta del usuario está contenida en la respuesta larga o viceversa
  if (correctNorm.includes(userNorm) && userNorm.length > 3) {
    const similarity = Math.round((userNorm.length / correctNorm.length) * 100);
    return { isCorrect: similarity >= 60, similarity, feedback: '¡Vas por muy buen camino! Cubre los conceptos clave.' };
  }

  // Comparación por palabras clave
  const userWords = new Set(userNorm.split(' ').filter(w => w.length > 3));
  const correctWords = new Set(correctNorm.split(' ').filter(w => w.length > 3));

  if (correctWords.size > 0) {
    let matches = 0;
    userWords.forEach(w => {
      if (correctWords.has(w)) matches++;
    });
    const wordSimilarity = Math.round((matches / correctWords.size) * 100);
    if (wordSimilarity >= 60) {
      return { isCorrect: true, similarity: wordSimilarity, feedback: '¡Muy bien! Has incluido las palabras clave.' };
    }
  }

  // Algoritmo de distancia de Levenshtein para palabras o respuestas cortas
  const a = userNorm;
  const b = correctNorm;
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[a.length][b.length];
  const maxLen = Math.max(a.length, b.length);
  const similarity = Math.max(0, Math.round(((maxLen - distance) / maxLen) * 100));

  if (similarity >= 75) {
    return { isCorrect: true, similarity, feedback: '¡Correcto! Solo pequeños fallos ortográficos o de puntuación.' };
  }

  return {
    isCorrect: false,
    similarity,
    feedback: 'Respuesta diferente. ¡Revisa la solución para reforzar tu memoria!'
  };
}

/**
 * Procesa la respuesta del alumno utilizando el algoritmo SuperMemo SM-2 (Roadmap Item 14)
 * @param {Object} card Ficha actual
 * @param {'again'|'hard'|'good'|'easy'} rating Calificación del repaso
 * @returns {Object} Ficha actualizada con nuevos intervalos SM-2 y caja Leitner
 */
export function processCardReview(card, rating) {
  const today = getLocalTodayDateString();
  let ef = typeof card.easeFactor === 'number' ? card.easeFactor : 2.5;
  let reps = card.repetitions || 0;
  let interval = card.interval || 0;
  let grade = 4; // Por defecto 'good'

  if (rating === 'again' || rating === 'hard') {
    grade = rating === 'again' ? 1 : 2;
  } else if (rating === 'good') {
    grade = 4;
  } else if (rating === 'easy') {
    grade = 5;
  }

  // 1. Cálculo de intervalo y repeticiones según SM-2
  if (grade < 3) {
    // Fallo: reiniciar repeticiones e intervalo a 1 día
    reps = 0;
    interval = 1;
  } else {
    // Éxito
    if (reps === 0) {
      interval = 1;
    } else if (reps === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * ef);
    }
    reps++;
  }

  // 2. Actualización del factor de facilidad (EF')
  // Fórmula oficial SM-2: EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  ef = ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (ef < 1.3) ef = 1.3; // Límite inferior estándar SM-2
  ef = Math.round(ef * 100) / 100;

  // 3. Mapeo a caja Leitner (1 a 5) para compatibilidad con la interfaz
  let newBox = 1;
  if (interval >= 30) newBox = 5;
  else if (interval >= 14) newBox = 4;
  else if (interval >= 7) newBox = 3;
  else if (interval >= 3) newBox = 2;
  else newBox = 1;

  const nextReview = addDaysToDateString(today, interval);

  return {
    ...card,
    box: newBox,
    repetitions: reps,
    easeFactor: ef,
    interval: interval,
    lastReviewed: today,
    nextReviewDate: nextReview
  };
}

/**
 * Semilla de fichas de muestra iniciales si el alumno no tiene ninguna
 */
export async function seedSampleFlashcardsIfNeeded(subjects = []) {
  const existing = await getAll('flashcards');
  if (existing.length > 0) return existing;

  const findSubId = (keywords) => {
    const found = subjects.find(s => keywords.some(k => s.name?.toLowerCase().includes(k)));
    return found ? found.id : (subjects[0]?.id || 'sub_general');
  };

  const artId = findSubId(['historia', 'arte', 'dibujo']);
  const lenguaId = findSubId(['lengua', 'literatura']);
  const filosofiaId = findSubId(['filosofía', 'valores']);

  const sampleCards = [
    {
      subjectId: artId,
      front: '¿Cuáles son las 4 características clave de la arquitectura gótica?',
      back: '1. Arco ojival o apuntado\n2. Bóveda de crucería\n3. Contrafuertes y arbotantes exteriores\n4. Grandes ventanales con vidrieras luminosas (busca la luz divina).',
      hint: 'Piensa en las catedrales de León, Burgos y Notre Dame.'
    },
    {
      subjectId: artId,
      front: '¿Qué es el claroscuro y quién fue su máximo exponente barroco?',
      back: 'Técnica pictórica que contrasta zonas fuertemente iluminadas con sombras profundas para crear volumen y dramatismo. Su máximo exponente fue Caravaggio (Tenebrismo).',
      hint: 'Pintor italiano del siglo XVII, obras dramáticas y teatrales.'
    },
    {
      subjectId: lenguaId,
      front: '¿Qué es una metáfora y en qué se diferencia de una comparación o símil?',
      back: 'La metáfora identifica directamente dos términos (A es B: "Tus ojos son dos luceros"). El símil o comparación utiliza un nexo comparativo explícito (A es como B: "Tus ojos son como dos luceros").',
      hint: 'Fíjate en la presencia o ausencia de la palabra "como".'
    },
    {
      subjectId: filosofiaId,
      front: '¿En qué consiste el "Mito de la Caverna" de Platón?',
      back: 'Alegoría que describe a prisioneros encadenados en una cueva viendo sombras proyectadas que creen reales. Representa el paso del mundo sensible (apariencias/opinión o doxa) al mundo inteligible (conocimiento verdadero de las Ideas o episteme).',
      hint: 'Sombras en la pared frente a la luz del Sol en el exterior.'
    }
  ];

  const created = [];
  for (const item of sampleCards) {
    const card = createFlashcard(item);
    await saveItem('flashcards', card);
    created.push(card);
  }

  return created;
}
