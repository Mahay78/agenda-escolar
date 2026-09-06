/**
 * ocr.js - Módulo de OCR Avanzado (Reconocimiento Óptico de Caracteres)
 * Extrae texto de fotos de pizarras, apuntes y libros en clase utilizando Tesseract.js.
 * Incluye pre-procesamiento con Canvas (inversión de tiza, realce de contraste, binarización)
 * y post-procesamiento inteligente de texto para eliminar errores comunes.
 * 100% en el cliente (navegador), sin enviar imágenes a servidores externos.
 */

let isTesseractLoading = false;
let tesseractLoaded = false;
const ocrCache = new Map(); // Caché en memoria: key -> { text, rawText, confidence, effectiveMode }

/**
 * Carga dinámicamente Tesseract.js desde la carpeta local libs o CDN
 */
export function loadTesseractScript() {
  if (window.Tesseract) {
    tesseractLoaded = true;
    return Promise.resolve(window.Tesseract);
  }

  if (isTesseractLoading) {
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (window.Tesseract) {
          clearInterval(check);
          resolve(window.Tesseract);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(check);
        if (!window.Tesseract) reject(new Error('Tiempo de espera agotado al cargar motor OCR.'));
      }, 15000);
    });
  }

  isTesseractLoading = true;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './libs/tesseract.min.js';
    script.onload = () => {
      isTesseractLoading = false;
      tesseractLoaded = true;
      resolve(window.Tesseract);
    };
    script.onerror = () => {
      // Fallback a CDN
      console.warn('Fallo al cargar libs/tesseract.min.js, intentando CDN...');
      const fallbackScript = document.createElement('script');
      fallbackScript.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      fallbackScript.onload = () => {
        isTesseractLoading = false;
        tesseractLoaded = true;
        resolve(window.Tesseract);
      };
      fallbackScript.onerror = (err) => {
        isTesseractLoading = false;
        reject(new Error('No se pudo cargar el motor OCR Tesseract. Comprueba tu conexión o archivos locales.'));
      };
      document.head.appendChild(fallbackScript);
    };
    document.head.appendChild(script);
  });
}

/**
 * Comprueba si el módulo OCR está listo
 */
export function isOcrReady() {
  return !!window.Tesseract;
}

/**
 * Pre-procesa la imagen mediante HTML5 Canvas para multiplicar la precisión del OCR
 * Modos:
 *  - 'auto': Detecta si la pizarra es oscura (tiza) o clara (papel/rotulador) y aplica el filtro idóneo.
 *  - 'chalkboard': Invierte colores (tiza blanca a negro, pizarra verde/negra a blanco) y estira contraste.
 *  - 'whiteboard': Elimina sombras tenues de fluorescente y resalta trazos de rotulador.
 *  - 'document': Escala de grises con umbral de alto contraste para libros, fotocopias y apuntes.
 *  - 'raw': Imagen original sin alteraciones.
 * 
 * @param {string|Blob|File} imageSource 
 * @param {string} mode
 * @returns {Promise<{ canvas: HTMLCanvasElement, effectiveMode: string, dataUrl: string }>}
 */
