import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { AuthMiddleware } from '~/api/Auth.js';
import { TeamId } from '~/models/Team.js';

export const DashboardWidgetId = Schema.Literals([
  'stats',
  'upcomingEvents',
  'activity',
  'teamManagement',
]);
export type DashboardWidgetId = typeof DashboardWidgetId.Type;

export const DASHBOARD_WIDGET_ORDER = [
  'stats',
  'upcomingEvents',
  'activity',
  'teamManagement',
] as const;

export class DashboardWidget extends Schema.Class<DashboardWidget>('DashboardWidget')({
  id: DashboardWidgetId,
  visible: Schema.Boolean,
  x: Schema.Number,
  y: Schema.Number,
  w: Schema.Number,
  h: Schema.Number,
}) {}

export interface DefaultLayoutEntry {
  id: DashboardWidgetId;
  visible: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

// 12-column grid defaults (rowHeight=80px)
// stats:          h=3 → 240px  (4 stat tiles)
// upcomingEvents: h=6 → 480px  (event list)
// activity:       h=3 → 240px  (3 detail rows)
// teamManagement: h=4 → 320px  (8 nav links)
export const DEFAULT_LAYOUT: ReadonlyArray<DefaultLayoutEntry> = [
  { id: 'stats', visible: true, x: 0, y: 0, w: 12, h: 3 },
  { id: 'upcomingEvents', visible: true, x: 0, y: 3, w: 8, h: 6 },
  { id: 'activity', visible: true, x: 8, y: 3, w: 4, h: 3 },
  { id: 'teamManagement', visible: true, x: 8, y: 6, w: 4, h: 4 },
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
