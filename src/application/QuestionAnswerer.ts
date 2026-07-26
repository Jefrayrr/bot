import { ApplicationProfile } from './ApplicationProfile.js';
import { QuestionClassifier, QuestionCategory, ClassificationResult } from './QuestionClassifier.js';
import { AnswerStrategy } from './AnswerStrategy.js';
import { KnowledgeBase } from './KnowledgeBase.js';
import { GeminiAnswerer } from './GeminiAnswerer.js';

export interface AnswerResult {
  answer: string | null;
  method: 'strategy' | 'knowledge_base' | 'gemini' | 'unknown';
  category: QuestionCategory;
  confidence: number;
}

export class QuestionAnswerer {
  private classifier: QuestionClassifier;
  private strategy: AnswerStrategy;
  private knowledgeBase: KnowledgeBase;
  private gemini: GeminiAnswerer;

  constructor(profile: ApplicationProfile, knowledgeBase: KnowledgeBase) {
    this.classifier = new QuestionClassifier();
    this.strategy = new AnswerStrategy(profile);
    this.knowledgeBase = knowledgeBase;
    this.gemini = new GeminiAnswerer(profile);
  }

  async findAnswer(
    label: string,
    placeholder?: string,
    options?: string[],
    fieldType?: string,
  ): Promise<AnswerResult> {
    const searchText = `${label} ${placeholder || ''}`;
    const opts = options || [];
    const fType = fieldType || 'text';

    const classification = this.classifier.classify(searchText, placeholder || '', opts, fType);

    if (classification.category !== 'unknown') {
      const answer = this.strategy.getAnswer(classification.category, searchText, opts);
      if (answer !== null && answer !== '') {
        return {
          answer,
          method: 'strategy',
          category: classification.category,
          confidence: classification.confidence,
        };
      }
    }

    const kbEntry = this.knowledgeBase.find(searchText);
    if (kbEntry) {
      return {
        answer: kbEntry.answer,
        method: 'knowledge_base',
        category: kbEntry.category,
        confidence: 90,
      };
    }

    // Use Gemini for text/string type questions
    if (this.gemini.isAvailable() && (fType === 'text' || fType === 'textarea') && !label.includes('email') && !label.includes('phone')) {
      const geminiAnswer = await this.gemini.answerTextQuestion(label, placeholder);
      if (geminiAnswer) {
        return {
          answer: geminiAnswer,
          method: 'gemini',
          category: classification.category,
          confidence: 80,
        };
      }
    }

    await this.knowledgeBase.markForLearning(searchText, classification.category);

    return {
      answer: null,
      method: 'unknown',
      category: classification.category,
      confidence: classification.confidence,
    };
  }

  getClassifier(): QuestionClassifier {
    return this.classifier;
  }

  getKnowledgeBase(): KnowledgeBase {
    return this.knowledgeBase;
  }
}
