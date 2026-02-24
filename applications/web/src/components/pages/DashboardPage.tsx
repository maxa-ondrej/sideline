import * as m from '../../paraglide/messages.js';
import { LanguageSwitcher } from '../organisms/LanguageSwitcher';

interface DashboardPageProps {
  user: { discordUsername: string };
  onLogout: () => void;
}

export function DashboardPage({ user, onLogout }: DashboardPageProps) {
  return (
    <div>
      <div className='flex items-center justify-between'>
        <h1>{m.dashboard_title()}</h1>
        <LanguageSwitcher isAuthenticated />
      </div>
      <p>{m.dashboard_welcome({ username: user.discordUsername })}</p>
      <button type='button' onClick={onLogout}>
        {m.auth_logout()}
      </button>
    </div>
  );
}
