/**
 * gamification-ui.js - Interfaz de gamificación (rachas, XP, logros y mapa de calor).
 *
 * Extraído de app.js (Roadmap Items 25, 26 y 28). La lógica de cálculo vive en
 * gamification.js; este módulo se encarga únicamente de pintarla en el DOM.
 */

import {
  recordStudyActivity,
  getGamificationStats,
  getRankInfo,
  generateActivityHeatmap,
  ACHIEVEMENTS
} from '../gamification.js';
import { showToast, escapeHTML } from './utils.js';

export async function initGamification() {
  const { stats, newlyUnlocked, streakSavedByFreeze } = await recordStudyActivity('app_opened');
  updateGamificationUI(stats);
  if (streakSavedByFreeze) {
    showToast('🧊 ¡Tu racha se ha protegido gracias al Congelador de Racha!', 'success');
  }
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

export function updateGamificationUI(stats) {
  const headerDays = document.getElementById('header-streak-days');
  const drawerText = document.getElementById('drawer-streak-text');
  const modalStreakDays = document.getElementById('modal-streak-days');
  const statBestStreak = document.getElementById('stat-best-streak');
  const statTasksDone = document.getElementById('stat-tasks-done');
  const statPomoSessions = document.getElementById('stat-pomo-sessions');

  const modalRankBadge = document.getElementById('modal-rank-badge');
  const modalFreezeBadge = document.getElementById('modal-freeze-badge');
  const modalXpTotal = document.getElementById('modal-xp-total');
  const modalXpNext = document.getElementById('modal-xp-next');
  const modalXpFill = document.getElementById('modal-xp-fill');

  const days = stats.currentStreak || 1;
  if (headerDays) headerDays.textContent = days;
  if (drawerText) drawerText.textContent = `${days} ${days === 1 ? 'día' : 'días'}`;
  if (modalStreakDays) modalStreakDays.textContent = `${days} ${days === 1 ? 'Día' : 'Días'} en Racha`;
  if (statBestStreak) statBestStreak.textContent = stats.bestStreak || 1;
  if (statTasksDone) statTasksDone.textContent = stats.completedTasksCount || 0;
  if (statPomoSessions) statPomoSessions.textContent = stats.pomodoroSessionsCount || 0;

  // Actualizar Rangos y XP (Roadmap Item 25)
  const rankData = getRankInfo(stats.xp || 0);
  if (modalRankBadge) {
    modalRankBadge.textContent = `${rankData.rank.icon} ${rankData.rank.title} (Nivel ${rankData.rank.level})`;
    modalRankBadge.style.borderColor = rankData.rank.color;
    modalRankBadge.style.color = rankData.rank.color;
  }

  // Congelador de Racha (Roadmap Item 28)
  const freezeCount = stats.streakFreeze?.available ?? 1;
  if (modalFreezeBadge) {
    modalFreezeBadge.textContent = freezeCount > 0
      ? `🧊 ${freezeCount} ${freezeCount === 1 ? 'Congelador Disponible' : 'Congeladores Disponibles'}`
      : '🧊 Sin Congelador';
  }

  if (modalXpTotal) {
    modalXpTotal.textContent = `${stats.xp || 0} XP Totales`;
  }
  if (modalXpNext) {
    if (rankData.nextRank) {
      modalXpNext.textContent = `Faltan ${rankData.neededForNext} XP para ${rankData.nextRank.title}`;
    } else {
      modalXpNext.textContent = '¡Rango Máximo Alcanzado! 👑';
    }
  }
  if (modalXpFill) {
    modalXpFill.style.width = `${rankData.progress}%`;
  }

  // Renderizar Mapa de Calor de 70 días (Roadmap Item 26)
  renderActivityHeatmap(stats.activityLog || {});
}

export function renderActivityHeatmap(activityLog = {}) {
  const grid = document.getElementById('heatmap-grid');
  const activeCountEl = document.getElementById('heatmap-total-active');
  if (!grid) return;

  const data = generateActivityHeatmap(activityLog, 70);
  let activeDays = 0;

  grid.innerHTML = data.map(item => {
    if (item.count > 0) activeDays++;
    const lvlClass = item.level > 0 ? `lvl-${item.level}` : '';
    const title = `${item.date}: ${item.count} ${item.count === 1 ? 'actividad' : 'actividades'}`;
    return `<div class="heatmap-cell ${lvlClass}" title="${title}" data-date="${item.date}"></div>`;
  }).join('');

  if (activeCountEl) {
    activeCountEl.textContent = `${activeDays} ${activeDays === 1 ? 'día activo' : 'días activos'}`;
  }
}

export function renderAchievementsList(stats) {
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
