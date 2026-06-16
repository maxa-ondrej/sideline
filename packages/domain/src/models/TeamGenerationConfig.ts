import { Schema } from 'effect';
import { Model } from 'effect/unstable/schema';
import { TeamId } from '~/models/Team.js';

// ---------------------------------------------------------------------------
// Default constants — used as fallback when no row exists for a team
// ---------------------------------------------------------------------------

export const DEFAULT_WEIGHT_ELO = 100;
export const DEFAULT_WEIGHT_SIZE = 50;
export const DEFAULT_WEIGHT_GENDER = 20;
export const DEFAULT_TEAM_COUNT = 2;
export const DEFAULT_MAX_ITERATIONS = 1000;

// ---------------------------------------------------------------------------
// Persisted config model
// ---------------------------------------------------------------------------

export class TeamGenerationConfig extends Model.Class<TeamGenerationConfig>('TeamGenerationConfig')(
  {
    team_id: TeamId,
    weight_elo: Schema.Int,
    weight_size: Schema.Int,
    weight_gender: Schema.Int,
    default_team_count: Schema.Int,
    max_iterations: Schema.Int,
    created_at: Model.DateTimeInsertFromDate,
    updated_at: Model.DateTimeUpdateFromDate,
  },
) {}
