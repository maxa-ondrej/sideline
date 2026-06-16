import { Schema } from 'effect';
import { Model } from 'effect/unstable/schema';
import { EventId } from '~/models/Event.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export const TrainingGameId = Schema.String.pipe(Schema.brand('TrainingGameId'));
export type TrainingGameId = typeof TrainingGameId.Type;

export const TrainingGameOutcome = Schema.Literals(['teamA', 'teamB', 'draw']);
export type TrainingGameOutcome = typeof TrainingGameOutcome.Type;

export class TrainingGame extends Model.Class<TrainingGame>('TrainingGame')({
  id: Model.Generated(TrainingGameId),
  team_id: TeamId,
  event_id: EventId,
  round: Schema.Int,
  outcome: TrainingGameOutcome,
  submitted_by: Schema.OptionFromNullOr(TeamMemberId),
  created_at: Model.DateTimeInsertFromDate,
}) {}
