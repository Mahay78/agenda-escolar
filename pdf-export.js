/**
 * pdf-export.js - Generador de documentos PDF 100% Offline con jsPDF
 * Genera Horario Escolar, Boletín de Calificaciones, Dossier de Proyectos y Apuntes con fotos.
 */

/**
 * Carga el script de jsPDF de forma perezosa si no está en window
 * @returns {Promise<Function>} Constructor jsPDF
 */
async function loadJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) {
    return window.jspdf.jsPDF;
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src*="jspdf"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.jspdf.jsPDF));
      existingScript.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.src = './libs/jspdf.umd.min.js';
    script.onload = () => {
      if (window.jspdf && window.jspdf.jsPDF) {
        resolve(window.jspdf.jsPDF);
      } else {
        reject(new Error('jsPDF no se cargó correctamente.'));
      }
    };
    script.onerror = (err) => reject(new Error('No se pudo cargar la librería jsPDF: ' + err));
    document.head.appendChild(script);
  });
}

/**
 * Convierte color HEX a RGB [r, g, b]
 * @param {string} hex 
 * @returns {[number, number, number]}
 */
function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return [70, 70, 70];
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return [70, 70, 70];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Exporta el Horario Semanal a PDF apaisado de alta calidad
 * @param {Array} schedule 
 * @param {Array} subjects 
 * @param {Array} timeSlots 
 * @param {Object} studentInfo 
 */
