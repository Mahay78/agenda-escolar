# 🗺️ Hoja de Ruta de Mejoras y Futuras Funcionalidades (Roadmap)
## Agenda Escolar PWA • Versión 3.5.x

Bienvenido a la hoja de ruta oficial del proyecto **Agenda Escolar**. En este documento se recopilan todas las propuestas, ideas y mejoras planificadas para continuar evolucionando la aplicación hacia el ecosistema de estudio más completo, rápido y ergonómico.

---

### 📊 Estado General de Funcionalidades

| Estado | Significado |
| :--- | :--- |
| `✅ Implementado` | Ya disponible en la versión actual en GitHub |
| `⏳ En Progreso` | En fase de diseño o desarrollo activo |
| `💡 Planificado` | Propuesta aprobada lista para ser priorizada |

---

## 🧠 1. Inteligencia Artificial y Gemini Flash

- [x] ✅ **1. Generador de Exámenes Simulados (Mock Tests):** Examen interactivo tipo test con temporizador, corrección automática, desglose y explicación razonada de cada fallo, con botón para convertir fallos en fichas Leitner.
- [ ] 💡 **2. Generador de Preguntas de Desarrollo con Calificación:** Preguntas abiertas típicas de examen de bachillerato/selectividad con rúbrica de corrección y nota estimada del 1 al 10.
- [ ] 💡 **3. Detección Automática de Deberes por Foto de Pizarra:** Sacas una foto al rincón de la pizarra donde el profesor apuntó los ejercicios y la IA crea automáticamente las tareas correspondientes con sus fechas límite.
- [ ] 💡 **4. Escaneo Mágico del Horario Escolar en Papel:** Foto a la hoja del horario de inicio de curso y extracción automática de asignaturas, horas y aulas para toda la semana.
- [x] ✅ **5. Podcast de Estudio con Diálogo a Dos Voces:** En el *Cuaderno LM*, simulación de un diálogo dinámico entre dos locutores que debaten y explican tus apuntes para escuchar de camino al instituto.
- [x] ✅ **6. Modo Tutor Socrático:** La IA te ayuda a resolver dudas guiándote mediante preguntas paso a paso en lugar de darte la solución directa.
- [x] ✅ **7. Corrector y Asesor de Redacciones:** Análisis de ensayos y redacciones en español o inglés evaluando vocabulario, ortografía, estructura y conectores.
- [ ] 💡 **8. Creador de Esquemas y Mapas Conceptuales:** Generación de resúmenes visuales y diagramas de flujo/árbol con sintaxis Mermaid a partir de temas densos.

---

## 📅 2. Organización, Horario y Tareas

- [ ] 💡 **9. Recordatorio Inteligente Vespertino (Mochila & Deberes):** Notificación automática a las 19:30 o 20:00: *«Mañana tienes Biología (recuerda la bata de laboratorio) y te quedan 2 tareas de Historia»*.
- [ ] 💡 **10. Horarios Semanales Rotativos (Semanas A / B):** Soporte para centros con asignaturas alternas por semanas pares/impares.
- [x] ✅ **11. Subtareas y Listas de Control (Checklists):** Posibilidad de desglosar tareas grandes o trabajos en entregas parciales marcables interactivamente.
- [ ] 💡 **12. Plantillas de Tareas Recurrentes:** Configurar tareas periódicas fijas (ej. *«Lectura semanal»* o *«Ficha de ejercicios de los viernes»*).
- [x] ✅ **13. Sincronización Automática con Google Calendar:** Exportación continua en formato `.ics` para ver las fechas de exámenes y entregas en la app de calendario nativa del móvil.

---

## 💡 3. Técnicas de Estudio y Repaso Activo

- [x] ✅ **14. Algoritmo Spaced Repetition (SuperMemo SM-2) en Flashcards:** Intervalos calculados científicamente en función de la curva del olvido ($EF \ge 1.3$, repeticiones y valoraciones).
- [x] ✅ **15. Modo Escritura en Fichas de Estudio:** Opción para teclear la respuesta en vez de solo voltear la tarjeta, con similitud semántica en tiempo real.
- [x] ✅ **16. Modo Zen / Enfoque con Sonidos de Ambiente:** Pantalla completa en el temporizador Pomodoro con sintetizador Web Audio API de lluvia, olas del mar, cafetería y ruido rosa sin conexión.
- [ ] 💡 **17. Estadísticas de Tiempo por Asignatura:** Gráficos que muestran cuántas horas has dedicado a cada materia para balancear tu esfuerzo antes de las evaluaciones.
- [ ] 💡 **18. Técnica Feynman Guiada:** Espacio donde el estudiante explica un concepto con sus propias palabras y la IA detecta imprecisiones o conceptos olvidados.

---

## 📷 4. Captura Visual, Pizarras y OCR

- [ ] 💡 **19. Detección Automática de Bordes y Corrección de Perspectiva:** Enderezado de fotografías tomadas desde un ángulo lateral de la clase.
- [ ] 💡 **20. Filtro Limpiador de Fondo para Tiza y Rotulador:** Aumento selectivo de contraste para pizarras verdes y blancas eliminando brillos y reflejos.
- [x] ✅ **21. Exportación de Apuntes Combinados a PDF:** Agrupar varias fotos de una misma lección en un solo archivo PDF limpio para imprimir o compartir.

