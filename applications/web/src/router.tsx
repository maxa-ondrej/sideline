import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import type React from 'react';
import * as TanstackQuery from '~/integrations/tanstack-query/root-provider';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  const rqContext = TanstackQuery.getContext();

  const router = createTanStackRouter({
    routeTree,
    context: { ...rqContext },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    Wrap: (props: { children: React.ReactNode }) => {
      return <TanstackQuery.Provider {...rqContext}>{props.children}</TanstackQuery.Provider>;
    },
  });

  return router;
}
