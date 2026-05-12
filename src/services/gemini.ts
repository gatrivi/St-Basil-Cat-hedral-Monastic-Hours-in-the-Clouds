import { GoogleGenAI, Modality } from '@google/genai';
import { HourName } from '../lib/hours';

// Use a getter to lazy-initialize the AI client
let aiInstance: GoogleGenAI | null = null;
function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('[DEBUG] Gemini Service: Initializing AI client. Key present:', !!apiKey);
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in the environment');
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function generatePrayerText(hourName: HourName, date: Date): Promise<string> {
  console.log(`[DEBUG] Gemini Service: generatePrayerText called for ${hourName}`);
  
  try {
    const ai = getAI();
    const prompt = `Genera una versión breve del texto para la Liturgia de las Horas católica para ${hourName} de hoy (${date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}).
    Mantenlo bajo 150 palabras. Incluye una breve lectura, un responsorio y una oración final.
    Formátalo bien usando Markdown. No incluyas relleno conversacional, solo el texto de la oración.
    Haz que suene auténtico a un entorno monástico (por ejemplo, cartujo o carmelita).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: 'Eres un monje copista que proporciona el texto exacto de la Liturgia de las Horas para la Capilla Digital Gatrivi. Escribe siempre en español.',
      }
    });
    console.log('[DEBUG] Gemini Service: generatePrayerText success');
    return response.text || 'Texto de oración no disponible.';
  } catch (error) {
    console.error('[DEBUG] Gemini Service: generatePrayerText FAILED', error);
    throw error;
  }
}

export async function generatePrayerAudio(text: string): Promise<string> {
  console.log('[DEBUG] Gemini Service: generatePrayerAudio called');
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Charon' }, // Deep, resonant voice
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      console.error('[DEBUG] Gemini Service: generatePrayerAudio - No audio data in response');
      throw new Error('No audio data received');
    }
    console.log('[DEBUG] Gemini Service: generatePrayerAudio success');
    return base64Audio;
  } catch (error) {
    console.error('[DEBUG] Gemini Service: generatePrayerAudio FAILED', error);
    throw error;
  }
}
