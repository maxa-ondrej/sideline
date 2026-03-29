import { SqlClient, SqlSchema } from '@effect/sql';
import { GroupModel, Role, Team, TeamMember } from '@sideline/domain';
import { LogicError, SqlErrors } from '@sideline/effect-lib';
import { Effect, type Option, Schema } from 'effect';

export class GroupNameAlreadyTakenError extends Schema.TaggedError<GroupNameAlreadyTakenError>()(
  'GroupNameAlreadyTakenError',
  {},
) {}

class GroupWithCount extends Schema.Class<GroupWithCount>('GroupWithCount')({
  id: GroupModel.GroupId,
  team_id: Team.TeamId,
  parent_id: Schema.OptionFromNullOr(GroupModel.GroupId),
  name: Schema.String,
  emoji: Schema.OptionFromNullOr(Schema.String),
  created_at: Schema.DateFromSelf,
  member_count: Schema.Number,
}) {}

class GroupRow extends Schema.Class<GroupRow>('GroupRow')({
  id: GroupModel.GroupId,
  team_id: Team.TeamId,
  parent_id: Schema.OptionFromNullOr(GroupModel.GroupId),
  name: Schema.String,
  emoji: Schema.OptionFromNullOr(Schema.String),
}) {}

class GroupMemberRow extends Schema.Class<GroupMemberRow>('GroupMemberRow')({
  member_id: TeamMember.TeamMemberId,
  name: Schema.OptionFromNullOr(Schema.String),
  username: Schema.String,
}) {}

class GroupRoleRow extends Schema.Class<GroupRoleRow>('GroupRoleRow')({
  role_id: Role.RoleId,
  role_name: Schema.String,
}) {}

class GroupInsertInput extends Schema.Class<GroupInsertInput>('GroupInsertInput')({
  team_id: Schema.String,
  parent_id: Schema.OptionFromNullOr(Schema.String),
  name: Schema.String,
  emoji: Schema.OptionFromNullOr(Schema.String),
}) {}

class GroupUpdateInput extends Schema.Class<GroupUpdateInput>('GroupUpdateInput')({
  id: GroupModel.GroupId,
  name: Schema.String,
  emoji: Schema.OptionFromNullOr(Schema.String),
}) {}

class GroupMemberInput extends Schema.Class<GroupMemberInput>('GroupMemberInput')({
  group_id: GroupModel.GroupId,
  team_member_id: TeamMember.TeamMemberId,
}) {}

class MoveGroupInput extends Schema.Class<MoveGroupInput>('MoveGroupInput')({
  id: GroupModel.GroupId,
  parent_id: Schema.OptionFromNullOr(GroupModel.GroupId),
}) {}

class AncestorRow extends Schema.Class<AncestorRow>('AncestorRow')({
  id: GroupModel.GroupId,
}) {}

class DescendantMemberRow extends Schema.Class<DescendantMemberRow>('DescendantMemberRow')({
  team_member_id: TeamMember.TeamMemberId,
}) {}

