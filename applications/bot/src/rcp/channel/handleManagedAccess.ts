import type { ChannelRpcEvents } from '@sideline/domain';
import { Effect } from 'effect';
import {
  removeChannelAccessOverwrite,
  setChannelAccessOverwrite,
} from '~/rest/channels/setChannelAccessOverwrite.js';

export const handleManagedAccessGranted = (
  event: ChannelRpcEvents.ManagedChannelAccessGrantedEvent,
) =>
  Effect.Do.pipe(
    Effect.tap(() =>
      setChannelAccessOverwrite(
        event.discord_channel_id,
        event.discord_role_id,
        event.access_level,
      ),
    ),
    Effect.tap(() =>
      Effect.logInfo(
        `Granted ${event.access_level} access to role ${event.discord_role_id} on channel ${event.discord_channel_id}`,
      ),
    ),
    Effect.asVoid,
  );

export const handleManagedAccessRevoked = (
  event: ChannelRpcEvents.ManagedChannelAccessRevokedEvent,
) =>
  Effect.Do.pipe(
    Effect.tap(() => removeChannelAccessOverwrite(event.discord_channel_id, event.discord_role_id)),
    Effect.tap(() =>
      Effect.logInfo(
        `Revoked access for role ${event.discord_role_id} on channel ${event.discord_channel_id}`,
      ),
    ),
    Effect.asVoid,
  );
