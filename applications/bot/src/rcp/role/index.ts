import { Effect, Schedule } from 'effect';
import { ProcessorService } from './ProcessorService.js';

export class RoleSyncService extends Effect.Service<RoleSyncService>()('bot/RoleSyncService', {
  effect: ProcessorService,
}) {
  poll() {
    return this.processTick;
  }

  pollLoop() {
    return this.processTick.pipe(Effect.repeat(Schedule.spaced('5 seconds')));
  }
}
