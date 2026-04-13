import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.all([
    sql`
      INSERT INTO role_permissions (role_id, permission)
      SELECT rp.role_id, 'group:manage'
      FROM role_permissions rp
      WHERE rp.permission = 'team:manage'
      ON CONFLICT DO NOTHING
    `,
    sql`
      INSERT INTO role_permissions (role_id, permission)
      SELECT r.id, 'group:manage'
      FROM roles r
      WHERE r.name IN ('Admin', 'Captain') AND r.is_built_in = true
      ON CONFLICT DO NOTHING
    `,
    sql`
      INSERT INTO role_permissions (role_id, permission)
      SELECT r.id, 'training-type:create'
      FROM roles r
      WHERE r.name = 'Captain' AND r.is_built_in = true
      ON CONFLICT DO NOTHING
    `,
  ]),
);
