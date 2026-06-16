import { Elo, Event, PlayerRatingApi, Team, TeamMember, TrainingGame } from '@sideline/domain';
import { LogicError } from '@sideline/effect-lib';
import { Effect, Layer, Option, Schema, ServiceMap } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';
import {
  type ApplyGameUpdatesParams,
  PlayerRatingsRepository,
} from '~/repositories/PlayerRatingsRepository.js';

// ---------------------------------------------------------------------------
// Row schemas
// ---------------------------------------------------------------------------

class InsertedGameRow extends Schema.Class<InsertedGameRow>('InsertedGameRow')({
  id: TrainingGame.TrainingGameId,
  round: Schema.Int,
  created_at: Schema.Date,
}) {}

class ListGameRow extends Schema.Class<ListGameRow>('ListGameRow')({
  id: TrainingGame.TrainingGameId,
  round: Schema.Int,
  outcome: TrainingGame.TrainingGameOutcome,
  created_at: Schema.Date,
  team_member_id: TeamMember.TeamMemberId,
  side: Schema.Literals(['A', 'B']),
}) {}

// ---------------------------------------------------------------------------
// Repository make
// ---------------------------------------------------------------------------

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const ratings = yield* PlayerRatingsRepository;

  // ---- insertGame ----

  const insertGame = (params: {
    teamId: Team.TeamId;
    eventId: Event.EventId;
    teamAMemberIds: ReadonlyArray<TeamMember.TeamMemberId>;
    teamBMemberIds: ReadonlyArray<TeamMember.TeamMemberId>;
    outcome: TrainingGame.TrainingGameOutcome;
    submittedBy: Option.Option<TeamMember.TeamMemberId>;
  }): Effect.Effect<PlayerRatingApi.TrainingGameResult> => {
    const { teamId, eventId, teamAMemberIds, teamBMemberIds, outcome, submittedBy } = params;

    const txEffect = Effect.Do.pipe(
      // Step a: Advisory lock to serialize round assignment per event
      Effect.tap(() =>
        sql`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`.pipe(catchSqlErrors, Effect.asVoid),
      ),
      // Step b: Compute next round number
      Effect.bind('round', () =>
        SqlSchema.findOne({
          Request: Event.EventId,
          Result: Schema.Struct({ next_round: Schema.Int }),
          execute: (eid) => sql`
            SELECT COALESCE(MAX(round), 0) + 1 AS next_round
            FROM training_games
            WHERE event_id = ${eid}
          `,
        })(eventId).pipe(
          catchSqlErrors,
          Effect.catchTag('NoSuchElementError', () =>
            LogicError.die('insertGame: round computation returned no row'),
          ),
          Effect.map((row) => row.next_round),
        ),
      ),
      // Step c: INSERT training_games RETURNING id, round, created_at
      Effect.bind('insertedGame', ({ round }) =>
        sql`
          INSERT INTO training_games (team_id, event_id, round, outcome, submitted_by)
          VALUES (${teamId}, ${eventId}, ${round}, ${outcome}, ${Option.getOrNull(submittedBy)})
          RETURNING id, round, created_at
        `.pipe(
          catchSqlErrors,
          Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(InsertedGameRow))),
          Effect.flatMap((rows) =>
            rows[0] !== undefined
              ? Effect.succeed(rows[0])
              : LogicError.die('insertGame: INSERT training_games returned no row'),
          ),
        ),
      ),
      // Step d: INSERT participants for team A (side 'A') and team B (side 'B')
      Effect.tap(({ insertedGame }) => {
        const allParticipants: Array<{
          training_game_id: TrainingGame.TrainingGameId;
          team_member_id: TeamMember.TeamMemberId;
          side: 'A' | 'B';
        }> = [
          ...teamAMemberIds.map((id) => ({
            training_game_id: insertedGame.id,
            team_member_id: id,
            side: 'A' as const,
          })),
          ...teamBMemberIds.map((id) => ({
            training_game_id: insertedGame.id,
            team_member_id: id,
            side: 'B' as const,
          })),
        ];

        return Effect.forEach(
          allParticipants,
          (p) =>
            sql`
              INSERT INTO training_game_participants (training_game_id, team_member_id, side)
              VALUES (${p.training_game_id}, ${p.team_member_id}, ${p.side})
            `.pipe(catchSqlErrors, Effect.asVoid),
          { concurrency: 1, discard: true },
        );
      }),
      // Step e: Apply Elo rating updates using applyGameUpdatesTx (nests in outer tx)
      Effect.tap(({ insertedGame }) => {
        const ratingParams: ApplyGameUpdatesParams = {
          teamId,
          teamAMemberIds,
          teamBMemberIds,
          outcome,
          submittedBy,
          gameId: Option.some(insertedGame.id),
        };
        return ratings.applyGameUpdatesTx(ratingParams);
      }),
      // Return the inserted game data
      Effect.map(({ insertedGame }) => insertedGame),
    );

    return sql.withTransaction(txEffect).pipe(
      catchSqlErrors,
      Effect.flatMap((insertedGame) =>
        ratings.getTeamRatings(teamId).pipe(
          catchSqlErrors,
          Effect.map((ratingRows) => {
            const entries = ratingRows.map(
              (row) =>
                new PlayerRatingApi.TeamRatingEntry({
                  memberId: row.team_member_id,
                  rating: row.rating,
                  gamesPlayed: row.games_played,
                  previousRating: row.prev_rating,
                  lastDelta: row.last_delta,
                  wins: row.wins,
                  losses: row.losses,
                  draws: row.draws,
                }),
            );

            return new PlayerRatingApi.TrainingGameResult({
              id: insertedGame.id,
              round: insertedGame.round,
              teamA: [...teamAMemberIds],
              teamB: [...teamBMemberIds],
              outcome,
              created_at: insertedGame.created_at.toISOString(),
              ratings: new PlayerRatingApi.TeamRatingsResponse({
                canManage: true,
                calibrationThreshold: Elo.CALIBRATION_GAMES,
                entries,
              }),
            });
          }),
        ),
      ),
    );
  };

  // ---- listGamesByEvent ----

  const listGamesByEventQuery = SqlSchema.findAll({
    Request: Schema.Struct({ team_id: Team.TeamId, event_id: Event.EventId }),
    Result: ListGameRow,
    execute: (input) => sql`
      SELECT
        tg.id,
        tg.round,
        tg.outcome,
        tg.created_at,
        tgp.team_member_id,
        tgp.side
      FROM training_games tg
      JOIN training_game_participants tgp ON tgp.training_game_id = tg.id
      WHERE tg.event_id = ${input.event_id}
        AND tg.team_id = ${input.team_id}
      ORDER BY tg.round ASC, tg.created_at ASC, tgp.side ASC, tgp.team_member_id ASC
    `,
  });

  const listGamesByEvent = (
    teamId: Team.TeamId,
    eventId: Event.EventId,
  ): Effect.Effect<ReadonlyArray<PlayerRatingApi.LoggedGameEntry>> =>
    listGamesByEventQuery({ team_id: teamId, event_id: eventId }).pipe(
      catchSqlErrors,
      Effect.map((rows) => {
        // Group rows by game id, preserving round order
        const gameMap = new Map<
          string,
          {
            id: TrainingGame.TrainingGameId;
            round: number;
            outcome: TrainingGame.TrainingGameOutcome;
            created_at: Date;
            teamA: TeamMember.TeamMemberId[];
            teamB: TeamMember.TeamMemberId[];
          }
        >();

        for (const row of rows) {
          let entry = gameMap.get(row.id);
          if (entry === undefined) {
            entry = {
              id: row.id,
              round: row.round,
              outcome: row.outcome,
              created_at: row.created_at,
              teamA: [],
              teamB: [],
            };
            gameMap.set(row.id, entry);
          }
          if (row.side === 'A') {
            entry.teamA.push(row.team_member_id);
          } else {
            entry.teamB.push(row.team_member_id);
          }
        }

        return Array.from(gameMap.values()).map(
          (g) =>
            new PlayerRatingApi.LoggedGameEntry({
              id: g.id,
              round: g.round,
              teamA: g.teamA,
              teamB: g.teamB,
              outcome: g.outcome,
              created_at: g.created_at.toISOString(),
            }),
        );
      }),
    );

  return {
    insertGame,
    listGamesByEvent,
  };
});

export class TrainingGamesRepository extends ServiceMap.Service<
  TrainingGamesRepository,
  Effect.Success<typeof make>
>()('api/TrainingGamesRepository') {
  static readonly Default = Layer.effect(TrainingGamesRepository, make);
}