export class GroupsRepository extends Effect.Service<GroupsRepository>()('api/GroupsRepository', {
  effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
}) {
  private findByTeamId = SqlSchema.findAll({
    Request: Schema.String,
    Result: GroupWithCount,
    execute: (teamId) => this.sql`
            SELECT g.id, g.team_id, g.parent_id, g.name, g.emoji, g.created_at,
                   (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id)::int AS member_count
            FROM groups g
            WHERE g.team_id = ${teamId} AND g.is_archived = false
            ORDER BY g.name ASC
          `,
  });

  private findById = SqlSchema.findOne({
    Request: GroupModel.GroupId,
    Result: GroupRow,
    execute: (id) =>
      this
        .sql`SELECT id, team_id, parent_id, name, emoji FROM groups WHERE id = ${id} AND is_archived = false`,
  });

  private insert = SqlSchema.single({
    Request: GroupInsertInput,
    Result: GroupRow,
    execute: (input) => this.sql`
            INSERT INTO groups (team_id, parent_id, name, emoji)
            VALUES (${input.team_id}, ${input.parent_id}, ${input.name}, ${input.emoji})
            RETURNING id, team_id, parent_id, name, emoji
          `,
  });

  private update = SqlSchema.single({
    Request: GroupUpdateInput,
    Result: GroupRow,
    execute: (input) => this.sql`
            UPDATE groups SET name = ${input.name}, emoji = ${input.emoji}
            WHERE id = ${input.id}
            RETURNING id, team_id, parent_id, name, emoji
          `,
  });

  private archiveGroup = SqlSchema.void({
    Request: GroupModel.GroupId,
    execute: (id) => this.sql`UPDATE groups SET is_archived = true WHERE id = ${id}`,
  });

  private moveGroupParent = SqlSchema.single({
    Request: MoveGroupInput,
    Result: GroupRow,
    execute: (input) => this.sql`
            UPDATE groups SET parent_id = ${input.parent_id}
            WHERE id = ${input.id}
            RETURNING id, team_id, parent_id, name, emoji
          `,
  });

  private findMembers = SqlSchema.findAll({
    Request: GroupModel.GroupId,
    Result: GroupMemberRow,
    execute: (groupId) => this.sql`
            SELECT tm.id AS member_id, u.name, u.username
            FROM group_members gm
            JOIN team_members tm ON tm.id = gm.team_member_id
            JOIN users u ON u.id = tm.user_id
            WHERE gm.group_id = ${groupId}
            ORDER BY u.username ASC
          `,
  });

  private addMember = SqlSchema.void({
    Request: GroupMemberInput,
    execute: (input) => this.sql`
            INSERT INTO group_members (group_id, team_member_id)
            VALUES (${input.group_id}, ${input.team_member_id})
            ON CONFLICT DO NOTHING
          `,
  });

  private removeMember = SqlSchema.void({
    Request: GroupMemberInput,
    execute: (input) => this.sql`
            DELETE FROM group_members
            WHERE group_id = ${input.group_id} AND team_member_id = ${input.team_member_id}
          `,
  });

  private findRolesForGroup = SqlSchema.findAll({
    Request: GroupModel.GroupId,
    Result: GroupRoleRow,
    execute: (groupId) => this.sql`
            SELECT r.id AS role_id, r.name AS role_name
            FROM role_groups rg
            JOIN roles r ON r.id = rg.role_id
            WHERE rg.group_id = ${groupId}
            ORDER BY r.name ASC
          `,
  });

  private countMembersForGroup = SqlSchema.single({
    Request: GroupModel.GroupId,
    Result: Schema.Struct({ count: Schema.Number }),
    execute: (groupId) =>
      this.sql`SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = ${groupId}`,
  });

  private findChildren = SqlSchema.findAll({
    Request: GroupModel.GroupId,
    Result: GroupRow,
    execute: (groupId) =>
      this
        .sql`SELECT id, team_id, parent_id, name, emoji FROM groups WHERE parent_id = ${groupId} AND is_archived = false`,
  });

  private findAncestors = SqlSchema.findAll({
    Request: GroupModel.GroupId,
    Result: AncestorRow,
    execute: (groupId) => this.sql`
            WITH RECURSIVE ancestors AS (
              SELECT parent_id AS id FROM groups WHERE id = ${groupId} AND parent_id IS NOT NULL
              UNION ALL
              SELECT g.parent_id FROM groups g JOIN ancestors a ON g.id = a.id WHERE g.parent_id IS NOT NULL
            )
            SELECT id FROM ancestors
          `,
  });

  private findDescendantMembers = SqlSchema.findAll({
    Request: GroupModel.GroupId,
    Result: DescendantMemberRow,
    execute: (groupId) => this.sql`
            WITH RECURSIVE descendants AS (
              SELECT ${groupId}::uuid AS id
              UNION ALL
              SELECT g.id FROM groups g JOIN descendants d ON g.parent_id = d.id
            )
            SELECT DISTINCT gm.team_member_id
            FROM descendants d
            JOIN group_members gm ON gm.group_id = d.id
          `,
  });

  findGroupsByTeamId = (teamId: Team.TeamId) =>
    this.findByTeamId(teamId).pipe(Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom));

  findGroupById = (groupId: GroupModel.GroupId) =>
    this.findById(groupId).pipe(Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom));

  insertGroup = (
    teamId: Team.TeamId,
    name: string,
    parentId: Option.Option<string>,
    emoji: Option.Option<string>,
  ) =>
    this.insert({ team_id: teamId, parent_id: parentId, name, emoji }).pipe(
      SqlErrors.catchUniqueViolation(() => new GroupNameAlreadyTakenError()),
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  updateGroupById = (groupId: GroupModel.GroupId, name: string, emoji: Option.Option<string>) =>
    this.update({ id: groupId, name, emoji }).pipe(
      SqlErrors.catchUniqueViolation(() => new GroupNameAlreadyTakenError()),
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  archiveGroupById = (groupId: GroupModel.GroupId) =>
    this.archiveGroup(groupId).pipe(Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom));

  moveGroup = (groupId: GroupModel.GroupId, parentId: Option.Option<GroupModel.GroupId>) =>
    this.moveGroupParent({ id: groupId, parent_id: parentId }).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  findMembersByGroupId = (groupId: GroupModel.GroupId) =>
    this.findMembers(groupId).pipe(Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom));

  addMemberById = (groupId: GroupModel.GroupId, teamMemberId: TeamMember.TeamMemberId) =>
    this.addMember({ group_id: groupId, team_member_id: teamMemberId }).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  removeMemberById = (groupId: GroupModel.GroupId, teamMemberId: TeamMember.TeamMemberId) =>
    this.removeMember({ group_id: groupId, team_member_id: teamMemberId }).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  getRolesForGroup = (groupId: GroupModel.GroupId) =>
    this.findRolesForGroup(groupId).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  getMemberCount = (groupId: GroupModel.GroupId) =>
    this.countMembersForGroup(groupId).pipe(
      Effect.map((r) => r.count),
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  getChildren = (groupId: GroupModel.GroupId) =>
    this.findChildren(groupId).pipe(Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom));

  getAncestorIds = (groupId: GroupModel.GroupId) =>
    this.findAncestors(groupId).pipe(
      Effect.map((rows) => rows.map((r) => r.id)),
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  getDescendantMemberIds = (groupId: GroupModel.GroupId) =>
    this.findDescendantMembers(groupId).pipe(
      Effect.map((rows) => rows.map((r) => r.team_member_id)),
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );
}
