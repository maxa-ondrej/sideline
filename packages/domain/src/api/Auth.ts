import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
} from '@effect/platform';
import { Context, Schema } from 'effect';
import { Permission } from '~/models/Role.js';
import { TeamId } from '~/models/Team.js';
import { Gender, Locale, Position, Proficiency, UserId } from '~/models/User.js';

export { UserId } from '~/models/User.js';

export const MIN_AGE = 6;

export class UserTeam extends Schema.Class<UserTeam>('UserTeam')({
  teamId: TeamId,
  teamName: Schema.String,
  roleName: Schema.String,
  permissions: Schema.Array(Permission),
}) {}

export class CurrentUser extends Schema.Class<CurrentUser>('CurrentUser')({
  id: UserId,
  discordId: Schema.String,
  discordUsername: Schema.String,
  discordAvatar: Schema.NullOr(Schema.String),
  isProfileComplete: Schema.Boolean,
  name: Schema.NullOr(Schema.String),
  birthYear: Schema.NullOr(Schema.Number),
  gender: Schema.NullOr(Gender),
  jerseyNumber: Schema.NullOr(Schema.Number),
  position: Schema.NullOr(Position),
  proficiency: Schema.NullOr(Proficiency),
  locale: Locale,
}) {}

export class UpdateLocaleRequest extends Schema.Class<UpdateLocaleRequest>('UpdateLocaleRequest')({
  locale: Locale,
}) {}

export class CreateTeamRequest extends Schema.Class<CreateTeamRequest>('CreateTeamRequest')({
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
}) {}

export class CompleteProfileRequest extends Schema.Class<CompleteProfileRequest>(
  'CompleteProfileRequest',
)({
  name: Schema.String,
  birthYear: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1900),
    Schema.filter((year) => year <= new Date().getFullYear() - MIN_AGE, {
      message: () => `Birth year must be at most ${new Date().getFullYear() - MIN_AGE}`,
    }),
  ),
  gender: Gender,
  jerseyNumber: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.between(0, 99)), {
    as: 'Option',
  }),
  position: Position,
  proficiency: Proficiency,
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
  .add(HttpApiEndpoint.get('getLogin', '/login/url').addSuccess(Schema.URL))
  .add(HttpApiEndpoint.get('doLogin', '/login').addSuccess(Schema.Void, { status: 302 }))
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
  .add(
    HttpApiEndpoint.patch('updateLocale', '/me/locale')
      .addSuccess(CurrentUser)
      .addError(Unauthorized, { status: 401 })
      .setPayload(UpdateLocaleRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('myTeams', '/me/teams')
      .addSuccess(Schema.Array(UserTeam))
      .addError(Unauthorized, { status: 401 })
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('createTeam', '/me/teams')
      .addSuccess(UserTeam)
      .addError(Unauthorized, { status: 401 })
      .setPayload(CreateTeamRequest)
      .middleware(AuthMiddleware),
  )
  .prefix('/auth') {}
