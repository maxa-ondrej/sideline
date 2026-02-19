import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Effect } from 'effect';
import { NotFound } from '../../lib/runtime';

export const Route = createFileRoute('/(authenticated)')({
  component: Outlet,
  beforeLoad: ({ context }) =>
    Effect.Do.pipe(
      Effect.bind('user', () => context.user),
      Effect.catchAll(NotFound.make),
      context.run,
    ),
});
