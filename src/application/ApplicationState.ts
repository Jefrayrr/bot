import fs from 'fs/promises';
import path from 'path';

export interface ApplicationState {
  jobId: string;
  company: string;
  title: string;
  url: string;
  currentStep: number;
  filledFields: string[];
  timestamp: string;
}

const STATE_FILE = path.resolve(process.env.DATA_DIR || './data', 'application_state.json');

export class ApplicationStateManager {
  async save(state: ApplicationState): Promise<void> {
    if (process.env.DISABLE_FILE_OUTPUT === 'true') return;
    const dir = path.dirname(STATE_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    console.log(`[AppState] State saved: ${state.title} @ ${state.company} (step ${state.currentStep})`);
  }

  async load(): Promise<ApplicationState | null> {
    try {
      const data = await fs.readFile(STATE_FILE, 'utf-8');
      const state: ApplicationState = JSON.parse(data);
      return state;
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      await fs.unlink(STATE_FILE);
      console.log('[AppState] State cleared.');
    } catch {
    }
  }

  async hasIncomplete(): Promise<boolean> {
    const state = await this.load();
    if (!state) return false;

    const age = Date.now() - new Date(state.timestamp).getTime();
    const maxAge = 24 * 60 * 60 * 1000;
    if (age > maxAge) {
      console.log('[AppState] Saved state is older than 24h, discarding.');
      await this.clear();
      return false;
    }

    return true;
  }

  async updateStep(step: number, filledField: string): Promise<void> {
    const state = await this.load();
    if (!state) return;

    state.currentStep = step;
    if (!state.filledFields.includes(filledField)) {
      state.filledFields.push(filledField);
    }
    state.timestamp = new Date().toISOString();
    await this.save(state);
  }
}
