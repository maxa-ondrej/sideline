import * as m from '../../paraglide/messages.js';
import { LanguageSwitcher } from '../organisms/LanguageSwitcher';
import { Button } from '../ui/button';

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
      <Button variant='outline' onClick={onLogout}>
        {m.auth_logout()}
      </Button>
    </div>
  );
}
