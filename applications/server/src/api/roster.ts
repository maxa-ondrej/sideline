import { HttpApiBuilder } from '@effect/platform';
import { Auth, Roster, type Team } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { Api } from '~/api/api.js';
import type { RosterEntry } from '~/repositories/TeamMembersRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';

const toRosterPlayer = (entry: RosterEntry) =>
  new Roster.RosterPlayer({
    memberId: entry.member_id,
    userId: entry.user_id,
    role: entry.role,
    name: entry.name,
    birthYear: entry.birth_year,
    gender: entry.gender,
    jerseyNumber: entry.jersey_number,
    position: entry.position,
    proficiency: entry.proficiency,
    discordUsername: entry.discord_username,
    discordAvatar: entry.discord_avatar,
  });

const requireMembership = (
  members: TeamMembersRepository,
  teamId: Team.TeamId,
  userId: Auth.UserId,
) =>
  members.findMembershipByIds(teamId, userId).pipe(
    Effect.mapError(() => new Roster.Forbidden()),
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(new Roster.Forbidden()),
        onSome: Effect.succeed,
      }),
    ),
  );

export const RosterApiLive = HttpApiBuilder.group(Api, 'roster', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('users', () => UsersRepository),
    Effect.map(({ members, users }) =>
      handlers
        .handle('listRoster', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('_membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id),
            ),
            Effect.bind('roster', () =>
              members.findRosterByTeam(teamId).pipe(Effect.mapError(() => new Roster.Forbidden())),
            ),
            Effect.map(({ roster }) => roster.map(toRosterPlayer)),
          ),
        )
        .handle('getPlayer', ({ path: { teamId, memberId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('_membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id),
            ),
            Effect.bind('entry', () =>
              members.findRosterMemberByIds(teamId, memberId).pipe(
                Effect.mapError(() => new Roster.Forbidden()),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.PlayerNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.map(({ entry }) => toRosterPlayer(entry)),
          ),
        )
        .handle('updatePlayer', ({ path: { teamId, memberId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id),
            ),
            Effect.tap(({ membership }) =>
              membership.role !== 'admin' ? Effect.fail(new Roster.Forbidden()) : Effect.void,
            ),
            Effect.bind('entry', () =>
              members.findRosterMemberByIds(teamId, memberId).pipe(
                Effect.mapError(() => new Roster.Forbidden()),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.PlayerNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.bind('updated', ({ entry }) =>
              users
                .updateAdminProfile({
                  id: entry.user_id,
                  name: payload.name,
                  birth_year: payload.birthYear,
                  gender: payload.gender,
                  jersey_number: payload.jerseyNumber,
                  position: payload.position,
                  proficiency: payload.proficiency,
                })
                .pipe(Effect.mapError(() => new Roster.Forbidden())),
            ),
            Effect.map(
              ({ entry, updated }) =>
                new Roster.RosterPlayer({
                  memberId: entry.member_id,
                  userId: entry.user_id,
                  role: entry.role,
                  name: updated.name,
                  birthYear: updated.birth_year,
                  gender: updated.gender,
                  jerseyNumber: updated.jersey_number,
                  position: updated.position,
                  proficiency: updated.proficiency,
                  discordUsername: entry.discord_username,
                  discordAvatar: entry.discord_avatar,
                }),
            ),
          ),
        )
        .handle('deactivatePlayer', ({ path: { teamId, memberId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id),
            ),
            Effect.tap(({ membership }) =>
              membership.role !== 'admin' ? Effect.fail(new Roster.Forbidden()) : Effect.void,
            ),
            Effect.bind('_check', () =>
              members.findRosterMemberByIds(teamId, memberId).pipe(
                Effect.mapError(() => new Roster.Forbidden()),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.PlayerNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(() =>
              members
                .deactivateMemberByIds(teamId, memberId)
                .pipe(Effect.mapError(() => new Roster.Forbidden())),
            ),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
