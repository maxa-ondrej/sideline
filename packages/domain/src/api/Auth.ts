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
  name: Schema.NullOr(Schema.String),
  birthYear: Schema.NullOr(Schema.Number),
  gender: Schema.NullOr(Schema.String),
  jerseyNumber: Schema.NullOr(Schema.Number),
  position: Schema.NullOr(Schema.String),
  proficiency: Schema.NullOr(Schema.String),
}) {}

export class CompleteProfileRequest extends Schema.Class<CompleteProfileRequest>(
  'CompleteProfileRequest',
)({
  name: Schema.String,
  birthYear: Schema.Number.pipe(Schema.int(), Schema.between(1900, 2020)),
  gender: Schema.Literal('male', 'female', 'other'),
  jerseyNumber: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.between(0, 99)), {
    as: 'Option',
  }),
  position: Schema.Literal('goalkeeper', 'defender', 'midfielder', 'forward'),
  proficiency: Schema.Literal('beginner', 'intermediate', 'advanced', 'pro'),
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
  .add(
    HttpApiEndpoint.post('completeProfile', '/profile')
      .addSuccess(CurrentUser)
      .addError(Unauthorized, { status: 401 })
      .setPayload(CompleteProfileRequest)
      .middleware(AuthMiddleware),
  )
  .prefix('/auth') {}
