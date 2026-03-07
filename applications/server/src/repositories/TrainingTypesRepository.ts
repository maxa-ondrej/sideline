import { SqlClient, SqlSchema } from '@effect/sql';
import { GroupModel, Team, TrainingType } from '@sideline/domain';
import { Effect, Schema } from 'effect';

class TrainingTypeWithGroup extends Schema.Class<TrainingTypeWithGroup>('TrainingTypeWithGroup')({
  id: TrainingType.TrainingTypeId,
  team_id: Team.TeamId,
  name: Schema.String,
  group_id: Schema.NullOr(GroupModel.GroupId),
  group_name: Schema.NullOr(Schema.String),
  discord_channel_id: Schema.NullOr(Schema.String),
  created_at: Schema.DateFromSelf,
}) {}

class TrainingTypeRow extends Schema.Class<TrainingTypeRow>('TrainingTypeRow')({
  id: TrainingType.TrainingTypeId,
  team_id: Team.TeamId,
  name: Schema.String,
  group_id: Schema.NullOr(GroupModel.GroupId),
  discord_channel_id: Schema.NullOr(Schema.String),
}) {}

class TrainingTypeInsertInput extends Schema.Class<TrainingTypeInsertInput>(
  'TrainingTypeInsertInput',
)({
  team_id: Schema.String,
  name: Schema.String,
  group_id: Schema.NullOr(Schema.String),
  discord_channel_id: Schema.NullOr(Schema.String),
}) {}

class TrainingTypeUpdateInput extends Schema.Class<TrainingTypeUpdateInput>(
  'TrainingTypeUpdateInput',
)({
  id: TrainingType.TrainingTypeId,
  name: Schema.String,
  discord_channel_id: Schema.NullOr(Schema.String),
}) {}

export class TrainingTypesRepository extends Effect.Service<TrainingTypesRepository>()(
  'api/TrainingTypesRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private findByTeamId = SqlSchema.findAll({
    Request: Schema.String,
    Result: TrainingTypeWithGroup,
    execute: (teamId) => this.sql`
      SELECT t.id, t.team_id, t.name, t.group_id, g.name AS group_name, t.discord_channel_id, t.created_at
      FROM training_types t
      LEFT JOIN groups g ON g.id = t.group_id
      WHERE t.team_id = ${teamId}
      ORDER BY t.name ASC
    `,
  });

  private findById = SqlSchema.findOne({
    Request: TrainingType.TrainingTypeId,
    Result: TrainingTypeRow,
    execute: (id) =>
      this
        .sql`SELECT id, team_id, name, group_id, discord_channel_id FROM training_types WHERE id = ${id}`,
  });

  private findByIdWithGroup = SqlSchema.findOne({
    Request: TrainingType.TrainingTypeId,
    Result: TrainingTypeWithGroup,
    execute: (id) => this.sql`
      SELECT t.id, t.team_id, t.name, t.group_id, g.name AS group_name, t.discord_channel_id, t.created_at
      FROM training_types t
      LEFT JOIN groups g ON g.id = t.group_id
      WHERE t.id = ${id}
    `,
  });

  private insertOne = SqlSchema.single({
    Request: TrainingTypeInsertInput,
    Result: TrainingTypeRow,
    execute: (input) => this.sql`
      INSERT INTO training_types (team_id, name, group_id, discord_channel_id)
      VALUES (${input.team_id}, ${input.name}, ${input.group_id}, ${input.discord_channel_id})
      RETURNING id, team_id, name, group_id, discord_channel_id
    `,
  });

  private updateOne = SqlSchema.single({
    Request: TrainingTypeUpdateInput,
    Result: TrainingTypeRow,
    execute: (input) => this.sql`
      UPDATE training_types SET name = ${input.name}, discord_channel_id = ${input.discord_channel_id}
      WHERE id = ${input.id}
      RETURNING id, team_id, name, group_id, discord_channel_id
    `,
  });

  private deleteOne = SqlSchema.void({
    Request: TrainingType.TrainingTypeId,
    execute: (id) => this.sql`DELETE FROM training_types WHERE id = ${id}`,
  });

  findTrainingTypesByTeamId = (teamId: Team.TeamId) => {
    return this.findByTeamId(teamId).pipe(Effect.orDie);
  };

  findTrainingTypeById = (trainingTypeId: TrainingType.TrainingTypeId) => {
    return this.findById(trainingTypeId).pipe(Effect.orDie);
  };

  findTrainingTypeByIdWithGroup = (trainingTypeId: TrainingType.TrainingTypeId) => {
    return this.findByIdWithGroup(trainingTypeId).pipe(Effect.orDie);
  };

  insertTrainingType = (
    teamId: Team.TeamId,
    name: string,
    groupId: string | null,
    discordChannelId?: string | null,
  ) => {
    return this.insertOne({
      team_id: teamId,
      name,
      group_id: groupId,
      discord_channel_id: discordChannelId ?? null,
    }).pipe(Effect.orDie);
  };

  updateTrainingType = (
    trainingTypeId: TrainingType.TrainingTypeId,
    name: string,
    discordChannelId?: string | null,
  ) => {
    return this.updateOne({
      id: trainingTypeId,
      name,
      discord_channel_id: discordChannelId ?? null,
    }).pipe(Effect.orDie);
  };

  deleteTrainingTypeById = (trainingTypeId: TrainingType.TrainingTypeId) => {
    return this.deleteOne(trainingTypeId).pipe(Effect.orDie);
  };
}
