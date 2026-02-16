import { AuthMiddleware, CurrentUser, Unauthorized } from '@sideline/domain/AuthApi';
import { Effect, Layer, Redacted } from 'effect';
import { SessionsRepository } from './SessionsRepository.js';
import { UsersRepository } from './UsersRepository.js';

export const AuthMiddlewareLive = Layer.effect(
  AuthMiddleware,
  Effect.gen(function* () {
    const sessions = yield* SessionsRepository;
    const users = yield* UsersRepository;

    return {
      token: (token) =>
        Effect.gen(function* () {
          const tokenValue = Redacted.value(token);
          const session = yield* sessions.findByToken(tokenValue);
          if (!session) return yield* new Unauthorized();
          const user = yield* users.findById(session.userId);
          if (!user) return yield* new Unauthorized();
          return new CurrentUser({
            id: user.id,
            discordId: user.discordId,
            discordUsername: user.discordUsername,
            discordAvatar: user.discordAvatar,
          });
        }),
    };
  }),
);
