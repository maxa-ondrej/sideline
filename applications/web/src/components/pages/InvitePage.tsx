import { Effect } from 'effect';
import React from 'react';
import { Button } from '~/components/ui/button';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

interface InvitePageProps {
  isAuthenticated: boolean;
  invite: { teamName: string };
  code: string;
  onJoined: (isProfileComplete: boolean) => void;
  onSignIn: () => void;
}

export function InvitePage({ isAuthenticated, invite, code, onJoined, onSignIn }: InvitePageProps) {
  const run = useRun();
  const [joining, setJoining] = React.useState(false);

  const handleJoin = React.useCallback(async () => {
    setJoining(true);
    await ApiClient.pipe(
      Effect.flatMap((api) => api.invite.joinViaInvite({ path: { code } })),
      Effect.tap((result) => Effect.sync(() => onJoined(result.isProfileComplete))),
      Effect.catchTag('AlreadyMember', () => ClientError.make(m.invite_errors_alreadyMember())),
      Effect.catchTag('InviteNotFound', () => ClientError.make(m.invite_errors_inviteNotValid())),
      Effect.catchTag(
        'HttpApiDecodeError',
        'ParseError',
        'RequestError',
        'ResponseError',
        'Unauthorized',
        () => ClientError.make(m.invite_errors_joinFailed()),
      ),
      run,
    );
    setJoining(false);
  }, [code, run, onJoined]);

  return (
    <div>
      <h1>{m.invite_joinTitle({ teamName: invite.teamName })}</h1>
      <p>{m.invite_joinDescription({ teamName: invite.teamName })}</p>
      {isAuthenticated ? (
        <Button onClick={handleJoin} disabled={joining}>
          {joining ? m.invite_joining() : m.invite_joinButton()}
        </Button>
      ) : (
        <Button onClick={onSignIn}>{m.invite_signInToJoin()}</Button>
      )}
    </div>
  );
}
