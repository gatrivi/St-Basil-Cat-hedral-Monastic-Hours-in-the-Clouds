import { GoogleGenAI, Modality } from '@google/genai';
import { HourName } from '../lib/hours';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generatePrayerText(hourName: HourName, date: Date): Promise<string> {
  const prompt = `Generate a short version of the text for the Catholic Liturgy of the Hours for ${hourName} for today (${date.toDateString()}). 
  Keep it under 150 words. Include a short reading, a responsory, and a concluding prayer. 
  Format it nicely using Markdown. Do not include any conversational filler, just the prayer text itself.
  Make it sound authentic to a monastic setting (e.g., Carthusian or Carmelite).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: 'You are a monastic scribe providing the exact text for the Liturgy of the Hours.',
      }
    });
    return response.text || 'Prayer text unavailable.';
  } catch (error) {
    console.error('Error generating prayer text:', error);
    throw new Error('Failed to generate prayer text.');
  }
}

export async function generatePrayerAudio(text: string): Promise<string> {
  try {
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
      throw new Error('No audio data received');
    }
    return base64Audio;
  } catch (error) {
    console.error('Error generating audio:', error);
    throw new Error('Failed to generate audio.');
  }
}
