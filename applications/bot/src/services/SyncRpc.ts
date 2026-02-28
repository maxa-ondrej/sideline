import { RpcClient } from '@effect/rpc';
import { SyncRpcs } from '@sideline/domain';
import { Effect } from 'effect';

export class SyncRpc extends Effect.Service<SyncRpc>()('bot/SyncRpc', {
  scoped: RpcClient.make(SyncRpcs.SyncRpcs),
}) {}
