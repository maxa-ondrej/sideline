import { HttpApiBuilder } from '@effect/platform';
import { Auth, EventApi, TeamSettingsApi } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { Api } from '~/api/api.js';
import { requireMembership, requirePermission } from '~/api/permissions.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamSettingsRepository } from '~/repositories/TeamSettingsRepository.js';

const forbidden = new EventApi.Forbidden();

export const TeamSettingsApiLive = HttpApiBuilder.group(Api, 'teamSettings', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('settings', () => TeamSettingsRepository),
    Effect.map(({ members, settings }) =>
      handlers
        .handle('getTeamSettings', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'team:manage', forbidden)),
            Effect.bind('row', () =>
              settings.findByTeamId(teamId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(({ row }) => {
              const s = Option.getOrNull(row);
              return new TeamSettingsApi.TeamSettingsInfo({
                teamId,
                eventHorizonDays: s?.event_horizon_days ?? 30,
                discordChannelTraining: s?.discord_channel_training ?? null,
                discordChannelMatch: s?.discord_channel_match ?? null,
                discordChannelTournament: s?.discord_channel_tournament ?? null,
                discordChannelMeeting: s?.discord_channel_meeting ?? null,
                discordChannelSocial: s?.discord_channel_social ?? null,
                discordChannelOther: s?.discord_channel_other ?? null,
              });
            }),
          ),
        )
        .handle('updateTeamSettings', ({ path: { teamId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'team:manage', forbidden)),
            Effect.bind('existing', () =>
              settings.findByTeamId(teamId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.bind('result', ({ existing }) => {
              const s = Option.getOrNull(existing);
              return settings
                .upsert({
                  teamId,
                  eventHorizonDays: payload.eventHorizonDays,
                  discordChannelTraining: Option.match(payload.discordChannelTraining, {
                    onNone: () => s?.discord_channel_training ?? null,
                    onSome: Option.getOrNull,
                  }),
                  discordChannelMatch: Option.match(payload.discordChannelMatch, {
                    onNone: () => s?.discord_channel_match ?? null,
                    onSome: Option.getOrNull,
                  }),
                  discordChannelTournament: Option.match(payload.discordChannelTournament, {
                    onNone: () => s?.discord_channel_tournament ?? null,
                    onSome: Option.getOrNull,
                  }),
                  discordChannelMeeting: Option.match(payload.discordChannelMeeting, {
                    onNone: () => s?.discord_channel_meeting ?? null,
                    onSome: Option.getOrNull,
                  }),
                  discordChannelSocial: Option.match(payload.discordChannelSocial, {
                    onNone: () => s?.discord_channel_social ?? null,
                    onSome: Option.getOrNull,
                  }),
                  discordChannelOther: Option.match(payload.discordChannelOther, {
                    onNone: () => s?.discord_channel_other ?? null,
                    onSome: Option.getOrNull,
                  }),
                })
                .pipe(Effect.mapError(() => forbidden));
            }),
            Effect.map(
              ({ result }) =>
                new TeamSettingsApi.TeamSettingsInfo({
                  teamId: result.team_id,
                  eventHorizonDays: result.event_horizon_days,
                  discordChannelTraining: result.discord_channel_training,
                  discordChannelMatch: result.discord_channel_match,
                  discordChannelTournament: result.discord_channel_tournament,
                  discordChannelMeeting: result.discord_channel_meeting,
                  discordChannelSocial: result.discord_channel_social,
                  discordChannelOther: result.discord_channel_other,
                }),
            ),
          ),
        ),
    ),
  ),
);
