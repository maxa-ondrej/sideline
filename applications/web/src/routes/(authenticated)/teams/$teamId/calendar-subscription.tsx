import { createFileRoute } from '@tanstack/react-router';
import { Effect } from 'effect';
import { CalendarSubscriptionPage } from '~/components/pages/CalendarSubscriptionPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/calendar-subscription')({
  component: CalendarSubscriptionRoute,
  ssr: false,
  loader: async ({ context }) => {
    return ApiClient.asEffect().pipe(
      Effect.flatMap((api) => api.ical.getICalToken()),
      warnAndCatchAll,
      context.run,
    );
  },
});

function CalendarSubscriptionRoute() {
  const { teamId } = Route.useParams();
  const icalToken = Route.useLoaderData();

  return <CalendarSubscriptionPage teamId={teamId} icalToken={icalToken} />;
}
