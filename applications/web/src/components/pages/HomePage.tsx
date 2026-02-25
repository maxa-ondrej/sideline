import { Link } from '@tanstack/react-router';
import { Option } from 'effect';
import { LanguageSwitcher } from '~/components/organisms/LanguageSwitcher';
import { Button } from '~/components/ui/button';
import * as m from '~/paraglide/messages.js';

const reasonMessages: Record<string, () => string> = {
  access_denied: m.auth_errors_accessDenied,
  missing_params: m.auth_errors_missingParams,
  oauth_failed: m.auth_errors_oauthFailed,
  profile_failed: m.auth_errors_profileFailed,
  internal_error: m.auth_errors_internalError,
};

interface HomePageProps {
  userOption: Option.Option<{ discordUsername: string }>;
  loginUrl: string;
  error: string | undefined;
  reason: string | undefined;
  onLogout: () => void;
}

export function HomePage({ userOption, loginUrl, error, reason, onLogout }: HomePageProps) {
  const isAuthenticated = Option.isSome(userOption);

  return (
    <div className='flex min-h-screen flex-col'>
      <header className='flex items-center justify-between px-6 py-4'>
        <span className='text-lg font-bold'>{m.app_name()}</span>
        <div className='flex items-center gap-3'>
          <LanguageSwitcher isAuthenticated={isAuthenticated} />
          {isAuthenticated && (
            <Button variant='ghost' size='sm' onClick={onLogout}>
              {m.auth_logout()}
            </Button>
          )}
        </div>
      </header>

      <main className='flex flex-1 flex-col items-center justify-center px-6 pb-24'>
        {isAuthenticated ? (
          <div className='flex flex-col items-center gap-6 text-center'>
            <h1 className='text-3xl font-bold'>
              {m.dashboard_welcome({ username: userOption.value.discordUsername })}
            </h1>
            <Button asChild size='lg'>
              <Link to='/dashboard'>{m.dashboard_title()}</Link>
            </Button>
          </div>
        ) : error ? (
          <div className='flex flex-col items-center gap-4 text-center'>
            <h1 className='text-3xl font-bold'>{m.app_name()}</h1>
            <p className='text-muted-foreground'>
              {reasonMessages[reason ?? '']?.() ?? m.auth_loginFailed()}
            </p>
            <Button asChild size='lg'>
              <a href={loginUrl}>{m.auth_tryAgain()}</a>
            </Button>
          </div>
        ) : (
          <div className='flex flex-col items-center gap-4 text-center'>
            <h1 className='text-3xl font-bold'>{m.app_name()}</h1>
            <p className='text-lg text-muted-foreground'>{m.app_welcome()}</p>
            <Button asChild size='lg'>
              <a href={loginUrl}>{m.auth_signInDiscord()}</a>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
