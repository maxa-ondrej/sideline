import { Effect, Schedule } from 'effect';
import { ProcessorService } from './ProcessorService.js';

export class ChannelSyncService extends Effect.Service<ChannelSyncService>()(
  'bot/ChannelSyncService',
  {
    effect: ProcessorService,
  },
) {
  poll() {
    return this.processTick;
  }

  pollLoop() {
    return this.processTick.pipe(Effect.repeat(Schedule.spaced('5 seconds')));
  }
}
