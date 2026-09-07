# 🎒 Agenda Escolar - PWA Online & Offline con Inteligencia Artificial

Una aplicación web progresiva (**Progressive Web App - PWA**) moderna, ultrarrápida y diseñada específicamente para que estudiantes organicen su vida académica: deberes, exámenes, proyectos artísticos, horario, calificaciones y mochila, con **captura con zoom de apuntes y pizarras**, **doble motor de OCR con IA (Local y Nube)** y funcionamiento **100% Offline (sin necesidad de internet)**.

🌐 **Aplicación en Vivo (GitHub Pages):** [https://mahay78.github.io/agenda-escolar/](https://mahay78.github.io/agenda-escolar/)  
📂 **Repositorio GitHub:** [https://github.com/Mahay78/agenda-escolar](https://github.com/Mahay78/agenda-escolar)

---

## 🌟 Novedades Principales (Versión 3.0.0)

### 🤖 1. Copiloto Escolar IA Integral (Conectado a toda la App)
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

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más información.
