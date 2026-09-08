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
  },
  {
    id: 'xp_100',
    title: 'Estratega Académico',
    desc: 'Alcanza 100 puntos de experiencia (Nivel 2)',
    icon: '⚡',
    condition: (s) => (s.xp || 0) >= 100
  },
  {
    id: 'xp_300',
    title: 'Erudito del Saber',
    desc: 'Alcanza 300 puntos de experiencia (Nivel 3)',
    icon: '🔮',
    condition: (s) => (s.xp || 0) >= 300
  },
  {
    id: 'xp_700',
    title: 'Máster Académico Supremo',
    desc: '¡Alcanza 700 puntos de experiencia y la cúspide académica!',
    icon: '👑',
    condition: (s) => (s.xp || 0) >= 700
  }
];

export const RANKS = [
  { level: 1, title: 'Novato', icon: '🌱', minXp: 0, maxXp: 99, color: '#94a3b8' },
  { level: 2, title: 'Estratega', icon: '⚡', minXp: 100, maxXp: 299, color: '#3b82f6' },
  { level: 3, title: 'Erudito', icon: '🧠', minXp: 300, maxXp: 699, color: '#8b5cf6' },
  { level: 4, title: 'Máster Académico', icon: '👑', minXp: 700, maxXp: Infinity, color: '#f59e0b' }
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
  xp: 0,
  activityLog: {},
  streakFreeze: { available: 1, usedDates: [] },
  unlockedAchievements: []
};

/**
 * Obtiene la información del rango y progreso según XP actual
 */
export function getRankInfo(xp = 0) {
  let currentRank = RANKS[0];
  let nextRank = RANKS[1];

  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].minXp) {
      currentRank = RANKS[i];
      nextRank = RANKS[i + 1] || null;
    }
  }

  let progress = 100;
  let xpInLevel = xp - currentRank.minXp;
  let neededForNext = 0;

  if (nextRank) {
    const range = nextRank.minXp - currentRank.minXp;
    neededForNext = nextRank.minXp - xp;
    progress = Math.min(100, Math.max(0, Math.round((xpInLevel / range) * 100)));
  }

  return {
    rank: currentRank,
    nextRank,
    xp,
    xpInLevel,
    neededForNext,
    progress
  };
}

/**
 * Genera la matriz del mapa de calor de actividad diaria (estilo GitHub)
 */
export function generateActivityHeatmap(activityLog = {}, days = 70) {
  const result = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const count = activityLog[dateStr] || 0;

    let level = 0;
    if (count >= 1 && count <= 2) level = 1;
    else if (count >= 3 && count <= 5) level = 2;
    else if (count >= 6 && count <= 8) level = 3;
    else if (count >= 9) level = 4;

    result.push({
      date: dateStr,
      count,
      level,
      dayOfWeek: d.getDay()
    });
  }
  return result;
}

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
 * Registra una acción de estudio y actualiza la racha, XP y logros
 * @param {'task_completed'|'pomodoro_completed'|'backpack_packed'|'grade_added'|'flashcards_reviewed'|'app_opened'} actionType 
 * @returns {Promise<{ stats: Object, newlyUnlocked: Array, xpGained: number, streakSavedByFreeze: boolean }>}
 */
export async function recordStudyActivity(actionType) {
  const stats = await getGamificationStats();
  const today = getTodayDateStr();

  // Asegurar estructura de campos nuevos
  stats.xp = stats.xp || 0;
  stats.activityLog = stats.activityLog || {};
  stats.streakFreeze = stats.streakFreeze || { available: 1, usedDates: [] };

  // 1. Asignar XP y contadores específicos
  let xpGained = 0;
  if (actionType === 'task_completed') {
    stats.completedTasksCount = (stats.completedTasksCount || 0) + 1;
    xpGained = 15;
  } else if (actionType === 'pomodoro_completed') {
    stats.pomodoroSessionsCount = (stats.pomodoroSessionsCount || 0) + 1;
    xpGained = 25;
  } else if (actionType === 'backpack_packed') {
    stats.backpackPackedCount = (stats.backpackPackedCount || 0) + 1;
    xpGained = 10;
  } else if (actionType === 'grade_added') {
    stats.gradesCount = (stats.gradesCount || 0) + 1;
    xpGained = 10;
  } else if (actionType === 'flashcards_reviewed') {
    stats.flashcardsReviewedCount = (stats.flashcardsReviewedCount || 0) + 1;
    xpGained = 10;
  } else if (actionType === 'app_opened') {
    xpGained = 2;
  }

  stats.xp += xpGained;

  // Registrar en el log de actividad diario
  stats.activityLog[today] = (stats.activityLog[today] || 0) + 1;

  // 2. Comprobar racha diaria y Congelador de Racha (Streak Freeze)
  let streakSavedByFreeze = false;
  if (!stats.lastActiveDate) {
    stats.currentStreak = 1;
    stats.bestStreak = 1;
    stats.lastActiveDate = today;
  } else if (stats.lastActiveDate !== today) {
    const diff = daysDifference(stats.lastActiveDate, today);
    if (diff === 1) {
      // Día consecutivo
      stats.currentStreak++;
      if (stats.currentStreak > stats.bestStreak) {
        stats.bestStreak = stats.currentStreak;
      }
      // Cada 7 días de racha premiar con un congelador extra (máximo 2)
      if (stats.currentStreak % 7 === 0 && stats.streakFreeze.available < 2) {
        stats.streakFreeze.available++;
      }
    } else if (diff === 2 && stats.streakFreeze.available > 0) {
      // Faltó un día pero tenía un congelador disponible: salvar la racha
      stats.streakFreeze.available--;
      stats.streakFreeze.usedDates.push(stats.lastActiveDate);
      stats.currentStreak++;
      streakSavedByFreeze = true;
      if (stats.currentStreak > stats.bestStreak) {
        stats.bestStreak = stats.currentStreak;
      }
    } else if (diff > 1) {
      // Racha interrumpida
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

  return { stats, newlyUnlocked, xpGained, streakSavedByFreeze };
}
