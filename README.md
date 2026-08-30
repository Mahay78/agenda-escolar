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

- [ ] **🔍 OCR (Reconocimiento Óptico de Caracteres):**
  - Procesamiento offline de fotos de pizarra y libros con `Tesseract.js` para extraer texto automáticamente.
  - Búsqueda instantánea de palabras clave dentro de las fotos sacadas en clase.

- [ ] **📄 Generador y Exportador a PDF:**
  - Exportar tareas, fotos anotadas y temarios en un único documento PDF limpio y descargable (`jsPDF` / `pdf-lib`).
  - Informe de calificaciones trimestrales en formato boletín PDF.

- [ ] **🔔 Notificaciones Push Locales:**
  - Recordatorios en el móvil el día antes de un examen o cuando vence una tarea pendiente.

- [ ] **🗂️ Fichas de Estudio Interactivas (Flashcards):**
  - Módulo de tarjetas de preguntas y respuestas con sistema de repetición espaciada para preparar exámenes.

- [ ] **📊 Gráficos y Estadísticas Visuales:**
  - Gráficas de evolución de notas a lo largo del curso y desglose del tiempo dedicado en el Pomodoro por asignatura.

- [ ] **🖨️ Modo Impresión Limpio:**
  - Estilos CSS `@media print` optimizados para imprimir el horario escolar o la lista de tareas en folio físico.

- [ ] **☁️ Sincronización en la Nube Opcional (Peer-to-Peer / Google Drive):**
  - Sincronización opcional entre dispositivos sin perder la filosofía *offline-first*.

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
├── server.js             # Servidor HTTP local en Node.js (cero dependencias externas)
├── iniciar_agenda.bat    # Acceso directo para iniciar la app en Windows con doble clic
├── sw.js                 # Service Worker para funcionamiento 100% Offline
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
