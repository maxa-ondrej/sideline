import { HttpApiBuilder } from '@effect/platform';
import { Auth, EventApi, TeamSettingsApi } from '@sideline/domain';
import { LogicError } from '@sideline/effect-lib';
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
            Effect.bind('row', () => settings.findByTeamId(teamId)),
            Effect.map(({ row }) =>
              Option.match(row, {
                onNone: () =>
                  new TeamSettingsApi.TeamSettingsInfo({
                    teamId,
                    eventHorizonDays: 30,
                    minPlayersThreshold: 0,
                    rsvpReminderHours: 24,
                    discordChannelTraining: Option.none(),
                    discordChannelMatch: Option.none(),
                    discordChannelTournament: Option.none(),
                    discordChannelMeeting: Option.none(),
                    discordChannelSocial: Option.none(),
                    discordChannelOther: Option.none(),
                  }),
                onSome: (s) =>
                  new TeamSettingsApi.TeamSettingsInfo({
                    teamId,
                    eventHorizonDays: s.event_horizon_days,
                    minPlayersThreshold: s.min_players_threshold,
                    rsvpReminderHours: s.rsvp_reminder_hours,
                    discordChannelTraining: s.discord_channel_training,
                    discordChannelMatch: s.discord_channel_match,
                    discordChannelTournament: s.discord_channel_tournament,
                    discordChannelMeeting: s.discord_channel_meeting,
                    discordChannelSocial: s.discord_channel_social,
                    discordChannelOther: s.discord_channel_other,
                  }),
              }),
            ),
          ),
        )
        .handle('updateTeamSettings', ({ path: { teamId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'team:manage', forbidden)),
            Effect.bind('existing', () => settings.findByTeamId(teamId)),
            Effect.bind('result', ({ existing }) =>
              Option.match(existing, {
                onNone: () =>
                  settings.upsert({
                    teamId,
                    eventHorizonDays: payload.eventHorizonDays,
                    minPlayersThreshold: Option.getOrElse(payload.minPlayersThreshold, () => 0),
                    rsvpReminderHours: Option.getOrElse(payload.rsvpReminderHours, () => 24),
                    discordChannelTraining: Option.flatten(payload.discordChannelTraining),
                    discordChannelMatch: Option.flatten(payload.discordChannelMatch),
                    discordChannelTournament: Option.flatten(payload.discordChannelTournament),
                    discordChannelMeeting: Option.flatten(payload.discordChannelMeeting),
                    discordChannelSocial: Option.flatten(payload.discordChannelSocial),
                    discordChannelOther: Option.flatten(payload.discordChannelOther),
                  }),
                onSome: (s) =>
                  settings.upsert({
                    teamId,
                    eventHorizonDays: payload.eventHorizonDays,
                    minPlayersThreshold: Option.getOrElse(
                      payload.minPlayersThreshold,
                      () => s.min_players_threshold,
                    ),
                    rsvpReminderHours: Option.getOrElse(
                      payload.rsvpReminderHours,
                      () => s.rsvp_reminder_hours,
                    ),
                    discordChannelTraining: Option.match(payload.discordChannelTraining, {
                      onNone: () => s.discord_channel_training,
                      onSome: (v) => v,
                    }),
                    discordChannelMatch: Option.match(payload.discordChannelMatch, {
                      onNone: () => s.discord_channel_match,
                      onSome: (v) => v,
                    }),
                    discordChannelTournament: Option.match(payload.discordChannelTournament, {
                      onNone: () => s.discord_channel_tournament,
                      onSome: (v) => v,
                    }),
                    discordChannelMeeting: Option.match(payload.discordChannelMeeting, {
                      onNone: () => s.discord_channel_meeting,
                      onSome: (v) => v,
                    }),
                    discordChannelSocial: Option.match(payload.discordChannelSocial, {
                      onNone: () => s.discord_channel_social,
                      onSome: (v) => v,
                    }),
                    discordChannelOther: Option.match(payload.discordChannelOther, {
                      onNone: () => s.discord_channel_other,
                      onSome: (v) => v,
                    }),
                  }),
              }),
            ),
            Effect.map(
              ({ result }) =>
                new TeamSettingsApi.TeamSettingsInfo({
                  teamId: result.team_id,
                  eventHorizonDays: result.event_horizon_days,
                  minPlayersThreshold: result.min_players_threshold,
                  rsvpReminderHours: result.rsvp_reminder_hours,
                  discordChannelTraining: result.discord_channel_training,
                  discordChannelMatch: result.discord_channel_match,
                  discordChannelTournament: result.discord_channel_tournament,
                  discordChannelMeeting: result.discord_channel_meeting,
                  discordChannelSocial: result.discord_channel_social,
                  discordChannelOther: result.discord_channel_other,
                }),
            ),
            Effect.catchTag(
              'NoSuchElementException',
              LogicError.withMessage(() => 'Failed upserting team settings — no row returned'),
            ),
          ),
        ),
    ),
  ),
);
