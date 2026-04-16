import type { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';

export const getEndpoint =
  <
    Id extends string,
    Endpoints extends HttpApiEndpoint.Any = never,
    TopLevel extends true | false = false,
  >(
    key: HttpApiEndpoint.Name<Endpoints>,
  ) =>
  (group: HttpApiGroup.HttpApiGroup<Id, Endpoints, TopLevel>) =>
    group.endpoints[key] as Endpoints;
