import { HttpApiBuilder } from '@effect/platform';
import { Layer } from 'effect';
import { AgeThresholdApiLive } from '~/api/age-threshold.js';
import { Api } from '~/api/api.js';
import { AuthApiLive } from '~/api/auth.js';
import { GroupApiLive } from '~/api/group.js';
import { InviteApiLive } from '~/api/invite.js';
import { NotificationApiLive } from '~/api/notification.js';
import { RoleApiLive } from '~/api/role.js';
import { RosterApiLive } from '~/api/roster.js';
import { TrainingTypeApiLive } from '~/api/training-type.js';

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(AgeThresholdApiLive),
  Layer.provide(AuthApiLive),
  Layer.provide(GroupApiLive),
  Layer.provide(InviteApiLive),
  Layer.provide(NotificationApiLive),
  Layer.provide(RosterApiLive),
  Layer.provide(RoleApiLive),
  Layer.provide(TrainingTypeApiLive),
);

export { Redirect } from '~/api/redirect.js';
