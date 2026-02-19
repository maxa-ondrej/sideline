import { TanStackDevtools } from '@tanstack/react-devtools';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { Effect, Option } from 'effect';
import { fetchEnv } from '../env.js';
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools';
import { getCurrentUser } from '../lib/auth';
import { ClientError, RunProvider, runPromise } from '../lib/runtime';
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
  beforeLoad: async ({ abortController }) => {
    const environment = await fetchEnv(abortController);
    const makeRun = runPromise(environment.SERVER_URL);
    const run = makeRun(abortController);
    const user = await getCurrentUser.pipe(
      Effect.catchAll(() => new ClientError({ message: 'Error while fetching user!' })),
      run,
    );
    if (Option.isSome(user)) {
      setLocale(user.value.locale);
    }
    return {
      environment,
      makeRun,
      run,
      user,
    };
  },
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const { makeRun } = Route.useRouteContext();
  const locale = getLocale();

  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body>
        <RunProvider value={makeRun}>{children}</RunProvider>
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
