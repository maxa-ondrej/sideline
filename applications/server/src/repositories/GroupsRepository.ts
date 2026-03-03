import { SqlClient, SqlSchema } from '@effect/sql';
import { GroupModel, Role, Team, TeamMember } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class GroupWithCount extends Schema.Class<GroupWithCount>('GroupWithCount')({
  id: GroupModel.GroupId,
  team_id: Team.TeamId,
  parent_id: Schema.NullOr(GroupModel.GroupId),
  name: Schema.String,
  emoji: Schema.NullOr(Schema.String),
  created_at: Schema.DateFromSelf,
  member_count: Schema.Number,
}) {}

class GroupRow extends Schema.Class<GroupRow>('GroupRow')({
  id: GroupModel.GroupId,
  team_id: Team.TeamId,
  parent_id: Schema.NullOr(GroupModel.GroupId),
  name: Schema.String,
  emoji: Schema.NullOr(Schema.String),
}) {}

class GroupMemberRow extends Schema.Class<GroupMemberRow>('GroupMemberRow')({
  member_id: TeamMember.TeamMemberId,
  name: Schema.NullOr(Schema.String),
  discord_username: Schema.String,
}) {}

class GroupRoleRow extends Schema.Class<GroupRoleRow>('GroupRoleRow')({
  role_id: Role.RoleId,
  role_name: Schema.String,
}) {}

class GroupInsertInput extends Schema.Class<GroupInsertInput>('GroupInsertInput')({
  team_id: Schema.String,
  parent_id: Schema.NullOr(Schema.String),
  name: Schema.String,
  emoji: Schema.NullOr(Schema.String),
}) {}

class GroupUpdateInput extends Schema.Class<GroupUpdateInput>('GroupUpdateInput')({
  id: GroupModel.GroupId,
  name: Schema.String,
  emoji: Schema.NullOr(Schema.String),
}) {}

class GroupMemberInput extends Schema.Class<GroupMemberInput>('GroupMemberInput')({
  group_id: GroupModel.GroupId,
  team_member_id: TeamMember.TeamMemberId,
}) {}

class MoveGroupInput extends Schema.Class<MoveGroupInput>('MoveGroupInput')({
  id: GroupModel.GroupId,
  parent_id: Schema.NullOr(GroupModel.GroupId),
}) {}

class AncestorRow extends Schema.Class<AncestorRow>('AncestorRow')({
  id: GroupModel.GroupId,
}) {}

class DescendantMemberRow extends Schema.Class<DescendantMemberRow>('DescendantMemberRow')({
  team_member_id: TeamMember.TeamMemberId,
}) {}

