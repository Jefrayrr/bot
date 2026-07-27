import { DecisionStep, DecisionTreeData } from './types.js';
import { eventBus } from './EventBus.js';

export class DecisionTracker {
  private currentJobId: string = '';
  private steps: DecisionStep[] = [];

  startJob(jobId: string): void {
    this.currentJobId = jobId;
    this.steps = [];
  }

  addStep(label: string, value: string | boolean | number, passed: boolean): void {
    this.steps.push({ label, value, passed });
    this.emit();
  }

  getResult(): DecisionTreeData {
    return {
      jobId: this.currentJobId,
      steps: [...this.steps],
    };
  }

  emit(): void {
    const tree = this.getResult();
    eventBus.emit('decision:tree', tree);
  }

  emitFinal(jobId: string, score: number, grade: string, passed: boolean): void {
    this.startJob(jobId);
    this.addStep('Score', score.toFixed(1), passed);
    this.addStep('Grade', grade, passed);
  }
}

export const decisionTracker = new DecisionTracker();
