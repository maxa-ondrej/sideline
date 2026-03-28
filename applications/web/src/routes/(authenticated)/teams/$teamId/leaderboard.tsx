import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/leaderboard')({
  ssr: false,
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/teams/$teamId/makanicko', params: { teamId: params.teamId } });
  },
});
