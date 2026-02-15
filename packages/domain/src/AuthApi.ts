import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
} from "@effect/platform"
import { Context, Schema } from "effect"

export const UserId = Schema.UUID.pipe(Schema.brand("UserId"))
export type UserId = typeof UserId.Type

export class User extends Schema.Class<User>("User")({
  id: UserId,
  discordId: Schema.String,
  discordUsername: Schema.String,
  discordAvatar: Schema.NullOr(Schema.String),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}

export class CurrentUser extends Schema.Class<CurrentUser>("CurrentUser")({
  id: UserId,
  discordId: Schema.String,
  discordUsername: Schema.String,
  discordAvatar: Schema.NullOr(Schema.String),
}) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  HttpApiSchema.annotations({ status: 401 }),
) {}

export const sessionSecurity = HttpApiSecurity.apiKey({ key: "session", in: "cookie" })

export class CurrentUserContext extends Context.Tag("CurrentUserContext")<
  CurrentUserContext,
  CurrentUser
>() {}

export class AuthMiddleware extends HttpApiMiddleware.Tag<AuthMiddleware>()("AuthMiddleware", {
  failure: Unauthorized,
  provides: CurrentUserContext,
  security: { session: sessionSecurity },
}) {}

export class AuthApiGroup extends HttpApiGroup.make("auth")
  .addError(Unauthorized, { status: 401 })
  .add(HttpApiEndpoint.get("login", "/auth/login").addSuccess(Schema.Void))
  .add(
    HttpApiEndpoint.get("callback", "/auth/callback")
      .addSuccess(Schema.Void)
      .setUrlParams(
        Schema.Struct({
          code: Schema.String,
          state: Schema.String,
        }),
      ),
  )
  .add(HttpApiEndpoint.post("logout", "/auth/logout").addSuccess(Schema.Void))
  .add(HttpApiEndpoint.get("me", "/auth/me").addSuccess(CurrentUser).middleware(AuthMiddleware)) {}
