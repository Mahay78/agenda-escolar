/**
 * notifications.js - Gestor de Recordatorios y Notificaciones Locales (Web Notifications API)
 * Avisa con antelación de exámenes cercanos y deberes pendientes que vencen hoy o mañana.
 */

import { getSetting, setSetting } from './db.js';

/**
 * Comprueba si las notificaciones están soportadas por el navegador
 */
export function areNotificationsSupported() {
  return 'Notification' in window;
}

/**
 * Obtiene el estado actual del permiso de notificación
 */
export function getNotificationPermission() {
  if (!areNotificationsSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Solicita permiso al usuario para enviar notificaciones
 */
export async function requestNotificationPermission() {
  if (!areNotificationsSupported()) {
    throw new Error('Tu navegador no soporta notificaciones locales.');
  }

  const permission = await Notification.requestPermission();
  const enabled = permission === 'granted';
  await setSetting('notificationsEnabled', enabled);
  return permission;
}

/**
 * Envía una notificación de prueba inmediata
 */
export async function sendTestNotification() {
  if (getNotificationPermission() !== 'granted') {
    const perm = await requestNotificationPermission();
    if (perm !== 'granted') {
      throw new Error('Permiso de notificaciones no concedido.');
    }
  }

  const n = new Notification('🎒 Agenda Escolar', {
    body: '¡Las notificaciones y recordatorios locales están activos y funcionando correctamente!',
    icon: './icon.svg',
    badge: './icon.svg',
    tag: 'test-notification'
  });

  return n;
}

/**
 * Comprueba tareas y exámenes pendientes y dispara notificaciones locales
 * @param {Array} tasks Lista de tareas
 * @param {Array} exams Lista de exámenes
 * @param {Array} subjects Lista de asignaturas
 */
export async function checkDueReminders(tasks = [], exams = [], subjects = []) {
  if (!areNotificationsSupported() || Notification.permission !== 'granted') {
    return;
  }

  const enabled = await getSetting('notificationsEnabled', true);
  if (!enabled) return;

  const subjectMap = new Map((subjects || []).map(s => [s.id, s]));

  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

  // Registro de notificaciones ya enviadas hoy en localStorage para evitar spam
  const storageKey = `notified_reminders_${todayStr}`;
  let alreadyNotified = [];
  try {
    alreadyNotified = JSON.parse(localStorage.getItem(storageKey) || '[]');
  } catch (e) {
    alreadyNotified = [];
  }
  const notifiedSet = new Set(alreadyNotified);

  // 1. Comprobar Exámenes de hoy y mañana
  for (const exam of exams) {
    if (notifiedSet.has(`exam_${exam.id}`)) continue;

    if (exam.date === todayStr) {
      const sub = subjectMap.get(exam.subjectId) || { name: 'Examen' };
      new Notification(`🚨 ¡HOY TIENES EXAMEN! - ${sub.name}`, {
        body: `Examen de ${sub.name} programado para hoy a las ${exam.time || 'primera hora'}. ¡Mucho éxito!`,
        icon: './icon.svg',
        tag: `exam_${exam.id}`
      });
      notifiedSet.add(`exam_${exam.id}`);
    } else if (exam.date === tomorrowStr) {
      const sub = subjectMap.get(exam.subjectId) || { name: 'Examen' };
      new Notification(`📝 Recordatorio: Examen Mañana`, {
        body: `Mañana tienes examen de ${sub.name}${exam.topics ? ': ' + exam.topics : ''}. Repasa tus apuntes.`,
        icon: './icon.svg',
        tag: `exam_${exam.id}`
      });
      notifiedSet.add(`exam_${exam.id}`);
    }
  }

  // 2. Comprobar Deberes / Tareas pendientes para hoy
  for (const task of tasks) {
    if (task.status === 'completed' || notifiedSet.has(`task_${task.id}`)) continue;

    if (task.dueDate === todayStr) {
      const sub = subjectMap.get(task.subjectId) || { name: 'Tarea' };
      new Notification(`📋 Deberes para Hoy: ${task.title || 'Tarea'}`, {
        body: `Tienes pendiente la tarea de ${sub.name} para entregar hoy.`,
        icon: './icon.svg',
        tag: `task_${task.id}`
      });
      notifiedSet.add(`task_${task.id}`);
    }
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(notifiedSet)));
  } catch (e) {
    // Ignorar error de storage
  }
}
