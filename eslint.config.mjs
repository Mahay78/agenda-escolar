import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    // Carpetas y ficheros excluidos del análisis
    ignores: ['libs/**', 'node_modules/**', '**/*.min.js', 'assets/**', 'tablet/**', 'mobile/**']
  },
  js.configs.recommended,
  {
    // Código de navegador (módulos ES de la app)
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser
      }
    },
    rules: {
      // Avisos (no bloquean) para código heredado que se irá limpiando
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-assignment': 'warn',
      'no-useless-escape': 'warn',
      'preserve-caught-error': 'warn',
      'no-console': 'off',
      // Detección de variables/errores reales
      'no-undef': 'error'
    }
  },
  {
    // app.js expone manejadores en window para usarlos desde HTML inline y
    // también los invoca directamente; se declaran para no marcar falsos positivos.
    files: ['app.js'],
    languageOptions: {
      globals: {
        closeDrawer: 'writable',
        confirmDeleteExam: 'writable',
        confirmDeleteGrade: 'writable',
        confirmDeleteMaterial: 'writable',
        confirmDeleteProject: 'writable',
        confirmDeleteSubject: 'writable',
        confirmDeleteTask: 'writable',
        handleCalendarDayClick: 'writable',
        handleDeleteResource: 'writable',
        handleExportProjectPDF: 'writable',
        handleExportSingleExamICS: 'writable',
        handlePermanentDeleteTrash: 'writable',
        handleRestoreFromGoogleDrive: 'writable',
        handleRestoreTrash: 'writable',
        handleSelectMockOption: 'writable',
        openDrawer: 'writable',
        openExamModal: 'writable',
        openGradeModal: 'writable',
        openMaterialModal: 'writable',
        openProjectModal: 'writable',
        openQuickCamera: 'writable',
        openSlotModal: 'writable',
        openSubjectModal: 'writable',
        openTaskModal: 'writable',
        removeTaskSubtask: 'writable',
        removeTempPhoto: 'writable',
        toggleDrawer: 'writable',
        toggleMaterialPacked: 'writable',
        toggleTaskComplete: 'writable',
        toggleTaskSubtask: 'writable'
      }
    }
  },
  {
    // Servidor Node ejecutado con CommonJS
    files: ['server.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    }
  }
];
