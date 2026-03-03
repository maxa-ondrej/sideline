import { HttpApiBuilder } from '@effect/platform';
import { Auth, EventApi, TeamSettingsApi } from '@sideline/domain';
import { Effect } from 'effect';
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
            Effect.bind('horizonDays', () =>
              settings.getHorizonDays(teamId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ horizonDays }) =>
                new TeamSettingsApi.TeamSettingsInfo({
                  teamId,
                  eventHorizonDays: horizonDays,
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
            Effect.bind('result', () =>
              settings
                .upsert({
                  teamId,
                  eventHorizonDays: payload.eventHorizonDays,
                })
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ result }) =>
                new TeamSettingsApi.TeamSettingsInfo({
                  teamId: result.team_id,
                  eventHorizonDays: result.event_horizon_days,
                }),
            ),
          ),
        ),
    ),
  ),
);
