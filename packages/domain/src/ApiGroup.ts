import type { HttpApiEndpoint, HttpApiError, HttpApiGroup } from '@effect/platform';

export const getEndpoint =
  <
    Id extends string,
    Endpoints extends HttpApiEndpoint.HttpApiEndpoint.Any = never,
    Error = HttpApiError.HttpApiDecodeError,
    R = never,
    TopLevel extends true | false = false,
  >(
    key: Endpoints['name'],
  ) =>
  (group: HttpApiGroup.HttpApiGroup<Id, Endpoints, Error, R, TopLevel>) =>
    group.endpoints[key];
