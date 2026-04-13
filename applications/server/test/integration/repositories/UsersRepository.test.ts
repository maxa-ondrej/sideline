import { describe, expect, it } from '@effect/vitest';
import type { User } from '@sideline/domain';
import { DateTime, Effect, Layer, Option } from 'effect';
import { beforeEach } from 'vitest';
import { UsersRepository } from '~/repositories/UsersRepository.js';
import { cleanDatabase, TestPgClient } from '../helpers.js';

const TestLayer = UsersRepository.Default.pipe(Layer.provideMerge(TestPgClient));

beforeEach(() => cleanDatabase.pipe(Effect.provide(TestPgClient), Effect.runPromise));

describe('UsersRepository', () => {
  it.effect('upsertFromDiscord creates a new user', () =>
    Effect.Do.pipe(
      Effect.bind('user', () =>
        UsersRepository.pipe(
          Effect.andThen((repo) =>
            repo.upsertFromDiscord({
              discord_id: '123456789012345678',
              username: 'testuser',
              avatar: Option.none(),
              discord_nickname: Option.none(),
            }),
          ),
        ),
      ),
      Effect.tap(({ user }) => {
        expect(user.discord_id).toBe('123456789012345678');
        expect(user.username).toBe('testuser');
        expect(Option.isNone(user.avatar)).toBe(true);
        expect(user.is_profile_complete).toBe(false);
      }),
      Effect.provide(TestLayer),
    ),
  );

  it.effect('upsertFromDiscord updates existing user on conflict', () =>
    Effect.Do.pipe(
      Effect.tap(() =>
        UsersRepository.pipe(
          Effect.andThen((repo) =>
            repo.upsertFromDiscord({
              discord_id: '999999999999999999',
              username: 'original',
              avatar: Option.none(),
              discord_nickname: Option.none(),
            }),
          ),
        ),
      ),
      Effect.bind('updated', () =>
        UsersRepository.pipe(
          Effect.andThen((repo) =>
            repo.upsertFromDiscord({
              discord_id: '999999999999999999',
              username: 'updated',
              avatar: Option.some('avatar-hash'),
              discord_nickname: Option.none(),
            }),
          ),
        ),
      ),
      Effect.tap(({ updated }) => {
        expect(updated.discord_id).toBe('999999999999999999');
        expect(updated.username).toBe('updated');
        expect(Option.getOrNull(updated.avatar)).toBe('avatar-hash');
      }),
      Effect.provide(TestLayer),
    ),
  );

  it.effect('findById returns Some for existing user', () =>
    Effect.Do.pipe(
      Effect.bind('created', () =>
        UsersRepository.pipe(
          Effect.andThen((repo) =>
            repo.upsertFromDiscord({
              discord_id: '111111111111111111',
              username: 'findme',
              avatar: Option.none(),
              discord_nickname: Option.none(),
            }),
          ),
        ),
      ),
      Effect.bind('found', ({ created }) =>
        UsersRepository.pipe(Effect.andThen((repo) => repo.findById(created.id))),
      ),
      Effect.tap(({ created, found }) => {
        expect(Option.isSome(found)).toBe(true);
        const user = Option.getOrThrow(found);
        expect(user.id).toBe(created.id);
        expect(user.username).toBe('findme');
      }),
      Effect.provide(TestLayer),
    ),
  );

  it.effect('findById returns None for non-existent user', () =>
    UsersRepository.pipe(
      Effect.andThen((repo) =>
        repo.findById('00000000-0000-0000-0000-000000000099' as User.UserId),
      ),
      Effect.tap((found) => {
        expect(Option.isNone(found)).toBe(true);
      }),
      Effect.provide(TestLayer),
    ),
  );

  it.effect('findByDiscordId returns Some for existing user', () =>
    Effect.Do.pipe(
      Effect.tap(() =>
        UsersRepository.pipe(
          Effect.andThen((repo) =>
            repo.upsertFromDiscord({
              discord_id: '222222222222222222',
              username: 'discorduser',
              avatar: Option.none(),
              discord_nickname: Option.none(),
            }),
          ),
        ),
      ),
      Effect.bind('found', () =>
        UsersRepository.pipe(Effect.andThen((repo) => repo.findByDiscordId('222222222222222222'))),
      ),
      Effect.tap(({ found }) => {
        expect(Option.isSome(found)).toBe(true);
        const user = Option.getOrThrow(found);
        expect(user.discord_id).toBe('222222222222222222');
        expect(user.username).toBe('discorduser');
      }),
      Effect.provide(TestLayer),
    ),
  );

  it.effect('findByDiscordId returns None for non-existent discord id', () =>
    UsersRepository.pipe(
      Effect.andThen((repo) => repo.findByDiscordId('000000000000000000')),
      Effect.tap((found) => {
        expect(Option.isNone(found)).toBe(true);
      }),
      Effect.provide(TestLayer),
    ),
  );

  it.effect('completeProfile updates profile fields and sets is_profile_complete to true', () =>
    Effect.Do.pipe(
      Effect.bind('created', () =>
        UsersRepository.pipe(
          Effect.andThen((repo) =>
            repo.upsertFromDiscord({
              discord_id: '333333333333333333',
              username: 'profileuser',
              avatar: Option.none(),
              discord_nickname: Option.none(),
            }),
          ),
        ),
      ),
      Effect.bind('completed', ({ created }) =>
        UsersRepository.pipe(
          Effect.andThen((repo) =>
            repo.completeProfile({
              id: created.id,
              name: Option.some('John Doe'),
              birth_date: Option.some(DateTime.makeUnsafe(new Date('1990-01-15'))),
              gender: Option.some('male' as User.Gender),
            }),
          ),
        ),
      ),
      Effect.tap(({ completed }) => {
        expect(completed.is_profile_complete).toBe(true);
        expect(Option.getOrNull(completed.name)).toBe('John Doe');
        expect(Option.getOrNull(completed.gender)).toBe('male');
      }),
      Effect.provide(TestLayer),
    ),
  );

  it.effect('updateLocale changes user locale', () =>
    Effect.Do.pipe(
      Effect.bind('created', () =>
        UsersRepository.pipe(
          Effect.andThen((repo) =>
            repo.upsertFromDiscord({
              discord_id: '444444444444444444',
              username: 'localeuser',
              avatar: Option.none(),
              discord_nickname: Option.none(),
            }),
          ),
        ),
      ),
      Effect.bind('updated', ({ created }) =>
        UsersRepository.pipe(
          Effect.andThen((repo) =>
            repo.updateLocale({
              id: created.id,
              locale: 'cs',
            }),
          ),
        ),
      ),
      Effect.tap(({ updated }) => {
        expect(updated.locale).toBe('cs');
      }),
      Effect.provide(TestLayer),
    ),
  );
});
