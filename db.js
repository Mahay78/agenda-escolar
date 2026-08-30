/**
 * db.js - Gestor de almacenamiento offline con IndexedDB
 * Guarda asignaturas, horario, tareas, exámenes, notas, fotos comprimidas y configuración.
 */

const DB_NAME = 'AgendaEscolarDB';
const DB_VERSION = 2;

let dbInstance = null;

// Inicialización de la base de datos
export function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Error al abrir IndexedDB:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      console.log('IndexedDB inicializada correctamente');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Asignaturas
      if (!db.objectStoreNames.contains('subjects')) {
        const subjectStore = db.createObjectStore('subjects', { keyPath: 'id' });
        subjectStore.createIndex('name', 'name', { unique: false });
      }

      // 2. Horario semanal
      if (!db.objectStoreNames.contains('schedule')) {
        const scheduleStore = db.createObjectStore('schedule', { keyPath: 'id' });
        scheduleStore.createIndex('day', 'day', { unique: false });
        scheduleStore.createIndex('slotIndex', 'slotIndex', { unique: false });
      }

      // 3. Tareas / Deberes
      if (!db.objectStoreNames.contains('tasks')) {
        const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
        taskStore.createIndex('dueDate', 'dueDate', { unique: false });
        taskStore.createIndex('status', 'status', { unique: false });
        taskStore.createIndex('subjectId', 'subjectId', { unique: false });
        taskStore.createIndex('priority', 'priority', { unique: false });
      }

      // 4. Exámenes
      if (!db.objectStoreNames.contains('exams')) {
        const examStore = db.createObjectStore('exams', { keyPath: 'id' });
        examStore.createIndex('date', 'date', { unique: false });
        examStore.createIndex('subjectId', 'subjectId', { unique: false });
      }

      // 5. Calificaciones / Notas
      if (!db.objectStoreNames.contains('grades')) {
        const gradeStore = db.createObjectStore('grades', { keyPath: 'id' });
        gradeStore.createIndex('subjectId', 'subjectId', { unique: false });
        gradeStore.createIndex('term', 'term', { unique: false });
      }

      // 6. Configuración
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // 7. Portafolio de Obras y Proyectos Artísticos
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('subjectId', 'subjectId', { unique: false });
        projectStore.createIndex('status', 'status', { unique: false });
      }

      // 8. Materiales de Taller / Mochila
      if (!db.objectStoreNames.contains('materials')) {
        const materialStore = db.createObjectStore('materials', { keyPath: 'id' });
        materialStore.createIndex('subjectId', 'subjectId', { unique: false });
      }
    };
  });
}

