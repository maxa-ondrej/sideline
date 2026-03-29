export * as Bind from './Bind.js';

/**
 * Creates a function that catches an error and converts it to a defect
 * with a descriptive message via `Effect.die(new LogicError(...))`.
 *
 * @example
 * ```ts
 * pipe(
 *   fetchUser(id),
 *   Effect.catchTag('SqlError', LogicError.withMessage((e) => `Failed fetching user ${id}: ${e.message}`)),
 * )
 * ```
 */
export * as LogicError from './LogicError.js';

export * as Metrics from './Metrics.js';

export * as Options from './Options.js';

export * as Runtime from './Runtime.js';

export * as Schemas from './Schemas.js';

export * as SqlErrors from './SqlErrors.js';

export * as Telemetry from './Telemetry.js';
