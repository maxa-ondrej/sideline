import type { ActivityLogApi, LeaderboardApi, User } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { useNavigate } from '@tanstack/react-router';
import React from 'react';

type SortColumn =
  | 'rank'
  | 'totalActivities'
  | 'totalDurationMinutes'
  | 'currentStreak'
  | 'longestStreak';
type SortDirection = 'asc' | 'desc';

interface LeaderboardPageProps {
  entries: ReadonlyArray<LeaderboardApi.LeaderboardEntry>;
  currentUserId: User.UserId;
  activityTypes: ReadonlyArray<ActivityLogApi.ActivityTypeEntry>;
  teamId: string;
  timeframe: 'all' | 'week';
  activityTypeId: string | undefined;
}

const formatDuration = (minutes: number): string => {
  if (minutes === 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

export function LeaderboardPage({
  entries,
  currentUserId,
  activityTypes,
  teamId,
  timeframe,
  activityTypeId,
}: LeaderboardPageProps) {
  const navigate = useNavigate();
  const [sortColumn, setSortColumn] = React.useState<SortColumn>('rank');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('asc');

  const handleTimeframeChange = (value: string) => {
    void navigate({
      to: '/(authenticated)/teams/$teamId/leaderboard',
      params: { teamId },
      search: { timeframe: value as 'all' | 'week', activityTypeId },
    });
  };

  const handleActivityTypeChange = (value: string) => {
    void navigate({
      to: '/(authenticated)/teams/$teamId/leaderboard',
      params: { teamId },
      search: {
        timeframe,
        activityTypeId: value === '' ? undefined : value,
      },
    });
  };

  const handleSortColumn = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection(column === 'rank' ? 'asc' : 'desc');
    }
  };

  const sortedEntries = [...entries].sort((a, b) => {
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    const diff = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortDirection === 'asc' ? diff : -diff;
  });

  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column)
      return <span className='ml-1 text-muted-foreground opacity-50'>↕</span>;
    return <span className='ml-1'>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const thClass = 'py-2 pr-4 font-medium cursor-pointer select-none hover:text-foreground';

  return (
    <div>
      <h1 className='text-2xl font-bold mb-6'>{m.leaderboard_title()}</h1>

      <div className='flex flex-wrap gap-4 mb-6'>
        <div className='flex flex-col gap-1'>
          <label
            htmlFor='leaderboard-timeframe'
            className='text-sm font-medium text-muted-foreground'
          >
            {m.leaderboard_filterTimeframe()}
          </label>
          <select
            id='leaderboard-timeframe'
            value={timeframe}
            onChange={(e) => handleTimeframeChange(e.target.value)}
            className='rounded-md border border-input bg-background px-3 py-1.5 text-sm'
          >
            <option value='all'>{m.leaderboard_timeframe_all()}</option>
            <option value='week'>{m.leaderboard_timeframe_week()}</option>
          </select>
        </div>

        <div className='flex flex-col gap-1'>
          <label
            htmlFor='leaderboard-activity-type'
            className='text-sm font-medium text-muted-foreground'
          >
            {m.leaderboard_filterActivityType()}
          </label>
          <select
            id='leaderboard-activity-type'
            value={activityTypeId ?? ''}
            onChange={(e) => handleActivityTypeChange(e.target.value)}
            className='rounded-md border border-input bg-background px-3 py-1.5 text-sm'
          >
            <option value=''>{m.leaderboard_allActivityTypes()}</option>
            {activityTypes.map((at) => (
              <option key={at.id} value={at.id}>
                {at.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className='text-muted-foreground'>{m.leaderboard_empty()}</p>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b'>
                <th className={`text-left ${thClass}`} onClick={() => handleSortColumn('rank')}>
                  {m.leaderboard_rank()}
                  <SortIndicator column='rank' />
                </th>
                <th className='text-left py-2 pr-4 font-medium'>{m.leaderboard_player()}</th>
                <th
                  className={`text-right ${thClass}`}
                  onClick={() => handleSortColumn('totalActivities')}
                >
                  {m.leaderboard_activities()}
                  <SortIndicator column='totalActivities' />
                </th>
                <th
                  className={`text-right ${thClass}`}
                  onClick={() => handleSortColumn('totalDurationMinutes')}
                >
                  {m.leaderboard_duration()}
                  <SortIndicator column='totalDurationMinutes' />
                </th>
                <th
                  className={`text-right ${thClass}`}
                  onClick={() => handleSortColumn('currentStreak')}
                >
                  {m.leaderboard_currentStreak()}
                  <SortIndicator column='currentStreak' />
                </th>
                <th
                  className={`text-right py-2 font-medium cursor-pointer select-none hover:text-foreground`}
                  onClick={() => handleSortColumn('longestStreak')}
                >
                  {m.leaderboard_longestStreak()}
                  <SortIndicator column='longestStreak' />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((entry) => {
                const isCurrentUser = entry.userId === currentUserId;
                return (
                  <tr
                    key={entry.teamMemberId}
                    className={`border-b last:border-0 ${isCurrentUser ? 'bg-accent font-semibold' : ''}`}
                  >
                    <td className='py-2 pr-4'>{entry.rank}</td>
                    <td className='py-2 pr-4'>{entry.username}</td>
                    <td className='py-2 pr-4 text-right'>{entry.totalActivities}</td>
                    <td className='py-2 pr-4 text-right'>
                      {formatDuration(entry.totalDurationMinutes)}
                    </td>
                    <td className='py-2 pr-4 text-right'>{entry.currentStreak}d</td>
                    <td className='py-2 text-right'>{entry.longestStreak}d</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
