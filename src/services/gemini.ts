import { GoogleGenAI, Modality } from '@google/genai';
import { HourName, getFallbackPrayer } from '../lib/hours';
import { getCachedPrayer, setCachedPrayer } from './prayerCache';

// ─── Gemini Client ───
let aiInstance: GoogleGenAI | null = null;
function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in the environment');
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
    const ai = getAI();
    const prompt = `Generate a short version of the text for the Catholic Liturgy of the Hours for ${hourName} for today (${date.toDateString()}). 
    Keep it under 150 words. Include a short reading, a responsory, and a concluding prayer. 
    Format it nicely using Markdown. Do not include any conversational filler, just the prayer text itself.
    Make it sound authentic to a monastic setting (e.g., Carthusian or Carmelite).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: 'You are a monastic scribe providing the exact text for the Liturgy of the Hours for the Gatrivi Digital Chapel.',
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
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
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
