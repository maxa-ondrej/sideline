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
  if (Option.isSome(userOption)) {
    return (
      <div>
        <div className='flex items-center justify-between'>
          <h1>{m.app_name()}</h1>
          <LanguageSwitcher isAuthenticated />
        </div>
        <p>{m.auth_signedInAs({ username: userOption.value.discordUsername })}</p>
        <Button variant='outline' onClick={onLogout}>
          {m.auth_logout()}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className='flex items-center justify-between'>
        <h1>{m.app_name()}</h1>
        <LanguageSwitcher isAuthenticated={false} />
      </div>
      {error ? (
        <div>
          <p>{reasonMessages[reason ?? '']?.() ?? m.auth_loginFailed()}</p>
          <Button asChild variant='outline'>
            <a href={loginUrl}>{m.auth_tryAgain()}</a>
          </Button>
        </div>
      ) : (
        <div>
          <p>{m.app_welcome()}</p>
          <Button asChild>
            <a href={loginUrl}>{m.auth_signInDiscord()}</a>
          </Button>
        </div>
      )}
    </div>
  );
}
