import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { TeamId } from '~/models/Team.js';

export class InviteInfo extends Schema.Class<InviteInfo>('InviteInfo')({
  teamName: Schema.String,
  teamId: TeamId,
  code: Schema.String,
}) {}

export class JoinResult extends Schema.Class<JoinResult>('JoinResult')({
  teamId: TeamId,
  roleName: Schema.String,
  isProfileComplete: Schema.Boolean,
}) {}

export class InviteCode extends Schema.Class<InviteCode>('InviteCode')({
  code: Schema.String,
  active: Schema.Boolean,
}) {}

export class InviteNotFound extends Schema.TaggedError<InviteNotFound>()(
  'InviteNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class AlreadyMember extends Schema.TaggedError<AlreadyMember>()(
  'AlreadyMember',
  {},
  HttpApiSchema.annotations({ status: 409 }),
) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  'Forbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class InviteApiGroup extends HttpApiGroup.make('invite')
  .add(
    HttpApiEndpoint.get('getInvite', '/invite/:code')
      .addSuccess(InviteInfo)
      .addError(InviteNotFound, { status: 404 })
      .setPath(Schema.Struct({ code: Schema.String })),
  )
  .add(
    HttpApiEndpoint.post('joinViaInvite', '/invite/:code/join')
      .addSuccess(JoinResult)
      .addError(InviteNotFound, { status: 404 })
      .addError(AlreadyMember, { status: 409 })
      .setPath(Schema.Struct({ code: Schema.String }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('regenerateInvite', '/teams/:teamId/invite/regenerate')
      .addSuccess(InviteCode)
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.del('disableInvite', '/teams/:teamId/invite')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .setPath(Schema.Struct({ teamId: TeamId }))
      .middleware(AuthMiddleware),
  ) {}
