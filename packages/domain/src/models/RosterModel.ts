import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { Snowflake } from '~/models/Discord.js';
import { TeamId } from '~/models/Team.js';

export const RosterId = Schema.String.pipe(Schema.brand('RosterId'));
export type RosterId = typeof RosterId.Type;

export class Roster extends Model.Class<Roster>('Roster')({
  id: Model.Generated(RosterId),
  team_id: TeamId,
  name: Schema.String,
  active: Schema.Boolean,
  discord_channel_id: Schema.OptionFromNullOr(Snowflake),
  color: Schema.OptionFromNullOr(Schema.String),
  emoji: Schema.OptionFromNullOr(Schema.String),
  created_at: Model.DateTimeInsertFromDate,
}) {}
