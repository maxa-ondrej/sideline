import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Effect } from 'effect';
import { warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)')({
  component: Outlet,
  beforeLoad: ({ context }) =>
    Effect.Do.pipe(
      Effect.bind('user', () => context.userOption),
      warnAndCatchAll,
      context.run,
    ),
});