export class GroupsRepository extends Effect.Service<GroupsRepository>()('api/GroupsRepository', {
  effect: SqlClient.SqlClient.pipe(
    Effect.bindTo('sql'),
    Effect.let('findByTeamId', ({ sql }) =>
      SqlSchema.findAll({
        Request: Schema.String,
        Result: GroupWithCount,
        execute: (teamId) => sql`
            SELECT g.id, g.team_id, g.parent_id, g.name, g.emoji, g.created_at,
                   (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id)::int AS member_count
            FROM groups g
            WHERE g.team_id = ${teamId} AND g.is_archived = false
            ORDER BY g.name ASC
          `,
      }),
    ),
    Effect.let('findById', ({ sql }) =>
      SqlSchema.findOne({
        Request: GroupModel.GroupId,
        Result: GroupRow,
        execute: (id) =>
          sql`SELECT id, team_id, parent_id, name, emoji FROM groups WHERE id = ${id} AND is_archived = false`,
      }),
    ),
    Effect.let('insert', ({ sql }) =>
      SqlSchema.single({
        Request: GroupInsertInput,
        Result: GroupRow,
        execute: (input) => sql`
            INSERT INTO groups (team_id, parent_id, name, emoji)
            VALUES (${input.team_id}, ${input.parent_id}, ${input.name}, ${input.emoji})
            RETURNING id, team_id, parent_id, name, emoji
          `,
      }),
    ),
    Effect.let('update', ({ sql }) =>
      SqlSchema.single({
        Request: GroupUpdateInput,
        Result: GroupRow,
        execute: (input) => sql`
            UPDATE groups SET name = ${input.name}, emoji = ${input.emoji}
            WHERE id = ${input.id}
            RETURNING id, team_id, parent_id, name, emoji
          `,
      }),
    ),
    Effect.let('archiveGroup', ({ sql }) =>
      SqlSchema.void({
        Request: GroupModel.GroupId,
        execute: (id) => sql`UPDATE groups SET is_archived = true WHERE id = ${id}`,
      }),
    ),
    Effect.let('moveGroupParent', ({ sql }) =>
      SqlSchema.single({
        Request: MoveGroupInput,
        Result: GroupRow,
        execute: (input) => sql`
            UPDATE groups SET parent_id = ${input.parent_id}
            WHERE id = ${input.id}
            RETURNING id, team_id, parent_id, name, emoji
          `,
      }),
    ),
    Effect.let('findMembers', ({ sql }) =>
      SqlSchema.findAll({
        Request: GroupModel.GroupId,
        Result: GroupMemberRow,
        execute: (groupId) => sql`
            SELECT tm.id AS member_id, u.name, u.discord_username
            FROM group_members gm
            JOIN team_members tm ON tm.id = gm.team_member_id
            JOIN users u ON u.id = tm.user_id
            WHERE gm.group_id = ${groupId}
            ORDER BY u.discord_username ASC
          `,
      }),
    ),
    Effect.let('addMember', ({ sql }) =>
      SqlSchema.void({
        Request: GroupMemberInput,
        execute: (input) => sql`
            INSERT INTO group_members (group_id, team_member_id)
            VALUES (${input.group_id}, ${input.team_member_id})
            ON CONFLICT DO NOTHING
          `,
      }),
    ),
    Effect.let('removeMember', ({ sql }) =>
      SqlSchema.void({
        Request: GroupMemberInput,
        execute: (input) => sql`
            DELETE FROM group_members
            WHERE group_id = ${input.group_id} AND team_member_id = ${input.team_member_id}
          `,
      }),
    ),
    Effect.let('findRolesForGroup', ({ sql }) =>
      SqlSchema.findAll({
        Request: GroupModel.GroupId,
        Result: GroupRoleRow,
        execute: (groupId) => sql`
            SELECT r.id AS role_id, r.name AS role_name
            FROM role_groups rg
            JOIN roles r ON r.id = rg.role_id
            WHERE rg.group_id = ${groupId}
            ORDER BY r.name ASC
          `,
      }),
    ),
    Effect.let('countMembersForGroup', ({ sql }) =>
      SqlSchema.single({
        Request: GroupModel.GroupId,
        Result: Schema.Struct({ count: Schema.Number }),
        execute: (groupId) =>
          sql`SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = ${groupId}`,
      }),
    ),
    Effect.let('findChildren', ({ sql }) =>
      SqlSchema.findAll({
        Request: GroupModel.GroupId,
        Result: GroupRow,
        execute: (groupId) =>
          sql`SELECT id, team_id, parent_id, name, emoji FROM groups WHERE parent_id = ${groupId} AND is_archived = false`,
      }),
    ),
    Effect.let('findAncestors', ({ sql }) =>
      SqlSchema.findAll({
        Request: GroupModel.GroupId,
        Result: AncestorRow,
        execute: (groupId) => sql`
            WITH RECURSIVE ancestors AS (
              SELECT parent_id AS id FROM groups WHERE id = ${groupId} AND parent_id IS NOT NULL
              UNION ALL
              SELECT g.parent_id FROM groups g JOIN ancestors a ON g.id = a.id WHERE g.parent_id IS NOT NULL
            )
            SELECT id FROM ancestors
          `,
      }),
    ),
    Effect.let('findDescendantMembers', ({ sql }) =>
      SqlSchema.findAll({
        Request: GroupModel.GroupId,
        Result: DescendantMemberRow,
        execute: (groupId) => sql`
            WITH RECURSIVE descendants AS (
              SELECT ${groupId}::uuid AS id
              UNION ALL
              SELECT g.id FROM groups g JOIN descendants d ON g.parent_id = d.id
            )
            SELECT DISTINCT gm.team_member_id
            FROM descendants d
            JOIN group_members gm ON gm.group_id = d.id
          `,
      }),
    ),
    Bind.remove('sql'),
  ),
}) {
  findGroupsByTeamId(teamId: Team.TeamId) {
    return this.findByTeamId(teamId);
  }

  findGroupById(groupId: GroupModel.GroupId) {
    return this.findById(groupId);
  }

  insertGroup(teamId: Team.TeamId, name: string, parentId: string | null, emoji: string | null) {
    return this.insert({ team_id: teamId, parent_id: parentId, name, emoji });
  }

  updateGroupById(groupId: GroupModel.GroupId, name: string, emoji: string | null) {
    return this.update({ id: groupId, name, emoji });
  }

  archiveGroupById(groupId: GroupModel.GroupId) {
    return this.archiveGroup(groupId);
  }

  moveGroup(groupId: GroupModel.GroupId, parentId: GroupModel.GroupId | null) {
    return this.moveGroupParent({ id: groupId, parent_id: parentId });
  }

  findMembersByGroupId(groupId: GroupModel.GroupId) {
    return this.findMembers(groupId);
  }

  addMemberById(groupId: GroupModel.GroupId, teamMemberId: TeamMember.TeamMemberId) {
    return this.addMember({ group_id: groupId, team_member_id: teamMemberId });
  }

  removeMemberById(groupId: GroupModel.GroupId, teamMemberId: TeamMember.TeamMemberId) {
    return this.removeMember({ group_id: groupId, team_member_id: teamMemberId });
  }

  getRolesForGroup(groupId: GroupModel.GroupId) {
    return this.findRolesForGroup(groupId);
  }

  getMemberCount(groupId: GroupModel.GroupId) {
    return this.countMembersForGroup(groupId).pipe(Effect.map((r) => r.count));
  }

  getChildren(groupId: GroupModel.GroupId) {
    return this.findChildren(groupId);
  }

  getAncestorIds(groupId: GroupModel.GroupId) {
    return this.findAncestors(groupId).pipe(Effect.map((rows) => rows.map((r) => r.id)));
  }

  getDescendantMemberIds(groupId: GroupModel.GroupId) {
    return this.findDescendantMembers(groupId).pipe(
      Effect.map((rows) => rows.map((r) => r.team_member_id)),
    );
  }
}
