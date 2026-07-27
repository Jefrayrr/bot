import { EventEmitter } from 'events';
import { MirrorEvent } from './types.js';

type Listener = (data: unknown) => void;

class EventBus extends EventEmitter {
  emit(event: string, data?: unknown): boolean {
    const mirrorEvent: MirrorEvent = {
      event,
      data: data ?? null,
      timestamp: new Date().toISOString(),
    };
    return super.emit(event, mirrorEvent);
  }

  onEvent(event: string, listener: (mirrorEvent: MirrorEvent) => void): this {
    return super.on(event, listener);
  }

  removeAll(): void {
    this.removeAllListeners();
  }
}

export const eventBus = new EventBus();