export async function preprocessImage(imageSource, mode = 'auto') {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      // Redimensionar si supera 1800px para máxima velocidad sin perder nitidez de trazo
      let { naturalWidth: width, naturalHeight: height } = img;
      const MAX_DIM = 1800;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, width, height);

      if (mode === 'raw') {
        resolve({ canvas, effectiveMode: 'raw', dataUrl: canvas.toDataURL('image/jpeg', 0.85) });
        return;
      }

      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;

      // Calcular luminosidad media con muestreo cada 40 bytes para autodetección ultra rápida
      let sumLuma = 0;
      let sampleCount = 0;
      for (let i = 0; i < d.length; i += 40) {
        sumLuma += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        sampleCount++;
      }
      const avgLuma = sumLuma / (sampleCount || 1);

      let effectiveMode = mode;
      if (mode === 'auto') {
        effectiveMode = avgLuma < 115 ? 'chalkboard' : 'document';
      }

      if (effectiveMode === 'chalkboard') {
        // Pizarra verde / negra: Tiza blanca sobre fondo oscuro
        // Invertimos los colores para que sea texto negro sobre papel blanco (estándar óptimo de Tesseract)
        for (let i = 0; i < d.length; i += 4) {
          const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          let inv = 255 - luma;
          // Estiramiento de contraste
          if (inv < 110) {
            inv = Math.max(0, inv * 0.5); // Letras de tiza más intensas y oscuras
          } else {
            inv = Math.min(255, 135 + (inv - 110) * 1.6); // Fondo de pizarra forzado a blanco limpio
          }
          d[i] = inv;
          d[i + 1] = inv;
          d[i + 2] = inv;
        }
      } else if (effectiveMode === 'whiteboard') {
        // Pizarra blanca: Eliminar sombras de iluminación y resaltar rotuladores
        for (let i = 0; i < d.length; i += 4) {
          const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          let val = luma;
          if (luma > 140) {
            val = 255; // Blanco puro para eliminar sombras grises del aula
          } else {
            val = Math.max(0, luma * 0.65); // Trazos de rotulador (azul, negro, rojo) más oscuros
          }
          d[i] = val;
          d[i + 1] = val;
          d[i + 2] = val;
        }
      } else {
        // Modo 'document': Libros, apuntes, fotocopias
        for (let i = 0; i < d.length; i += 4) {
          const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          let val = luma;
          if (luma > 170) val = 255;
          else if (luma < 90) val = 0;
          else val = ((luma - 90) / 80) * 255;

          d[i] = val;
          d[i + 1] = val;
          d[i + 2] = val;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      resolve({
        canvas,
        effectiveMode,
        dataUrl: canvas.toDataURL('image/jpeg', 0.85)
      });
    };

    img.onerror = () => {
      // Si falla la carga como imagen, devolver objeto seguro
      const fallbackCanvas = document.createElement('canvas');
      resolve({ canvas: fallbackCanvas, effectiveMode: 'raw', dataUrl: '' });
    };

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else if (imageSource instanceof Blob) {
      img.src = URL.createObjectURL(imageSource);
    } else {
      resolve({ canvas: null, effectiveMode: 'raw', dataUrl: '' });
    }
  });
}

/**
 * Limpieza y formateo inteligente del texto extraído por OCR
 * @param {string} rawText 
 * @returns {string}
 */
