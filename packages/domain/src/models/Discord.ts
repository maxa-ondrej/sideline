import { Schema } from 'effect';

export const Snowflake = Schema.String.pipe(Schema.brand('Snowflake'));
export type Snowflake = typeof Snowflake.Type;
