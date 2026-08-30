# 🎒 Agenda Escolar para el Instituto (PWA Online / Offline)

Una aplicación web progresiva (**PWA**) diseñada especialmente para que los estudiantes de instituto organicen su día a día escolar, deberes, exámenes, horario y calificaciones, con **soporte completo para sacar fotografías de la pizarra, apuntes o libros** y funcionamiento **100% Offline (sin necesidad de internet)**.

---

## 🌟 Características Principales

1. **📷 Cámara Integrada para Fotos de Pizarras y Apuntes:**
   - Saca fotos en directo con la cámara trasera o delantera del móvil / webcam del PC.
   - Efecto flash de captura y compresión inteligente automática.
   - Visor a pantalla completa y botón para dibujar y realizar **anotaciones y correcciones** directamente sobre las fotos.

2. **✏️ Editor de Anotaciones y Correcciones sobre Fotos (`annotations.js`):**
   - Herramientas de trazo libre, flechas de corrección, recuadros, círculos y notas de texto.
   - Paleta de colores personalizable y opciones de grosor y deshacer (Undo).

3. **🎙️ Grabadora de Notas de Voz Offline (`audio.js`):**
   - Graba explicaciones del profesor o recordatorios de audio adjuntos a tus tareas.
   - Reproductor integrado sin dependencias externas.

4. **⏱️ Temporizador Pomodoro de Concentración con Campana Sonora:**
   - Métodos de 25 min de estudio, 5 min de descanso corto y 15 min de descanso largo.
   - Campana suave sintetizada mediante la Web Audio API (100% offline).
   - Contador de sesiones de concentración diarias.

5. **🎒 Gestor de Mochila y Materiales de Taller:**
   - Checklist interactiva para preparar materiales de dibujo, láminas, pinceles, etc.
   - Filtro inteligente según las clases y asignaturas del día siguiente.

6. **🎨 Portafolio de Proyectos y Obras Artísticas:**
   - Registro de proyectos con fases (Boceto, En Proceso, Terminado, Entregado), soporte, técnica y fotos de evolución.

7. **⚡ Funcionamiento 100% Offline & Online:**
   - Almacenamiento local con IndexedDB (datos, fotos y audios en tu dispositivo).
   - Service Worker que carga la aplicación al instante sin conexión.

8. **📅 Horario Semanal & 📋 Deberes & 📝 Exámenes & 📊 Notas:**
   - Horario con franjas horarias y recreos.
   - Cuenta atrás de exámenes y cálculo de notas medias trimestrales y globales.

9. **💬 Compartir por WhatsApp & 📱 Código QR:**
   - Generación de mensajes formateados y códigos QR para transferir tareas y horarios.

10. **💾 Copias de Seguridad (Exportar / Importar JSON):**
    - Exporta e importa toda tu agenda con fotos, audios y proyectos en un clic.

---

## 🚀 Cómo Iniciar la Aplicación

### Opción 1 (Doble Clic en Windows - Más fácil):
1. Entra en la carpeta `Abian aplicación` en tu escritorio.
2. Haz doble clic en el archivo **`iniciar_agenda.bat`**.
3. Se abrirá automáticamente la aplicación en tu navegador web (`http://localhost:3000`).

### Opción 2 (Desde la terminal / CLI):
```bash
npm start
```
o bien:
```bash
node server.js
```

---

## 📱 Cómo Instalar la App en el Móvil o PC

La aplicación es una **PWA (Progressive Web App)**, lo que significa que puedes instalarla como si fuera una aplicación nativa de Android, iPhone o Windows:

### En el Móvil (Android / Google Chrome):
1. Conecta el móvil a la misma red Wi-Fi de tu ordenador y entra en la dirección IP que muestra la consola (por ejemplo: `http://192.168.1.XX:3000`).
2. Toca el menú de tres puntos de Chrome (arriba a la derecha).
3. Selecciona **"Añadir a la pantalla de inicio"** o **"Instalar aplicación"**.
4. ¡Listo! Tendrás el icono de la **Agenda Escolar** en la pantalla de tu móvil y funcionará sin conexión.

### En iPhone / iPad (Safari):
1. Abre la dirección en Safari.
2. Toca el botón de **Compartir** (icono con una flecha hacia arriba).
3. Selecciona **"Añadir a la pantalla de inicio"**.

### En el Ordenador (Chrome / Edge):
1. En la barra de direcciones del navegador verás un icono de instalación (o pulsa el botón **📲** en la cabecera de la agenda).
2. Haz clic en **"Instalar Agenda Escolar"** para tenerla en tu escritorio como una app de Windows.
