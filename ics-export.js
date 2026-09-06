/**
 * ics-export.js - Generador de archivos de calendario iCalendar (.ics) estándar RFC 5545
 * 100% Offline, compatible con Google Calendar, Apple Calendar, Microsoft Outlook y apps móviles.
 */

/**
 * Formatea una fecha o cadena YYYY-MM-DD a formato iCalendar (YYYYMMDD o YYYYMMDDTHHmmssZ)
 * @param {string|Date} dateInput 
 * @param {string} [timeStr] Hora en formato HH:mm
 * @returns {string}
 */
function formatICSDate(dateInput, timeStr = null) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  
  if (isNaN(d.getTime())) {
    const now = new Date();
    return now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  const pad = (n) => String(n).padStart(2, '0');

  if (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    d.setHours(hours, minutes, 0, 0);
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hours)}${pad(minutes)}00`;
  } else {
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  }
}

/**
 * Limpia y escapa texto para formato iCalendar
 * @param {string} text 
 * @returns {string}
 */
function escapeICSText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n');
}

/**
 * Descarga un contenido iCalendar en el dispositivo del usuario
 * @param {string} icsContent 
 * @param {string} filename 
 */
export function downloadICS(icsContent, filename = 'agenda-escolar.ics') {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Exporta todos los exámenes a un archivo .ics con alarma recordatoria previa de 24h
 * @param {Array} exams Lista de exámenes
 * @param {Array} subjects Lista de asignaturas
 * @returns {string} Contenido .ics
 */
export function generateExamsICS(exams, subjects = []) {
  const subjectMap = new Map((subjects || []).map((s) => [s.id, s]));
  const dtStamp = formatICSDate(new Date(), '12:00') + 'Z';

  let lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Agenda Escolar PWA//Exámenes y Evaluaciones//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Exámenes - Agenda Escolar',
    'X-WR-TIMEZONE:Europe/Madrid'
  ];

  for (const exam of exams) {
    const sub = subjectMap.get(exam.subjectId) || { name: 'Examen', icon: '📝', classroom: '' };
    const dateStr = exam.date;
    const timeStr = exam.time || '09:00';
    const examTitle = exam.title || exam.topics || 'Examen';
    const summary = `${sub.icon ? sub.icon + ' ' : ''}Examen: ${sub.name} - ${examTitle}`;
    
    const dtStart = formatICSDate(dateStr, timeStr);
    
    let dtEnd = dtStart;
    if (/T\d{6}/.test(dtStart)) {
      const [h, m] = timeStr.split(':').map(Number);
      const endH = (h + 1).toString().padStart(2, '0');
      dtEnd = dtStart.replace(/T\d{4}/, `T${endH}${m.toString().padStart(2, '0')}`);
    }

    const description = [
      exam.topics ? `Temario: ${exam.topics}` : '',
      exam.notes ? `Notas: ${exam.notes}` : '',
      exam.weight ? `Ponderación: ${exam.weight}%` : '',
      `Asignatura: ${sub.name}`,
      sub.teacher ? `Profesor/a: ${sub.teacher}` : ''
    ].filter(Boolean).join('\\n');

    const location = sub.classroom ? escapeICSText(sub.classroom) : '';
    const uid = `exam_${exam.id || Date.now()}_${Math.random().toString(36).substring(2, 7)}@agenda-escolar.app`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${escapeICSText(summary)}`);
    if (description) lines.push(`DESCRIPTION:${escapeICSText(description)}`);
    if (location) lines.push(`LOCATION:${location}`);
    lines.push('STATUS:CONFIRMED');

    // Alarma recordatoria 1 día antes (24 horas)
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-P1D');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:Recordatorio: Mañana tienes examen de ${escapeICSText(sub.name)}`);
    lines.push('END:VALARM');

    // Alarma recordatoria 2 horas antes
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-PT2H');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:En 2 horas comienza el examen de ${escapeICSText(sub.name)}`);
    lines.push('END:VALARM');

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Exporta el Horario Semanal como eventos recurrentes semanales (Lunes a Viernes)
 * @param {Array} schedule Celdas del horario
 * @param {Array} subjects Asignaturas
 * @param {Array} timeSlots Franjas horarias
 * @returns {string} Contenido .ics
 */
export function generateScheduleICS(schedule, subjects = [], timeSlots = []) {
  const subjectMap = new Map((subjects || []).map((s) => [s.id, s]));
  const slotMap = new Map((timeSlots || []).map((slot) => [slot.index, slot]));

  const dayCodes = ['MO', 'TU', 'WE', 'TH', 'FR']; // 0 = Lunes, 4 = Viernes
  const dtStamp = formatICSDate(new Date(), '08:00') + 'Z';

  // Buscar el próximo lunes para usarlo como fecha base del evento recurrente
  const baseMonday = new Date();
  const currentDayOfWeek = baseMonday.getDay();
  const daysUntilNextMonday = ((1 - currentDayOfWeek + 7) % 7) || 7;
  baseMonday.setDate(baseMonday.getDate() + (currentDayOfWeek === 1 ? 0 : daysUntilNextMonday));

  let lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Agenda Escolar PWA//Horario Semanal Escolar//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Horario Escolar - Agenda',
    'X-WR-TIMEZONE:Europe/Madrid'
  ];

  for (const cell of schedule) {
    if (!cell.subjectId) continue;
    const sub = subjectMap.get(cell.subjectId);
    if (!sub) continue;

    const slot = slotMap.get(cell.slotIndex);
    if (!slot || slot.isBreak) continue;

    const dayIndex = cell.day;
    const dayCode = dayCodes[dayIndex] || 'MO';

    const eventDate = new Date(baseMonday);
    eventDate.setDate(baseMonday.getDate() + dayIndex);

    const startTime = slot.start || '08:30';
    const endTime = slot.end || '09:25';

    const dtStart = formatICSDate(eventDate, startTime);
    const dtEnd = formatICSDate(eventDate, endTime);

    const summary = `${sub.icon ? sub.icon + ' ' : ''}${sub.name}`;
    const description = [
      `Asignatura: ${sub.name}`,
      sub.teacher ? `Profesor: ${sub.teacher}` : '',
      sub.classroom ? `Aula: ${sub.classroom}` : '',
      `Franja: ${slot.label || (slot.start + ' - ' + slot.end)}`
    ].filter(Boolean).join('\\n');

    const location = sub.classroom ? escapeICSText(sub.classroom) : '';
    const uid = `sched_d${dayIndex}_s${cell.slotIndex}_${sub.id}@agenda-escolar.app`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${dayCode}`);
    lines.push(`SUMMARY:${escapeICSText(summary)}`);
    if (description) lines.push(`DESCRIPTION:${escapeICSText(description)}`);
    if (location) lines.push(`LOCATION:${location}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Exporta un examen individual a archivo .ics
 * @param {Object} exam 
 * @param {Object} subject 
 */
export function exportSingleExam(exam, subject) {
  const ics = generateExamsICS([exam], subject ? [subject] : []);
  const safeName = (subject?.name || 'examen').toLowerCase().replace(/[^a-z0-9]/g, '_');
  downloadICS(ics, `examen_${safeName}_${exam.date || 'fecha'}.ics`);
}
