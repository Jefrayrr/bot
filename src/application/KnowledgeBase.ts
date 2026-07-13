import fs from 'fs/promises';
import path from 'path';
import { QuestionCategory } from './QuestionClassifier.js';

export interface KnowledgeEntry {
  id: string;
  rawText: string;
  normalizedText: string;
  category: QuestionCategory;
  answer: string;
  learnedAt: string;
  lastUsedAt: string;
  timesUsed: number;
}

const KB_FILE = path.resolve(process.env.DATA_DIR || './data', 'knowledge_base.json');

export class KnowledgeBase {
  private entries: KnowledgeEntry[] = [];
  private pendingLearning: Array<{ rawText: string; category: QuestionCategory }> = [];

  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(KB_FILE, 'utf-8');
      this.entries = JSON.parse(data);
      console.log(`[KnowledgeBase] Loaded ${this.entries.length} learned answers.`);
    } catch {
      console.log('[KnowledgeBase] No existing knowledge base, starting fresh.');
      this.entries = [];
    }
  }

  find(rawText: string): KnowledgeEntry | null {
    const normalized = this._normalize(rawText);

    for (const entry of this.entries) {
      if (this._match(normalized, entry.normalizedText)) {
        entry.timesUsed++;
        entry.lastUsedAt = new Date().toISOString();
        return entry;
      }
    }

    return null;
  }

  async learn(rawText: string, answer: string, category: QuestionCategory): Promise<KnowledgeEntry> {
    const entry: KnowledgeEntry = {
      id: `kb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      rawText,
      normalizedText: this._normalize(rawText),
      category,
      answer,
      learnedAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      timesUsed: 1,
    };

    const existingIdx = this.entries.findIndex(e => e.normalizedText === entry.normalizedText);
    if (existingIdx >= 0) {
      this.entries[existingIdx].answer = answer;
      this.entries[existingIdx].timesUsed++;
      this.entries[existingIdx].lastUsedAt = new Date().toISOString();
    } else {
      this.entries.push(entry);
    }

    await this._save();
    return entry;
  }

  async markForLearning(rawText: string, category: QuestionCategory): Promise<void> {
    if (!this.pendingLearning.some(p => p.rawText === rawText)) {
      this.pendingLearning.push({ rawText, category });
    }
  }

  getPendingLearning(): Array<{ rawText: string; category: QuestionCategory }> {
    return [...this.pendingLearning];
  }

  async clearPending(): Promise<void> {
    this.pendingLearning = [];
  }

  private _normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[áäà]/g, 'a')
      .replace(/[éëè]/g, 'e')
      .replace(/[íïì]/g, 'i')
      .replace(/[óöò]/g, 'o')
      .replace(/[úüù]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private _match(a: string, b: string): boolean {
    if (a === b) return true;

    const aWords = a.split(' ');
    const bWords = b.split(' ');

    const intersection = aWords.filter(w => bWords.includes(w)).length;
    const union = new Set([...aWords, ...bWords]).size;

    const jaccard = union > 0 ? intersection / union : 0;
    if (jaccard >= 0.6) return true;

    const longer = aWords.length >= bWords.length ? aWords : bWords;
    const shorter = aWords.length >= bWords.length ? bWords : aWords;
    const contained = shorter.every(w => longer.includes(w));
    if (contained && shorter.length >= 2) return true;

    return false;
  }

  private async _save(): Promise<void> {
    if (process.env.DISABLE_FILE_OUTPUT === 'true') return;
    const dir = path.dirname(KB_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(KB_FILE, JSON.stringify(this.entries, null, 2), 'utf-8');
  }
}