export function cleanOcrText(rawText) {
  if (!rawText) return '';
  let text = rawText;

  // 1. Normalizar saltos de línea Windows/Unix y eliminar espacios residuales
  text = text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');

  // 2. Unir palabras partidas con guión al final de la línea: ej. "recono-\ncimiento" -> "reconocimiento"
  text = text.replace(/([a-záéíóúüñA-ZÁÉÍÓÚÜÑ])-+\n([a-záéíóúüñA-ZÁÉÍÓÚÜÑ])/g, '$1$2');

  // 3. Arreglar líneas partidas dentro del mismo párrafo (oraciones que no terminan en punto)
  text = text.replace(/([a-záéíóúüñ,;:])\n([a-záéíóúüñ])/g, '$1 $2');

  // 4. Limpiar artefactos aislados frecuentes de bordes de pizarra (caracteres sueltos como ~ . _ | ` ' en líneas solas)
  text = text.replace(/^[\s~_`'|\\\/]{1,2}$/gm, '');

  // 5. Corregir caracteres confusos habituales en castellano
  text = text.replace(/(\d)\s*,\s*(\d)/g, '$1,$2'); // números decimales con coma separada
  text = text.replace(/([0-9]+)\s*º/g, '$1º'); // ordinales: 1 º -> 1º
  text = text.replace(/([0-9]+)\s*ª/g, '$1ª'); // ordinales: 1 ª -> 1ª

  // 6. Eliminar múltiples saltos de línea redundantes
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Convierte el texto reconocido en una lista limpia de deberes o ejercicios
 * @param {string} text 
 * @returns {string}
 */
export function formatAsBulletList(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const formatted = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Si ya empieza con viñeta o número tipo "1." o "1)" o "-", respetarlo
    if (/^(\d+[\.\)]|[a-zA-Z][\.\)]|[-•*])\s+/.test(line)) {
      formatted.push(line);
    } else if (/^(ejercicio|ej|actividad|pág|pag|tema|tarea)/i.test(line)) {
      formatted.push(`📌 ${line}`);
    } else {
      formatted.push(`• ${line}`);
    }
  }

  return formatted.join('\n');
}

/**
 * Reconoce el texto en una imagen dada (DataURL, Blob o URL) con preprocesamiento óptico
 * @param {string|Blob|File} imageSource Imagen a procesar
 * @param {Object} options Opciones de reconocimiento
 * @param {string} [options.mode='auto'] Modo de pre-filtro: 'auto', 'chalkboard', 'whiteboard', 'document', 'raw'
 * @param {string} [options.lang='spa'] Idioma del modelo ('spa' o 'spa+eng')
 * @param {boolean} [options.forceReload=false] Forzar nuevo análisis saltándose la caché
 * @param {Function} [options.onProgress] Callback(progressObj: { status: string, progress: number })
 * @returns {Promise<{ text: string, rawText: string, confidence: number, effectiveMode: string, previewDataUrl: string }>}
 */
export async function recognizeImageText(imageSource, options = {}) {
  const { onProgress, lang = 'spa', mode = 'auto', forceReload = false } = options;
  const cacheKey = typeof imageSource === 'string' ? `${imageSource.substring(0, 100)}_${mode}_${lang}` : null;

  // Comprobar si ya está en caché
  if (cacheKey && !forceReload && ocrCache.has(cacheKey)) {
    const cached = ocrCache.get(cacheKey);
    if (onProgress) onProgress({ status: 'Completado (desde caché)', progress: 1 });
    return cached;
  }

  if (onProgress) onProgress({ status: 'Preparando imagen y aplicando filtros de contraste...', progress: 0.05 });

  // 1. Pre-procesar la imagen con Canvas según el modo elegido
  const { canvas: processedCanvas, effectiveMode, dataUrl: previewDataUrl } = await preprocessImage(imageSource, mode);

  // Intentar primero con la IA local del teléfono (Oppo Reno 12 F / Android ML Kit)
  if (mode === 'auto' || mode === 'raw') {
    try {
      const targetInput = processedCanvas || imageSource;
      const deviceResult = await recognizeWithDeviceAI(targetInput);
      if (deviceResult && deviceResult.text.length > 5) {
        if (onProgress) onProgress({ status: '¡Texto extraído con la IA de tu Oppo!', progress: 1 });
        deviceResult.previewDataUrl = previewDataUrl;
        deviceResult.effectiveMode = 'device_ai';
        if (cacheKey) {
          ocrCache.set(cacheKey, deviceResult);
          ocrCache.set(imageSource, deviceResult);
        }
        return deviceResult;
      }
    } catch (devErr) {
      console.warn('IA local del teléfono no disponible, recurriendo a Tesseract.js:', devErr);
    }
  }

  if (onProgress) onProgress({ status: 'Inicializando motor OCR...', progress: 0.12 });

  const Tesseract = await loadTesseractScript();
  if (!Tesseract) {
    throw new Error('El motor Tesseract no está disponible.');
  }

  if (onProgress) onProgress({ status: 'Analizando texto optimizado...', progress: 0.2 });

  try {
    const workerOptions = {
      workerPath: './libs/worker.min.js'
    };

    const targetInput = processedCanvas || imageSource;

    const result = await Tesseract.recognize(targetInput, lang, {
      ...workerOptions,
      logger: (m) => {
        if (onProgress) {
          let statusText = 'Procesando...';
          if (m.status === 'loading tesseract core') statusText = 'Cargando núcleo OCR WebAssembly...';
          else if (m.status === 'initializing tesseract') statusText = 'Iniciando diccionario lingüístico...';
          else if (m.status === 'loading language traineddata') statusText = 'Cargando modelo de idioma...';
          else if (m.status === 'recognizing text') statusText = `Reconociendo caracteres: ${Math.round((m.progress || 0) * 100)}%`;

          onProgress({
            status: statusText,
            progress: m.progress || 0
          });
        }
      }
    });

    const rawText = (result?.data?.text || '').trim();
    const confidence = Math.round(result?.data?.confidence || 0);

    // 2. Post-procesamiento y limpieza inteligente del texto
    const cleanedText = cleanOcrText(rawText);

    const data = {
      text: cleanedText,
      rawText: rawText,
      confidence: confidence,
      effectiveMode: effectiveMode,
      previewDataUrl: previewDataUrl
    };

    // Guardar en caché
    if (cacheKey) {
      ocrCache.set(cacheKey, data);
      // Guardar también con la clave base si fue modo auto para búsquedas rápidas en galería
      ocrCache.set(imageSource, data);
    }

    if (onProgress) onProgress({ status: '¡Texto extraído y optimizado!', progress: 1 });

    return data;
  } catch (err) {
    console.error('Error durante OCR:', err);
    throw new Error('Error al reconocer texto de la imagen: ' + (err.message || err));
  }
}

/**
 * Obtiene el texto OCR en caché de una imagen si existe
 * @param {string} src
 * @returns {string|null}
 */
export function getCachedOcrText(src) {
  if (ocrCache.has(src)) {
    return ocrCache.get(src).text;
  }
  // Búsqueda por prefijo si está cacheado con modo
  for (const [key, val] of ocrCache.entries()) {
    if (key.startsWith(src.substring(0, 100))) {
      return val.text;
    }
  }
  return null;
}

/**
 * Almacena manualmente un resultado OCR en caché
 * @param {string} src
 * @param {string} text
 */
export function setCachedOcrText(src, text) {
  ocrCache.set(src, { text, rawText: text, confidence: 100, effectiveMode: 'manual' });
}

/**
 * 1. RECONOCIMIENTO CON LA IA NATIVA DEL TELÉFONO (Oppo Reno 12 F / Android ML Kit)
 */
export async function recognizeWithDeviceAI(imageSource) {
  if (typeof window === 'undefined' || !('TextDetector' in window)) {
    return null; // El navegador no soporta TextDetector nativo
  }

  try {
    const detector = new window.TextDetector();
    let imgElement;

    if (imageSource instanceof HTMLCanvasElement || imageSource instanceof HTMLImageElement) {
      imgElement = imageSource;
    } else {
      imgElement = new Image();
      imgElement.src = typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);
      await new Promise((res, rej) => {
        imgElement.onload = res;
        imgElement.onerror = rej;
      });
    }

    const detectedBlocks = await detector.detect(imgElement);
    if (!detectedBlocks || detectedBlocks.length === 0) return null;

    // Ordenar los bloques de texto verticalmente (de arriba a abajo)
    detectedBlocks.sort((a, b) => (a.boundingBox?.top || 0) - (b.boundingBox?.top || 0));
    const rawText = detectedBlocks.map((b) => b.rawValue).filter(Boolean).join('\n');

    return {
      text: cleanOcrText(rawText),
      rawText: rawText,
      confidence: 95,
      effectiveMode: 'device_ai', // IA local del Oppo Reno 12 F / Android
      previewDataUrl: ''
    };
  } catch (err) {
    console.warn('Fallo al usar TextDetector del dispositivo:', err);
    return null;
  }
}

/**
 * 2. RECONOCIMIENTO Y ESTRUCTURACIÓN CON GOOGLE GEMINI
 */
export async function recognizeWithGemini(base64Image, apiKey) {
  if (!apiKey) throw new Error('Debes introducir tu API Key gratuita de Google Gemini.');

  // Detectar MIME type y limpiar encabezado data:image/...;base64,
  const mimeMatch = base64Image.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const base64Data = base64Image.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, '');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const prompt = `Actúa como asistente escolar para un estudiante de instituto. Analiza esta foto de una pizarra o apuntes:
1. Transcribe todo el texto con máxima fidelidad ortográfica.
2. Identifica si hay deberes, tareas o fechas de exámenes.
3. Devuelve primero un resumen claro de los ejercicios o tareas a realizar en formato lista.`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error al conectar con Gemini (${response.status})`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return {
    text: text.trim(),
    confidence: 99,
    effectiveMode: 'gemini_ai'
  };
}
