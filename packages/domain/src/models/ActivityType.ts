import { Schema } from 'effect';

export const ActivityTypeId = Schema.String.pipe(Schema.brand('ActivityTypeId'));
export type ActivityTypeId = typeof ActivityTypeId.Type;

export const ActivityTypeSlug = Schema.Literal('gym', 'running', 'stretching', 'training');
export type ActivityTypeSlug = typeof ActivityTypeSlug.Type;
