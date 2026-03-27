import { ActivityType, Leaderboard, Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import { LeaderboardPage } from '~/components/pages/LeaderboardPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

interface LeaderboardSearch {
  timeframe?: 'all' | 'week';
  activityTypeId?: string;
}

export const Route = createFileRoute('/(authenticated)/teams/$teamId/leaderboard')({
  ssr: false,
  component: LeaderboardRoute,
  validateSearch: (search: Record<string, unknown>): LeaderboardSearch => {
    const rawTimeframe = search.timeframe;
    const timeframe = rawTimeframe === 'all' || rawTimeframe === 'week' ? rawTimeframe : undefined;
    const rawActivityTypeId = search.activityTypeId;
    const activityTypeId = typeof rawActivityTypeId === 'string' ? rawActivityTypeId : undefined;
    return { timeframe, activityTypeId };
  },
  loader: async ({ params, context, location }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    const search = location.search as LeaderboardSearch;
    const timeframe = search.timeframe ?? 'all';
    const activityTypeId =
      search.activityTypeId !== undefined
        ? Option.some(Schema.decodeSync(ActivityType.ActivityTypeId)(search.activityTypeId))
        : Option.none();

    return ApiClient.pipe(
      Effect.flatMap((api) =>
        Effect.all({
          leaderboard: api.leaderboard.getLeaderboard({
            path: { teamId },
            urlParams: {
              timeframe: Option.some(
                Schema.decodeSync(Leaderboard.LeaderboardTimeframe)(timeframe),
              ),
              activityTypeId,
            },
          }),
          activityTypes: api.activityLog.listActivityTypes({ path: { teamId } }),
        }),
      ),
      warnAndCatchAll,
      context.run,
    );
  },
});

function LeaderboardRoute() {
  const { user } = Route.useRouteContext();
  const { teamId } = Route.useParams();
  const search = Route.useSearch();
  const data = Route.useLoaderData();

  const timeframe = search.timeframe ?? 'all';

  return (
    <LeaderboardPage
      entries={data?.leaderboard.entries ?? []}
      currentUserId={user.id}
      activityTypes={data?.activityTypes.activityTypes ?? []}
      teamId={teamId}
      timeframe={timeframe}
      activityTypeId={search.activityTypeId}
    />
  );
}
