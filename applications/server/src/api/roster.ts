import { HttpApiBuilder } from '@effect/platform';
import { Auth, Roster, type RosterModel as RosterNS } from '@sideline/domain';
import { DateTime, Effect, Option } from 'effect';
import { Api } from '~/api/api.js';
import { parsePermissions, requireMembership, requirePermission } from '~/api/permissions.js';
import { RostersRepository } from '~/repositories/RostersRepository.js';
import type { RosterEntry } from '~/repositories/TeamMembersRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';

const mapDbError =
  <E>(make: () => E) =>
  <A, OrigE, R>(effect: Effect.Effect<A, OrigE, R>): Effect.Effect<A, E, R> =>
    effect.pipe(
      Effect.tapError((e) => Effect.logWarning('Unexpected error in roster handler', e)),
      Effect.mapError(make),
    );

const splitRoleNames = (roleNames: string): ReadonlyArray<string> =>
  roleNames === '' ? [] : roleNames.split(',');

const toRosterPlayer = (entry: RosterEntry) =>
  new Roster.RosterPlayer({
    memberId: entry.member_id,
    userId: entry.user_id,
    roleNames: [...splitRoleNames(entry.role_names)],
    permissions: [...parsePermissions(entry.permissions)],
    name: entry.name,
    birthYear: entry.birth_year,
    gender: entry.gender,
    jerseyNumber: entry.jersey_number,
    position: entry.position,
    proficiency: entry.proficiency,
    discordUsername: entry.discord_username,
    discordAvatar: entry.discord_avatar,
  });

const toRosterInfo = (r: RosterNS.Roster, memberCount: number): Roster.RosterInfo =>
  new Roster.RosterInfo({
    rosterId: r.id,
    teamId: r.team_id,
    name: r.name,
    active: r.active,
    memberCount,
    createdAt: DateTime.formatIso(r.created_at),
  });

