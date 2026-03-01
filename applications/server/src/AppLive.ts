import {
  FetchHttpClient,
  HttpApiBuilder,
  HttpApiSwagger,
  type HttpRouter,
  HttpServer,
} from '@effect/platform';
import { RpcSerialization, RpcServer } from '@effect/rpc';
import { SyncRpcs } from '@sideline/domain';
import { Layer } from 'effect';
import { ApiLive } from '~/api/index.js';
import { AuthMiddlewareLive } from '~/middleware/AuthMiddlewareLive.js';
import { AgeThresholdRepository } from '~/repositories/AgeThresholdRepository.js';
import { ChannelSyncEventsRepository } from '~/repositories/ChannelSyncEventsRepository.js';
import { DiscordChannelMappingRepository } from '~/repositories/DiscordChannelMappingRepository.js';
import { DiscordRoleMappingRepository } from '~/repositories/DiscordRoleMappingRepository.js';
import { NotificationsRepository } from '~/repositories/NotificationsRepository.js';
import { RoleSyncEventsRepository } from '~/repositories/RoleSyncEventsRepository.js';
import { RolesRepository } from '~/repositories/RolesRepository.js';
import { RostersRepository } from '~/repositories/RostersRepository.js';
import { SessionsRepository } from '~/repositories/SessionsRepository.js';
import { SubgroupsRepository } from '~/repositories/SubgroupsRepository.js';
import { TeamInvitesRepository } from '~/repositories/TeamInvitesRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { TrainingTypesRepository } from '~/repositories/TrainingTypesRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';
import { AgeCheckService } from '~/services/AgeCheckService.js';
import { DiscordOAuth } from '~/services/DiscordOAuth.js';
import { env } from './env.js';
import { HttpLogger } from './middleware/HttpLogger.js';
import { SyncRpcsLive } from './rpc/index.js';

const RpcLive = RpcServer.layer(SyncRpcs.SyncRpcs).pipe(
  Layer.provide(SyncRpcsLive),
  Layer.provide(
    RpcServer.layerProtocolHttp({
      path: env.RPC_PREFIX as HttpRouter.PathInput,
      routerTag: HttpApiBuilder.Router,
    }),
  ),
  Layer.provide(RpcSerialization.layerNdjson),
);

const Repositories = Layer.mergeAll(
  UsersRepository.Default,
  SessionsRepository.Default,
  TeamsRepository.Default,
  TeamMembersRepository.Default,
  RostersRepository.Default,
  RolesRepository.Default,
  SubgroupsRepository.Default,
  TrainingTypesRepository.Default,
  TeamInvitesRepository.Default,
  AgeThresholdRepository.Default,
  NotificationsRepository.Default,
  RoleSyncEventsRepository.Default,
  DiscordRoleMappingRepository.Default,
  ChannelSyncEventsRepository.Default,
  DiscordChannelMappingRepository.Default,
);

export const AppLive = HttpApiBuilder.serve(HttpLogger).pipe(
  Layer.provide(HttpApiSwagger.layer({ path: '/docs/swagger-ui' })),
  Layer.provide(HttpApiBuilder.middlewareOpenApi({ path: '/docs/openapi.json' })),
  Layer.provide(HttpApiBuilder.middlewareCors({ credentials: true, allowedOrigins: () => true })),
  Layer.provide(ApiLive),
  Layer.provide(RpcLive),
  HttpServer.withLogAddress,
  Layer.provide(AuthMiddlewareLive),
  Layer.provide(AgeCheckService.Default),
  Layer.provide(Repositories),
  Layer.provide(DiscordOAuth.Default),
  Layer.provide(FetchHttpClient.layer),
);
