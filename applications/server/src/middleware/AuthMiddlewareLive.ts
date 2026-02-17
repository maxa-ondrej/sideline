import { AuthMiddleware, CurrentUser, Unauthorized } from '@sideline/domain/api/Auth';
import type { Redacted as RedactedType } from 'effect';
import { Effect, Layer, Option, Redacted } from 'effect';
import { SessionsRepository } from '../repositories/SessionsRepository.js';
import { UsersRepository } from '../repositories/UsersRepository.js';

export const AuthMiddlewareLive = Layer.effect(
  AuthMiddleware,
  Effect.Do.pipe(
    Effect.bind('sessions', () => SessionsRepository),
    Effect.bind('users', () => UsersRepository),
    Effect.map(({ sessions, users }) => ({
      token: (token: RedactedType.Redacted<string>) =>
        sessions.findByToken(Redacted.value(token)).pipe(
          Effect.orDie,
          Effect.flatMap(
            Option.match({
              onNone: () => new Unauthorized(),
              onSome: (session) =>
                users.findById(session.user_id).pipe(
                  Effect.orDie,
                  Effect.flatMap(
                    Option.match({
                      onNone: () => new Unauthorized(),
                      onSome: (user) =>
                        Effect.succeed(
                          new CurrentUser({
                            id: user.id,
                            discordId: user.discord_id,
                            discordUsername: user.discord_username,
                            discordAvatar: user.discord_avatar,
                            isProfileComplete: user.is_profile_complete,
                          }),
                        ),
                    }),
                  ),
                ),
            }),
          ),
        ),
    })),
  ),
);