export const RosterApiLive = HttpApiBuilder.group(Api, 'roster', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('users', () => UsersRepository),
    Effect.bind('rosters', () => RostersRepository),
    Effect.map(({ members, users, rosters }) =>
      handlers
        .handle('listMembers', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new Roster.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              requirePermission(membership, 'member:view', new Roster.Forbidden()),
            ),
            Effect.bind('roster', () =>
              members.findRosterByTeam(teamId).pipe(mapDbError(() => new Roster.Forbidden())),
            ),
            Effect.map(({ roster }) => roster.map(toRosterPlayer)),
          ),
        )
        .handle('getMember', ({ path: { teamId, memberId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new Roster.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              requirePermission(membership, 'member:view', new Roster.Forbidden()),
            ),
            Effect.bind('entry', () =>
              members.findRosterMemberByIds(teamId, memberId).pipe(
                mapDbError(() => new Roster.Forbidden()),
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
        .handle('updateMember', ({ path: { teamId, memberId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new Roster.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              requirePermission(membership, 'member:edit', new Roster.Forbidden()),
            ),
            Effect.bind('entry', () =>
              members.findRosterMemberByIds(teamId, memberId).pipe(
                mapDbError(() => new Roster.Forbidden()),
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
                .pipe(mapDbError(() => new Roster.Forbidden())),
            ),
            Effect.map(
              ({ entry, updated }) =>
                new Roster.RosterPlayer({
                  memberId: entry.member_id,
                  userId: entry.user_id,
                  roleNames: [...splitRoleNames(entry.role_names)],
                  permissions: [...parsePermissions(entry.permissions)],
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
        .handle('deactivateMember', ({ path: { teamId, memberId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new Roster.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              requirePermission(membership, 'member:remove', new Roster.Forbidden()),
            ),
            Effect.bind('_check', () =>
              members.findRosterMemberByIds(teamId, memberId).pipe(
                mapDbError(() => new Roster.Forbidden()),
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
                .pipe(mapDbError(() => new Roster.Forbidden())),
            ),
            Effect.asVoid,
          ),
        )
        .handle('listRosters', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new Roster.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              requirePermission(membership, 'roster:view', new Roster.Forbidden()),
            ),
            Effect.bind('rosterList', () =>
              rosters.findByTeamId(teamId).pipe(mapDbError(() => new Roster.Forbidden())),
            ),
            Effect.map(({ rosterList }) =>
              rosterList.map(
                (r) =>
                  new Roster.RosterInfo({
                    rosterId: r.id,
                    teamId: r.team_id,
                    name: r.name,
                    active: r.active,
                    memberCount: r.member_count,
                    createdAt: DateTime.formatIso(r.created_at),
                  }),
              ),
            ),
          ),
        )
        .handle('createRoster', ({ path: { teamId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new Roster.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              requirePermission(membership, 'roster:manage', new Roster.Forbidden()),
            ),
            Effect.bind('roster', () =>
              rosters
                .insert({ team_id: teamId, name: payload.name, active: true })
                .pipe(mapDbError(() => new Roster.Forbidden())),
            ),
            Effect.map(({ roster }) => toRosterInfo(roster, 0)),
          ),
        )
        .handle('getRoster', ({ path: { teamId, rosterId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new Roster.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              requirePermission(membership, 'roster:view', new Roster.Forbidden()),
            ),
            Effect.bind('roster', () =>
              rosters.findRosterById(rosterId).pipe(
                mapDbError(() => new Roster.Forbidden()),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.RosterNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.bind('rosterMembers', ({ roster }) =>
              rosters
                .findMemberEntriesById(roster.id)
                .pipe(mapDbError(() => new Roster.Forbidden())),
            ),
            Effect.map(
              ({ roster, rosterMembers }) =>
                new Roster.RosterDetail({
                  rosterId: roster.id,
                  teamId: roster.team_id,
                  name: roster.name,
                  active: roster.active,
                  createdAt: DateTime.formatIso(roster.created_at),
                  members: rosterMembers.map(toRosterPlayer),
                }),
            ),
          ),
        )
        .handle('updateRoster', ({ path: { teamId, rosterId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new Roster.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              requirePermission(membership, 'roster:manage', new Roster.Forbidden()),
            ),
            Effect.bind('existing', () =>
              rosters.findRosterById(rosterId).pipe(
                mapDbError(() => new Roster.Forbidden()),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.RosterNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.bind('updated', () =>
              rosters
                .update({ id: rosterId, name: payload.name, active: payload.active })
                .pipe(mapDbError(() => new Roster.Forbidden())),
            ),
            Effect.bind('memberCount', ({ updated }) =>
              rosters.findMemberEntriesById(updated.id).pipe(
                mapDbError(() => new Roster.Forbidden()),
                Effect.map((e) => e.length),
              ),
            ),
            Effect.map(({ updated, memberCount }) => toRosterInfo(updated, memberCount)),
          ),
        )
        .handle('deleteRoster', ({ path: { teamId, rosterId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new Roster.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              requirePermission(membership, 'roster:manage', new Roster.Forbidden()),
            ),
            Effect.bind('_existing', () =>
              rosters.findRosterById(rosterId).pipe(
                mapDbError(() => new Roster.Forbidden()),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.RosterNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(() =>
              rosters.delete(rosterId).pipe(mapDbError(() => new Roster.Forbidden())),
            ),
            Effect.asVoid,
          ),
        )
        .handle('addRosterMember', ({ path: { teamId, rosterId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new Roster.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              requirePermission(membership, 'roster:manage', new Roster.Forbidden()),
            ),
            Effect.bind('_roster', () =>
              rosters.findRosterById(rosterId).pipe(
                mapDbError(() => new Roster.Forbidden()),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.RosterNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.bind('_member', () =>
              members.findRosterMemberByIds(teamId, payload.memberId).pipe(
                mapDbError(() => new Roster.Forbidden()),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.PlayerNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(() =>
              rosters
                .addMemberById(rosterId, payload.memberId)
                .pipe(mapDbError(() => new Roster.Forbidden())),
            ),
            Effect.asVoid,
          ),
        )
        .handle('removeRosterMember', ({ path: { teamId, rosterId, memberId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, new Roster.Forbidden()),
            ),
            Effect.tap(({ membership }) =>
              requirePermission(membership, 'roster:manage', new Roster.Forbidden()),
            ),
            Effect.bind('_roster', () =>
              rosters.findRosterById(rosterId).pipe(
                mapDbError(() => new Roster.Forbidden()),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.RosterNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.bind('_member', () =>
              members.findRosterMemberByIds(teamId, memberId).pipe(
                mapDbError(() => new Roster.Forbidden()),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.PlayerNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(() =>
              rosters
                .removeMemberById(rosterId, memberId)
                .pipe(mapDbError(() => new Roster.Forbidden())),
            ),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
