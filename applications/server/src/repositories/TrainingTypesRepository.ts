import { SqlClient, SqlSchema } from '@effect/sql';
import {
  TeamMember as TeamMemberNS,
  Team as TeamNS,
  TrainingType as TrainingTypeNS,
} from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class TrainingTypeWithCount extends Schema.Class<TrainingTypeWithCount>('TrainingTypeWithCount')({
  id: TrainingTypeNS.TrainingTypeId,
  team_id: TeamNS.TeamId,
  name: Schema.String,
  created_at: Schema.DateFromSelf,
  coach_count: Schema.Number,
}) {}

class TrainingTypeRow extends Schema.Class<TrainingTypeRow>('TrainingTypeRow')({
  id: TrainingTypeNS.TrainingTypeId,
  team_id: TeamNS.TeamId,
  name: Schema.String,
}) {}

class CoachRow extends Schema.Class<CoachRow>('TrainingTypeCoachRow')({
  member_id: TeamMemberNS.TeamMemberId,
  name: Schema.NullOr(Schema.String),
  discord_username: Schema.String,
}) {}

class TrainingTypeInsertInput extends Schema.Class<TrainingTypeInsertInput>(
  'TrainingTypeInsertInput',
)({
  team_id: Schema.String,
  name: Schema.String,
}) {}

class TrainingTypeUpdateInput extends Schema.Class<TrainingTypeUpdateInput>(
  'TrainingTypeUpdateInput',
)({
  id: TrainingTypeNS.TrainingTypeId,
  name: Schema.String,
}) {}

class TrainingTypeCoachInput extends Schema.Class<TrainingTypeCoachInput>('TrainingTypeCoachInput')(
  {
    training_type_id: TrainingTypeNS.TrainingTypeId,
    team_member_id: TeamMemberNS.TeamMemberId,
  },
) {}

export class TrainingTypesRepository extends Effect.Service<TrainingTypesRepository>()(
  'api/TrainingTypesRepository',
  {
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('findByTeamId', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.String,
          Result: TrainingTypeWithCount,
          execute: (teamId) => sql`
            SELECT t.id, t.team_id, t.name, t.created_at,
                   (SELECT COUNT(*) FROM training_type_coaches tc WHERE tc.training_type_id = t.id)::int AS coach_count
            FROM training_types t
            WHERE t.team_id = ${teamId}
            ORDER BY t.name ASC
          `,
        }),
      ),
      Effect.let('findById', ({ sql }) =>
        SqlSchema.findOne({
          Request: TrainingTypeNS.TrainingTypeId,
          Result: TrainingTypeRow,
          execute: (id) => sql`SELECT id, team_id, name FROM training_types WHERE id = ${id}`,
        }),
      ),
      Effect.let('insert', ({ sql }) =>
        SqlSchema.single({
          Request: TrainingTypeInsertInput,
          Result: TrainingTypeRow,
          execute: (input) => sql`
            INSERT INTO training_types (team_id, name)
            VALUES (${input.team_id}, ${input.name})
            RETURNING id, team_id, name
          `,
        }),
      ),
      Effect.let('update', ({ sql }) =>
        SqlSchema.single({
          Request: TrainingTypeUpdateInput,
          Result: TrainingTypeRow,
          execute: (input) => sql`
            UPDATE training_types SET name = ${input.name}
            WHERE id = ${input.id}
            RETURNING id, team_id, name
          `,
        }),
      ),
      Effect.let('deleteTrainingType', ({ sql }) =>
        SqlSchema.void({
          Request: TrainingTypeNS.TrainingTypeId,
          execute: (id) => sql`DELETE FROM training_types WHERE id = ${id}`,
        }),
      ),
      Effect.let('findCoaches', ({ sql }) =>
        SqlSchema.findAll({
          Request: TrainingTypeNS.TrainingTypeId,
          Result: CoachRow,
          execute: (trainingTypeId) => sql`
            SELECT tm.id AS member_id, u.name, u.discord_username
            FROM training_type_coaches tc
            JOIN team_members tm ON tm.id = tc.team_member_id
            JOIN users u ON u.id = tm.user_id
            WHERE tc.training_type_id = ${trainingTypeId}
            ORDER BY u.discord_username ASC
          `,
        }),
      ),
      Effect.let('addCoach', ({ sql }) =>
        SqlSchema.void({
          Request: TrainingTypeCoachInput,
          execute: (input) => sql`
            INSERT INTO training_type_coaches (training_type_id, team_member_id)
            VALUES (${input.training_type_id}, ${input.team_member_id})
            ON CONFLICT DO NOTHING
          `,
        }),
      ),
      Effect.let('removeCoach', ({ sql }) =>
        SqlSchema.void({
          Request: TrainingTypeCoachInput,
          execute: (input) => sql`
            DELETE FROM training_type_coaches
            WHERE training_type_id = ${input.training_type_id} AND team_member_id = ${input.team_member_id}
          `,
        }),
      ),
      Effect.let('countCoachesForTrainingType', ({ sql }) =>
        SqlSchema.single({
          Request: TrainingTypeNS.TrainingTypeId,
          Result: Schema.Struct({ count: Schema.Number }),
          execute: (trainingTypeId) =>
            sql`SELECT COUNT(*)::int AS count FROM training_type_coaches WHERE training_type_id = ${trainingTypeId}`,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  findTrainingTypesByTeamId(teamId: TeamNS.TeamId) {
    return this.findByTeamId(teamId);
  }

  findTrainingTypeById(trainingTypeId: TrainingTypeNS.TrainingTypeId) {
    return this.findById(trainingTypeId);
  }

  insertTrainingType(teamId: TeamNS.TeamId, name: string) {
    return this.insert({ team_id: teamId, name });
  }

  updateTrainingType(trainingTypeId: TrainingTypeNS.TrainingTypeId, name: string) {
    return this.update({ id: trainingTypeId, name });
  }

  deleteTrainingTypeById(trainingTypeId: TrainingTypeNS.TrainingTypeId) {
    return this.deleteTrainingType(trainingTypeId);
  }

  findCoachesByTrainingTypeId(trainingTypeId: TrainingTypeNS.TrainingTypeId) {
    return this.findCoaches(trainingTypeId);
  }

  addCoachById(
    trainingTypeId: TrainingTypeNS.TrainingTypeId,
    teamMemberId: TeamMemberNS.TeamMemberId,
  ) {
    return this.addCoach({ training_type_id: trainingTypeId, team_member_id: teamMemberId });
  }

  removeCoachById(
    trainingTypeId: TrainingTypeNS.TrainingTypeId,
    teamMemberId: TeamMemberNS.TeamMemberId,
  ) {
    return this.removeCoach({ training_type_id: trainingTypeId, team_member_id: teamMemberId });
  }

  getCoachCount(trainingTypeId: TrainingTypeNS.TrainingTypeId) {
    return this.countCoachesForTrainingType(trainingTypeId).pipe(Effect.map((r) => r.count));
  }
}
