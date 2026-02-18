import { TanStackDevtools } from '@tanstack/react-devtools';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { Effect } from 'effect';
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools';
import { getCurrentUser } from '../lib/auth';
import { ClientError, runPromise } from '../lib/runtime';
import { getLocale, setLocale } from '../paraglide/runtime.js';
import appCss from '../styles.css?url';

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
  shellComponent: RootDocument,
  beforeLoad: async ({ abortController }) =>
    Effect.Do.pipe(
      Effect.bind('user', () => getCurrentUser),
      Effect.tap(({ user }) => {
        if (user) {
          setLocale(user.locale);
        }
        return Effect.void;
      }),
      Effect.map(({ user }) => ({
        user: user
          ? {
              id: user.id,
              username: user.discordUsername,
              isProfileComplete: user.isProfileComplete,
              locale: user.locale,
            }
          : null,
      })),
      Effect.catchAll(() => new ClientError({ message: 'Error while fetching user!' })),
      runPromise(abortController),
    ),
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const locale = getLocale();

  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
