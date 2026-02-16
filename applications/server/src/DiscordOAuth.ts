import { Discord } from 'arctic';
import { Effect, Redacted } from 'effect';
import { env } from './env.js';

export class DiscordOAuth extends Effect.Service<DiscordOAuth>()('api/DiscordOAuth', {
  effect: Effect.Do.pipe(
    Effect.let('clientId', () => env.DISCORD_CLIENT_ID),
    Effect.let('clientSecret', () => Redacted.value(env.DISCORD_CLIENT_SECRET)),
    Effect.let('redirectUri', () => env.DISCORD_REDIRECT_URI),
    Effect.let(
      'client',
      ({ clientId, clientSecret, redirectUri }) => new Discord(clientId, clientSecret, redirectUri),
    ),
    Effect.map(
      ({ client }) =>
        ({
          createAuthorizationURL: (state: string) =>
            Effect.sync(() => client.createAuthorizationURL(state, null, ['identify'])),
          validateAuthorizationCode: (code: string) =>
            Effect.tryPromise({
              try: () => client.validateAuthorizationCode(code, null),
              catch: (error) => new DiscordOAuthError({ cause: error }),
            }),
        }) as const,
    ),
  ),
}) {}

export class DiscordOAuthError {
  readonly _tag = 'DiscordOAuthError';
  constructor(readonly options: { readonly cause: unknown }) {}
}
