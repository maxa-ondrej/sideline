import { type Effect, Layer, ServiceMap } from 'effect';
import { ProcessorService } from './ProcessorService.js';

const make = ProcessorService;

export class RoleSyncService extends ServiceMap.Service<
  RoleSyncService,
  Effect.Success<typeof make>
>()('bot/RoleSyncService') {
  static readonly Default = Layer.effect(RoleSyncService, make);
}
