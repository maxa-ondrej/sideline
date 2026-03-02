import React from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import * as m from '~/paraglide/messages.js';

interface CreateTeamPageProps {
  onCreateTeam: (name: string) => Promise<boolean>;
}

export function CreateTeamPage({ onCreateTeam }: CreateTeamPageProps) {
  const [teamName, setTeamName] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const handleCreate = React.useCallback(async () => {
    if (!teamName.trim()) return;
    setCreating(true);
    const success = await onCreateTeam(teamName.trim());
    setCreating(false);
    if (success) {
      setTeamName('');
    }
  }, [teamName, onCreateTeam]);

  return (
    <div>
      <header className='mb-8'>
        <h1 className='text-2xl font-bold'>{m.dashboard_createTeam()}</h1>
      </header>

      <section>
        <div className='flex gap-2 max-w-md'>
          <Input
            placeholder={m.dashboard_teamNamePlaceholder()}
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
          />
          <Button onClick={handleCreate} disabled={creating || !teamName.trim()}>
            {creating ? m.dashboard_creating() : m.dashboard_createTeam()}
          </Button>
        </div>
      </section>
    </div>
  );
}
