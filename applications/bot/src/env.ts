import { Schemas } from '@sideline/effect-lib';
import { createEnv } from '@t3-oss/env-core';
import { Discord } from 'dfx';
import { Schema } from 'effect';

export const env = createEnv({
  server: {
    NODE_ENV: Schema.standardSchemaV1(Schemas.NodeEnv),
    DISCORD_BOT_TOKEN: Schema.NonEmptyTrimmedString.pipe(Schema.Redacted, Schema.standardSchemaV1),
    HEALTH_PORT: Schema.NumberFromString.pipe(
      Schemas.Optional(() => 9000),
      Schema.standardSchemaV1,
    ),
    DISCORD_GATEWAY_INTENTS: Schema.NumberFromString.pipe(
      Schemas.Optional(
        () => Discord.GatewayIntentBits.Guilds | Discord.GatewayIntentBits.GuildMembers,
      ),
      Schema.standardSchemaV1,
    ),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
