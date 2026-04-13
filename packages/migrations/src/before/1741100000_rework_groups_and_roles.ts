import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.all([
    // 1. Rename subgroups → groups
    sql`ALTER TABLE subgroups RENAME TO groups`,
    sql`ALTER TABLE subgroup_members RENAME TO group_members`,
    sql`ALTER TABLE group_members RENAME COLUMN subgroup_id TO group_id`,

    // 2. Add hierarchy + emoji to groups
    sql`ALTER TABLE groups ADD COLUMN parent_id UUID REFERENCES groups(id) ON DELETE SET NULL`,
    sql`ALTER TABLE groups ADD COLUMN emoji TEXT`,
    sql`CREATE INDEX idx_groups_parent ON groups(parent_id)`,

    // 3. Drop subgroup_permissions (permissions now come only from roles)
    sql`DROP TABLE subgroup_permissions`,

    // 4. Rename indexes
    sql`ALTER INDEX idx_subgroups_team RENAME TO idx_groups_team`,
    sql`ALTER INDEX idx_subgroups_team_name RENAME TO idx_groups_team_name`,
    sql`ALTER INDEX idx_subgroup_members_member RENAME TO idx_group_members_member`,

    // 5. Create role_groups junction (roles assigned to groups)
    sql`CREATE TABLE role_groups (
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, group_id)
    )`,
    sql`CREATE INDEX idx_role_groups_group ON role_groups(group_id)`,

    // 6. Rename channel sync columns
    sql`ALTER TABLE channel_sync_events RENAME COLUMN subgroup_id TO group_id`,
    sql`ALTER TABLE channel_sync_events RENAME COLUMN subgroup_name TO group_name`,
    sql`ALTER TABLE discord_channel_mappings RENAME COLUMN subgroup_id TO group_id`,

    // 7. Training types: add group_id, drop coaches
    sql`ALTER TABLE training_types ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE SET NULL`,
    sql`DROP TABLE training_type_coaches`,

    // 8. Role-scoped training type access
    sql`CREATE TABLE role_training_types (
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      training_type_id UUID NOT NULL REFERENCES training_types(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, training_type_id)
    )`,
    sql`CREATE INDEX idx_role_training_types_tt ON role_training_types(training_type_id)`,

    // 9. Add new permissions to Admin
    sql`INSERT INTO role_permissions (role_id, permission)
      SELECT r.id, p.perm FROM roles r
      CROSS JOIN (VALUES ('training-type:create'), ('training-type:delete')) AS p(perm)
      WHERE r.is_built_in = true AND r.name = 'Admin'
      ON CONFLICT DO NOTHING`,

    // 10. Age thresholds: role_id → group_id
    sql`ALTER TABLE age_threshold_rules ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE CASCADE`,
    sql`ALTER TABLE age_threshold_rules DROP CONSTRAINT age_threshold_rules_team_id_role_id_key`,
    sql`ALTER TABLE age_threshold_rules DROP COLUMN role_id`,
    sql`ALTER TABLE age_threshold_rules ALTER COLUMN group_id SET NOT NULL`,
    sql`ALTER TABLE age_threshold_rules ADD CONSTRAINT age_threshold_rules_team_group_unique UNIQUE (team_id, group_id)`,
  ]),
);
