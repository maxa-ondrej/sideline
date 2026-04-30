import { Discord, type EventRpcEvents } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect, Option, Schema } from 'effect';
import { guildLocale } from '~/locale.js';
import { buildClaimMessage } from '~/rest/events/buildClaimMessage.js';
import { DfxGuild } from '~/schemas.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const decodeGuild = Schema.decodeUnknownSync(DfxGuild);
const decodeSnowflake = Schema.decodeSync(Discord.Snowflake);

export const handleTrainingClaimRequest = (event: EventRpcEvents.TrainingClaimRequestEvent) =>
  Option.match(event.discord_target_channel_id, {
    onNone: () =>
      Effect.logWarning(
        `handleTrainingClaimRequest: no owner channel resolved for event ${event.event_id}, skipping`,
      ),
    onSome: (channelId) =>
      Effect.Do.pipe(
        Effect.bind('rpc', () => SyncRpc.asEffect()),
        Effect.bind('rest', () => DiscordREST.asEffect()),
        Effect.bind('guild', ({ rest }) =>
          rest.getGuild(event.guild_id).pipe(Effect.map(decodeGuild)),
        ),
        Effect.flatMap(({ rpc, rest, guild }) => {
          const locale = guildLocale({ guild_locale: guild.preferred_locale });
          const payload = buildClaimMessage({
            title: event.title,
            startAt: event.start_at,
            endAt: event.end_at,
            location: event.location,
            description: event.description,
            claimedBy: Option.none(),
            eventStatus: 'active',
            teamId: event.team_id,
            eventId: event.event_id,
            locale,
          });

          const roleMention = Option.match(event.discord_role_id, {
            onNone: () =>
              ({}) as {
                content?: string;
                allowed_mentions?: { parse: []; roles: string[] };
              },
            onSome: (role) => ({
              content: `<@&${role}>`,
              allowed_mentions: { parse: [] as [], roles: [role] },
            }),
          });

          return rest
            .createMessage(channelId, {
              ...roleMention,
              embeds: payload.embeds,
              components: payload.components,
            })
            .pipe(
              Effect.tap((msg) =>
                rpc['Event/SaveClaimDiscordMessageId']({
                  event_id: event.event_id,
                  channel_id: channelId,
                  message_id: decodeSnowflake(msg.id),
                }),
              ),
              Effect.tap((msg) =>
                Effect.logInfo(
                  `Posted claim message for "${event.title}" to channel ${channelId}, message ${msg.id}`,
                ),
              ),
              Effect.asVoid,
              Effect.catchTag(['HttpClientError', 'RatelimitedResponse', 'ErrorResponse'], (err) =>
                Effect.logWarning(
                  `handleTrainingClaimRequest: failed to post claim message for event ${event.event_id}`,
                  err,
                ),
              ),
            );
        }),
      ),
  });
