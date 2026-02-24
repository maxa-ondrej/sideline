import { Auth } from '@sideline/domain';
import type { Redacted as RedactedType } from 'effect';
import { Effect, Layer, Option, Redacted } from 'effect';
import { SessionsRepository } from '~/repositories/SessionsRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';

export const AuthMiddlewareLive = Layer.effect(
  Auth.AuthMiddleware,
  Effect.Do.pipe(
    Effect.bind('sessions', () => SessionsRepository),
    Effect.bind('users', () => UsersRepository),
    Effect.map(({ sessions, users }) => ({
      token: (token: RedactedType.Redacted<string>) =>
        sessions.findByToken(Redacted.value(token)).pipe(
          Effect.mapError(() => new Auth.Unauthorized()),
          Effect.flatMap(
            Option.match({
              onNone: () => new Auth.Unauthorized(),
              onSome: (session) =>
                users.findById(session.user_id).pipe(
                  Effect.mapError(() => new Auth.Unauthorized()),
                  Effect.flatMap(
                    Option.match({
                      onNone: () => new Auth.Unauthorized(),
                      onSome: (user) =>
                        Effect.succeed(
                          new Auth.CurrentUser({
                            id: user.id,
                            discordId: user.discord_id,
                            discordUsername: user.discord_username,
                            discordAvatar: user.discord_avatar,
                            isProfileComplete: user.is_profile_complete,
                            name: user.name,
                            birthYear: user.birth_year,
                            gender: user.gender,
                            jerseyNumber: user.jersey_number,
                            position: user.position,
                            proficiency: user.proficiency,
                            locale: user.locale,
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
