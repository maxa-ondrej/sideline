import { createHash } from 'node:crypto';
import type { Discord as DiscordSchemas, Event, Team } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Array as Arr, Effect, Option, Schedule, Schema } from 'effect';
import { guildLocale } from '~/locale.js';
import { buildEventEmbed, YES_EMBED_LIMIT } from '~/rest/events/buildEventEmbed.js';
import { buildUpcomingEventEmbed } from '~/rest/events/buildUpcomingEventEmbed.js';
import { DfxGuild } from '~/schemas.js';
import { SyncRpc } from '~/services/SyncRpc.js';

/** Compute a stable hash of a rendered Discord message payload. */
const hashPayload = (payload: unknown): string =>
  createHash('sha256').update(JSON.stringify(payload)).digest('hex');

type GuildLocaleShape = {
  readonly preferred_locale: string;
  readonly system_channel_id: Option.Option<DiscordSchemas.Snowflake>;
};
const tryDecodeGuild = (raw: unknown): GuildLocaleShape => {
  try {
    return Schema.decodeUnknownSync(DfxGuild)(raw);
  } catch {
    return { preferred_locale: 'en-US', system_channel_id: Option.none() };
  }
};

export const reconcileEvent = (event: {
  event_id: Event.EventId;
  team_id: Team.TeamId;
  guild_id: DiscordSchemas.Snowflake;
}): Effect.Effect<void, never, SyncRpc | DiscordREST> =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc.asEffect()),
    Effect.bind('rest', () => DiscordREST.asEffect()),
    // Get guild for locale
    Effect.bind('guild', ({ rest }) =>
      rest.getGuild(event.guild_id).pipe(
        Effect.map((raw): GuildLocaleShape => tryDecodeGuild(raw)),
        Effect.catch(
          (): Effect.Effect<GuildLocaleShape> =>
            Effect.succeed({
              preferred_locale: 'en-US',
              system_channel_id: Option.none<DiscordSchemas.Snowflake>(),
            }),
        ),
      ),
    ),
    Effect.let('locale', ({ guild }) => guildLocale({ guild_locale: guild.preferred_locale })),
    // 1. Personal channel reconcile: list personal channels for this event
    Effect.bind('personalChannels', ({ rpc }) =>
      rpc['Guild/ListPersonalChannelsForEvent']({ event_id: event.event_id }).pipe(
        Effect.catchTag('RpcClientError', (e) =>
          Effect.logWarning(
            `RPC error listing personal channels for event ${event.event_id}`,
            e,
          ).pipe(
            Effect.map(
              (): ReadonlyArray<{
                team_member_id: string;
                discord_id: DiscordSchemas.Snowflake;
                personal_channel_id: DiscordSchemas.Snowflake;
              }> => [],
            ),
          ),
        ),
      ),
    ),
    // 2. For each member: fetch their upcoming events and render personal embed
    Effect.tap(({ rpc, rest, personalChannels, locale }) =>
      Effect.all(
        Arr.map(personalChannels, (member) =>
          Effect.Do.pipe(
            Effect.bind('events', () =>
              rpc['Guild/GetAllUpcomingEventsForUser']({
                guild_id: event.guild_id,
                discord_user_id: member.discord_id,
              }).pipe(
                // Tolerate RsvpMemberNotFound per member — skip
                Effect.catchTag('RsvpMemberNotFound', () =>
                  Effect.succeed({ events: [], total: 0, team_id: String(event.team_id) }),
                ),
                Effect.catchTag('GuildNotFound', () =>
                  Effect.succeed({ events: [], total: 0, team_id: String(event.team_id) }),
                ),
              ),
            ),
            Effect.bind('stored', () =>
              rpc['PersonalEvents/GetPersonalEventMessage']({
                event_id: event.event_id,
                team_member_id: member.team_member_id,
              }),
            ),
            Effect.flatMap(({ events: userResult, stored }) => {
              // Find this specific event in their upcoming events
              const entry = userResult.events.find((e) => e.event_id === event.event_id);
              if (!entry) {
                // Event not in their upcoming list — skip
                return Effect.void;
              }

              const rendered = buildUpcomingEventEmbed({ entry, locale });
              const hash = hashPayload({
                embeds: rendered.embeds,
                components: rendered.components,
              });

              // Hash-diff: skip if equal
              const storedHash = Option.isSome(stored) ? stored.value.payload_hash : null;
              if (storedHash === hash) {
                return Effect.void;
              }

              if (Option.isSome(stored)) {
                // Update existing message
                const messageId = stored.value.discord_message_id;
                return rest
                  .updateMessage(member.personal_channel_id, messageId, {
                    embeds: rendered.embeds,
                    components: rendered.components,
                  })
                  .pipe(
                    Effect.tap(() =>
                      rpc['PersonalEvents/UpsertPersonalEventMessage']({
                        event_id: event.event_id,
                        team_member_id: member.team_member_id,
                        personal_channel_id: member.personal_channel_id,
                        discord_message_id: messageId,
                        payload_hash: hash,
                      }).pipe(
                        Effect.catchTag('RpcClientError', (e) =>
                          Effect.logWarning(
                            `Failed to upsert personal event message for member ${member.team_member_id}`,
                            e,
                          ),
                        ),
                      ),
                    ),
                    Effect.asVoid,
                    Effect.catchTag(
                      ['HttpClientError', 'RatelimitedResponse', 'ErrorResponse'],
                      (e) =>
                        Effect.logWarning(
                          `Failed to update personal channel message for member ${member.team_member_id}`,
                          e,
                        ),
                    ),
                  );
              }

              // No stored message — CREATE it (new member or new event).
              // Dedup safety: if UpsertPersonalEventMessage fails after retries, delete
              // the just-created Discord message (compensating action) and propagate the
              // error so the event stays dirty and is retried cleanly next tick.
              const upsertRetryPolicy = Schedule.exponential('200 millis').pipe(
                Schedule.both(Schedule.recurs(3)),
              );
              return rest
                .createMessage(member.personal_channel_id, {
                  embeds: rendered.embeds,
                  components: rendered.components,
                })
                .pipe(
                  Effect.flatMap((msg) => {
                    const discordMessageId = msg.id as DiscordSchemas.Snowflake;
                    return rpc['PersonalEvents/UpsertPersonalEventMessage']({
                      event_id: event.event_id,
                      team_member_id: member.team_member_id,
                      personal_channel_id: member.personal_channel_id,
                      discord_message_id: discordMessageId,
                      payload_hash: hash,
                    }).pipe(
                      Effect.retry(upsertRetryPolicy),
                      Effect.tap(() =>
                        Effect.logInfo(
                          `Created personal event message ${discordMessageId} for member ${member.team_member_id} event ${event.event_id}`,
                        ),
                      ),
                      // If persist still fails after retries: compensating delete to avoid orphan,
                      // then re-fail so the event stays dirty and is retried next tick.
                      Effect.catchTag('RpcClientError', (rpcErr) =>
                        rest.deleteMessage(member.personal_channel_id, discordMessageId).pipe(
                          Effect.catchCause((deleteCause) =>
                            Effect.logWarning(
                              `Compensating delete failed for orphan message ${discordMessageId} (member ${member.team_member_id})`,
                              deleteCause,
                            ),
                          ),
                          Effect.andThen(Effect.fail(rpcErr)),
                        ),
                      ),
                    );
                  }),
                  Effect.asVoid,
                  Effect.catchTag(
                    ['HttpClientError', 'RatelimitedResponse', 'ErrorResponse'],
                    (e) =>
                      Effect.logWarning(
                        `Failed to create personal channel message for member ${member.team_member_id}`,
                        e,
                      ),
                  ),
                );
            }),
            Effect.catchTag('RpcClientError', (e) =>
              Effect.logWarning(
                `RPC error reconciling personal channel for member ${member.team_member_id}`,
                e,
              ),
            ),
          ),
        ),
        { concurrency: 1 },
      ),
    ),
    // 3. NB-A1: Also refresh the global shared message (hash-diff to avoid unnecessary API calls)
    Effect.bind('globalMsg', ({ rpc }) =>
      rpc['Event/GetDiscordMessageId']({ event_id: event.event_id }).pipe(
        Effect.catchTag('RpcClientError', (e) =>
          Effect.logWarning(
            `RPC error getting discord message id for event ${event.event_id}`,
            e,
          ).pipe(
            Effect.map(
              (): Option.Option<{
                discord_channel_id: DiscordSchemas.Snowflake;
                discord_message_id: DiscordSchemas.Snowflake;
              }> => Option.none(),
            ),
          ),
        ),
      ),
    ),
    Effect.flatMap(({ rpc, rest, globalMsg, locale }) =>
      Option.match(globalMsg, {
        onNone: () => Effect.void,
        onSome: (msg) =>
          Effect.Do.pipe(
            Effect.bind('embedInfo', () =>
              rpc['Event/GetEventEmbedInfo']({ event_id: event.event_id }),
            ),
            Effect.flatMap(({ embedInfo }) =>
              Option.match(embedInfo, {
                onNone: () => Effect.void,
                onSome: (info) =>
                  Effect.all({
                    counts: rpc['Event/GetRsvpCounts']({ event_id: event.event_id }),
                    yesAttendees: rpc['Event/GetYesAttendeesForEmbed']({
                      event_id: event.event_id,
                      limit: YES_EMBED_LIMIT,
                      member_group_id: Option.none(),
                    }),
                  }).pipe(
                    Effect.flatMap(({ counts, yesAttendees }) => {
                      const payload = buildEventEmbed({
                        teamId: String(event.team_id),
                        eventId: String(event.event_id),
                        title: info.title,
                        description: info.description,
                        imageUrl: info.image_url,
                        startAt: info.start_at,
                        endAt: info.end_at,
                        location: info.location,
                        locationUrl: info.location_url,
                        eventType: info.event_type,
                        counts,
                        yesAttendees,
                        locale,
                        allDay: info.all_day,
                      });

                      // Hash-diff: fetch current stored hash from the message or compute
                      const newHash = hashPayload({
                        embeds: payload.embeds,
                        components: payload.components,
                      });

                      // Check if the global message content changed by fetching it.
                      // We use the message endpoint to get the current content for hash comparison.
                      return rest.getMessage(msg.discord_channel_id, msg.discord_message_id).pipe(
                        Effect.flatMap((currentMsg) => {
                          const currentHash = hashPayload({
                            embeds: currentMsg.embeds ?? [],
                            components: currentMsg.components ?? [],
                          });
                          if (currentHash === newHash) {
                            return Effect.void;
                          }
                          return rest
                            .updateMessage(msg.discord_channel_id, msg.discord_message_id, {
                              embeds: payload.embeds,
                              components: payload.components,
                            })
                            .pipe(
                              Effect.tap(() =>
                                Effect.logInfo(
                                  `Reconciled global message for event ${event.event_id} in channel ${msg.discord_channel_id}`,
                                ),
                              ),
                              Effect.asVoid,
                            );
                        }),
                        Effect.catchTag(
                          ['HttpClientError', 'RatelimitedResponse', 'ErrorResponse'],
                          (_e) =>
                            // If fetching fails, fall back to always updating
                            rest
                              .updateMessage(msg.discord_channel_id, msg.discord_message_id, {
                                embeds: payload.embeds,
                                components: payload.components,
                              })
                              .pipe(
                                Effect.tap(() =>
                                  Effect.logInfo(
                                    `Reconciled global message for event ${event.event_id} (fallback, no hash diff)`,
                                  ),
                                ),
                                Effect.asVoid,
                              ),
                        ),
                      );
                    }),
                    Effect.catchTag(
                      ['HttpClientError', 'RatelimitedResponse', 'ErrorResponse'],
                      (e) =>
                        Effect.logWarning(
                          `Failed to update global event message for event ${event.event_id}`,
                          e,
                        ),
                    ),
                  ),
              }),
            ),
            Effect.catchTag('RpcClientError', (e) =>
              Effect.logWarning(`RPC error refreshing global event message ${event.event_id}`, e),
            ),
          ),
      }),
    ),
    Effect.asVoid,
  );
