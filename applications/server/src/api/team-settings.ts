import { Auth, EventApi, TeamSettingsApi } from '@sideline/domain';
import { LogicError } from '@sideline/effect-lib';
import { Effect, Option } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { Api } from '~/api/api.js';
import { requireMembership, requirePermission } from '~/api/permissions.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamSettingsRepository } from '~/repositories/TeamSettingsRepository.js';
import { DEFAULT_CHANNEL_FORMAT, DEFAULT_ROLE_FORMAT } from '~/utils/applyDiscordFormat.js';

const forbidden = new EventApi.Forbidden();

export const TeamSettingsApiLive = HttpApiBuilder.group(Api, 'teamSettings', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository.asEffect()),
    Effect.bind('settings', () => TeamSettingsRepository.asEffect()),
    Effect.map(({ members, settings }) =>
      handlers
        .handle('getTeamSettings', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
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
                    discordChannelLateRsvp: Option.none(),
                    createDiscordChannelOnGroup: true,
                    createDiscordChannelOnRoster: true,
                    discordArchiveCategoryId: Option.none(),
                    discordChannelCleanupOnGroupDelete: 'delete',
                    discordChannelCleanupOnRosterDeactivate: 'delete',
                    discordRoleFormat: DEFAULT_ROLE_FORMAT,
                    discordChannelFormat: DEFAULT_CHANNEL_FORMAT,
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
                    discordChannelLateRsvp: s.discord_channel_late_rsvp,
                    createDiscordChannelOnGroup: s.create_discord_channel_on_group,
                    createDiscordChannelOnRoster: s.create_discord_channel_on_roster,
                    discordArchiveCategoryId: s.discord_archive_category_id,
                    discordChannelCleanupOnGroupDelete: s.discord_channel_cleanup_on_group_delete,
                    discordChannelCleanupOnRosterDeactivate:
                      s.discord_channel_cleanup_on_roster_deactivate,
                    discordRoleFormat: s.discord_role_format,
                    discordChannelFormat: s.discord_channel_format,
                  }),
              }),
            ),
          ),
        )
        .handle('updateTeamSettings', ({ path: { teamId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
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
                    discordChannelLateRsvp: Option.flatten(payload.discordChannelLateRsvp),
                    createDiscordChannelOnGroup: Option.getOrElse(
                      payload.createDiscordChannelOnGroup,
                      () => true,
                    ),
                    createDiscordChannelOnRoster: Option.getOrElse(
                      payload.createDiscordChannelOnRoster,
                      () => true,
                    ),
                    discordArchiveCategoryId: Option.flatten(payload.discordArchiveCategoryId),
                    discordChannelCleanupOnGroupDelete: Option.getOrElse(
                      payload.discordChannelCleanupOnGroupDelete,
                      () => 'delete' as const,
                    ),
                    discordChannelCleanupOnRosterDeactivate: Option.getOrElse(
                      payload.discordChannelCleanupOnRosterDeactivate,
                      () => 'delete' as const,
                    ),
                    ...(Option.isSome(payload.discordRoleFormat)
                      ? { discordRoleFormat: payload.discordRoleFormat.value }
                      : {}),
                    ...(Option.isSome(payload.discordChannelFormat)
                      ? { discordChannelFormat: payload.discordChannelFormat.value }
                      : {}),
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
                    discordChannelLateRsvp: Option.match(payload.discordChannelLateRsvp, {
                      onNone: () => s.discord_channel_late_rsvp,
                      onSome: (v) => v,
                    }),
                    createDiscordChannelOnGroup: Option.getOrElse(
                      payload.createDiscordChannelOnGroup,
                      () => s.create_discord_channel_on_group,
                    ),
                    createDiscordChannelOnRoster: Option.getOrElse(
                      payload.createDiscordChannelOnRoster,
                      () => s.create_discord_channel_on_roster,
                    ),
                    discordArchiveCategoryId: Option.match(payload.discordArchiveCategoryId, {
                      onNone: () => s.discord_archive_category_id,
                      onSome: (v) => v,
                    }),
                    discordChannelCleanupOnGroupDelete: Option.getOrElse(
                      payload.discordChannelCleanupOnGroupDelete,
                      () => s.discord_channel_cleanup_on_group_delete,
                    ),
                    discordChannelCleanupOnRosterDeactivate: Option.getOrElse(
                      payload.discordChannelCleanupOnRosterDeactivate,
                      () => s.discord_channel_cleanup_on_roster_deactivate,
                    ),
                    discordRoleFormat: Option.getOrElse(
                      payload.discordRoleFormat,
                      () => s.discord_role_format,
                    ),
                    discordChannelFormat: Option.getOrElse(
                      payload.discordChannelFormat,
                      () => s.discord_channel_format,
                    ),
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
                  discordChannelLateRsvp: result.discord_channel_late_rsvp,
                  createDiscordChannelOnGroup: result.create_discord_channel_on_group,
                  createDiscordChannelOnRoster: result.create_discord_channel_on_roster,
                  discordArchiveCategoryId: result.discord_archive_category_id,
                  discordChannelCleanupOnGroupDelete:
                    result.discord_channel_cleanup_on_group_delete,
                  discordChannelCleanupOnRosterDeactivate:
                    result.discord_channel_cleanup_on_roster_deactivate,
                  discordRoleFormat: result.discord_role_format,
                  discordChannelFormat: result.discord_channel_format,
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
