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
    console.log('[DEBUG] Gemini Service: generatePrayerText success');
    return response.text || 'Prayer text unavailable.';
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
