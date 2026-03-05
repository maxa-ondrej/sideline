import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
} from '@effect/platform';
import { Context, Schema } from 'effect';
import { Snowflake } from '~/models/Discord.js';
import { Permission } from '~/models/Role.js';
import { TeamId } from '~/models/Team.js';
import { Gender, Locale, UserId } from '~/models/User.js';

export { UserId } from '~/models/User.js';

export const MIN_AGE = 6;

export class UserTeam extends Schema.Class<UserTeam>('UserTeam')({
  teamId: TeamId,
  teamName: Schema.String,
  roleNames: Schema.Array(Schema.String),
  permissions: Schema.Array(Permission),
}) {}

export class CurrentUser extends Schema.Class<CurrentUser>('CurrentUser')({
  id: UserId,
  discordId: Schema.String,
  username: Schema.String,
  avatar: Schema.NullOr(Schema.String),
  isProfileComplete: Schema.Boolean,
  name: Schema.NullOr(Schema.String),
  birthDate: Schema.NullOr(Schema.String),
  gender: Schema.NullOr(Gender),
  locale: Locale,
}) {}

export class UpdateLocaleRequest extends Schema.Class<UpdateLocaleRequest>('UpdateLocaleRequest')({
  locale: Locale,
}) {}

export class CreateTeamRequest extends Schema.Class<CreateTeamRequest>('CreateTeamRequest')({
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
  guildId: Snowflake,
}) {}

export class DiscordGuild extends Schema.Class<DiscordGuild>('DiscordGuild')({
  id: Snowflake,
  name: Schema.String,
  icon: Schema.NullOr(Schema.String),
  owner: Schema.Boolean,
  botPresent: Schema.Boolean,
}) {}

export class CompleteProfileRequest extends Schema.Class<CompleteProfileRequest>(
  'CompleteProfileRequest',
)({
  name: Schema.String,
  birthDate: Schema.String.pipe(
    Schema.filter((s) => {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return 'Invalid date';
      if (d < new Date('1900-01-01')) return 'Date must be after 1900-01-01';
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - MIN_AGE);
      if (d > minDate) return `Must be at least ${MIN_AGE} years old`;
      return true;
    }),
  ),
  gender: Gender,
}) {}

export class UpdateProfileRequest extends Schema.Class<UpdateProfileRequest>(
  'UpdateProfileRequest',
)({
  name: Schema.NullOr(Schema.String),
  birthDate: Schema.OptionFromNullOr(
    Schema.String.pipe(
      Schema.filter((s) => {
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) return 'Invalid date';
        if (d < new Date('1900-01-01')) return 'Date must be after 1900-01-01';
        const minDate = new Date();
        minDate.setFullYear(minDate.getFullYear() - MIN_AGE);
        if (d > minDate) return `Must be at least ${MIN_AGE} years old`;
        return true;
      }),
    ),
  ),
  gender: Schema.NullOr(Gender),
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
    HttpApiEndpoint.patch('updateProfile', '/me')
      .addSuccess(CurrentUser)
      .addError(Unauthorized, { status: 401 })
      .setPayload(UpdateProfileRequest)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('myTeams', '/me/teams')
      .addSuccess(Schema.Array(UserTeam))
      .addError(Unauthorized, { status: 401 })
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('myGuilds', '/me/guilds')
      .addSuccess(Schema.Array(DiscordGuild))
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
