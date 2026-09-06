# 🎒 Agenda Escolar - PWA Online & Offline

Una aplicación web progresiva (**Progressive Web App - PWA**) moderna, ultrarrápida y diseñada específicamente para que estudiantes organicen su vida académica, deberes, exámenes, proyectos artísticos, horario, calificaciones y mochila, con **captura y anotación de fotos sobre apuntes/pizarras** y funcionamiento **100% Offline (sin necesidad de internet)**.

🌐 **Aplicación en Vivo:** [https://mahay78.github.io/agenda-escolar/](https://mahay78.github.io/agenda-escolar/)  
📂 **Repositorio GitHub:** [https://github.com/Mahay78/agenda-escolar](https://github.com/Mahay78/agenda-escolar)

---

## 🌟 Características Actuales Implementadas

1. **📷 Cámara Integrada para Pizarras y Apuntes:**
   - Captura directa desde cámara trasera/delantera del móvil o webcam de PC.
   - Compresión inteligente automática en IndexedDB.
   - Visor a pantalla completa y visor rápido.

2. **✏️ Editor de Anotaciones y Correcciones sobre Fotos (`annotations.js`):**
   - Herramientas de trazo libre, flechas de corrección de profesores, recuadros, círculos y texto.
   - Selector de colores, grosores y función de Deshacer (Undo).

3. **🎙️ Grabadora de Notas de Voz Offline (`audio.js`):**
   - Grabación de explicaciones de clase o recordatorios de audio adjuntos a las tareas.
   - Reproductor integrado con almacenamiento local.

4. **⏱️ Temporizador Pomodoro de Concentración:**
   - Métodos de estudio (25m), descanso corto (5m) y descanso largo (15m).
   - Campana suave sintetizada mediante **Web Audio API** (sin dependencias ni archivos externos).
   - Estadísticas diarias de sesiones y tiempo enfocado.

5. **🎒 Gestor de Mochila y Materiales de Taller:**
   - Checklist interactiva de materiales (lápices, blocs A3, témperas, reglas, pendrives...).
   - Filtro inteligente **"Para Clases de Mañana"** basado en el horario escolar.
   - Barra de progreso del estado de la mochila.

6. **🎨 Portafolio de Proyectos y Obras Artísticas:**
   - Seguimiento por fases: *Boceto/Idea*, *En Proceso/Taller*, *Obra Terminada*, *Entregado/Evaluado*.
   - Registro de técnicas, soportes, fechas límites y fotos de evolución.

7. **📅 Horario Escolar Semanal:**
   - Configuración visual de Lunes a Viernes con franjas horarias y recreos.
   - Asignaturas con colores, iconos/emojis, aula y nombre del profesor.
   - Vista rápida en el panel "Hoy" con la clase actual y la siguiente.

8. **📋 Gestor de Deberes y Tareas:**
   - Filtros por: *Pendientes, Para Hoy, Esta Semana, Con Fotos, Completadas*.
   - Prioridades (*Urgente, Normal, Baja*) y fechas con avisos de vencimiento.

9. **📝 Control de Exámenes y Evaluaciones:**
   - Cuenta atrás en días (*¡HOY!, Mañana, En X días*).
   - Temarios a estudiar y fotografías de esquemas.

10. **📊 Calificaciones y Cálculo de Medias:**
    - Registro de notas por trimestres (1º, 2º y 3º).
    - Cálculo automático de la nota media global y por evaluación.

11. **💬 Compartir por WhatsApp & 📱 Códigos QR:**
    - Formateo inteligente de mensajes para enviar deberes u horarios a WhatsApp.
    - Generador y escáner de códigos QR offline.

12. **💾 Copias de Seguridad (Exportar / Importar JSON):**
    - Copia de seguridad completa en un clic (incluye fotos, audios, proyectos y notas).

---

## 🗺️ Roadmap: Lista de Próximas Mejoras

Aquí tienes las funcionalidades planificadas para las siguientes versiones del proyecto:

- [x] **📱 Menú Desplegable / Lateral (Hamburguesa / Drawer) para Móviles y Tablets:**
  - Menú lateral deslizable o desplegable táctil optimizado para pantallas pequeñas y tablets.
  - Navegación rápida con una sola mano entre todas las secciones (Hoy, Deberes, Horario, Mochila, Proyectos, Pomodoro, Exámenes, Notas, Galería y Ajustes).

- [x] **🔍 OCR (Reconocimiento Óptico de Caracteres):**
  - Procesamiento offline de fotos de pizarra y libros con `Tesseract.js` para extraer texto automáticamente sin necesidad de servidores externos.
  - Inserción directa del texto extraído en tareas de deberes o temarios de exámenes.
  - Búsqueda instantánea de palabras clave dentro de las fotos guardadas en la galería.

- [x] **🔎 Buscador Global Inteligente (Ctrl + K / Spotlight):**
  - Barra de búsqueda estilo Spotlight accesible mediante atajo de teclado (`Ctrl + K`) o botón en cabecera y menú drawer.
  - Búsqueda en tiempo real indexando tareas, exámenes, proyectos artísticos, calificaciones, materiales de la mochila y fotos/apuntes con OCR.
  - Filtros por chips de categoría y navegación por teclado (flechas y Enter).

- [x] **📄 Generador y Exportador a PDF (100% Offline con `jsPDF`):**
  - **Exportar Horario Escolar en PDF:** Descarga tu horario semanal en formato PDF apaisado listo para imprimir o compartir.
  - **Boletín Oficial de Calificaciones:** Generación de informe académico con notas por evaluación y media global ponderada.
  - **Dossier de Proyectos Artísticos:** PDF técnico con ficha del proyecto, técnicas y registro fotográfico de la evolución de la obra.

- [x] **🎙️ Mejoras Avanzadas en Notas de Voz:**
  - **Transcripción de Voz a Texto (Dictado):** Dictar deberes, notas, exámenes y proyectos con la voz utilizando `Web Speech API` para que se conviertan en texto automáticamente.
  - **Notas de voz en Proyectos y Exámenes:** Permitir adjuntar notas de audio directamente a las obras del portafolio y temarios de examen.

- [x] **🔔 Notificaciones Push Locales:**
  - Recordatorios en el móvil o navegador el día antes de un examen o cuando vence una tarea pendiente con la API nativa de notificaciones web.

- [x] **🎨 Paquete y Selector Visual de Iconos para Asignaturas y Materias:**
  - Catálogo interactivo de iconos y emojis organizados por categorías (*Artes Plásticas, Música, Ciencias, Letras, Idiomas, Tecnología, Deporte*).
  - Selector visual intuitivo al crear o editar asignaturas sin tener que buscarlos en el teclado del móvil.

- [ ] **🎨 Herramientas Especiales de Taller y Arte:**
  - **Cuentagotas Digital de Color (Color Picker en fotos):** Extrae la paleta de colores (códigos HEX, RGB y nombres de pigmentos) tocando cualquier punto de una foto.
  - **Guía de Proporciones en Cámara:** Cuadrícula de regla de tercios y proporción áurea superpuesta para encuadrar dibujos y fotos de bodegones.
  - **Lienzo en Blanco para Bocetos:** Pizarra digital en blanco dentro de la app para realizar bocetos, esquemas o cálculos rápidos durante la clase.

- [x] **🧮 Simulador de Notas y Calificaciones Ponderadas:**
  - **Simulador "¿Qué nota necesito?":** Calcula automáticamente qué nota necesitas en el próximo examen para alcanzar la media deseada con análisis de viabilidad en tiempo real.
  - **Ponderaciones personalizables:** Porcentajes por exámenes, trabajos y actitud (ej. *70% Exámenes / 30% Prácticas*).
  - **Calculadora EBAU / Selectividad:** Simulador de nota media de bachillerato y ponderación de materias específicas.

- [x] **📅 Integración con Calendarios Nativos (`.ics` / Google / Apple / Outlook):**
  - Exportación de exámenes y horario semanal a formato estándar `.ics` (RFC 5545) con recordatorios y alarmas de 24h previas en un clic.

- [x] **🎮 Gamificación y Hábitos de Estudio:**
  - **Rachas de Estudio Diarias (*Streaks*):** Registro de días consecutivos completando tareas y sesiones Pomodoro con contador en la cabecera.
  - **Sistema de Logros y Desafíos:** Medallas y trofeos desbloqueables (*Primer Paso, En Racha, Semana Perfecta, Maestro de la Concentración*).

- [x] **📚 Biblioteca de Recursos y Enlaces por Asignatura:**
  - Guardar enlaces directos a Google Classroom, carpetas de Google Drive, aulas virtuales Moodle o recursos didácticos dentro de cada materia.

- [ ] **⏱️ Modo Simulacro de Examen:**
  - Cronómetro a pantalla completa sin distracciones para practicar exámenes con límite de tiempo real (ej. 50 o 90 minutos).

- [ ] **👁️ Accesibilidad y Personalización Visual:**
  - Modo con tipografía especial para dislexia (*OpenDyslexic*) y tamaño de texto ajustable.

- [x] **🗑️ Papelera de Reciclaje (30 días):**
  - Recuperación y restauración de tareas, exámenes, notas, materiales o proyectos eliminados accidentalmente, con auto-purga a los 30 días.

- [x] **🖨️ Modo Impresión Limpio y Boletín / Horario PDF:**
  - Estilos CSS `@media print` y botones integrados en Horario y Notas para imprimir en papel o guardar en PDF de forma limpia y profesional.

- [x] **☁️ Sincronización en la Nube con Firebase / Firestore (Híbrido Offline-First):**
  - **Inicio de Sesión con Google (Firebase Auth):** Conectar con un solo clic para respaldar y sincronizar la agenda entre móvil, tablet y PC.
  - **Gestión Multi-cuenta y Cuentas Escolares (Google Classroom):**
    - Identificador único (`uid`) por usuario para aislamiento total de datos de cada alumno.
  - **Base de Datos en Tiempo Real (Cloud Firestore):** Guardado automático en la nube de deberes, exámenes, notas, horario y portafolio de proyectos.
  - **Arquitectura Híbrida Segura:**
    - *Modo Sin Conexión / Sin Cuenta:* Todo funciona al 100% de forma local en el dispositivo usando `IndexedDB`.
    - *Modo Conectado:* Sincronización manual o en tiempo real con la nube.

---

## 📂 Estructura de Archivos del Proyecto

```text
├── index.html            # Estructura principal y modales de la interfaz de usuario
├── styles.css            # Diseño responsivo, tema claro/oscuro y componentes
├── app.js                # Lógica central, controladores de eventos y renderizado
├── db.js                 # Capa de datos con IndexedDB, semillas y compresión de imágenes
├── camera.js             # Módulo de captura de cámara en vivo y visor a pantalla completa
├── annotations.js        # Editor de dibujo y correcciones sobre fotografías
├── audio.js              # Grabadora de notas de voz y sintetizador de sonido Web Audio API
├── qr.js                 # Generador, lector de QR y formateador de mensajes WhatsApp
├── ocr.js                # Motor de OCR y extracción de texto de imágenes con Tesseract.js
├── libs/                 # Librerías cliente offline (Tesseract core & worker)
├── server.js             # Servidor HTTP local en Node.js (cero dependencias externas)
├── iniciar_agenda.bat    # Acceso directo para iniciar la app en Windows con doble clic
├── sw.js                 # Service Worker para funcionamiento 100% Offline (PWA v2.4.0)
├── manifest.webmanifest  # Configuración PWA para instalación como app nativa
└── icon.svg              # Logotipo vectorial de la aplicación
```

---

## 🚀 Cómo Iniciar en Local

### Opción 1: En Windows con Doble Clic
1. Entra en la carpeta `Abian aplicación` en tu escritorio.
2. Haz doble clic en el archivo **`iniciar_agenda.bat`**.
3. Se abrirá automáticamente en tu navegador web (`http://localhost:3000`).

### Opción 2: Desde Terminal / CLI
```bash
npm start
```
o bien:
```bash
node server.js
```

---

## 📱 Cómo Instalar la App en Móvil o PC

- **En Android (Google Chrome):** Abre [https://mahay78.github.io/agenda-escolar/](https://mahay78.github.io/agenda-escolar/), toca los tres puntos (⋮) y selecciona **"Instalar aplicación"**.
- **En iPhone / iPad (Safari):** Abre el enlace, pulsa el botón **Compartir** (cuadrado con flecha) y selecciona **"Añadir a la pantalla de inicio"**.
- **En PC (Chrome / Edge):** Pulsa el botón de instalación en la barra de direcciones del navegador.
