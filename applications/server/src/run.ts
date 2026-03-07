import { createServer } from 'node:http';
import { NodeFileSystem, NodeHttpServer } from '@effect/platform-node';
import { SqlClient } from '@effect/sql';
import { PgClient } from '@effect/sql-pg';
import { Runtime } from '@sideline/effect-lib';
import { AfterMigrator, BeforeMigrator } from '@sideline/migrations';
import { Config, Effect, Layer } from 'effect';
import { env } from '~/env.js';
import { AppLive, HealthServerLive } from '~/index.js';
import { AgeThresholdRepository } from '~/repositories/AgeThresholdRepository.js';
import { ChannelSyncEventsRepository } from '~/repositories/ChannelSyncEventsRepository.js';
import { EventSeriesRepository } from '~/repositories/EventSeriesRepository.js';
import { EventSyncEventsRepository } from '~/repositories/EventSyncEventsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { GroupsRepository } from '~/repositories/GroupsRepository.js';
import { NotificationsRepository } from '~/repositories/NotificationsRepository.js';
import { TeamSettingsRepository } from '~/repositories/TeamSettingsRepository.js';
import { AgeCheckCron } from '~/services/AgeCheckCron.js';
import { AgeCheckService } from '~/services/AgeCheckService.js';
import { EventHorizonCron } from '~/services/EventHorizonCron.js';
import { RsvpReminderCron } from '~/services/RsvpReminderCron.js';

const BasePg: Config.Config.Wrap<PgClient.PgClientConfig> = {
  host: Config.succeed(env.DATABASE_HOST),
  port: Config.succeed(env.DATABASE_PORT),
  database: Config.succeed(env.DATABASE_NAME),
  username: Config.succeed(env.DATABASE_USER),
  password: Config.succeed(env.DATABASE_PASS),
};

const CreateDb = SqlClient.SqlClient.pipe(
  Effect.andThen((sql) => sql.unsafe(`CREATE DATABASE "${env.DATABASE_NAME}"`)),
  Effect.tap(Effect.logInfo),
  Effect.tapError(Effect.logWarning),
  Effect.option,
  Effect.asVoid,
  Effect.provide(
    PgClient.layerConfig({
      ...BasePg,
      database: Config.succeed(env.DATABASE_MAIN),
    }),
  ),
);

const MigratorContext = Layer.merge(PgClient.layerConfig(BasePg), NodeFileSystem.layer);
const MigrateBefore = BeforeMigrator.pipe(Effect.provide(MigratorContext));
const MigrateAfter = AfterMigrator.pipe(Effect.provide(MigratorContext));

const App = AppLive.pipe(
  Layer.provide(PgClient.layerConfig(BasePg)),
  Layer.provide(NodeHttpServer.layer(createServer, { port: env.PORT })),
  Layer.launch,
  Effect.withLogSpan('app'),
);

const Health = HealthServerLive.pipe(Layer.launch, Effect.withLogSpan('health'));

const RepositoriesLive = Layer.mergeAll(
  AgeThresholdRepository.Default,
  NotificationsRepository.Default,
  GroupsRepository.Default,
  ChannelSyncEventsRepository.Default,
);

const Cron = AgeCheckCron.pipe(
  Effect.provide(
    AgeCheckService.Default.pipe(
      Layer.provideMerge(RepositoriesLive),
      Layer.provideMerge(PgClient.layerConfig(BasePg)),
    ),
  ),
  Effect.withLogSpan('age-check-cron'),
);

const EventHorizonRepositoriesLive = Layer.mergeAll(
  EventSeriesRepository.Default,
  EventsRepository.Default,
  TeamSettingsRepository.Default,
);

const HorizonCron = EventHorizonCron.pipe(
  Effect.provide(
    EventHorizonRepositoriesLive.pipe(Layer.provideMerge(PgClient.layerConfig(BasePg))),
  ),
  Effect.withLogSpan('event-horizon-cron'),
);

const RsvpReminderRepositoriesLive = Layer.mergeAll(
  EventsRepository.Default,
  EventSyncEventsRepository.Default,
  TeamSettingsRepository.Default,
);

const ReminderCron = RsvpReminderCron.pipe(
  Effect.provide(
    RsvpReminderRepositoriesLive.pipe(Layer.provideMerge(PgClient.layerConfig(BasePg))),
  ),
  Effect.withLogSpan('rsvp-reminder-cron'),
);

Effect.Do.pipe(
  Effect.tap(() => (env.DATABASE_MAIN !== env.DATABASE_NAME ? CreateDb : Effect.void)),
  Effect.tap(() => MigrateBefore),
  Effect.andThen(() =>
    Effect.all([App, Health, MigrateAfter, Cron, HorizonCron, ReminderCron], { concurrency: 6 }),
  ),
  Runtime.runMain(env.NODE_ENV, env.LOG_LEVEL),
);
