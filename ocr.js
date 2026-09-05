/**
 * ocr.js - Módulo de OCR (Reconocimiento Óptico de Caracteres)
 * Extrae texto de fotos de pizarras, apuntes y libros en clase utilizando Tesseract.js.
 * 100% en el cliente (navegador), sin enviar imágenes a servidores externos.
 */

let isTesseractLoading = false;
let tesseractLoaded = false;
const ocrCache = new Map(); // Caché en memoria de fotos ya procesadas

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
 * Reconoce el texto en una imagen dada (DataURL, Blob o URL)
 * @param {string|Blob|File} imageSource Imagen a procesar
 * @param {Object} options Opciones de reconocimiento
 * @param {Function} [options.onProgress] Callback(progressObj: { status: string, progress: number })
 * @param {string} [options.lang='spa'] Idioma del modelo ('spa' para español)
 * @returns {Promise<{ text: string, confidence: number }>}
 */
export async function recognizeImageText(imageSource, options = {}) {
  const { onProgress, lang = 'spa' } = options;

  // Comprobar si ya está en caché
  if (typeof imageSource === 'string' && ocrCache.has(imageSource)) {
    const cached = ocrCache.get(imageSource);
    if (onProgress) onProgress({ status: 'Completado (desde caché)', progress: 1 });
    return cached;
  }

  if (onProgress) onProgress({ status: 'Inicializando motor OCR...', progress: 0.05 });

  const Tesseract = await loadTesseractScript();
  if (!Tesseract) {
    throw new Error('El motor Tesseract no está disponible.');
  }

  if (onProgress) onProgress({ status: 'Analizando texto en la fotografía...', progress: 0.15 });

  try {
    const workerOptions = {
      workerPath: './libs/worker.min.js'
    };

    const result = await Tesseract.recognize(imageSource, lang, {
      ...workerOptions,
      logger: (m) => {
        if (onProgress) {
          let statusText = 'Procesando...';
          if (m.status === 'loading tesseract core') statusText = 'Cargando núcleo OCR WebAssembly...';
          else if (m.status === 'initializing tesseract') statusText = 'Iniciando diccionario español...';
          else if (m.status === 'loading language traineddata') statusText = 'Descargando modelo de idioma...';
          else if (m.status === 'recognizing text') statusText = `Reconociendo texto: ${Math.round((m.progress || 0) * 100)}%`;

          onProgress({
            status: statusText,
            progress: m.progress || 0
          });
        }
      }
    });

    const recognizedText = (result?.data?.text || '').trim();
    const confidence = result?.data?.confidence || 0;

    const data = {
      text: recognizedText,
      confidence: Math.round(confidence)
    };

    // Guardar en caché si es un dataUrl
    if (typeof imageSource === 'string') {
      ocrCache.set(imageSource, data);
    }

    if (onProgress) onProgress({ status: '¡Texto extraído con éxito!', progress: 1 });

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
  return ocrCache.has(src) ? ocrCache.get(src).text : null;
}

/**
 * Almacena manualmente un resultado OCR en caché
 * @param {string} src
 * @param {string} text
 */
export function setCachedOcrText(src, text) {
  ocrCache.set(src, { text, confidence: 100 });
}
