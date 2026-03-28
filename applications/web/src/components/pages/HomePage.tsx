import * as m from '@sideline/i18n/messages';
import { Option, Record } from 'effect';
import { Calendar, Dumbbell, Users } from 'lucide-react';
import { LanguageSwitcher } from '~/components/organisms/LanguageSwitcher';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

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

const features = [
  {
    id: 'events',
    icon: Calendar,
    titleKey: m.hero_feature_events,
    descKey: m.hero_feature_events_desc,
  },
  {
    id: 'workout',
    icon: Dumbbell,
    titleKey: m.hero_feature_workout,
    descKey: m.hero_feature_workout_desc,
  },
  {
    id: 'team',
    icon: Users,
    titleKey: m.hero_feature_team,
    descKey: m.hero_feature_team_desc,
  },
] as const;

export function HomePage({ loginUrl, error, reason }: HomePageProps) {
  return (
    <div className='flex min-h-screen flex-col'>
      <header className='flex items-center justify-between px-6 py-4 border-b'>
        <span className='text-lg font-bold'>{m.app_name()}</span>
        <div className='flex items-center gap-3'>
          <LanguageSwitcher isAuthenticated={false} />
        </div>
      </header>

      <main className='flex flex-1 flex-col items-center justify-center px-6 pb-24'>
        {Option.isSome(error) ? (
          <div className='flex flex-col items-center gap-4 text-center max-w-md'>
            <h1 className='text-3xl font-bold'>{m.app_name()}</h1>
            <p className='text-muted-foreground'>
              {reason.pipe(
                Option.flatMap((msg) => Record.get(reasonMessages, msg)),
                Option.getOrElse(() => m.auth_loginFailed),
              )()}
            </p>
            <Button asChild size='lg'>
              <a href={loginUrl}>{m.auth_tryAgain()}</a>
            </Button>
          </div>
        ) : (
          <div className='flex flex-col items-center gap-10 text-center w-full max-w-4xl'>
            {/* Hero section */}
            <div className='flex flex-col items-center gap-4'>
              <h1 className='text-4xl font-bold tracking-tight sm:text-5xl'>{m.hero_headline()}</h1>
              <p className='text-lg text-muted-foreground max-w-2xl'>{m.hero_subheadline()}</p>
              <Button asChild size='lg' className='mt-2'>
                <a href={loginUrl}>{m.auth_signInDiscord()}</a>
              </Button>
            </div>

            {/* Feature widgets */}
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-3 w-full'>
              {features.map((feature) => (
                <Card key={feature.id} className='text-left'>
                  <CardHeader className='pb-2'>
                    <div className='flex items-center gap-2'>
                      <feature.icon className='size-5 text-muted-foreground' />
                      <CardTitle className='text-base'>{feature.titleKey()}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className='text-sm text-muted-foreground'>{feature.descKey()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className='border-t px-6 py-4 text-center text-sm text-muted-foreground'>
        {m.hero_footer()}
      </footer>
    </div>
  );
}
