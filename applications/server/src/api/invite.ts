import { HttpApiBuilder } from '@effect/platform';
import { Auth, Invite } from '@sideline/domain';
import { Effect, Option, Schedule } from 'effect';
import { Api } from '~/api/api.js';
import { TeamInvitesRepository } from '~/repositories/TeamInvitesRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';

const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const INVITE_CODE_LENGTH = 12;

const generateInviteCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(INVITE_CODE_LENGTH));
  return Array.from(bytes, (b) => INVITE_CODE_CHARS[b % INVITE_CODE_CHARS.length]).join('');
};

export const InviteApiLive = HttpApiBuilder.group(Api, 'invite', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('teams', () => TeamsRepository),
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('invites', () => TeamInvitesRepository),
    Effect.map(({ teams, members, invites }) =>
      handlers
        .handle('getInvite', ({ path: { code } }) =>
          invites.findByCode(code).pipe(
            Effect.mapError(() => new Invite.InviteNotFound()),
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.fail(new Invite.InviteNotFound()),
                onSome: Effect.succeed,
              }),
            ),
            Effect.bindTo('invite'),
            Effect.bind('team', ({ invite }) =>
              teams.findById(invite.team_id).pipe(
                Effect.mapError(() => new Invite.InviteNotFound()),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Invite.InviteNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.map(
              ({ team, invite }) =>
                new Invite.InviteInfo({
                  teamName: team.name,
                  teamId: team.id,
                  code: invite.code,
                }),
            ),
          ),
        )
        .handle('joinViaInvite', ({ path: { code } }) =>
          Effect.Do.pipe(
            Effect.bind('user', () => Auth.CurrentUserContext),
            Effect.bind('invite', () =>
              invites.findByCode(code).pipe(
                Effect.mapError(() => new Invite.InviteNotFound()),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Invite.InviteNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.bind('existing', ({ user, invite }) =>
              members
                .findMembershipByIds(invite.team_id, user.id)
                .pipe(Effect.mapError(() => new Invite.InviteNotFound())),
            ),
            Effect.tap(({ existing }) =>
              Option.isSome(existing) ? Effect.fail(new Invite.AlreadyMember()) : Effect.void,
            ),
            Effect.bind('membership', ({ user, invite }) =>
              members
                .addMember({
                  team_id: invite.team_id,
                  user_id: user.id,
                  role: 'member',
                  active: true,
                  joined_at: undefined,
                })
                .pipe(Effect.mapError(() => new Invite.InviteNotFound())),
            ),
            Effect.map(
              ({ user, membership }) =>
                new Invite.JoinResult({
                  teamId: membership.team_id,
                  role: membership.role,
                  isProfileComplete: user.isProfileComplete,
                }),
            ),
          ),
        )
        .handle('regenerateInvite', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('user', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ user }) =>
              members.findMembershipByIds(teamId, user.id).pipe(
                Effect.mapError(() => new Invite.Forbidden()),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Invite.Forbidden()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ membership }) =>
              membership.role !== 'admin' ? Effect.fail(new Invite.Forbidden()) : Effect.void,
            ),
            Effect.bind('newInvite', ({ user }) =>
              Effect.suspend(() =>
                invites.create({
                  team_id: teamId,
                  code: generateInviteCode(),
                  active: true,
                  created_by: user.id,
                  expires_at: null,
                  created_at: undefined,
                }),
              ).pipe(
                Effect.retry(Schedule.addDelay(Schedule.recurs(5), () => '100 millis')),
                Effect.mapError(() => new Invite.Forbidden()),
              ),
            ),
            Effect.tap(({ newInvite }) =>
              invites
                .deactivateByTeamExcept({ teamId, excludeId: newInvite.id })
                .pipe(Effect.mapError(() => new Invite.Forbidden())),
            ),
            Effect.map(
              ({ newInvite }) =>
                new Invite.InviteCode({
                  code: newInvite.code,
                  active: newInvite.active,
                }),
            ),
          ),
        )
        .handle('disableInvite', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('user', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ user }) =>
              members.findMembershipByIds(teamId, user.id).pipe(
                Effect.mapError(() => new Invite.Forbidden()),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Invite.Forbidden()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ membership }) =>
              membership.role !== 'admin' ? Effect.fail(new Invite.Forbidden()) : Effect.void,
            ),
            Effect.tap(() =>
              invites.deactivateByTeam(teamId).pipe(Effect.mapError(() => new Invite.Forbidden())),
            ),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
