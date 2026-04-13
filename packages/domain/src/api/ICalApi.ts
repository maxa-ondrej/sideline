import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { AuthMiddleware } from '~/api/Auth.js';

export class ICalTokenResponse extends Schema.Class<ICalTokenResponse>('ICalTokenResponse')({
  token: Schema.String,
  url: Schema.String,
}) {}

export class ICalTokenNotFound extends Schema.TaggedError<ICalTokenNotFound>()(
  'ICalTokenNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class ICalApiGroup extends HttpApiGroup.make('ical')
  .add(
    HttpApiEndpoint.get('getICalToken', '/me/ical-token')
      .addSuccess(ICalTokenResponse)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('regenerateICalToken', '/me/ical-token/regenerate')
      .addSuccess(ICalTokenResponse)
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getICalFeed', '/ical/:token')
      .addSuccess(Schema.Void)
      .addError(ICalTokenNotFound, { status: 404 })
      .setPath(Schema.Struct({ token: Schema.String })),
  ) {}
