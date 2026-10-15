/**
 * state.js - Estado global compartido de la Agenda Escolar.
 *
 * Centraliza el objeto `AppState` para que los distintos módulos de la
 * aplicación puedan leerlo y modificarlo sin duplicar referencias.
 */

export const AppState = {
  activeTab: 'tab-today',
  selectedScheduleDay: new Date().getDay() >= 1 && new Date().getDay() <= 5 ? new Date().getDay() : 1,
  taskFilter: 'all',
  termFilter: 'all',
  materialFilter: 'all',
  projectFilter: 'all',
  gallerySearchQuery: '',
  globalSearchActiveFilter: 'all',
  subjects: [],
  schedule: [],
  tasks: [],
  exams: [],
  grades: [],
  projects: [],
  materials: [],
  flashcards: [],
  flashcardsSubjectFilter: 'all',
  flashcardsBoxFilter: 'all',
  flashcardsMode: 'study',
  studySessionCards: [],
  currentStudyCardIndex: 0,
  isStudyCardFlipped: false,
  timeSlots: [],
  studentInfo: {},
  tempTaskPhotos: [],
  tempExamPhotos: [],
  tempProjectPhotos: [],
  tempTaskAudio: null,
  tempExamAudio: null,
  tempProjectAudio: null,
  currentViewedImageSrc: null,
  isRecordingAudio: false,
  isRecordingExamAudio: false,
  isRecordingProjectAudio: false,
  pomodoro: {
    timeLeft: 25 * 60,
    totalTime: 25 * 60,
    isRunning: false,
    mode: 'work',
    timerId: null,
    countToday: 0,
    totalFocusMinutes: 0
  },
  trash: []
};
