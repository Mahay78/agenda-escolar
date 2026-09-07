# 🎒 Agenda Escolar - PWA Online & Offline con Inteligencia Artificial

Una aplicación web progresiva (**Progressive Web App - PWA**) moderna, ultrarrápida y diseñada específicamente para que estudiantes organicen su vida académica: deberes, exámenes, proyectos artísticos, horario, calificaciones y mochila, con **captura con zoom de apuntes y pizarras**, **doble motor de OCR con IA (Local y Nube)** y funcionamiento **100% Offline (sin necesidad de internet)**.

🌐 **Aplicación en Vivo (GitHub Pages):** [https://mahay78.github.io/agenda-escolar/](https://mahay78.github.io/agenda-escolar/)  
📂 **Repositorio GitHub:** [https://github.com/Mahay78/agenda-escolar](https://github.com/Mahay78/agenda-escolar)

---

## 🌟 Novedades Principales (Versión 3.5.x)

* 📱 **Arquitectura Ergonómica de 4 Pestañas + Botón Rápido (+):**
  * `☀️ Mi Día`: Dashboard diario con horario en vivo, tareas urgentes y alertas.
  * `📅 Agenda`: Subpestañas fluidas para *Deberes*, *Exámenes*, *Horario semanal*, *Mochila* y *Proyectos*.
  * `➕ Botón Central (+)`: Acceso instantáneo para crear tareas, exámenes, fichas, escanear apuntes o invocar al Copiloto IA.
  * `🧠 Estudio`: *Cuaderno LM* integrado con pantalla completa, mazo *Flashcards*, temporizador *Pomodoro* y *Galería de apuntes*.
  * `📊 Progreso`: Calificaciones con simulador de medias, logros, rachas y configuración de Google Drive / Clave IA.
* 🖥️ **Diseño Nativo para Escritorio (PC / Mac) y Tablets:** Barra lateral fija colapsable (Sidebar estilo Notion/Slack), buscador Spotlight (`Ctrl + K`), cuadrícula de tarjetas y vistas independientes.
* 📱 **Ajuste Móvil 100% Hermético:** Eliminación de desbordamiento horizontal (`overflow-x`), respeto a áreas seguras (`viewport-fit=cover`) y 5 botones perfectamente calibrados para el pulgar.
* 🗺️ **Hoja de Ruta Oficial de Mejoras:** Consulta el catálogo completo de opciones planificadas en 👉 [**ROADMAP.md**](./ROADMAP.md).

---

### 📚 1. Cuaderno LM - Entorno de Estudio Dedicado Estilo NotebookLM (`notebook.html`)
* **URL dedicada:** [https://mahay78.github.io/agenda-escolar/notebook.html](https://mahay78.github.io/agenda-escolar/notebook.html)
* **Estudio Fundamentado en Fuentes (*Source Grounding*):** Sube tus apuntes escritos, fotos de pizarras o textos de libros; la IA responderá exclusivamente basándose en lo que dice el profesor o el texto.
* **Citas a la Fuente Obligatorias:** Cada afirmación de la IA incluye referencias `[Fuente X]` para que el estudiante siempre verifique el apunte exacto.
* **Herramientas de Estudio con 1 Clic (Studio):**
  * 🎙️ **Audio Resumen / Podcast de Estudio:** Genera un diálogo dinámico y pedagógico y lo reproduce en voz alta con controles de velocidad (`1.0x`, `1.2x`, `1.4x`).
  * 📖 **Guía de Estudio Completa:** Ideas principales, resumen del tema y glosario de términos esenciales.
  * ❓ **Simulacro de Examen (Quiz):** Preguntas tipo test y desarrollo con soluciones explicadas para autoevaluación.
  * 🎴 **Fichas de Estudio con Exportación:** Extrae las tarjetas de estudio y las exporta directamente al mazo Leitner de la agenda.
  * ⚡ **Resumen Ejecutivo:** Puntos clave directos en viñetas.

---

### 🤖 2. Copiloto Escolar IA Integral (Conectado a toda la App)
* **Interacción Global con la Agenda:** La IA conoce el contexto vivo del estudiante (hora actual, clases de hoy y mañana, deberes pendientes, exámenes y mochila).
* **Ejecución Automática de Acciones (*Function Calling*):** La IA no solo responde dudas, sino que ejecuta acciones directas en la app:
  * Crear tareas y deberes con fecha estimada y prioridad (*"Apunta los ejercicios 1 y 2 de lengua para el jueves"*).
  * Agendar exámenes con materias y temario (*"Ponme examen de física el 20 de octubre"*).
  * Preparar y verificar la mochila según el horario del día siguiente (*"¿Qué libros me faltan para mañana?"*).
  * Iniciar temporizadores Pomodoro de estudio (*"Inicia 25 minutos de estudio de historia"*).
* **Voz Bidireccional:** Dictado por voz mediante reconocimiento de micrófono y lectura de respuestas en voz alta con síntesis de voz natural en español.
* **Búsqueda e Investigación Web (Wikipedia API):** Consulta enciclopédica académica integrada para buscar definiciones, biografías y datos contrastados al instante.
* **Botón Flotante y Accesos Rápidos:** Accesible desde cualquier lugar mediante un botón flotante, atajo en la cabecera, drawer lateral o menú rápido (+).

---

### 🎴 2. Generador de Fichas de Estudio (Flashcards) con IA
* **De Apuntes a Tarjetas en 1 Clic:** Transforma resúmenes, libros o explicaciones de clase en fichas de preguntas y respuestas listas para repasar con el sistema de repetición espaciada de Leitner.
* **Integración Directa con OCR y Cámara:** Tras fotografiar la pizarra o libro, el botón `✨ Crear Fichas con IA` analiza el texto detectado y genera automáticamente el mazo de repaso.
* **Tutor Socrático:** El botón `🤖 Explicar con Copiloto` en el visor de OCR desglosa conceptos complejos y los explica de forma didáctica.
* **Modo Offline Local Heurístico:** Si no dispones de conexión a internet ni clave API, un extractor inteligente en JavaScript analiza patrones sintácticos de apuntes para generar fichas al instante sin consumir datos.

---

## 🌟 Novedades Anteriores (Versión 2.9.0)

### 📷 1. Cámara Escolar con Zoom Óptico/Digital y Efecto Snap
* **Controles de Zoom Rápido:** Píldoras dedicadas `1x`, `2x`, `3x` y control deslizante continuo hasta `4x`.
* **Gesto Táctil Pinch-to-Zoom:** Pellizca con dos dedos directamente en la pantalla de la cámara para acercar o alejar el encuadre de forma fluida.
* **Aceleración por Hardware:** Detección automática de las capacidades del sensor del teléfono mediante `MediaTrackConstraints.zoom` para utilizar el zoom óptico/digital nativo sin pérdida de calidad.
* **Efecto Snap-Zoom al Disparar:** Animación de compresión y zoom instantáneo combinada con destello de flash al capturar la fotografía, proporcionando una respuesta táctil y visual dinámica.
* **Recorte Inteligente de Sensor:** Si el dispositivo utiliza zoom por software, el lienzo de captura recorta el área central con precisión para entregar una imagen nítida a máxima resolución.
* **Zoom de Inspección (2.5x) en Vista Previa:** Antes de aceptar la foto, un botón y toque directo en la imagen permite ampliarla a 2.5x para comprobar si la letra pequeña o las fórmulas matemáticas de la pizarra son perfectamente legibles.

---

### 🔍 2. Motor de OCR Inteligente con Doble Inteligencia Artificial
La aplicación incluye un sistema de Reconocimiento Óptico de Caracteres de tres niveles:

#### ⚡ A. IA Local del Teléfono (100% Offline, Gratuita y en 0.15s)
* Diseñada para aprovechar la API nativa `window.TextDetector` conectada a **Google Play Services ML Kit** en smartphones modernos (como Oppo Reno 12 F, Xiaomi, Samsung Galaxy y Pixel).
* **Velocidad Extrema:** Procesa la imagen en menos de 0.2 segundos directamente en la NPU/CPU del móvil.
* **Cero Consumo:** No gasta datos móviles ni envía imágenes al exterior, protegiendo al 100% la privacidad del estudiante.
* **Algoritmo de Orden de Lectura 2D:** Agrupa los bloques de texto detectados en líneas horizontales continuas y columnas naturales, respetando el flujo de lectura humano (ideal para pizarras divididas en secciones o ejercicios laterales).
* **Multi-Pase de Contraste:** Si la foto es oscura o de tiza sobre pizarra verde/negra, ejecuta un segundo pase con ecualización de contraste para capturar trazos tenues.

> 💡 *Nota para Android Chrome:* Si `TextDetector` no está activo por defecto, se puede habilitar en `chrome://flags#enable-experimental-web-platform-features`.

#### ✨ B. IA Avanzada en la Nube con Google Gemini Flash
* Integración directa con el modelo **Google Gemini 1.5 Flash** mediante API REST.
* **Transcripción de Caligrafía Difícil:** Lee apuntes a mano alzada y esquemas complejos que los OCR convencionales no interpretan.
* **Extracción Estructurada de Deberes:** El prompt de Gemini analiza el contenido de la foto y devuelve un resumen ordenado con las tareas a realizar, números de ejercicios y fechas límites detectadas.
* **Configuración Sencilla:** Botón `⚙️ Clave IA` en el modal de OCR para almacenar tu clave gratuita de [Google AI Studio](https://aistudio.google.com/) de forma privada en el almacenamiento local de tu navegador.

#### 📄 C. Motor Tesseract.js WebAssembly (Respaldo Universal)
* Si el navegador no cuenta con la API del teléfono ni con conexión a Gemini, recurre de forma transparente a **Tesseract.js** en WebAssembly, garantizando que el OCR siempre funcione en cualquier ordenador o dispositivo.

---

## 📱 Módulos y Funcionalidades de la Aplicación

### 🏠 1. Panel Principal ("Hoy")
* Resumen rápido del día escolar: clase en curso y siguiente clase según la hora actual.
* Contador de deberes pendientes para hoy y esta semana.
* Notificación visual de exámenes inminentes con cuenta atrás de días.
* Racha de hábitos de estudio con registro diario de constancia.

### 📋 2. Deberes y Tareas
* Organización por asignaturas con colores identificativos.
* Filtros por estado (*Pendientes*, *Para Hoy*, *Esta Semana*, *Con Fotos*, *Completadas*).
* Prioridades (*Urgente*, *Normal*, *Baja*) y avisos de entrega.
* Inserción directa de apuntes extraídos desde la cámara o notas de voz.

### 📅 3. Horario Escolar Semanal
* Visualización de Lunes a Viernes con recreos y franjas configurables.
* Asignaturas personalizables con aula, nombre del profesor, iconos temáticos y colores.
* **Exportación a PDF:** Descarga tu horario escolar en un documento apaisado listo para imprimir.

### 🎒 4. Mochila Inteligente
* Lista interactiva de materiales y útiles de clase.
* **Filtro Inteligente "Para Clases de Mañana":** Cruza los materiales con las materias del día siguiente y te avisa exactamente de qué debes meter en la mochila.
* Barra de progreso de preparación.

### 🎨 5. Portafolio de Proyectos y Taller Artístico
* Seguimiento de proyectos por fases: *Boceto / Idea*, *En Proceso / Taller*, *Terminado*, *Entregado / Evaluado*.
* Registro de técnicas plásticas, dimensiones, soporte y fotografías del paso a paso de la obra.
* Generador de **Dossier de Proyecto en PDF** con portada, ficha técnica y fotos.

### ⏱️ 6. Pomodoro de Concentración
* Modos de estudio (25m), descanso corto (5m) y descanso largo (15m).
* Campana de aviso sintetizada mediante **Web Audio API** (sin descargas ni archivos externos).
* Registro de sesiones completadas y tiempo enfocado.

### 📝 7. Exámenes y Calificaciones
* Calendario de pruebas con cálculo automático de días restantes (*¡HOY!*, *Mañana*, *En X días*).
* Registro de notas trimestrales (1º, 2º y 3º trimestre).
* Cálculo automático de notas medias por materia y media global del curso.
* **Boletín Oficial de Notas en PDF** exportable con un solo clic.

### 🧠 8. Fichas de Estudio (Flashcards con Repaso Leitner)
* Sistema de memorización espaciada con 5 cajas Leitner.
* Creación rápida de fichas a partir del texto extraído con la cámara o dictadas por voz.
* Estadísticas de tarjetas repasadas y tarjetas dominadas.

### 🎙️ 9. Grabadora de Voz y Dictado Inteligente
* Grabación de notas de audio adjuntas a deberes, proyectos o exámenes.
* **Dictado por Voz (Web Speech API):** Habla al móvil y convierte tu voz en texto en cualquier campo de la aplicación.

### 💬 10. Compartir por WhatsApp y Códigos QR
* Generador de mensajes con formato profesional (emojis, fechas y listas) para enviar deberes a grupos de clase por WhatsApp.
* Generación y escaneo de códigos QR para compartir la agenda entre compañeros sin conexión.

### ☁️ 11. Sincronización y Copias de Seguridad
* **Exportar / Importar JSON:** Respaldo completo de datos, audios y fotos comprimidas en un archivo descargable.
* **Google Drive:** Conexión para subir copias de seguridad a tu nube personal.
* **Firebase Cloud Sync:** Sincronización automática multidispositivo.

---

## 🛠️ Tecnologías y Arquitectura

* **Frontend Puro:** HTML5 semántico, CSS3 con variables personalizadas y temas Claro/Oscuro, Vanilla JavaScript (ES Modules).
* **PWA:** Service Worker (`sw.js`) con estrategia *Cache First* y actualización en segundo plano, y manifiesto (`manifest.webmanifest`) para instalación como app nativa.
* **Almacenamiento Local:** `IndexedDB` para capacidad ilimitada de almacenamiento local (imágenes en base64, audios, tareas e historial).
* **APIs Web Modernas:**
  - `navigator.mediaDevices.getUserMedia` (Cámara en vivo con control de zoom y capacidades ópticas).
  - `window.TextDetector` (Shape Detection API - Google Play Services ML Kit).
  - `Web Audio API` (Generación de audio para Pomodoro).
  - `Web Speech API` (Reconocimiento de voz para dictado).
  - `Web Notifications API` (Recordatorios y avisos locales).
* **Bibliotecas Integradas:**
  - `jsPDF`: Motor de creación de documentos PDF offline.
  - `Tesseract.js`: Motor OCR WebAssembly como respaldo.
* **Servicios de IA:**
  - `Google Gemini 1.5 Flash API`: Transcripción y estructuración en la nube.

---

## 📥 Instalación en Dispositivos

### En Teléfonos Móviles (Android / Oppo / Xiaomi / Samsung)
1. Abre **[https://mahay78.github.io/agenda-escolar/](https://mahay78.github.io/agenda-escolar/)** en Google Chrome.
2. Toca el menú de tres puntos (⋮) en la esquina superior derecha.
3. Selecciona **"Añadir a la pantalla de inicio"** o **"Instalar aplicación"**.
4. La agenda se instalará como una aplicación nativa con acceso rápido, pantalla completa y funcionamiento 100% offline.

### En iPhone o iPad (iOS / Safari)
1. Abre la web en **Safari**.
2. Pulsa el botón de **Compartir** (icono de cuadrado con flecha hacia arriba).
3. Selecciona **"Añadir a la pantalla de inicio"**.

### En Ordenador (Windows / Mac / Linux)
* Pulsa el icono de instalación **📲** en la barra de direcciones de Chrome o Edge para instalarla como app de escritorio.

---

## 💻 Ejecución en Entorno Local

Si deseas ejecutar la aplicación en tu propio ordenador:

1. Asegúrate de tener instalado [Node.js](https://nodejs.org/).
2. Haz doble clic en el archivo **`iniciar_agenda.bat`** (o ejecuta `node server.js` en la consola).
3. Se abrirá automáticamente tu navegador en `http://localhost:3000`.
4. El servidor local también muestra la IP local de tu Wi-Fi para que puedas abrirla en el móvil mientras programas.

---

## 🗺️ Hoja de Ruta de Mejoras y Futuras Funcionalidades (Roadmap)

Puedes consultar el catálogo interactivo en el archivo dedicado 👉 [**ROADMAP.md**](./ROADMAP.md). A continuación tienes un resumen de las mejoras planificadas:

### 🧠 1. Inteligencia Artificial y Gemini Flash
- [ ] 💡 **Generador de Exámenes Simulados:** Preguntas tipo test interactivas con temporizador y corrección automática basada en tus apuntes.
- [ ] 💡 **Preguntas de Desarrollo con Calificación:** Preguntas de examen con nota estimada del 1 al 10 y consejos de mejora.
- [ ] 💡 **Detección de Deberes por Foto de Pizarra:** Extraer automáticamente tareas y ejercicios de una foto de la pizarra.
- [ ] 💡 **Escaneo Mágico de Horarios en Papel:** Rellenar la semana completa con asignaturas y aulas a partir de la foto del horario.
- [ ] 💡 **Podcast de Estudio a Dos Voces:** Dos locutores debatiendo tus apuntes de forma entretenida.
- [ ] 💡 **Modo Tutor Socrático:** La IA te guía paso a paso con preguntas para que aprendas a resolver el problema por ti mismo.
- [ ] 💡 **Corrector de Redacciones:** Revisión de ortografía, vocabulario y coherencia en español e inglés.
- [ ] 💡 **Mapas Conceptuales y Diagramas Mermaid:** Esquemas visuales automáticos para temas densos.

### 📅 2. Organización y Tiempo
- [ ] 💡 **Recordatorio Vespertino de Mochila:** Aviso diario con el material necesario según las clases de mañana.
- [ ] 💡 **Horarios Rotativos (Semanas A / B):** Soporte para institutos con semanas alternas.
- [ ] 💡 **Subtareas y Checklists:** Desglose de tareas y proyectos en entregas parciales.
- [ ] 💡 **Plantillas de Tareas Recurrentes:** Tareas periódicas automáticas todas las semanas.
- [ ] 💡 **Sincronización con Google Calendar:** Exportación `.ics` para ver las fechas en el calendario nativo del teléfono.

### 💡 3. Técnicas de Estudio y Repaso Activo
- [ ] 💡 **Spaced Repetition (SuperMemo SM-2):** Algoritmo científico de curva del olvido para flashcards.
- [ ] 💡 **Modo Escritura para Fichas:** Teclear la respuesta para afianzar ortografía y vocabulario.
- [ ] 💡 **Modo Zen / Enfoque con Sonidos de Fondo:** Pomodoro con sonido de lluvia, biblioteca o cafetería.
- [ ] 💡 **Estadísticas de Estudio por Asignatura:** Gráficos del tiempo invertido en cada materia.
- [ ] 💡 **Técnica Feynman Guiada:** Explica el tema con tus palabras y la IA detecta lo que falta.

### 📷 4. Captura Visual y OCR
- [ ] 💡 **Enderezado y Corrección de Perspectiva:** Corrige fotos de pizarras tomadas desde un lateral.
- [ ] 💡 **Filtro de Alto Contraste:** Limpia reflejos y optimiza tiza y rotulador para máxima legibilidad.
- [ ] 💡 **Exportación de Apuntes a PDF Único:** Combina varias fotos en un único documento para imprimir.

### 📊 5. Calificaciones y Selectividad
- [ ] 💡 **Notas Ponderadas:** Configurar porcentajes (70% exámenes, 20% tareas, 10% actitud).
- [ ] 💡 **Calculadora "¿Qué necesito en el final?":** Nota mínima exacta para aprobar o subir nota.
- [ ] 💡 **Simulador EVAU / EBAU:** Cálculo sobre 14 puntos según ponderaciones 0.2 y 0.1.

### 🎮 6. Gamificación y Hábitos
- [ ] 💡 **Niveles de Estudiante y XP:** Experiencia y rangos (*Novato*, *Estratega*, *Erudito*, *Máster*).
- [ ] 💡 **Mapa de Calor de Constancia:** Visualización de días activos estilo GitHub.
- [ ] 💡 **Retos Semanales:** Desafíos para fomentar el hábito diario.
- [ ] 💡 **Congelador de Racha:** Salva tu racha si estuviste enfermo.

### 👥 7. Colaboración
- [ ] 💡 **Compartir Mazos por QR / Enlace:** Pásale tus fichas de repaso a un compañero en 1 segundo.
- [ ] 💡 **Sala Pomodoro Compartida:** Ver compañeros estudiando simultáneamente para motivarse.
- [ ] 💡 **Tablón de Avisos de Clase:** Fechas pactadas de exámenes y cambios de aula.

### 🎨 8. Personalización y Accesibilidad
- [ ] 💡 **Temas OLED, Pastel y Bosque:** Personalización estética del tema visual.
- [ ] 💡 **Tipografía para Dislexia (OpenDyslexic):** Modo de lectura accesible.
- [ ] 💡 **Atajos en el Icono (App Shortcuts):** Acceso rápido manteniendo pulsado el icono del móvil.

### 🔒 9. Seguridad y Nube
- [ ] 💡 **Bloqueo con Huella / Face ID / PIN:** Seguridad biométrica en el dispositivo.
- [ ] 💡 **Sincronización en Segundo Plano (Background Sync):** Sube datos automáticamente con WiFi.
- [ ] 💡 **Papelera con Restauración a 30 Días:** Recupera elementos borrados por error.

### 🖥️ 10. Experiencia Optimizada para PC y Tablet (Pantalla Grande, Teclado y Lápiz)
- [ ] 💡 **Atajos de Teclado Globales (Power-User Shortcuts):** Teclas rápidas (`N` nueva tarea, `E` nuevo examen, `Espacio` pausar Pomodoro, `1-4` cambiar de pestaña, `Esc` cerrar paneles).
- [ ] 💡 **Arrastrar y Soltar Tareas (Drag & Drop):** Mover tareas entre días o estados (*Pendientes ➔ En Proceso ➔ Completadas*) estilo Kanban interactivo.
- [ ] 💡 **Menú Contextual con Clic Derecho:** Clic derecho sobre cualquier elemento para opciones rápidas (*Marcar urgente*, *Preguntar a la IA*, *Duplicar*, *Eliminar*).
- [ ] 💡 **Selección Múltiple y Acciones en Lote (`Shift`/`Ctrl` + Clic):** Marcar, mover o eliminar múltiples tareas o fichas simultáneamente.
- [ ] 💡 **Arrastrar Archivos desde el Escritorio (Desktop Drag & Drop):** Arrastrar PDFs o fotos directamente desde el explorador de Windows o Mac hacia la app.
- [ ] 💡 **Vista de Doble Panel (Split View sin modales emergentes):** Lista a la izquierda y visor/edición de detalles a la derecha aprovechando la pantalla ancha.
- [ ] 💡 **Vista de Calendario Mensual Completo:** Cuadrícula de mes completo estilo Google Calendar para ver todas las entregas y exámenes.
- [ ] 💡 **Horario Semanal en Matriz Completa:** Visualización simultánea de todas las clases de lunes a viernes en una tabla espaciosa.
- [ ] 💡 **Temporizador Pomodoro Flotante (Picture-in-Picture):** Minimizar el reloj de estudio en una pequeña ventana flotante mientras usas Word, PowerPoint o el navegador.
- [ ] 💡 **Modo Multi-Monitor:** Ventana independiente para el *Cuaderno LM* o el *Copiloto IA* en una segunda pantalla.
- [ ] 💡 **Apuntes a Mano Alzada con Lápiz (Apple Pencil / S-Pen):** Escritura de fórmulas, diagramas y subrayado de apuntes con detección de presión del lápiz en tablets.
- [ ] 💡 **Rechazo de Palma (Palm Rejection):** Apoyo natural de la mano sobre la pantalla de la tablet sin trazos involuntarios.
- [ ] 💡 **Compatibilidad con Pantalla Dividida de la Tablet (iPadOS / Android Split View):** Usar la agenda en una mitad y el PDF del libro escolar en la otra.
- [ ] 💡 **Visor de PDFs de Doble Página (Modo Libro):** Lectura horizontal a dos páginas en monitores y tablets grandes.
- [ ] 💡 **Cuaderno LM a 3 Columnas Simultáneas:** Documento a la izquierda, notas en el centro y chat de Gemini a la derecha en tiempo real.
- [ ] 💡 **Modo Zen Pantalla Completa (Tecla F11):** Ocultar distracciones para sesiones intensivas de estudio con reloj grande y sonidos relajantes.

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más información.

