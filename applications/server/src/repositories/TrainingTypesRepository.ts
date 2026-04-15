import { Discord, GroupModel, Team, TrainingType } from '@sideline/domain';
import { SqlErrors } from '@sideline/effect-lib';
import { Effect, Layer, Option, Schema, ServiceMap } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

export class TrainingTypeNameAlreadyTakenError extends Schema.TaggedErrorClass<TrainingTypeNameAlreadyTakenError>()(
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
  created_at: Schema.Date,
}) {}

class TrainingTypeRow extends Schema.Class<TrainingTypeRow>('TrainingTypeRow')({
  id: TrainingType.TrainingTypeId,
  team_id: Team.TeamId,
  name: Schema.String,
  owner_group_id: Schema.OptionFromNullOr(GroupModel.GroupId),
  member_group_id: Schema.OptionFromNullOr(GroupModel.GroupId),
  discord_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

const TrainingTypeInsertInput = Schema.Struct({
  team_id: Schema.String,
  name: Schema.String,
  owner_group_id: Schema.OptionFromNullOr(Schema.String),
  member_group_id: Schema.OptionFromNullOr(Schema.String),
  discord_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
});

const TrainingTypeUpdateInput = Schema.Struct({
  id: TrainingType.TrainingTypeId,
  name: Schema.String,
  owner_group_id: Schema.OptionFromNullOr(Schema.String),
  member_group_id: Schema.OptionFromNullOr(Schema.String),
  discord_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
});

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const findByTeamId = SqlSchema.findAll({
    Request: Schema.String,
    Result: TrainingTypeWithGroup,
    execute: (teamId) => sql`
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

  const findById = SqlSchema.findOneOption({
    Request: TrainingType.TrainingTypeId,
    Result: TrainingTypeRow,
    execute: (id) =>
      sql`SELECT id, team_id, name, owner_group_id, member_group_id, discord_channel_id FROM training_types WHERE id = ${id}`,
  });

  const findByIdWithGroup = SqlSchema.findOneOption({
    Request: TrainingType.TrainingTypeId,
    Result: TrainingTypeWithGroup,
    execute: (id) => sql`
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

  const insertOne = SqlSchema.findOne({
    Request: TrainingTypeInsertInput,
    Result: TrainingTypeRow,
    execute: (input) => sql`
      INSERT INTO training_types (team_id, name, owner_group_id, member_group_id, discord_channel_id)
      VALUES (${input.team_id}, ${input.name}, ${input.owner_group_id}, ${input.member_group_id}, ${input.discord_channel_id})
      RETURNING id, team_id, name, owner_group_id, member_group_id, discord_channel_id
    `,
  });

  const updateOne = SqlSchema.findOne({
    Request: TrainingTypeUpdateInput,
    Result: TrainingTypeRow,
    execute: (input) => sql`
      UPDATE training_types SET name = ${input.name},
        owner_group_id = ${input.owner_group_id},
        member_group_id = ${input.member_group_id},
        discord_channel_id = ${input.discord_channel_id}
      WHERE id = ${input.id}
      RETURNING id, team_id, name, owner_group_id, member_group_id, discord_channel_id
    `,
  });

  const deleteOne = SqlSchema.void({
    Request: TrainingType.TrainingTypeId,
    execute: (id) => sql`DELETE FROM training_types WHERE id = ${id}`,
  });

  const findTrainingTypesByTeamId = (teamId: Team.TeamId) =>
    findByTeamId(teamId).pipe(catchSqlErrors);

  const findTrainingTypeById = (trainingTypeId: TrainingType.TrainingTypeId) =>
    findById(trainingTypeId).pipe(catchSqlErrors);

  const findTrainingTypeByIdWithGroup = (trainingTypeId: TrainingType.TrainingTypeId) =>
    findByIdWithGroup(trainingTypeId).pipe(catchSqlErrors);

  const insertTrainingType = (
    teamId: Team.TeamId,
    name: string,
    ownerGroupId: Option.Option<string>,
    memberGroupId: Option.Option<string> = Option.none(),
    discordChannelId: Option.Option<Discord.Snowflake> = Option.none(),
  ) =>
    insertOne({
      team_id: teamId,
      name,
      owner_group_id: ownerGroupId,
      member_group_id: memberGroupId,
      discord_channel_id: discordChannelId,
    }).pipe(
      SqlErrors.catchUniqueViolation(() => new TrainingTypeNameAlreadyTakenError()),
      catchSqlErrors,
    );

  const updateTrainingType = (
    trainingTypeId: TrainingType.TrainingTypeId,
    name: string,
    ownerGroupId: Option.Option<string> = Option.none(),
    memberGroupId: Option.Option<string> = Option.none(),
    discordChannelId: Option.Option<Discord.Snowflake> = Option.none(),
  ) =>
    updateOne({
      id: trainingTypeId,
      name,
      owner_group_id: ownerGroupId,
      member_group_id: memberGroupId,
      discord_channel_id: discordChannelId,
    }).pipe(
      SqlErrors.catchUniqueViolation(() => new TrainingTypeNameAlreadyTakenError()),
      catchSqlErrors,
    );

  const deleteTrainingTypeById = (trainingTypeId: TrainingType.TrainingTypeId) =>
    deleteOne(trainingTypeId).pipe(catchSqlErrors);

  return {
    findTrainingTypesByTeamId,
    findTrainingTypeById,
    findTrainingTypeByIdWithGroup,
    insertTrainingType,
    updateTrainingType,
    deleteTrainingTypeById,
  };
});

export class TrainingTypesRepository extends ServiceMap.Service<
  TrainingTypesRepository,
  Effect.Success<typeof make>
>()('api/TrainingTypesRepository') {
  static readonly Default = Layer.effect(TrainingTypesRepository, make);
}
