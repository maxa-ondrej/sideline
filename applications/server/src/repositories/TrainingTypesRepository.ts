import { SqlClient, SqlSchema } from '@effect/sql';
import { Discord, GroupModel, Team, TrainingType } from '@sideline/domain';
import { SqlErrors } from '@sideline/effect-lib';
import { Effect, Option, Schema } from 'effect';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

export class TrainingTypeNameAlreadyTakenError extends Schema.TaggedError<TrainingTypeNameAlreadyTakenError>()(
  'TrainingTypeNameAlreadyTakenError',
  {},
) {}

class TrainingTypeWithGroup extends Schema.Class<TrainingTypeWithGroup>('TrainingTypeWithGroup')({
  id: TrainingType.TrainingTypeId,
  team_id: Team.TeamId,
  name: Schema.String,
  owner_group_id: Schema.OptionFromNullOr(GroupModel.GroupId),
  owner_group_name: Schema.OptionFromNullOr(Schema.String),
  member_group_id: Schema.OptionFromNullOr(GroupModel.GroupId),
  member_group_name: Schema.OptionFromNullOr(Schema.String),
  discord_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
  created_at: Schema.DateFromSelf,
}) {}

class TrainingTypeRow extends Schema.Class<TrainingTypeRow>('TrainingTypeRow')({
  id: TrainingType.TrainingTypeId,
  team_id: Team.TeamId,
  name: Schema.String,
  owner_group_id: Schema.OptionFromNullOr(GroupModel.GroupId),
  member_group_id: Schema.OptionFromNullOr(GroupModel.GroupId),
  discord_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class TrainingTypeInsertInput extends Schema.Class<TrainingTypeInsertInput>(
  'TrainingTypeInsertInput',
)({
  team_id: Schema.String,
  name: Schema.String,
  owner_group_id: Schema.OptionFromNullOr(Schema.String),
  member_group_id: Schema.OptionFromNullOr(Schema.String),
  discord_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class TrainingTypeUpdateInput extends Schema.Class<TrainingTypeUpdateInput>(
  'TrainingTypeUpdateInput',
)({
  id: TrainingType.TrainingTypeId,
  name: Schema.String,
  owner_group_id: Schema.OptionFromNullOr(Schema.String),
  member_group_id: Schema.OptionFromNullOr(Schema.String),
  discord_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
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
      SELECT t.id, t.team_id, t.name, t.owner_group_id,
             g.name AS owner_group_name,
             t.member_group_id,
             g2.name AS member_group_name,
             t.discord_channel_id, t.created_at
      FROM training_types t
      LEFT JOIN groups g ON g.id = t.owner_group_id
      LEFT JOIN groups g2 ON g2.id = t.member_group_id
      WHERE t.team_id = ${teamId}
      ORDER BY t.name ASC
    `,
  });

  private findById = SqlSchema.findOne({
    Request: TrainingType.TrainingTypeId,
    Result: TrainingTypeRow,
    execute: (id) =>
      this
        .sql`SELECT id, team_id, name, owner_group_id, member_group_id, discord_channel_id FROM training_types WHERE id = ${id}`,
  });

  private findByIdWithGroup = SqlSchema.findOne({
    Request: TrainingType.TrainingTypeId,
    Result: TrainingTypeWithGroup,
    execute: (id) => this.sql`
      SELECT t.id, t.team_id, t.name, t.owner_group_id,
             g.name AS owner_group_name,
             t.member_group_id,
             g2.name AS member_group_name,
             t.discord_channel_id, t.created_at
      FROM training_types t
      LEFT JOIN groups g ON g.id = t.owner_group_id
      LEFT JOIN groups g2 ON g2.id = t.member_group_id
      WHERE t.id = ${id}
    `,
  });

  private insertOne = SqlSchema.single({
    Request: TrainingTypeInsertInput,
    Result: TrainingTypeRow,
    execute: (input) => this.sql`
      INSERT INTO training_types (team_id, name, owner_group_id, member_group_id, discord_channel_id)
      VALUES (${input.team_id}, ${input.name}, ${input.owner_group_id}, ${input.member_group_id}, ${input.discord_channel_id})
      RETURNING id, team_id, name, owner_group_id, member_group_id, discord_channel_id
    `,
  });

  private updateOne = SqlSchema.single({
    Request: TrainingTypeUpdateInput,
    Result: TrainingTypeRow,
    execute: (input) => this.sql`
      UPDATE training_types SET name = ${input.name},
        owner_group_id = ${input.owner_group_id},
        member_group_id = ${input.member_group_id},
        discord_channel_id = ${input.discord_channel_id}
      WHERE id = ${input.id}
      RETURNING id, team_id, name, owner_group_id, member_group_id, discord_channel_id
    `,
  });

  private deleteOne = SqlSchema.void({
    Request: TrainingType.TrainingTypeId,
    execute: (id) => this.sql`DELETE FROM training_types WHERE id = ${id}`,
  });

  findTrainingTypesByTeamId = (teamId: Team.TeamId) =>
    this.findByTeamId(teamId).pipe(catchSqlErrors);

  findTrainingTypeById = (trainingTypeId: TrainingType.TrainingTypeId) =>
    this.findById(trainingTypeId).pipe(catchSqlErrors);

  findTrainingTypeByIdWithGroup = (trainingTypeId: TrainingType.TrainingTypeId) =>
    this.findByIdWithGroup(trainingTypeId).pipe(catchSqlErrors);

  insertTrainingType = (
    teamId: Team.TeamId,
    name: string,
    ownerGroupId: Option.Option<string>,
    memberGroupId: Option.Option<string> = Option.none(),
    discordChannelId: Option.Option<Discord.Snowflake> = Option.none(),
  ) =>
    this.insertOne({
      team_id: teamId,
      name,
      owner_group_id: ownerGroupId,
      member_group_id: memberGroupId,
      discord_channel_id: discordChannelId,
    }).pipe(
      SqlErrors.catchUniqueViolation(() => new TrainingTypeNameAlreadyTakenError()),
      catchSqlErrors,
    );

  updateTrainingType = (
    trainingTypeId: TrainingType.TrainingTypeId,
    name: string,
    ownerGroupId: Option.Option<string> = Option.none(),
    memberGroupId: Option.Option<string> = Option.none(),
    discordChannelId: Option.Option<Discord.Snowflake> = Option.none(),
  ) =>
    this.updateOne({
      id: trainingTypeId,
      name,
      owner_group_id: ownerGroupId,
      member_group_id: memberGroupId,
      discord_channel_id: discordChannelId,
    }).pipe(
      SqlErrors.catchUniqueViolation(() => new TrainingTypeNameAlreadyTakenError()),
      catchSqlErrors,
    );

  deleteTrainingTypeById = (trainingTypeId: TrainingType.TrainingTypeId) =>
    this.deleteOne(trainingTypeId).pipe(catchSqlErrors);
}
