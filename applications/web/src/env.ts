import { Schema } from 'effect';

export const schema = {
  SERVER_URL: Schema.NonEmptyTrimmedString.pipe(Schema.standardSchemaV1),
};
