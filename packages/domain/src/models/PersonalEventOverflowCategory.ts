import { Schema } from 'effect';
import { Model } from 'effect/unstable/schema';
import { Snowflake } from '~/models/Discord.js';
import { TeamId } from '~/models/Team.js';

export const PersonalEventOverflowCategoryId = Schema.String.pipe(
  Schema.brand('PersonalEventOverflowCategoryId'),
);
export type PersonalEventOverflowCategoryId = typeof PersonalEventOverflowCategoryId.Type;

export class PersonalEventOverflowCategory extends Model.Class<PersonalEventOverflowCategory>(
  'PersonalEventOverflowCategory',
)({
  id: Model.Generated(PersonalEventOverflowCategoryId),
  team_id: TeamId,
  discord_category_id: Snowflake,
  sequence: Schema.Int,
  created_at: Model.DateTimeInsertFromDate,
}) {}
