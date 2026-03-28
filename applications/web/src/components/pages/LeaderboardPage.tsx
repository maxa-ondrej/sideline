import type { LeaderboardApi } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';

interface LeaderboardPageProps {
  entries: ReadonlyArray<LeaderboardApi.LeaderboardEntry>;
  currentUserId: string;
}

const formatDuration = (minutes: number): string => {
  if (minutes === 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

export function LeaderboardPage({ entries, currentUserId }: LeaderboardPageProps) {
  if (entries.length === 0) {
    return (
      <div>
        <h1 className='text-2xl font-bold mb-6'>{m.leaderboard_title()}</h1>
        <p className='text-muted-foreground'>{m.leaderboard_empty()}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className='text-2xl font-bold mb-6'>{m.leaderboard_title()}</h1>

      <div className='overflow-x-auto'>
        <table className='w-full text-sm min-w-[320px]'>
          <thead>
            <tr className='border-b'>
              <th className='text-left py-2 pr-4 font-medium'>{m.leaderboard_rank()}</th>
              <th className='text-left py-2 pr-4 font-medium'>{m.leaderboard_player()}</th>
              <th className='text-right py-2 pr-4 font-medium'>{m.leaderboard_activities()}</th>
              <th className='hidden sm:table-cell text-right py-2 pr-4 font-medium'>
                {m.leaderboard_duration()}
              </th>
              <th className='text-right py-2 pr-4 font-medium'>{m.leaderboard_currentStreak()}</th>
              <th className='hidden sm:table-cell text-right py-2 font-medium'>
                {m.leaderboard_longestStreak()}
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isCurrentUser = entry.userId === currentUserId;
              return (
                <tr
                  key={entry.teamMemberId}
                  className={`border-b last:border-0 ${isCurrentUser ? 'bg-accent font-semibold' : ''}`}
                >
                  <td className='py-2 pr-4'>{entry.rank}</td>
                  <td className='py-2 pr-4 truncate max-w-[120px]'>{entry.username}</td>
                  <td className='py-2 pr-4 text-right'>{entry.totalActivities}</td>
                  <td className='hidden sm:table-cell py-2 pr-4 text-right'>
                    {formatDuration(entry.totalDurationMinutes)}
                  </td>
                  <td className='py-2 pr-4 text-right'>{entry.currentStreak}d</td>
                  <td className='hidden sm:table-cell py-2 text-right'>{entry.longestStreak}d</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
