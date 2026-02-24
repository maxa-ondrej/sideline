import { HttpServerResponse } from '@effect/platform';
import { Schema } from 'effect';

export class Redirect extends Schema.Class<Redirect>('Redirect')({
  url: Schema.URL,
}) {
  static fromUrl = (url: URL) => new Redirect({ url });

  static withSearchParam = (key: string, value: string) => (redirect: Redirect) => {
    const newUrl = new URL(redirect.url);
    newUrl.searchParams.set(key, value);
    return Redirect.fromUrl(newUrl);
  };

  static toResponse = (redirect: Redirect) =>
    HttpServerResponse.empty({ status: 302 }).pipe(
      HttpServerResponse.setHeader('Location', redirect.url.toString()),
    );
}
