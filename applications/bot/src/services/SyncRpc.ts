import { RpcClient } from '@effect/rpc';
import { RoleSyncRpc } from '@sideline/domain';
import { Effect } from 'effect';

export class SyncRpc extends Effect.Service<SyncRpc>()('bot/SyncRpc', {
  scoped: RpcClient.make(RoleSyncRpc.RoleSyncRpcs),
}) {}
