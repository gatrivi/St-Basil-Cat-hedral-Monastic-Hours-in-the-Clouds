import { GoogleGenAI, Modality } from '@google/genai';
import { HourName, getFallbackPrayer } from '../lib/hours';
import { getCachedPrayer, setCachedPrayer } from './prayerCache';

// ─── Gemini Client ───
let aiInstance: GoogleGenAI | null = null;
async function getAI() {
  if (!aiInstance) {
    let apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      try {
        const { rtdbGet } = await import('./firebase');
        apiKey = await rtdbGet('config/gemini_api_key');
      } catch (err) {
        console.warn('[Cathedral] Failed to fetch API key from Firebase:', err);
      }
    }

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined. Set it in .env or Firebase RTDB at /config/gemini_api_key');
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

// ─── Text Generation ───
export async function generatePrayerText(hourName: HourName, date: Date): Promise<string> {
  const dateStr = date.toISOString().split('T')[0];

  // 1. Check cache first (RTDB → localStorage)
  const cached = await getCachedPrayer(hourName, dateStr);
  if (cached) {
    console.log('[Cathedral] Using cached prayer for', hourName);
    return cached;
  }

  // 2. Try Gemini
  try {
    const ai = await getAI();
    const prompt = `Genera una version breve del texto para la Liturgia de las Horas catolica para ${hourName} de hoy (${date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}).
    Mantenlo bajo 150 palabras. Incluye una breve lectura, un responsorio y una oracion final.
    Formatelo bien usando Markdown. No incluyas relleno conversacional, solo el texto de la oracion.
    Haz que suene autentico a un entorno monastico (por ejemplo, cartujo o carmelita).`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Eres un monje copista que proporciona el texto exacto de la Liturgia de las Horas para la Capilla Digital Gatrivi. Escribe siempre en espanol.',
      }
    });
    const text = response.text || 'Prayer text unavailable.';
    await setCachedPrayer(hourName, dateStr, text);
    return text;
  } catch (err) {
    console.warn('[Cathedral] Gemini text generation failed, using fallback:', err);
    // 3. Fallback to built-in prayers (always works, no API needed)
    const fallback = getFallbackPrayer(hourName, date);
    await setCachedPrayer(hourName, dateStr, fallback);
    return fallback;
  }
}

// ─── Audio Generation (Gemini TTS) ───
export async function generatePrayerAudio(text: string): Promise<string> {
  const ai = await getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Charon' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('No audio data received');
  }
  return base64Audio;
}

// ─── Web Speech API Fallback ───
function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(10, (words / 130) * 60);
}

export interface SpeechController {
  play: () => void;
  pause: () => void;
  stop: () => void;
  isPlaying: () => boolean;
  getCurrentTime: () => number;
  getDuration: () => number;
  onEnd: (() => void) | null;
  onPlay: (() => void) | null;
  onPause: (() => void) | null;
  onTimeUpdate: (() => void) | null;
}

export function createSpeechController(text: string): SpeechController {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.85;
  utterance.pitch = 0.95;
  utterance.volume = 1;

  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name.includes('Google UK English Male'))
    || voices.find(v => v.name.includes('Daniel'))
    || voices.find(v => v.name.includes('Fred'))
    || voices.find(v => v.lang.startsWith('en') && v.name.includes('Male'))
    || voices.find(v => v.lang.startsWith('en'));
  if (preferred) utterance.voice = preferred;

  let playing = false;
  let startTime = 0;
  let pausedAt = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const duration = estimateDuration(text);

  const ctrl: SpeechController = {
    onEnd: null,
    onPlay: null,
    onPause: null,
    onTimeUpdate: null,

    play() {
      if (playing) return;
      if (pausedAt > 0) {
        speechSynthesis.cancel();
      }
      speechSynthesis.speak(utterance);
      playing = true;
      startTime = Date.now() - pausedAt * 1000;
      pausedAt = 0;
      ctrl.onPlay?.();

      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        ctrl.onTimeUpdate?.();
      }, 250);
    },

    pause() {
      if (!playing) return;
      speechSynthesis.pause();
      playing = false;
      pausedAt = (Date.now() - startTime) / 1000;
      if (timer) clearInterval(timer);
      ctrl.onPause?.();
    },

    stop() {
      speechSynthesis.cancel();
      playing = false;
      pausedAt = 0;
      startTime = 0;
      if (timer) clearInterval(timer);
    },

    isPlaying() {
      return playing && speechSynthesis.speaking;
    },

    getCurrentTime() {
      if (!playing) return pausedAt;
      return Math.min((Date.now() - startTime) / 1000, duration);
    },

    getDuration() {
      return duration;
    },
  };

  utterance.onend = () => {
    playing = false;
    pausedAt = 0;
    if (timer) clearInterval(timer);
    ctrl.onEnd?.();
  };

  utterance.onerror = (e) => {
    console.warn('[Cathedral] Speech synthesis error:', e.error);
    playing = false;
    if (timer) clearInterval(timer);
    ctrl.onEnd?.();
  };

  return ctrl;
}

// ─── Convenience: try Gemini audio, fallback to Web Speech ───
export async function generateAudioOrFallback(
  text: string
): Promise<{ mode: 'gemini'; base64: string } | { mode: 'speech'; controller: SpeechController }> {
  try {
    const base64 = await generatePrayerAudio(text);
    return { mode: 'gemini', base64 };
  } catch (err) {
    console.warn('[Cathedral] Gemini TTS failed, using browser speech:', err);
    const controller = createSpeechController(text);
    return { mode: 'speech', controller };
  }
}
