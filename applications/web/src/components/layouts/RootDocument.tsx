import { TanStackDevtools } from '@tanstack/react-devtools';
import { HeadContent, Scripts } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import type React from 'react';
import { Toaster } from '~/components/ui/sonner';
import TanStackQueryDevtools from '~/integrations/tanstack-query/devtools';
import { type Run, RunProvider } from '~/lib/runtime';
import { getLocale } from '~/paraglide/runtime.js';

interface RootDocumentProps {
  run: Run;
  children: React.ReactNode;
}

export function RootDocument({ run, children }: RootDocumentProps) {
  const locale = getLocale();

  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body>
        <RunProvider value={run}>{children}</RunProvider>
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
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}
