import * as m from '../../paraglide/messages.js';
import { LanguageSwitcher } from '../organisms/LanguageSwitcher';
import { ProfileCompleteForm } from '../organisms/ProfileCompleteForm';

interface ProfileCompletePageProps {
  user: { discordUsername: string };
  onSuccess: () => void;
}

export function ProfileCompletePage({ user, onSuccess }: ProfileCompletePageProps) {
  return (
    <div className='mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8'>
      <div className='mb-6 flex items-center justify-between'>
        <div>
          <h1 className='mb-2 text-2xl font-bold'>{m.profile_complete_title()}</h1>
          <p className='text-muted-foreground text-sm'>{m.profile_complete_subtitle()}</p>
        </div>
        <LanguageSwitcher isAuthenticated />
      </div>
      <ProfileCompleteForm initialName={user.discordUsername} onSuccess={onSuccess} />
    </div>
  );
}
