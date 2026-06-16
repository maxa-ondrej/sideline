import type { EventRsvpApi, PlayerRatingApi } from '@sideline/domain';
import { Event, Team, TeamMember } from '@sideline/domain';
import { Effect, Option, Schema } from 'effect';
import React from 'react';

import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';
import { tr } from '~/lib/translations.js';

type TeamAssignment = 'unassigned' | 'teamA' | 'teamB';
type WinnerChoice = 'teamA' | 'draw' | 'teamB';

interface TrainingResultSectionProps {
  teamId: string;
  eventId: string;
  attendees: ReadonlyArray<EventRsvpApi.RsvpEntry>;
  initialGames: ReadonlyArray<PlayerRatingApi.LoggedGameEntry>;
  onRefresh: () => void;
}

export function TrainingResultSection({
  teamId,
  eventId,
  attendees,
  initialGames,
  onRefresh,
}: TrainingResultSectionProps) {
  const run = useRun();

  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);
  const eventIdBranded = Schema.decodeSync(Event.EventId)(eventId);

  // Assignment state: memberId -> TeamAssignment
  const [assignments, setAssignments] = React.useState<Record<string, TeamAssignment>>(() => {
    const init: Record<string, TeamAssignment> = {};
    for (const a of attendees) {
      init[a.teamMemberId] = 'unassigned';
    }
    return init;
  });

  const [winner, setWinner] = React.useState<WinnerChoice | ''>('');
  const [saving, setSaving] = React.useState(false);
  const [loggedGames, setLoggedGames] =
    React.useState<ReadonlyArray<PlayerRatingApi.LoggedGameEntry>>(initialGames);

  // Sync state when attendees prop changes (parent refresh)
  React.useEffect(() => {
    setAssignments((prev) => {
      const next: Record<string, TeamAssignment> = {};
      for (const a of attendees) {
        next[a.teamMemberId] = prev[a.teamMemberId] ?? 'unassigned';
      }
      return next;
    });
  }, [attendees]);

  // Sync logged games when initialGames prop changes
  React.useEffect(() => {
    setLoggedGames(initialGames);
  }, [initialGames]);

  const teamAIds = attendees
    .filter((a) => assignments[a.teamMemberId] === 'teamA')
    .map((a) => a.teamMemberId);
  const teamBIds = attendees
    .filter((a) => assignments[a.teamMemberId] === 'teamB')
    .map((a) => a.teamMemberId);
  const unassignedIds = attendees.filter((a) => assignments[a.teamMemberId] === 'unassigned');

  const teamACount = teamAIds.length;
  const teamBCount = teamBIds.length;
  const unassignedCount = unassignedIds.length;

  // Auto-reset winner if the winning side becomes empty
  React.useEffect(() => {
    if (winner === 'teamA' && teamACount === 0) setWinner('');
    if (winner === 'teamB' && teamBCount === 0) setWinner('');
  }, [teamACount, teamBCount, winner]);

  const canSave = teamACount > 0 && teamBCount > 0 && winner !== '';

  const saveDisabledReason = !canSave
    ? teamACount === 0 || teamBCount === 0
      ? tr('trainingResult_validationTeamsNonEmpty')
      : tr('trainingResult_validationWinnerRequired')
    : undefined;

  const handleAssign = (memberId: string, value: string) => {
    setAssignments((prev) => ({
      ...prev,
      [memberId]: (value || 'unassigned') as TeamAssignment,
    }));
  };

  const handleSave = React.useCallback(async () => {
    if (!canSave) return;
    const teamABranded = teamAIds.map((id) => Schema.decodeSync(TeamMember.TeamMemberId)(id));
    const teamBBranded = teamBIds.map((id) => Schema.decodeSync(TeamMember.TeamMemberId)(id));
    const outcome = winner as 'teamA' | 'teamB' | 'draw';

    setSaving(true);
    const result = await ApiClient.asEffect().pipe(
      Effect.flatMap((api) =>
        api.playerRating.logTrainingGame({
          params: { teamId: teamIdBranded, eventId: eventIdBranded },
          payload: { teamA: teamABranded, teamB: teamBBranded, outcome },
        }),
      ),
      Effect.catchTag('PlayerRatingInvalidGameResult', (e) => {
        if (e.reason === 'notRsvpYes' || e.reason === 'unknownMember') {
          onRefresh();
          return Effect.fail(ClientError.make(tr('trainingResult_rosterChanged')));
        }
        if (e.reason === 'overlap') {
          return Effect.fail(ClientError.make(tr('trainingResult_validationOverlap')));
        }
        if (e.reason === 'emptyTeam') {
          return Effect.fail(ClientError.make(tr('trainingResult_validationTeamsNonEmpty')));
        }
        return Effect.fail(ClientError.make(tr('trainingResult_saveFailed')));
      }),
      Effect.catchTag('PlayerRatingEventNotLoggable', () =>
        Effect.fail(ClientError.make(tr('trainingResult_notLoggable'))),
      ),
      Effect.mapError(() => ClientError.make(tr('trainingResult_saveFailed'))),
      run({ success: tr('trainingResult_saved') }),
    );
    setSaving(false);

    if (Option.isSome(result)) {
      // Prepend the new round entry to the logged list
      const newEntry: PlayerRatingApi.LoggedGameEntry = result.value;
      setLoggedGames((prev) => [newEntry, ...prev]);

      // Reset assignments back to unassigned
      setAssignments((prev) => {
        const reset: Record<string, TeamAssignment> = {};
        for (const k of Object.keys(prev)) {
          reset[k] = 'unassigned';
        }
        return reset;
      });
      setWinner('');
      onRefresh();
    }
  }, [canSave, teamAIds, teamBIds, winner, teamIdBranded, eventIdBranded, run, onRefresh]);

  const saveHelpId = 'training-result-save-help';

  // Outcome label for a logged game entry
  const outcomeLabel = (outcome: string): string => {
    if (outcome === 'teamA') return tr('trainingResult_winnerTeamA');
    if (outcome === 'teamB') return tr('trainingResult_winnerTeamB');
    return tr('trainingResult_winnerDraw');
  };

  return (
    <Card className='mb-6' id='training-result'>
      <CardHeader>
        <CardTitle className='text-base'>{tr('trainingResult_section')}</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col gap-6'>
        {attendees.length === 0 ? (
          <div className='flex flex-col gap-1'>
            <p className='text-sm text-muted-foreground'>{tr('trainingResult_emptyNoAttendees')}</p>
            <p className='text-xs text-muted-foreground'>{tr('trainingResult_emptyHint')}</p>
          </div>
        ) : (
          <>
            <p className='text-sm text-muted-foreground'>{tr('trainingResult_assignHelp')}</p>

            {/* Live counters */}
            <p aria-live='polite' className='text-sm font-medium'>
              {tr('trainingResult_counts', {
                teamA: teamACount,
                teamB: teamBCount,
                unassigned: unassignedCount,
              })}
            </p>

            {/* Per-attendee assignment rows */}
            <div className='flex flex-col gap-2'>
              {attendees.map((attendee) => (
                <div
                  key={attendee.teamMemberId}
                  className='flex items-center justify-between gap-3'
                >
                  <span className='text-sm truncate min-w-0 flex-1'>{attendee.displayName}</span>
                  <ToggleGroup
                    type='single'
                    variant='outline'
                    size='sm'
                    value={assignments[attendee.teamMemberId] ?? 'unassigned'}
                    onValueChange={(val) => handleAssign(attendee.teamMemberId, val)}
                    aria-label={tr('trainingResult_rowAssignLabel', { name: attendee.displayName })}
                  >
                    <ToggleGroupItem
                      value='unassigned'
                      aria-label={tr('trainingResult_segUnassigned')}
                    >
                      {tr('trainingResult_segUnassigned')}
                    </ToggleGroupItem>
                    <ToggleGroupItem value='teamA' aria-label={tr('trainingResult_segTeamA')}>
                      {tr('trainingResult_segTeamA')}
                    </ToggleGroupItem>
                    <ToggleGroupItem value='teamB' aria-label={tr('trainingResult_segTeamB')}>
                      {tr('trainingResult_segTeamB')}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              ))}
            </div>

            {/* Winner picker */}
            <div className='flex flex-col gap-2'>
              <p className='text-sm font-medium'>{tr('trainingResult_winnerPickerLabel')}</p>
              <ToggleGroup
                type='single'
                variant='outline'
                value={winner}
                onValueChange={(val) => setWinner((val || '') as WinnerChoice | '')}
                aria-label={tr('trainingResult_winnerPickerLabel')}
              >
                <ToggleGroupItem
                  value='teamA'
                  disabled={teamACount === 0}
                  title={teamACount === 0 ? tr('trainingResult_winnerDisabledEmpty') : undefined}
                  aria-label={tr('trainingResult_winnerTeamA')}
                >
                  {tr('trainingResult_winnerTeamA')}
                </ToggleGroupItem>
                <ToggleGroupItem value='draw' aria-label={tr('trainingResult_winnerDraw')}>
                  {tr('trainingResult_winnerDraw')}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value='teamB'
                  disabled={teamBCount === 0}
                  title={teamBCount === 0 ? tr('trainingResult_winnerDisabledEmpty') : undefined}
                  aria-label={tr('trainingResult_winnerTeamB')}
                >
                  {tr('trainingResult_winnerTeamB')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Save button */}
            <div className='flex flex-col gap-1'>
              <Button
                onClick={handleSave}
                disabled={!canSave || saving}
                aria-describedby={saveDisabledReason ? saveHelpId : undefined}
              >
                {saving ? tr('trainingResult_saving') : tr('trainingResult_save')}
              </Button>
              {saveDisabledReason && (
                <p id={saveHelpId} className='text-xs text-muted-foreground'>
                  {saveDisabledReason}
                </p>
              )}
            </div>
          </>
        )}

        {/* Logged rounds */}
        {loggedGames.length > 0 && (
          <div className='flex flex-col gap-2'>
            <p className='text-sm font-semibold'>{tr('trainingResult_loggedRounds')}</p>
            <div className='flex flex-col gap-1'>
              {loggedGames.map((game) => {
                const aCount = game.teamA.length;
                const bCount = game.teamB.length;
                return (
                  <div
                    key={game.id}
                    className='flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm'
                  >
                    <span className='font-medium'>
                      {tr('trainingResult_round', { n: game.round })}
                    </span>
                    <span className='text-muted-foreground'>
                      {tr('trainingResult_score', { scoreA: aCount, scoreB: bCount })}
                    </span>
                    <span
                      className={
                        game.outcome === 'teamA'
                          ? 'rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800'
                          : game.outcome === 'teamB'
                            ? 'rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800'
                            : 'rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700'
                      }
                    >
                      {outcomeLabel(game.outcome)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
