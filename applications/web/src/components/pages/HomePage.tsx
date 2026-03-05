import * as m from '@sideline/i18n/messages';
import { Option, Record } from 'effect';
import { LanguageSwitcher } from '~/components/organisms/LanguageSwitcher';
import { Button } from '~/components/ui/button';

const reasonMessages: Record<string, () => string> = {
  access_denied: m.auth_errors_accessDenied,
  missing_params: m.auth_errors_missingParams,
  oauth_failed: m.auth_errors_oauthFailed,
  profile_failed: m.auth_errors_profileFailed,
  internal_error: m.auth_errors_internalError,
};

interface HomePageProps {
  loginUrl: string;
  error: Option.Option<string>;
  reason: Option.Option<string>;
}

export function HomePage({ loginUrl, error, reason }: HomePageProps) {
  return (
    <div className='flex min-h-screen flex-col'>
      <header className='flex items-center justify-between px-6 py-4'>
        <span className='text-lg font-bold'>{m.app_name()}</span>
        <div className='flex items-center gap-3'>
          <LanguageSwitcher isAuthenticated={false} />
        </div>
      </header>

      <main className='flex flex-1 flex-col items-center justify-center px-6 pb-24'>
        {Option.isSome(error) ? (
          <div className='flex flex-col items-center gap-4 text-center'>
            <h1 className='text-3xl font-bold'>{m.app_name()}</h1>
            <p className='text-muted-foreground'>
              {reason.pipe(
                Option.flatMap((m) => Record.get(reasonMessages, m)),
                Option.getOrElse(() => m.auth_loginFailed),
              )()}
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
