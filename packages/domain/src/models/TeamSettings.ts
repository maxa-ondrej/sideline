import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { TeamId } from '~/models/Team.js';

export class TeamSettings extends Model.Class<TeamSettings>('TeamSettings')({
  team_id: TeamId,
  event_horizon_days: Schema.Int,
  min_players_threshold: Schema.Int,
  rsvp_reminder_hours: Schema.Int,
  create_discord_channel_on_group: Schema.Boolean,
  created_at: Model.DateTimeInsertFromDate,
  updated_at: Model.DateTimeUpdateFromDate,
}) {}
