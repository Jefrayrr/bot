import { TimelineEntry } from './types.js';
import { eventBus } from './EventBus.js';

class TimelineRecorder {
  private entries: TimelineEntry[] = [];
  private maxEntries: number = 500;

  add(type: TimelineEntry['type'], message: string, data?: Record<string, unknown>): void {
    const entry: TimelineEntry = {
      timestamp: new Date().toISOString(),
      type,
      message,
      data,
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
    eventBus.emit('timeline:entry', entry);
  }

  getEntries(limit?: number): TimelineEntry[] {
    if (limit) return this.entries.slice(-limit);
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }
}

export const timeline = new TimelineRecorder();
