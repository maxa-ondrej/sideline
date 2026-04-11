import { ActivityType, Discord } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Ix from 'dfx/Interactions/index';
import { Interaction } from 'dfx/Interactions/index';
import * as DiscordTypes from 'dfx/types';
import { Array, Effect, Metric, Option, pipe, Schema } from 'effect';
import { userLocale } from '~/locale.js';
import { discordInteractionsTotal } from '~/metrics.js';
import { interactionUserId } from '~/schemas.js';
import { SyncRpc } from '~/services/SyncRpc.js';

export const logHandler = Interaction.pipe(
  Effect.tap(() =>
    Metric.update(Metric.tagged(discordInteractionsTotal, 'interaction_type', 'command'), 1),
  ),
  Effect.flatMap((interaction) => {
    const locale = userLocale(interaction);
    const guildId = interaction.guild_id;

    if (!guildId) {
      return Effect.succeed(
        Ix.response({
          type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: m.bot_makanicko_no_guild({}, { locale }),
            flags: DiscordTypes.MessageFlags.Ephemeral,
          },
        }),
      );
    }

    const snowflakeGuildId = Discord.Snowflake.make(guildId);
    const maybeUserId = interactionUserId(interaction);

    if (Option.isNone(maybeUserId)) {
      return Effect.succeed(
        Ix.response({
          type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: m.bot_makanicko_log_error({}, { locale }),
            flags: DiscordTypes.MessageFlags.Ephemeral,
          },
        }),
      );
    }

    const discordUserId = maybeUserId.value;

    const data = interaction.data;
    const subCommand = data && 'options' in data ? data.options?.[0] : undefined;
    const options = subCommand && 'options' in subCommand ? [...(subCommand.options ?? [])] : [];

    const activityTypeRaw = pipe(
      options,
      Array.findFirst((o) => o.name === 'activity'),
      Option.flatMap((o) => ('value' in o ? Option.some(String(o.value)) : Option.none())),
      Option.getOrElse(() => 'gym'),
    );
    const activityTypeSlug = Schema.decodeUnknownOption(ActivityType.ActivityTypeSlug)(
      activityTypeRaw,
    );

    if (Option.isNone(activityTypeSlug)) {
      return Effect.succeed(
        Ix.response({
          type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: m.bot_makanicko_log_error({}, { locale }),
            flags: DiscordTypes.MessageFlags.Ephemeral,
          },
        }),
      );
    }

    const durationMinutes = pipe(
      options,
      Array.findFirst((o) => o.name === 'duration'),
      Option.flatMap((o) =>
        'value' in o && o.value !== null && o.value !== undefined
          ? Option.some(Number(o.value))
          : Option.none(),
      ),
    );

    const note = pipe(
      options,
      Array.findFirst((o) => o.name === 'note'),
      Option.flatMap((o) =>
        'value' in o && o.value !== null && o.value !== undefined
          ? Option.some(String(o.value))
          : Option.none(),
      ),
    );

    const work = Effect.Do.pipe(
      Effect.bind('rpc', () => SyncRpc),
      Effect.bind('rest', () => DiscordREST),
      Effect.flatMap(({ rpc, rest }) =>
        rpc['Activity/LogActivity']({
          guild_id: snowflakeGuildId,
          discord_user_id: discordUserId,
          activity_type: activityTypeSlug.value,
          duration_minutes: durationMinutes,
          note,
        }).pipe(
          Effect.map((result) => ({
            content: m.bot_makanicko_log_success({ activity: result.activity_type_id }, { locale }),
          })),
          Effect.catchTag('ActivityGuildNotFound', () =>
            Effect.succeed({ content: m.bot_makanicko_log_error({}, { locale }) }),
          ),
          Effect.catchTag('ActivityMemberNotFound', () =>
            Effect.succeed({ content: m.bot_makanicko_log_not_member({}, { locale }) }),
          ),
          Effect.catchTag('RpcClientError', () =>
            Effect.succeed({ content: m.bot_makanicko_log_error({}, { locale }) }),
          ),
          Effect.flatMap((payload) =>
            rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
              payload,
            }),
          ),
          Effect.catchTag(
            'RequestError',
            'ResponseError',
            'RatelimitedResponse',
            'ErrorResponse',
            (error) => Effect.logError('Failed to update makanicko log response', error),
          ),
        ),
      ),
    );

    return Effect.as(
      Effect.forkDaemon(work),
      Ix.response({
        type: DiscordTypes.InteractionCallbackTypes.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: { flags: DiscordTypes.MessageFlags.Ephemeral },
      }),
    );
  }),
  Effect.withSpan('command/makanicko/log'),
);
