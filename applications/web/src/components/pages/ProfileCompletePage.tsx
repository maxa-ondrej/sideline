import { LanguageSwitcher } from '~/components/organisms/LanguageSwitcher';
import { ProfileCompleteForm } from '~/components/organisms/ProfileCompleteForm';
import * as m from '~/paraglide/messages.js';

interface ProfileCompletePageProps {
  user: { discordUsername: string };
  onSuccess: () => void;
}

export function ProfileCompletePage({ user, onSuccess }: ProfileCompletePageProps) {
  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <header className='mb-8'>
        <div className='flex items-center justify-between mb-2'>
          <h1 className='text-2xl font-bold'>{m.profile_complete_title()}</h1>
          <LanguageSwitcher isAuthenticated />
        </div>
        <p className='text-muted-foreground'>{m.profile_complete_subtitle()}</p>
      </header>
      <ProfileCompleteForm initialName={user.discordUsername} onSuccess={onSuccess} />
    </div>
  );
}
