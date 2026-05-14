import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(
  Effect.service(SqlClient.SqlClient),
  (sql) => sql`
    INSERT INTO role_permissions (role_id, permission)
    SELECT r.id, perm
    FROM roles r
    CROSS JOIN (VALUES ('activity-type:create'), ('activity-type:delete')) AS p(perm)
    WHERE r.name = 'Captain' AND r.is_built_in = true
    ON CONFLICT DO NOTHING
  `,
);
