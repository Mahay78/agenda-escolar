/**
 * gamification.js - Sistema de Gamificación, Rachas de Estudio y Logros Académicos
 * Fomenta hábitos de estudio diarios, constancia y celebración de metas.
 */

import { getSetting, setSetting } from './db.js';

export const ACHIEVEMENTS = [
  {
    id: 'first_task',
    title: 'Primer Paso',
    desc: 'Completa tu primera tarea o deber en la agenda',
    icon: '🎯',
    condition: (s) => s.completedTasksCount >= 1
  },
  {
    id: 'tasks_10',
    title: 'Máquina de Tareas',
    desc: 'Completa 10 tareas o deberes escolares',
    icon: '🚀',
    condition: (s) => s.completedTasksCount >= 10
  },
  {
    id: 'streak_3',
    title: 'En Racha',
    desc: 'Mantén una racha de estudio de 3 días consecutivos',
    icon: '🔥',
    condition: (s) => s.currentStreak >= 3
  },
  {
    id: 'streak_7',
    title: 'Semana Perfecta',
    desc: 'Alcanza 7 días seguidos de actividad académica',
    icon: '⚡',
    condition: (s) => s.currentStreak >= 7
  },
  {
    id: 'streak_30',
    title: 'Leyenda del Instituto',
    desc: '¡30 días seguidos de racha y constancia!',
    icon: '👑',
    condition: (s) => s.currentStreak >= 30
  },
  {
    id: 'pomodoro_1',
    title: 'Foco Inicial',
    desc: 'Completa tu primera sesión Pomodoro de 25 minutos',
    icon: '⏱️',
    condition: (s) => s.pomodoroSessionsCount >= 1
  },
  {
    id: 'pomodoro_5',
    title: 'Maestro de la Concentración',
    desc: 'Completa 5 sesiones Pomodoro enfocadas',
    icon: '🍅',
    condition: (s) => s.pomodoroSessionsCount >= 5
  },
  {
    id: 'backpack_ready',
    title: 'Mochila Impecable',
    desc: 'Prepara todos los materiales de taller y mochila para mañana',
    icon: '🎒',
    condition: (s) => s.backpackPackedCount >= 1
  },
  {
    id: 'grades_recorded',
    title: 'Expediente al Día',
    desc: 'Registra tus calificaciones y calcula tus medias',
    icon: '📊',
    condition: (s) => s.gradesCount >= 3
  },
  {
    id: 'flashcards_reviewed',
    title: 'Memoria Prodigiosa',
    desc: 'Repasa fichas de estudio con el método de repetición espaciada',
    icon: '🧠',
    condition: (s) => (s.flashcardsReviewedCount || 0) >= 5
  }
];

const DEFAULT_STATS = {
  currentStreak: 1,
  bestStreak: 1,
  lastActiveDate: null,
  completedTasksCount: 0,
  pomodoroSessionsCount: 0,
  backpackPackedCount: 0,
  gradesCount: 0,
  flashcardsReviewedCount: 0,
  unlockedAchievements: []
};

/**
 * Obtiene la fecha de hoy en formato YYYY-MM-DD local
 */
function getTodayDateStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Calcula la diferencia en días entre dos fechas YYYY-MM-DD
 */
function daysDifference(dateStrA, dateStrB) {
  if (!dateStrA || !dateStrB) return 999;
  const [y1, m1, d1] = dateStrA.split('-').map(Number);
  const [y2, m2, d2] = dateStrB.split('-').map(Number);
  const utcA = Date.UTC(y1, m1 - 1, d1);
  const utcB = Date.UTC(y2, m2 - 1, d2);
  return Math.round(Math.abs(utcB - utcA) / (1000 * 60 * 60 * 24));
}

/**
 * Obtiene las estadísticas de gamificación actuales
 */
export async function getGamificationStats() {
  const data = await getSetting('gamificationStats', DEFAULT_STATS);
  return { ...DEFAULT_STATS, ...data };
}

/**
 * Registra una acción de estudio y actualiza la racha y logros
 * @param {'task_completed'|'pomodoro_completed'|'backpack_packed'|'grade_added'|'app_opened'} actionType 
 * @returns {Promise<{ stats: Object, newlyUnlocked: Array }>}
 */
export async function recordStudyActivity(actionType) {
  const stats = await getGamificationStats();
  const today = getTodayDateStr();

  // 1. Actualizar contadores específicos
  if (actionType === 'task_completed') stats.completedTasksCount++;
  if (actionType === 'pomodoro_completed') stats.pomodoroSessionsCount++;
  if (actionType === 'backpack_packed') stats.backpackPackedCount++;
  if (actionType === 'grade_added') stats.gradesCount++;
  if (actionType === 'flashcards_reviewed') stats.flashcardsReviewedCount = (stats.flashcardsReviewedCount || 0) + 1;

  // 2. Comprobar racha diaria
  if (!stats.lastActiveDate) {
    stats.currentStreak = 1;
    stats.bestStreak = 1;
    stats.lastActiveDate = today;
  } else if (stats.lastActiveDate !== today) {
    const diff = daysDifference(stats.lastActiveDate, today);
    if (diff === 1) {
      // Día consecutivo: aumentar racha
      stats.currentStreak++;
      if (stats.currentStreak > stats.bestStreak) {
        stats.bestStreak = stats.currentStreak;
      }
    } else if (diff > 1) {
      // Racha interrumpida: reiniciar a 1
      stats.currentStreak = 1;
    }
    stats.lastActiveDate = today;
  }

  // 3. Comprobar logros desbloqueados
  const newlyUnlocked = [];
  const currentUnlocked = new Set(stats.unlockedAchievements || []);

  for (const ach of ACHIEVEMENTS) {
    if (!currentUnlocked.has(ach.id) && ach.condition(stats)) {
      currentUnlocked.add(ach.id);
      newlyUnlocked.push(ach);
    }
  }

  stats.unlockedAchievements = Array.from(currentUnlocked);
  await setSetting('gamificationStats', stats);

  return { stats, newlyUnlocked };
}
