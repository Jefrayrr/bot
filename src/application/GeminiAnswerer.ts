import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApplicationProfile } from './ApplicationProfile.js';

export class GeminiAnswerer {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private profile: ApplicationProfile;

  constructor(profile: ApplicationProfile) {
    this.profile = profile;
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      console.log('[Gemini] Initialized with API key');
    } else {
      console.log('[Gemini] No API key found, disabled');
    }
  }

  isAvailable(): boolean {
    return this.model !== null;
  }

  async answerTextQuestion(label: string, placeholder?: string): Promise<string | null> {
    if (!this.model) return null;

    const prompt = `You are Jefferson Rodriguez, a software developer from Bogotá, Colombia applying for a job.
Answer the following question from a job application form briefly and in a positive/affirmative way.
Keep your answer under 200 characters. Be concise and professional.

Question: "${label}"
${placeholder ? `Context: "${placeholder}"` : ''}

Your profile:
- Full name: ${this.profile.fullName}
- City: ${this.profile.city}
- Experience: ${this.profile.yearsExperience} years
- English level: ${this.profile.english}
- Education: ${this.profile.education.join(', ')}
- Authorized to work: ${this.profile.authorizedToWork}
- Currently employed: ${this.profile.currentlyEmployed}

Answer (short, affirmative, under 200 chars):`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      let text = response.text().trim();

      // Remove quotes if present
      text = text.replace(/^["']|["']$/g, '');

      // Truncate to 200 characters
      if (text.length > 200) {
        text = text.substring(0, 197) + '...';
      }

      console.log(`[Gemini] Answer for "${label.substring(0, 50)}...": "${text}"`);
      return text;
    } catch (err: any) {
      console.warn(`[Gemini] Error: ${err.message}`);
      return null;
    }
  }
}
