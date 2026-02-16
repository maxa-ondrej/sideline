import { Discord } from 'arctic';
import { Config, Effect, Redacted } from 'effect';

export class DiscordOAuth extends Effect.Service<DiscordOAuth>()('api/DiscordOAuth', {
  effect: Effect.gen(function* () {
    const clientId = yield* Config.string('DISCORD_CLIENT_ID');
    const clientSecret = yield* Config.redacted('DISCORD_CLIENT_SECRET');
    const redirectUri = yield* Config.string('DISCORD_REDIRECT_URI');

    const client = new Discord(clientId, Redacted.value(clientSecret), redirectUri);

    function createAuthorizationURL(state: string) {
      return Effect.sync(() => client.createAuthorizationURL(state, null, ['identify']));
    }

    function validateAuthorizationCode(code: string) {
      return Effect.tryPromise({
        try: () => client.validateAuthorizationCode(code, null),
        catch: (error) => new DiscordOAuthError({ cause: error }),
      });
    }

    return { createAuthorizationURL, validateAuthorizationCode } as const;
  }),
}) {}

export class DiscordOAuthError {
  readonly _tag = 'DiscordOAuthError';
  constructor(readonly options: { readonly cause: unknown }) {}
}