---

## 📊 5. Calificaciones, Medias y Selectividad / EVAU

- [x] ✅ **22. Ponderación por Tipos de Nota:** Asignar porcentajes (ej. exámenes, trabajos, actitud/asistencia) a cada calificación con badges visuales.
- [x] ✅ **23. Calculadora «¿Qué Nota Necesito en el Examen Final?»:»** Estimación exacta de la puntuación mínima requerida para aprobar o alcanzar una meta.
- [x] ✅ **24. Simulador de Nota de Admisión EVAU / EBAU:** Cálculo de nota de corte sobre 14 puntos según las materias que ponderan 0.2 y 0.1 para la carrera universitaria elegida.

---

## 🎮 6. Gamificación, Motivación y Hábitos

- [x] ✅ **25. Niveles de Estudiante y Puntos de Experiencia (XP):** Subir de nivel (*Novato*, *Estratega*, *Erudito*, *Máster Académico*) al completar tareas, pomodoros y simulacros.
- [x] ✅ **26. Mapa de Calor de Constancia (Estilo GitHub):** Cuadrícula visual de 70 días activos para visualizar tu disciplina durante todo el curso.
- [ ] 💡 **27. Retos y Desafíos Semanales:** Misiones opcionales para fomentar buenos hábitos de estudio diario.
- [x] ✅ **28. Congelador de Racha (Streak Freeze):** Salvar la racha de estudio si un día estuviste enfermo o sin acceso al teléfono.

---

## 👥 7. Colaboración y Comunidad

- [x] ✅ **29. Compartir Mazos de Fichas (Exportar e Importar JSON & QR):** Exportar e importar paquetes de preguntas y respuestas de un tema entre compañeros en 1 segundo.
- [ ] 💡 **30. Sala de Pomodoro Compartida:** Indicador opcional de compañeros que están estudiando a la misma vez para motivarse en grupo.
- [ ] 💡 **31. Tablón de Avisos del Grupo:** Registro de acuerdos de clase (fechas de exámenes pactadas, cambios de aula o excursiones).

---

## 🎨 8. Personalización y Accesibilidad

- [x] ✅ **32. Temas de Color Temáticos (OLED Negro Puro, Pastel, Lavanda, Bosque):** Personalización estética del entorno de estudio.
- [x] ✅ **33. Tipografía Especial para Dislexia (OpenDyslexic y Atkinson Hyperlegible):** Opciones en ajustes para cambiar la tipografía facilitando la lectura.
- [ ] 💡 **34. Atajos en el Icono del Móvil (App Shortcuts):** Accesos directos al mantener pulsado el icono en la pantalla de inicio (*Nueva Tarea*, *Horario*, *Copiloto IA*).

---

## 🔒 9. Seguridad y Sincronización

- [ ] 💡 **35. Bloqueo Biométrico (Huella / Face ID / PIN):** Protección de notas y diario escolar mediante la seguridad del propio dispositivo.
- [x] ✅ **36. Sincronización en la Nube (Google Drive y Firebase Sync):** Respaldo de datos automático y manual en la nube.
- [x] ✅ **37. Papelera con Retención de 30 Días:** Recuperación sencilla de elementos eliminados por error.

---

## 🖥️ 10. Experiencia Optimizada para PC y Tablet (Pantalla Grande, Teclado y Lápiz)

