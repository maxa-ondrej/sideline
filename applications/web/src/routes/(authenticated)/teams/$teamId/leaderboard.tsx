import { Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import { LeaderboardPage } from '~/components/pages/LeaderboardPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/leaderboard')({
  ssr: false,
  component: LeaderboardRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    return ApiClient.pipe(
      Effect.flatMap((api) =>
        Effect.all({
          leaderboard: api.leaderboard.getLeaderboard({
            path: { teamId },
            urlParams: { timeframe: Option.none(), activityTypeId: Option.none() },
          }),
        }),
      ),
      warnAndCatchAll,
      context.run,
    );
  },
});

function LeaderboardRoute() {
  const { user } = Route.useRouteContext();
  const data = Route.useLoaderData();

  return <LeaderboardPage entries={data?.leaderboard.entries ?? []} currentUserId={user.id} />;
}
