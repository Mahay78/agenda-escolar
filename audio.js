/**
 * audio.js - Grabadora de notas de voz offline y sintetizador de sonido para Pomodoro
 * 100% Offline (Sintetizador Web Audio API sin archivos externos).
 */

let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let isRecording = false;

/**
 * Inicia la grabación de una nota de voz
 * @param {Function} onProgress Callback con el tiempo transcurrido en segundos
 */
export async function startRecording(onProgress) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Grabación de audio no disponible en este navegador.');
  }

  audioChunks = [];
  audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(audioStream);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.start(200);
  isRecording = true;

  let seconds = 0;
  const interval = setInterval(() => {
    if (!isRecording) {
      clearInterval(interval);
      return;
    }
    seconds++;
    if (onProgress) onProgress(seconds);
  }, 1000);
}

/**
 * Detiene la grabación y devuelve la nota de voz en base64 DataURL
 */
export function stopRecording() {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve(null);
      return;
    }

    isRecording = false;

    mediaRecorder.onstop = () => {
      const mimeType = mediaRecorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunks, { type: mimeType });

      // Detener pistas de audio
      if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop());
        audioStream = null;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          dataUrl: e.target.result,
          durationSec: Math.round(audioBlob.size / 16000), // Estimado
          mimeType
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorder.stop();
  });
}

export function cancelRecording() {
  isRecording = false;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (audioStream) {
    audioStream.getTracks().forEach((track) => track.stop());
    audioStream = null;
  }
  audioChunks = [];
}

// ==========================================================================
// SINTETIZADOR DE SONIDO OFFLINE (WEB AUDIO API)
// ==========================================================================
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Toca un tono suave de campana para fin de sesión Pomodoro
 */
export function playPomodoroBell() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Tono 1 (440 Hz - La)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // Do5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 1.2);

    // Tono 2 (659.25 Hz - Mi)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.15);
    gain2.gain.setValueAtTime(0.35, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 1.6);

    // Tono 3 (783.99 Hz - Sol)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1046.5, now + 0.35); // Do6
    gain3.gain.setValueAtTime(0.4, now + 0.35);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.35);
    osc3.stop(now + 2.0);
  } catch (err) {
    console.warn('No se pudo reproducir campana de audio:', err);
  }
}

/**
 * Toca un tono corto de inicio / descanso
 */
export function playBreakBell() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  } catch (err) {
    console.warn('Audio feedback:', err);
  }
}