- [x] ✅ **38. Atajos de Teclado Globales (Power-User Shortcuts):** Teclas rápidas (`N` nueva tarea, `E` nuevo examen, `Espacio` pausar Pomodoro, `1-4` cambiar de pestaña, `Esc` cerrar paneles).
- [x] ✅ **39. Arrastrar y Soltar Tareas (Drag & Drop):** Mover tareas y reordenar interactivamente mediante gestos de arrastre nativos.
- [x] ✅ **40. Menú Contextual con Clic Derecho:** Clic derecho sobre tareas y exámenes para opciones rápidas (*Cambiar prioridad*, *Preguntar al Copiloto IA*, *Crear fichas*, *Exportar a .ics*, *Eliminar*).
- [ ] 💡 **41. Selección Múltiple y Acciones en Lote (`Shift`/`Ctrl` + Clic):** Marcar, mover o eliminar múltiples tareas o fichas simultáneamente.
- [ ] 💡 **42. Arrastrar Archivos desde el Escritorio (Desktop Drag & Drop):** Arrastrar PDFs o fotos directamente desde el explorador de Windows o Mac hacia la app.
- [ ] 💡 **43. Vista de Doble Panel (Split View sin modales emergentes):** Lista a la izquierda y visor/edición de detalles a la derecha aprovechando la pantalla ancha.
- [x] ✅ **44. Vista de Calendario Mensual Completo:** Cuadrícula de mes completo con badges de tareas y exámenes y panel de detalle por día.
- [x] ✅ **45. Horario Semanal en Matriz Completa:** Visualización simultánea de todas las clases de lunes a viernes en una tabla espaciosa con botón de alternancia.
- [x] ✅ **46. Temporizador Pomodoro Flotante (Picture-in-Picture):** Minimizar el reloj de estudio en ventana flotante PiP o widget superpuesto mientras usas otras apps.
- [ ] 💡 **47. Modo Multi-Monitor:** Ventana independiente para el *Cuaderno LM* o el *Copiloto IA* en una segunda pantalla.
- [ ] 💡 **48. Apuntes a Mano Alzada con Lápiz (Apple Pencil / S-Pen):** Escritura de fórmulas, diagramas y subrayado de apuntes con detección de presión del lápiz en tablets.
- [ ] 💡 **49. Rechazo de Palma (Palm Rejection):** Apoyo natural de la mano sobre la pantalla de la tablet sin trazos involuntarios.
- [ ] 💡 **50. Compatibilidad con Pantalla Dividida de la Tablet (iPadOS / Android Split View):** Usar la agenda en una mitad y el PDF del libro escolar en la otra.
- [ ] 💡 **51. Visor de PDFs de Doble Página (Modo Libro):** Lectura horizontal a dos páginas en monitores y tablets grandes.
- [ ] 💡 **52. Cuaderno LM a 3 Columnas Simultáneas:** Documento a la izquierda, notas en el centro y chat de Gemini a la derecha en tiempo real.
- [x] ✅ **53. Modo Zen Pantalla Completa (Tecla F11 / Botón Zen):** Ocultar distracciones para sesiones intensivas de estudio con reloj grande y sonidos relajantes.

---

## 🇬🇧 11. English Coach & Tutor de Idiomas Interactivo (Speaking, Writing & Corrección)

- [x] ✅ **54. Tutor de Conversación Escolar en Inglés (English Coach):** Práctica de conversación interactiva adaptada al nivel del estudiante (A2, B1, B2, Selectividad/EOI).
- [x] ✅ **55. Recuadro de Corrección Pedagógica en Tiempo Real (Feedback Box):** Corrección de cada mensaje: frase corregida, explicación clara de la regla gramatical y sugerencia de nivel CEFR.
- [x] ✅ **56. Modo Speaking por Voz con Detección y Pronunciación Nativa:** Síntesis y reconocimiento de voz nativo en inglés (`en-US`/`en-GB`).
- [x] ✅ **57. Corrector de Redacciones (Writing & Essay Checker):** Análisis de redacciones escolares indicando errores ortográficos, tiempos verbales y conectores formales (*However, Furthermore, In addition*).
- [x] ✅ **58. Conversor de Errores a Fichas con 1 Toque (Flashcards):** Botón directo en el Feedback Box para guardar cualquier fallo o vocabulario nuevo directamente en el mazo de repaso de inglés.
- [ ] 💡 **59. Simulador de Examen Oral y Roleplay (Selectividad / Cambridge):** La IA actúa como examinador haciendo preguntas de prueba oral o guiando la descripción de imágenes.

---

## 📚 12. Cuaderno LM Avanzado (Entorno de Estudio Estilo NotebookLM)

- [ ] 💡 **60. Subida Directa de Archivos PDF y Word (.docx):** Arrastrar o cargar libros de texto y temas completos en PDF extrayendo el contenido al instante con motor local.
- [ ] 💡 **61. Múltiples Cuadernos Temáticos por Asignatura:** Crear libretas independientes (Historia, Biología, Filosofía) con sus propias fuentes y chats sin mezclar temas.
- [x] ✅ **62. Podcast de Estudio a Dos Voces con Descarga y Síntesis:** Dos locutores virtuales (*Lucía & Mateo*) debatiendo y explicando tus apuntes de forma amena.
- [ ] 💡 **63. Citas Interactivas con Resaltado en Vivo:** Al pulsar sobre una cita `[Fuente X]` en el chat, el visor de apuntes se abre y subraya en amarillo el fragmento exacto.
- [ ] 💡 **64. Modo "Pregúntame a Mí" (Examen Oral IA):** La IA asume el rol de profesor y te hace preguntas sobre tus apuntes, evaluando si tu respuesta está completa o qué te faltó.
- [ ] 💡 **65. Generador de Mapas Mentales y Esquemas Visuales:** Convertir apuntes extensos en diagramas interactivos y esquemas gráficos para aprendizaje visual.
- [x] ✅ **66. Bloc de Notas Integrado (Scratchpad):** Espacio personal persistente y botón `📌 En mis Notas` en cada respuesta del chat y estudio para redactar tu propio resumen dentro de la app.

---

### 📬 ¿Cómo proponer una nueva idea o votar por una existente?
Si quieres proponer una nueva funcionalidad o priorizar alguna de estas opciones:
1. Abre un **[Issue en GitHub](https://github.com/Mahay78/agenda-escolar/issues)** usando la plantilla de sugerencia.
2. Deja una estrella ⭐ en el repositorio para apoyar el desarrollo continuo de la aplicación.

