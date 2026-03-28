import { setLocale } from '@sideline/i18n/runtime';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext } from '@tanstack/react-router';
import { Effect, Option } from 'effect';
import type React from 'react';
import { RootDocument } from '~/components/layouts/RootDocument';
import { fetchEnv } from '~/env.js';
import { ApiClient, runPromiseClient, runPromiseServer } from '~/lib/runtime';
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
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        title: 'Sideline',
      },
      {
        name: 'theme-color',
        content: '#0a0a0a',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'default',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'Sideline',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'apple-touch-icon',
        href: '/icons/apple-touch-icon.png',
      },
    ],
  }),
  wrapInSuspense: true,
  ssr: false,
  shellComponent: RootDocumentRoute,
  beforeLoad: async ({ abortController }) => {
    const environment = await fetchEnv(abortController);
    const makeRun = runPromiseServer(environment.SERVER_URL);
    const run = makeRun(abortController);
    const user = await getCurrentUser.pipe(Effect.option, Effect.map(Option.flatten), run);
    if (Option.isSome(user)) {
      setLocale(user.value.locale);
    }
    return {
      environment,
      run,
      userOption: user,
      serverUrl: environment.SERVER_URL,
    };
  },
});

function RootDocumentRoute({ children }: { children: React.ReactNode }) {
  const { serverUrl } = Route.useRouteContext();

  return <RootDocument run={runPromiseClient(serverUrl)}>{children}</RootDocument>;
}