export async function exportSchedulePDF(schedule, subjects = [], timeSlots = [], studentInfo = {}) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 14;

  const subjectMap = new Map((subjects || []).map(s => [s.id, s]));
  const days = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES'];

  // Encabezado decorativo
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(margin, margin, pageWidth - margin * 2, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('HORARIO ESCOLAR SEMANAL', margin + 6, margin + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  const infoText = `${studentInfo.studentName || 'Estudiante'}  •  ${studentInfo.course || 'Curso Académico'}  •  ${studentInfo.schoolName || 'Instituto'}`;
  doc.text(infoText, margin + 6, margin + 17);

  // Dimensiones de la tabla
  const tableStartY = margin + 26;
  const colTimeWidth = 28;
  const colDayWidth = (pageWidth - margin * 2 - colTimeWidth) / 5;
  const usableHeight = pageHeight - tableStartY - margin - 4;
  const rowHeight = Math.min(22, usableHeight / (timeSlots.length + 1));

  // Cabecera de columnas
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, tableStartY, pageWidth - margin * 2, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  doc.text('HORA', margin + colTimeWidth / 2, tableStartY + 5.5, { align: 'center' });
  days.forEach((day, i) => {
    const x = margin + colTimeWidth + (i * colDayWidth) + (colDayWidth / 2);
    doc.text(day, x, tableStartY + 5.5, { align: 'center' });
  });

  // Filas por franja horaria
  let currentY = tableStartY + 8;

  timeSlots.forEach((slot) => {
    // Si es recreo
    if (slot.isBreak) {
      doc.setFillColor(254, 243, 199); // Amarillo claro
      doc.rect(margin, currentY, pageWidth - margin * 2, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      const breakText = `☕ ${slot.label || 'RECREO'} (${slot.start} - ${slot.end})`;
      doc.text(breakText, pageWidth / 2, currentY + 5, { align: 'center' });
      currentY += 7;
      return;
    }

    // Columna de hora
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, currentY, colTimeWidth, rowHeight, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, currentY, colTimeWidth, rowHeight, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(slot.label || '', margin + colTimeWidth / 2, currentY + (rowHeight / 2) - 2, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`${slot.start} - ${slot.end}`, margin + colTimeWidth / 2, currentY + (rowHeight / 2) + 3, { align: 'center' });

    // Días Lunes a Viernes
    for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
      const cellX = margin + colTimeWidth + (dayIndex * colDayWidth);
      const match = schedule.find(s => s.day === dayIndex && s.slotIndex === slot.index);

      if (match && match.subjectId) {
        const sub = subjectMap.get(match.subjectId);
        if (sub) {
          const [r, g, b] = hexToRgb(sub.color);
          // Fondo suave
          doc.setFillColor(Math.min(255, r + 185), Math.min(255, g + 185), Math.min(255, b + 185));
          doc.rect(cellX, currentY, colDayWidth, rowHeight, 'F');

          // Borde lateral temático
          doc.setFillColor(r, g, b);
          doc.rect(cellX, currentY, 3, rowHeight, 'F');

          // Texto Asignatura
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(15, 23, 42);
          const subTitle = doc.splitTextToSize(sub.name, colDayWidth - 6);
          doc.text(subTitle[0] || sub.name, cellX + 5, currentY + 5.5);

          // Aula / Profesor
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(71, 85, 105);
          const extraInfo = sub.classroom || sub.teacher || '';
          if (extraInfo) {
            doc.text(extraInfo, cellX + 5, currentY + 11);
          }
        }
      }

      doc.setDrawColor(226, 232, 240);
      doc.rect(cellX, currentY, colDayWidth, rowHeight, 'D');
    }

    currentY += rowHeight;
  });

  // Pie de página
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  const nowStr = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.text(`Generado con Agenda Escolar PWA • ${nowStr}`, margin, pageHeight - 6);

  doc.save(`Horario_Escolar_${(studentInfo.studentName || 'estudiante').toLowerCase().replace(/\s+/g, '_')}.pdf`);
}

/**
 * Exporta el Boletín Oficial de Calificaciones y Medias a PDF
 * @param {Array} grades 
 * @param {Array} subjects 
 * @param {Object} studentInfo 
 */
export async function exportGradesReportPDF(grades = [], subjects = [], studentInfo = {}) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;

  // Cabecera institucional
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, margin, pageWidth - margin * 2, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('BOLETÍN DE CALIFICACIONES', margin + 8, margin + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Informe Académico y Cálculo de Medias Ponderadas`, margin + 8, margin + 18);
  doc.text(`${studentInfo.schoolName || 'Instituto de Educación Secundaria'}`, margin + 8, margin + 23);

  // Ficha de datos del alumno
  const studentCardY = margin + 34;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, studentCardY, pageWidth - margin * 2, 18, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, studentCardY, pageWidth - margin * 2, 18, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`ESTUDIANTE:`, margin + 6, studentCardY + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(`${studentInfo.studentName || 'Nombre no asignado'}`, margin + 35, studentCardY + 7);

  doc.setFont('helvetica', 'bold');
  doc.text(`CURSO / GRUPO:`, margin + 6, studentCardY + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(`${studentInfo.course || '1º Bachillerato'}`, margin + 35, studentCardY + 13);

  const nowFormatted = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  doc.setFont('helvetica', 'bold');
  doc.text(`FECHA:`, pageWidth - margin - 42, studentCardY + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(nowFormatted, pageWidth - margin - 26, studentCardY + 7);

  // Tabla de Calificaciones
  const tableStartY = studentCardY + 24;
  const colSubjectWidth = 78;
  const colTermWidth = 24;
  const colFinalWidth = 26;

  // Cabecera de la tabla
  doc.setFillColor(51, 65, 85);
  doc.rect(margin, tableStartY, pageWidth - margin * 2, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);

  doc.text('ASIGNATURA / MATERIA', margin + 4, tableStartY + 5.5);
  doc.text('1º EVAL.', margin + colSubjectWidth + 3, tableStartY + 5.5);
  doc.text('2º EVAL.', margin + colSubjectWidth + colTermWidth + 3, tableStartY + 5.5);
  doc.text('3º EVAL.', margin + colSubjectWidth + (colTermWidth * 2) + 3, tableStartY + 5.5);
  doc.text('NOTA FINAL', margin + colSubjectWidth + (colTermWidth * 3) + 2, tableStartY + 5.5);

  let currentY = tableStartY + 8;
  const rowHeight = 9;

  let totalPoints = 0;
  let gradedSubjectsCount = 0;

  subjects.forEach((sub, index) => {
    // Alternar colores de fila
    if (index % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(248, 250, 252);
    }
    doc.rect(margin, currentY, pageWidth - margin * 2, rowHeight, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, currentY, pageWidth - margin * 2, rowHeight, 'D');

    // Nombre asignatura
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sub.name, margin + 4, currentY + 6);

    // Obtener notas de trimestres 1, 2, 3
    const subGrades = grades.filter(g => g.subjectId === sub.id);
    const g1 = subGrades.find(g => String(g.term) === '1');
    const g2 = subGrades.find(g => String(g.term) === '2');
    const g3 = subGrades.find(g => String(g.term) === '3');

    const score1 = g1 && !isNaN(g1.score) ? Number(g1.score) : null;
    const score2 = g2 && !isNaN(g2.score) ? Number(g2.score) : null;
    const score3 = g3 && !isNaN(g3.score) ? Number(g3.score) : null;

    const printScore = (sc, x) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      if (sc !== null) {
        if (sc >= 5) {
          doc.setTextColor(16, 185, 129); // Verde
        } else {
          doc.setTextColor(239, 68, 68); // Rojo
        }
        doc.text(sc.toFixed(1), x, currentY + 6);
      } else {
        doc.setTextColor(156, 163, 175);
        doc.text('-', x, currentY + 6);
      }
    };

    printScore(score1, margin + colSubjectWidth + 9);
    printScore(score2, margin + colSubjectWidth + colTermWidth + 9);
    printScore(score3, margin + colSubjectWidth + (colTermWidth * 2) + 9);

    // Calcular media de la asignatura
    const validScores = [score1, score2, score3].filter(s => s !== null);
    if (validScores.length > 0) {
      const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
      totalPoints += avg;
      gradedSubjectsCount++;

      doc.setFont('helvetica', 'bold');
      if (avg >= 5) {
        doc.setTextColor(16, 185, 129);
      } else {
        doc.setTextColor(239, 68, 68);
      }
      doc.text(avg.toFixed(2), margin + colSubjectWidth + (colTermWidth * 3) + 7, currentY + 6);
    } else {
      doc.setTextColor(156, 163, 175);
      doc.text('-', margin + colSubjectWidth + (colTermWidth * 3) + 7, currentY + 6);
    }

    currentY += rowHeight;
  });

  // Caja de Nota Media Global
  currentY += 8;
  const avgGlobal = gradedSubjectsCount > 0 ? (totalPoints / gradedSubjectsCount).toFixed(2) : 'N/A';

  doc.setFillColor(238, 242, 255); // Indigo suave
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 22, 2, 2, 'F');
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 22, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(67, 56, 202);
  doc.text('NOTA MEDIA GLOBAL DEL EXPEDIENTE:', margin + 8, currentY + 9);

  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(`${avgGlobal}`, pageWidth - margin - 22, currentY + 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Calculada sobre ${gradedSubjectsCount} asignaturas evaluadas.`, margin + 8, currentY + 16);

  // Pie de página
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Documento informativo generado mediante la aplicación Agenda Escolar PWA Offline.', margin, pageHeight - 8);

  doc.save(`Boletin_Notas_${(studentInfo.studentName || 'estudiante').toLowerCase().replace(/\s+/g, '_')}.pdf`);
}

