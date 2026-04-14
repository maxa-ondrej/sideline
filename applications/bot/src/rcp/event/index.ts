import { type Effect, Layer, ServiceMap } from 'effect';
import { ProcessorService } from './ProcessorService.js';

const make = ProcessorService;

export class EventSyncService extends ServiceMap.Service<
  EventSyncService,
  Effect.Success<typeof make>
>()('bot/EventSyncService') {
  static readonly Default = Layer.effect(EventSyncService, make);
}
