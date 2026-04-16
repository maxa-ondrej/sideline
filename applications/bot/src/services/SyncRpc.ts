import { SyncRpcs } from '@sideline/domain';
import { type Effect, Layer, ServiceMap } from 'effect';
import { RpcClient } from 'effect/unstable/rpc';

const make = RpcClient.make(SyncRpcs.SyncRpcs);

export type SyncRpcClient = Effect.Success<typeof make>;

export class SyncRpc extends ServiceMap.Service<SyncRpc, SyncRpcClient>()('bot/SyncRpc') {
  static readonly Default = Layer.effect(SyncRpc, make);
}
