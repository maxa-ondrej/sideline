# Effect Lib Package (`@sideline/effect-lib`)

Shared Effect-TS utilities used across the monorepo.

## Key Exports

### Bind Utilities

`Bind.remove` strips internal dependencies from service types in the repository pattern:

```typescript
import { Bind } from '@sideline/effect-lib';

// In repository definition — remove internals from the service type
SqlClient.SqlClient.pipe(
  Effect.bindTo('sql'),
  Effect.bind('repo', () => Model.makeRepository(...)),
  Effect.let('findById', ({ repo }) => (id) => repo.findById(id)),
  Bind.remove('sql'),
  Bind.remove('repo'),
)
```

### DateTime Schemas

`Schemas.DateTimeFromDate` — converts between JS `Date` and Effect `DateTime.Utc`. Use in domain models:

```typescript
import { Schemas } from '@sideline/effect-lib';

// For non-nullable DateTime fields
created_at: Schemas.DateTimeFromDate

// For nullable DateTime fields
deleted_at: Schema.OptionFromNullOr(Schemas.DateTimeFromDate)
```

### SQL Error Handling

Utilities for handling PostgreSQL-specific errors (unique constraint violations, etc.).
