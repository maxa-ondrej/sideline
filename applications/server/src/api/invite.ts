import { HttpApiBuilder } from '@effect/platform';
import { CurrentUserContext } from '@sideline/domain/api/Auth';
import {
  AlreadyMember,
  Forbidden,
  InviteCode,
  InviteInfo,
  InviteNotFound,
  JoinResult,
} from '@sideline/domain/api/Invite';
import { Effect, Option } from 'effect';
import { TeamInvitesRepository } from '../repositories/TeamInvitesRepository.js';
import { TeamMembersRepository } from '../repositories/TeamMembersRepository.js';
import { TeamsRepository } from '../repositories/TeamsRepository.js';
import { Api } from './health.js';

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
            Effect.orDie,
            Effect.flatMap(
              Option.match({
                onNone: () => new InviteNotFound(),
                onSome: (invite) =>
                  teams.findById(invite.team_id).pipe(
                    Effect.orDie,
                    Effect.flatMap(
                      Option.match({
                        onNone: () => new InviteNotFound(),
                        onSome: (team) =>
                          Effect.succeed(
                            new InviteInfo({
                              teamName: team.name,
                              teamId: team.id,
                              code: invite.code,
                            }),
                          ),
                      }),
                    ),
                  ),
              }),
            ),
          ),
        )
        .handle('joinViaInvite', ({ path: { code } }) =>
          Effect.Do.pipe(
            Effect.bind('user', () => CurrentUserContext),
            Effect.bind('invite', () =>
              invites.findByCode(code).pipe(
                Effect.orDie,
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new InviteNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.bind('existing', ({ user, invite }) =>
              members.findMembershipByIds(invite.team_id, user.id).pipe(Effect.orDie),
            ),
            Effect.tap(({ existing }) =>
              Option.isSome(existing) ? Effect.fail(new AlreadyMember()) : Effect.void,
            ),
            Effect.bind('membership', ({ user, invite }) =>
              members
                .addMember({
                  team_id: invite.team_id,
                  user_id: user.id,
                  role: 'member',
                  joined_at: undefined,
                })
                .pipe(Effect.orDie),
            ),
            Effect.map(
              ({ user, membership }) =>
                new JoinResult({
                  teamId: membership.team_id,
                  role: membership.role,
                  isProfileComplete: user.isProfileComplete,
                }),
            ),
          ),
        )
        .handle('regenerateInvite', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('user', () => CurrentUserContext),
            Effect.bind('membership', ({ user }) =>
              members.findMembershipByIds(teamId, user.id).pipe(
                Effect.orDie,
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Forbidden()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ membership }) =>
              membership.role !== 'admin' ? Effect.fail(new Forbidden()) : Effect.void,
            ),
            Effect.tap(() => invites.deactivateByTeam(teamId).pipe(Effect.orDie)),
            Effect.bind('newInvite', ({ user }) =>
              invites
                .create({
                  team_id: teamId,
                  code: generateInviteCode(),
                  active: true,
                  created_by: user.id,
                  expires_at: null,
                  created_at: undefined,
                })
                .pipe(Effect.orDie),
            ),
            Effect.map(
              ({ newInvite }) =>
                new InviteCode({
                  code: newInvite.code,
                  active: newInvite.active,
                }),
            ),
          ),
        )
        .handle('disableInvite', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('user', () => CurrentUserContext),
            Effect.bind('membership', ({ user }) =>
              members.findMembershipByIds(teamId, user.id).pipe(
                Effect.orDie,
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new Forbidden()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ membership }) =>
              membership.role !== 'admin' ? Effect.fail(new Forbidden()) : Effect.void,
            ),
            Effect.tap(() => invites.deactivateByTeam(teamId).pipe(Effect.orDie)),
            Effect.map(() => undefined as undefined),
          ),
        ),
    ),
  ),
);
