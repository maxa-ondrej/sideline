import { HttpApiBuilder } from '@effect/platform';
import { Auth, Roster, type RosterModel } from '@sideline/domain';
import { Array, DateTime, Effect, Option } from 'effect';
import { Api } from '~/api/api.js';
import { requireMembership, requirePermission } from '~/api/permissions.js';
import { RostersRepository } from '~/repositories/RostersRepository.js';
import type { RosterEntry } from '~/repositories/TeamMembersRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';

const toRosterPlayer = (entry: RosterEntry) =>
  new Roster.RosterPlayer({
    memberId: entry.member_id,
    userId: entry.user_id,
    discordId: entry.discord_id,
    roleNames: entry.role_names,
    permissions: entry.permissions,
    name: entry.name,
    birthDate: entry.birth_date,
    gender: entry.gender,
    jerseyNumber: entry.jersey_number,
    username: entry.username,
    avatar: entry.avatar,
  });

const toRosterInfo = (r: RosterModel.Roster, memberCount: number): Roster.RosterInfo =>
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
            Effect.bind('roster', () => members.findRosterByTeam(teamId)),
            Effect.map(({ roster }) => Array.map(roster, toRosterPlayer)),
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
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.PlayerNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.bind('updated', ({ entry }) =>
              users.updateAdminProfile({
                id: entry.user_id,
                name: payload.name,
                birth_date: Option.map(payload.birthDate, DateTime.unsafeMake),
                gender: payload.gender,
              }),
            ),
            Effect.tap(({ entry }) =>
              members.setJerseyNumber(entry.member_id, payload.jerseyNumber),
            ),
            Effect.map(
              ({ entry, updated }) =>
                new Roster.RosterPlayer({
                  memberId: entry.member_id,
                  userId: entry.user_id,
                  discordId: entry.discord_id,
                  roleNames: entry.role_names,
                  permissions: entry.permissions,
                  name: updated.name,
                  birthDate: Option.map(updated.birth_date, DateTime.formatIsoDateUtc),
                  gender: updated.gender,
                  jerseyNumber: payload.jerseyNumber,
                  username: entry.username,
                  avatar: entry.avatar,
                }),
            ),
            Effect.catchTag('NoSuchElementException', Effect.die),
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
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.PlayerNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(() => members.deactivateMemberByIds(teamId, memberId)),
            Effect.asVoid,
            Effect.catchTag('NoSuchElementException', Effect.die),
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
            Effect.bind('rosterList', () => rosters.findByTeamId(teamId)),
            Effect.map(({ rosterList }) =>
              Array.map(
                rosterList,
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
              rosters.insert({ team_id: teamId, name: payload.name, active: true }),
            ),
            Effect.map(({ roster }) => toRosterInfo(roster, 0)),
            Effect.catchTag('NoSuchElementException', Effect.die),
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
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.RosterNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.bind('rosterMembers', ({ roster }) => rosters.findMemberEntriesById(roster.id)),
            Effect.map(
              ({ roster, rosterMembers }) =>
                new Roster.RosterDetail({
                  rosterId: roster.id,
                  teamId: roster.team_id,
                  name: roster.name,
                  active: roster.active,
                  createdAt: DateTime.formatIso(roster.created_at),
                  members: Array.map(rosterMembers, toRosterPlayer),
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
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.RosterNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.bind('updated', () =>
              rosters.update({ id: rosterId, name: payload.name, active: payload.active }),
            ),
            Effect.bind('memberCount', ({ updated }) =>
              rosters.findMemberEntriesById(updated.id).pipe(Effect.map((e) => e.length)),
            ),
            Effect.map(({ updated, memberCount }) => toRosterInfo(updated, memberCount)),
            Effect.catchTag('NoSuchElementException', Effect.die),
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
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.RosterNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(() => rosters.delete(rosterId)),
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
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.PlayerNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(() => rosters.addMemberById(rosterId, payload.memberId)),
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
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Roster.PlayerNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(() => rosters.removeMemberById(rosterId, memberId)),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
