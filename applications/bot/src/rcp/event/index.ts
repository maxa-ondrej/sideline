import { Effect, Schedule } from 'effect';
import { ProcessorService } from './ProcessorService.js';

export class EventSyncService extends Effect.Service<EventSyncService>()('bot/EventSyncService', {
  effect: ProcessorService,
}) {
  poll() {
    return this.processTick;
  }

  pollLoop() {
    return this.processTick.pipe(Effect.repeat(Schedule.spaced('5 seconds')));
  }
}
