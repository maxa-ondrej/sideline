import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
} from '@effect/platform';
import { Context, Schema } from 'effect';
import { UserId } from '../models/User.js';

export { UserId } from '../models/User.js';

export class CurrentUser extends Schema.Class<CurrentUser>('CurrentUser')({
  id: UserId,
  discordId: Schema.String,
  discordUsername: Schema.String,
  discordAvatar: Schema.NullOr(Schema.String),
  isProfileComplete: Schema.Boolean,
}) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  'Unauthorized',
  {},
  HttpApiSchema.annotations({ status: 401 }),
) {}

export class CurrentUserContext extends Context.Tag('CurrentUserContext')<
  CurrentUserContext,
  CurrentUser
>() {}

export class AuthMiddleware extends HttpApiMiddleware.Tag<AuthMiddleware>()('AuthMiddleware', {
  failure: Unauthorized,
  provides: CurrentUserContext,
  security: { token: HttpApiSecurity.bearer },
}) {}

export class AuthApiGroup extends HttpApiGroup.make('auth')
  .add(HttpApiEndpoint.get('login', '/login').addSuccess(Schema.Void, { status: 302 }))
  .add(
    HttpApiEndpoint.get('callback', '/callback')
      .addSuccess(Schema.Void, { status: 302 })
      .setUrlParams(
        Schema.Struct({
          code: Schema.String.pipe(Schema.optionalWith({ as: 'Option' })),
          state: Schema.String.pipe(Schema.optionalWith({ as: 'Option' })),
          error: Schema.String.pipe(Schema.optionalWith({ as: 'Option' })),
        }),
      ),
  )
  .add(
    HttpApiEndpoint.get('me', '/me')
      .addSuccess(CurrentUser)
      .addError(Unauthorized, { status: 401 })
      .middleware(AuthMiddleware),
  )
  .prefix('/auth') {}
