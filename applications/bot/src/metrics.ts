import { Metric } from 'effect';

/** Total Discord gateway events processed, tagged with { event_type } */
export const discordEventsTotal = Metric.counter('discord_events_total', {
  description: 'Total Discord gateway events processed',
  incremental: true,
});

/** Total sync events processed successfully, tagged with { sync_type, action } */
export const syncEventsProcessedTotal = Metric.counter('sync_events_processed_total', {
  description: 'Total sync events processed successfully',
  incremental: true,
});

/** Total sync events that failed processing, tagged with { sync_type } */
export const syncEventsFailedTotal = Metric.counter('sync_events_failed_total', {
  description: 'Total sync events that failed processing',
  incremental: true,
});

/** Total Discord interactions handled, tagged with { interaction_type } */
export const discordInteractionsTotal = Metric.counter('discord_interactions_total', {
  description: 'Total Discord interactions handled',
  incremental: true,
});
