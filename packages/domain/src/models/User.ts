import { Model } from '@effect/sql';
import { Schema } from 'effect';

export const UserId = Schema.String.pipe(Schema.brand('UserId'));
export type UserId = typeof UserId.Type;

export const Gender = Schema.Literal('male', 'female', 'other');
export type Gender = typeof Gender.Type;

export const Position = Schema.Literal('goalkeeper', 'defender', 'midfielder', 'forward');
export type Position = typeof Position.Type;

export const Proficiency = Schema.Literal('beginner', 'intermediate', 'advanced', 'pro');
export type Proficiency = typeof Proficiency.Type;

export const Locale = Schema.Literal('en', 'cs');
export type Locale = typeof Locale.Type;

export class User extends Model.Class<User>('User')({
  id: Model.Generated(UserId),
  discord_id: Schema.String,
  discord_username: Schema.String,
  discord_avatar: Schema.NullOr(Schema.String),
  discord_access_token: Model.Sensitive(Schema.String),
  discord_refresh_token: Model.Sensitive(Schema.NullOr(Schema.String)),
  name: Schema.NullOr(Schema.String),
  birth_year: Schema.NullOr(Schema.Number),
  gender: Schema.NullOr(Gender),
  jersey_number: Schema.NullOr(Schema.Number),
  position: Schema.NullOr(Position),
  proficiency: Schema.NullOr(Proficiency),
  locale: Locale,
  created_at: Model.DateTimeInsertFromDate,
  is_profile_complete: Schema.Boolean,
  updated_at: Model.DateTimeUpdateFromDate,
}) {}
