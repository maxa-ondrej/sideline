import { type Effect, Layer, ServiceMap } from 'effect';
import { ProcessorService } from './ProcessorService.js';

const make = ProcessorService;

export class ChannelSyncService extends ServiceMap.Service<
  ChannelSyncService,
  Effect.Success<typeof make>
>()('bot/ChannelSyncService') {
  static readonly Default = Layer.effect(ChannelSyncService, make);
}
