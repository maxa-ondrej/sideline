import { SyncRpcs } from '@sideline/domain';
import { Effect } from 'effect';
import { RpcClient } from 'effect/unstable/rpc';

export class SyncRpc extends Effect.Service<SyncRpc>()('bot/SyncRpc', {
  scoped: RpcClient.make(SyncRpcs.SyncRpcs),
}) {}
