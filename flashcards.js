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
 * Procesa la respuesta del alumno a una ficha según el sistema Leitner
 * @param {Object} card Ficha actual
 * @param {'hard'|'good'|'easy'} rating Calificación: difícil, regular o fácil
 * @returns {Object} Ficha actualizada
 */
export function processCardReview(card, rating) {
  const today = getLocalTodayDateString();
  const currentBox = card.box || 1;
  let newBox = currentBox;

  if (rating === 'hard') {
    // Si falla o le resulta muy difícil, vuelve a la caja 1
    newBox = 1;
  } else if (rating === 'good') {
    // Si la sabe regular, si estaba en 1 pasa a 2; si ya estaba en 2+, se mantiene en la misma caja
    newBox = currentBox === 1 ? 2 : currentBox;
  } else if (rating === 'easy') {
    // Si le resulta fácil, asciende a la siguiente caja (máximo caja 5)
    newBox = Math.min(currentBox + 1, 5);
  }

  const intervalDays = LEITNER_INTERVALS[newBox] || 1;
  const nextReview = addDaysToDateString(today, intervalDays);

  return {
    ...card,
    box: newBox,
    repetitions: (card.repetitions || 0) + 1,
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
