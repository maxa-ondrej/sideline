import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { AuthMiddleware } from '~/api/Auth.js';
import { TeamId } from '~/models/Team.js';

export const DashboardWidgetId = Schema.Literals([
  'awaitingRsvp',
  'outstandingPayments',
  'stats',
  'upcomingEvents',
  'activity',
  'teamManagement',
]);
export type DashboardWidgetId = typeof DashboardWidgetId.Type;

export const DASHBOARD_WIDGET_ORDER = [
  'awaitingRsvp',
  'outstandingPayments',
  'stats',
  'upcomingEvents',
  'activity',
  'teamManagement',
] as const;

export class DashboardWidget extends Schema.Class<DashboardWidget>('DashboardWidget')({
  id: DashboardWidgetId,
  visible: Schema.Boolean,
  height: Schema.Number,
  colSpan: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 3 }))),
  x: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  y: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
}) {}

export interface DefaultLayoutEntry {
  id: DashboardWidgetId;
  visible: boolean;
  height: number;
  colSpan: number;
  x: number;
  y: number;
}

// Sensible pixel-height defaults for the vertical-stack layout.
// awaitingRsvp:        x=0,  y=0,  colSpan=3, height=80   — full width (3 cols), banner-style
// outstandingPayments: x=0,  y=8,  colSpan=3, height=80   — full width, slim, below RSVP
// stats:               x=0,  y=16, colSpan=3, height=140  — full width (3 cols)
// upcomingEvents:      x=0,  y=30, colSpan=2, height=280  — 2 cols
// activity:            x=8,  y=30, colSpan=1, height=200  — 1 col
// teamManagement:      x=8,  y=50, colSpan=1, height=260  — 1 col
// (12-column grid, rowHeight=10)
export const DEFAULT_LAYOUT: ReadonlyArray<DefaultLayoutEntry> = [
  { id: 'awaitingRsvp', visible: true, height: 80, colSpan: 3, x: 0, y: 0 },
  { id: 'outstandingPayments', visible: true, height: 80, colSpan: 3, x: 0, y: 8 },
  { id: 'stats', visible: true, height: 140, colSpan: 3, x: 0, y: 16 },
  { id: 'upcomingEvents', visible: true, height: 280, colSpan: 2, x: 0, y: 30 },
  { id: 'activity', visible: true, height: 200, colSpan: 1, x: 8, y: 30 },
  { id: 'teamManagement', visible: true, height: 260, colSpan: 1, x: 8, y: 50 },
] as const;

export class DashboardLayout extends Schema.Class<DashboardLayout>('DashboardLayout')({
  widgets: Schema.Array(DashboardWidget),
}) {}

export const UpdateDashboardLayoutPayload = Schema.Struct({
  widgets: Schema.Array(DashboardWidget),
});
export type UpdateDashboardLayoutPayload = Schema.Schema.Type<typeof UpdateDashboardLayoutPayload>;

export class Forbidden extends Schema.TaggedErrorClass<Forbidden>()(
  'DashboardLayoutForbidden',
  {},
) {}

export class DashboardLayoutApiGroup extends HttpApiGroup.make('dashboardLayout')
  .add(
    HttpApiEndpoint.get('getDashboardLayout', '/teams/:teamId/dashboard-layout', {
      success: DashboardLayout,
      error: Forbidden.pipe(HttpApiSchema.status(403)),
      params: { teamId: TeamId },
    }).middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.put('updateDashboardLayout', '/teams/:teamId/dashboard-layout', {
      success: DashboardLayout,
      error: Forbidden.pipe(HttpApiSchema.status(403)),
      payload: UpdateDashboardLayoutPayload,
      params: { teamId: TeamId },
    }).middleware(AuthMiddleware),
  ) {}
