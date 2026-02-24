import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext } from '@tanstack/react-router';
import { Effect, Option } from 'effect';
import type React from 'react';
import { RootDocument } from '~/components/layouts/RootDocument';
import { fetchEnv } from '~/env.js';
import { ApiClient, runPromiseClient, runPromiseServer } from '~/lib/runtime';
import { setLocale } from '~/paraglide/runtime.js';
import appCss from '../styles.css?url';

const getCurrentUser = ApiClient.pipe(
  Effect.flatMap((api) => api.auth.me()),
  Effect.map(Option.some),
  Effect.catchTag('Unauthorized', () => Effect.succeed(Option.none())),
  Effect.tap((user) => Effect.logInfo('Logged in as', user)),
);

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Sideline',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  ssr: false,
  shellComponent: RootDocumentRoute,
  beforeLoad: async ({ abortController }) => {
    const environment = await fetchEnv(abortController);
    const makeRun = runPromiseServer(environment.SERVER_URL);
    const run = makeRun(abortController);
    const clientRun = runPromiseClient(environment.SERVER_URL);
    const user = await getCurrentUser.pipe(Effect.option, Effect.map(Option.flatten), run);
    if (Option.isSome(user)) {
      setLocale(user.value.locale);
    }
    return {
      environment,
      run,
      clientRun,
      userOption: user,
    };
  },
});

function RootDocumentRoute({ children }: { children: React.ReactNode }) {
  const { clientRun } = Route.useRouteContext();

  return <RootDocument run={clientRun}>{children}</RootDocument>;
}
