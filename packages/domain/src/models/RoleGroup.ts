import { Schema } from 'effect';
import { GroupId } from '~/models/GroupModel.js';
import { RoleId } from '~/models/Role.js';

export class RoleGroup extends Schema.Class<RoleGroup>('RoleGroup')({
  role_id: RoleId,
  group_id: GroupId,
}) {}