// Operaciones genéricas
async function getStore(storeName, mode = 'readonly') {
  const db = await initDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

export async function getAll(storeName) {
  const store = await getStore(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getById(storeName, id) {
  const store = await getStore(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveItem(storeName, item) {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteItem(storeName, id) {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function clearStore(storeName) {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// Configuración
export async function getSetting(key, defaultValue = null) {
  const item = await getById('settings', key);
  return item ? item.value : defaultValue;
}

export async function setSetting(key, value) {
  return saveItem('settings', { key, value });
}

// Catálogos de asignaturas por modalidad
export const ARTS_PLASTICAS_SUBJECTS = [
  { id: 'sub_dibujo_art', name: 'Dibujo Artístico', color: '#ec4899', icon: '🎨', teacher: 'Prof. de Dibujo', classroom: 'Aula de Dibujo' },
  { id: 'sub_dibujo_tec', name: 'Dibujo Técnico Aplicado al Arte', color: '#3b82f6', icon: '📐', teacher: 'Prof. Técnico', classroom: 'Aula Dibujo Técnico' },
  { id: 'sub_cultura_audio', name: 'Cultura Audiovisual', color: '#8b5cf6', icon: '🎬', teacher: 'Prof. Audiovisuales', classroom: 'Aula Multimedia / Lab' },
  { id: 'sub_proyectos_art', name: 'Proyectos Artísticos', color: '#f59e0b', icon: '🖌️', teacher: 'Prof. de Proyectos', classroom: 'Taller de Arte' },
  { id: 'sub_volumen', name: 'Volumen y Escultura', color: '#d97706', icon: '🗿', teacher: 'Prof. de Volumen', classroom: 'Taller de Escultura' },
  { id: 'sub_diseno', name: 'Diseño Gráfico y Digital', color: '#06b6d4', icon: '💻', teacher: 'Prof. de Diseño', classroom: 'Aula de Informática' },
  { id: 'sub_historia_arte', name: 'Historia del Arte', color: '#eab308', icon: '🖼️', teacher: 'Prof. de Historia', classroom: 'Aula 201' },
  { id: 'sub_expresion_grafica', name: 'Técnicas de Expresión Gráfica', color: '#10b981', icon: '✏️', teacher: 'Prof. Técnicas', classroom: 'Taller Gráfico' },
  { id: 'sub_lengua', name: 'Lengua Castellana y Literatura', color: '#ef4444', icon: '📚', teacher: 'Prof. de Lengua', classroom: 'Aula 104' },
  { id: 'sub_filosofia_historia', name: 'Filosofía / Historia de España', color: '#6366f1', icon: '🏛️', teacher: 'Prof. Filosofía', classroom: 'Aula 102' },
  { id: 'sub_ingles', name: 'Inglés', color: '#a855f7', icon: '🇬🇧', teacher: 'Prof. de Inglés', classroom: 'Aula Idiomas' },
  { id: 'sub_edfisica', name: 'Educación Física', color: '#14b8a6', icon: '🏃', teacher: 'Prof. Ed. Física', classroom: 'Gimnasio' }
];

export const ARTS_ESCENICAS_SUBJECTS = [
  { id: 'sub_artes_escenicas', name: 'Artes Escénicas', color: '#ec4899', icon: '🎭', teacher: 'Prof. Teatro', classroom: 'Salón de Actos / Taller' },
  { id: 'sub_analisis_musical', name: 'Análisis Musical', color: '#8b5cf6', icon: '🎼', teacher: 'Prof. Música', classroom: 'Aula de Música' },
  { id: 'sub_coro_vocal', name: 'Coro y Técnica Vocal', color: '#eab308', icon: '🎤', teacher: 'Prof. Canto', classroom: 'Aula de Música' },
  { id: 'sub_cultura_audio', name: 'Cultura Audiovisual', color: '#06b6d4', icon: '🎬', teacher: 'Prof. Audiovisuales', classroom: 'Aula Multimedia' },
  { id: 'sub_literatura_uni', name: 'Literatura Universal', color: '#f59e0b', icon: '📖', teacher: 'Prof. Literatura', classroom: 'Aula 104' },
  { id: 'sub_lengua', name: 'Lengua Castellana y Literatura', color: '#ef4444', icon: '📚', teacher: 'Prof. Lengua', classroom: 'Aula 101' },
  { id: 'sub_filosofia_historia', name: 'Filosofía / Historia de España', color: '#6366f1', icon: '🏛️', teacher: 'Prof. Filosofía', classroom: 'Aula 102' },
  { id: 'sub_ingles', name: 'Inglés', color: '#a855f7', icon: '🇬🇧', teacher: 'Prof. Inglés', classroom: 'Aula Idiomas' }
];

export const DEFAULT_SUBJECTS = ARTS_PLASTICAS_SUBJECTS;

export const DEFAULT_TIME_SLOTS = [
  { index: 0, start: '08:30', end: '09:25', label: '1ª Hora' },
  { index: 1, start: '09:25', end: '10:20', label: '2ª Hora' },
  { index: 2, start: '10:20', end: '11:15', label: '3ª Hora' },
  { index: 3, start: '11:15', end: '11:45', label: 'Recreo', isBreak: true },
  { index: 4, start: '11:45', end: '12:40', label: '4ª Hora' },
  { index: 5, start: '12:40', end: '13:35', label: '5ª Hora' },
  { index: 6, start: '13:35', end: '14:30', label: '6ª Hora' }
];

export const DEFAULT_MATERIALS = [
  { id: 'mat_1', name: 'Bloc de Dibujo / Papel Guarro A3', icon: '📄', subjectId: 'sub_dibujo_art', isPacked: false },
  { id: 'mat_2', name: 'Set de Lápices Grafito (2H a 6B)', icon: '✏️', subjectId: 'sub_dibujo_art', isPacked: false },
  { id: 'mat_3', name: 'Carboncillo y Difumino', icon: '🖤', subjectId: 'sub_dibujo_art', isPacked: false },
  { id: 'mat_4', name: 'Goma Maleable y Goma de Miga', icon: '🧼', subjectId: 'sub_dibujo_art', isPacked: false },
  { id: 'mat_5', name: 'Escuadra, Cartabón y Regla 30cm', icon: '📐', subjectId: 'sub_dibujo_tec', isPacked: false },
  { id: 'mat_6', name: 'Compás de Precisión y Adaptador', icon: '📏', subjectId: 'sub_dibujo_tec', isPacked: false },
  { id: 'mat_7', name: 'Caja de Acuarelas / Témperas', icon: '🎨', subjectId: 'sub_proyectos_art', isPacked: false },
  { id: 'mat_8', name: 'Pinceles de Pelo Suave y Vaso', icon: '🖌️', subjectId: 'sub_proyectos_art', isPacked: false },
  { id: 'mat_9', name: 'Espátulas y Herramientas de Modelado', icon: '🗿', subjectId: 'sub_volumen', isPacked: false },
  { id: 'mat_10', name: 'Memoria USB / Tarjeta SD Cámara', icon: '💾', subjectId: 'sub_cultura_audio', isPacked: false }
];

// Comprobar y sembrar datos iniciales si la base de datos está vacía
export async function seedInitialDataIfNeeded() {
  const subjects = await getAll('subjects');
  if (subjects.length === 0) {
    for (const sub of DEFAULT_SUBJECTS) {
      await saveItem('subjects', sub);
    }
  }

  const timeSlots = await getSetting('timeSlots');
  if (!timeSlots) {
    await setSetting('timeSlots', DEFAULT_TIME_SLOTS);
  }

  const studentInfo = await getSetting('studentInfo');
  if (!studentInfo) {
    await setSetting('studentInfo', {
      studentName: 'Estudiante',
      schoolName: 'Escuela de Arte / Instituto de Educación Secundaria',
      course: '1º Bachillerato de Artes',
      theme: 'dark'
    });
  }

  const materials = await getAll('materials');
  if (materials.length === 0) {
    for (const m of DEFAULT_MATERIALS) {
      await saveItem('materials', m);
    }
  }
}

export async function applySubjectPreset(presetName) {
  let targetSubjects = ARTS_PLASTICAS_SUBJECTS;
  if (presetName === 'artes_escenicas') {
    targetSubjects = ARTS_ESCENICAS_SUBJECTS;
  }
  await clearStore('subjects');
  for (const s of targetSubjects) {
    await saveItem('subjects', s);
  }
  return targetSubjects;
}

// Compresor de imágenes para optimizar almacenamiento en IndexedDB
export function compressImage(source, maxWidth = 1280, maxHeight = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calcular proporción
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Exportar en JPEG optimizado
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };

    img.onerror = (err) => reject(new Error('No se pudo procesar la imagen: ' + err));

    if (typeof source === 'string') {
      img.src = source;
    } else if (source instanceof File || source instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(source);
    } else {
      reject(new Error('Formato de imagen no soportado'));
    }
  });
}

// Exportar copia de seguridad completa a JSON
export async function exportBackup() {
  const data = {
    version: 2,
    exportDate: new Date().toISOString(),
    subjects: await getAll('subjects'),
    schedule: await getAll('schedule'),
    tasks: await getAll('tasks'),
    exams: await getAll('exams'),
    grades: await getAll('grades'),
    projects: await getAll('projects'),
    materials: await getAll('materials'),
    settings: await getAll('settings')
  };
  return JSON.stringify(data, null, 2);
}

// Importar copia de seguridad desde JSON
export async function importBackup(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.subjects || !data.tasks) {
      throw new Error('El archivo no contiene un formato de copia de seguridad válido');
    }

    // Limpiar tiendas actuales
    await clearStore('subjects');
    await clearStore('schedule');
    await clearStore('tasks');
    await clearStore('exams');
    await clearStore('grades');
    await clearStore('projects');
    await clearStore('materials');
    await clearStore('settings');

    // Restaurar datos
    for (const s of data.subjects || []) await saveItem('subjects', s);
    for (const sc of data.schedule || []) await saveItem('schedule', sc);
    for (const t of data.tasks || []) await saveItem('tasks', t);
    for (const e of data.exams || []) await saveItem('exams', e);
    for (const g of data.grades || []) await saveItem('grades', g);
    for (const p of data.projects || []) await saveItem('projects', p);
    for (const m of data.materials || []) await saveItem('materials', m);
    for (const st of data.settings || []) await saveItem('settings', st);

    return true;
  } catch (error) {
    console.error('Error al importar la copia de seguridad:', error);
    throw error;
  }
}