/**
 * Exporta un Dossier artístico de proyecto a PDF con fotografías de evolución
 * @param {Object} project Objeto del proyecto artístico
 * @param {Object} subject Asignatura
 */
export async function exportProjectDossierPDF(project, subject = {}) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;

  // Cabecera dossier
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, margin, pageWidth - margin * 2, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('DOSSIER DE PROYECTO ARTÍSTICO', margin + 6, margin + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`${subject.name || 'Artes'} • Memoria técnica y proceso creativo`, margin + 6, margin + 18);

  // Ficha técnica
  let currentY = margin + 30;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 34, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 34, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(project.title || 'Proyecto sin título', margin + 6, currentY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  const statusMap = {
    'idea': '💡 Boceto / Idea Inicial',
    'in_progress': '⏳ En Proceso en Taller',
    'finished': '✅ Obra Terminada',
    'graded': '🏆 Entregada y Evaluada'
  };

  doc.text(`Estado: ${statusMap[project.status] || project.status || 'En Proceso'}`, margin + 6, currentY + 16);
  doc.text(`Técnica / Soporte: ${project.technique || 'No especificado'}`, margin + 6, currentY + 22);
  doc.text(`Fecha Límite de Entrega: ${project.dueDate || 'Sin fecha fija'}`, margin + 6, currentY + 28);

  currentY += 40;

  // Descripción / Memoria del Proyecto
  if (project.description) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('MEMORIA DESCRIPTIVA Y CONCEPTUAL', margin, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const splitDesc = doc.splitTextToSize(project.description, pageWidth - margin * 2);
    doc.text(splitDesc, margin, currentY);
    currentY += (splitDesc.length * 4.5) + 6;
  }

  // Fotografías de evolución
  const photos = project.photos || (project.photo ? [project.photo] : []);
  if (photos.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('REGISTRO FOTOGRÁFICO DE LA EVOLUCIÓN', margin, currentY);
    currentY += 6;

    const imgWidth = 82;
    const imgHeight = 62;

    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      const imgData = typeof p === 'string' ? p : p.dataUrl || p.url;
      if (!imgData) continue;

      const col = i % 2;
      const x = margin + (col * (imgWidth + 10));

      if (currentY + imgHeight > pageHeight - margin) {
        doc.addPage();
        currentY = margin + 10;
      }

      try {
        doc.addImage(imgData, 'JPEG', x, currentY, imgWidth, imgHeight);
        doc.setDrawColor(203, 213, 225);
        doc.rect(x, currentY, imgWidth, imgHeight, 'D');
      } catch (e) {
        console.warn('No se pudo incrustar imagen en PDF:', e);
      }

      if (col === 1 || i === photos.length - 1) {
        currentY += imgHeight + 8;
      }
    }
  }

  const safeTitle = (project.title || 'proyecto').toLowerCase().replace(/[^a-z0-9]/g, '_');
  doc.save(`Dossier_${safeTitle}.pdf`);
}
