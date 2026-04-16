import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { AuthMiddleware } from '~/api/Auth.js';

export class ICalTokenResponse extends Schema.Class<ICalTokenResponse>('ICalTokenResponse')({
  token: Schema.String,
  url: Schema.String,
}) {}

export class ICalTokenNotFound extends Schema.TaggedErrorClass<ICalTokenNotFound>()(
  'ICalTokenNotFound',
  {},
) {}

export class ICalApiGroup extends HttpApiGroup.make('ical')
  .add(
    HttpApiEndpoint.get('getICalToken', '/me/ical-token', {
      success: ICalTokenResponse,
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('regenerateICalToken', '/me/ical-token/regenerate', {
      success: ICalTokenResponse,
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.get('getICalFeed', '/ical/:token', {
      success: Schema.Void,
      error: ICalTokenNotFound.pipe(HttpApiSchema.status(404)),
      params: { token: Schema.String },
    }),
  ) {}
