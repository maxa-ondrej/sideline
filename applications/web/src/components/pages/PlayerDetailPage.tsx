import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import type { Roster } from '@sideline/domain';
import { Link } from '@tanstack/react-router';
import { Schema } from 'effect';
import { useForm } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import * as m from '~/paraglide/messages.js';

const PlayerEditSchema = Schema.Struct({
  name: Schema.NullOr(Schema.String),
  birthYear: Schema.NullOr(Schema.NumberFromString),
  gender: Schema.NullOr(Schema.Literal('male', 'female', 'other')),
  jerseyNumber: Schema.NullOr(Schema.NumberFromString.pipe(Schema.int(), Schema.between(0, 99))),
  position: Schema.NullOr(Schema.Literal('goalkeeper', 'defender', 'midfielder', 'forward')),
  proficiency: Schema.NullOr(Schema.Literal('beginner', 'intermediate', 'advanced', 'pro')),
});

export type PlayerEditValues = Schema.Schema.Type<typeof PlayerEditSchema>;

interface PlayerDetailPageProps {
  teamId: string;
  player: Roster.RosterPlayer;
  isAdmin: boolean;
  onSave: (values: PlayerEditValues) => Promise<void>;
}

export function PlayerDetailPage({ teamId, player, isAdmin, onSave }: PlayerDetailPageProps) {
  const form = useForm({
    resolver: effectTsResolver(PlayerEditSchema),
    mode: 'onChange',
    defaultValues: {
      name: player.name,
      birthYear: player.birthYear !== null ? String(player.birthYear) : null,
      gender: player.gender,
      jerseyNumber: player.jerseyNumber !== null ? String(player.jerseyNumber) : null,
      position: player.position,
      proficiency: player.proficiency,
    },
  });

  const displayName = player.name ?? player.discordUsername;

  return (
    <div className='p-4 max-w-lg'>
      <Button asChild variant='ghost' className='mb-4'>
        <Link to='/teams/$teamId/members' params={{ teamId }}>
          ← {m.members_backToMembers()}
        </Link>
      </Button>
      <h1 className='text-2xl font-bold mb-4'>{displayName}</h1>
      {isAdmin ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className='flex flex-col gap-4'>
            <FormField
              {...form.register('name')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.profile_complete_displayName()}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              {...form.register('birthYear')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.profile_complete_birthYear()}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder={m.profile_complete_birthYearPlaceholder()}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              {...form.register('gender')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.profile_complete_gender()}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder={m.profile_complete_genderPlaceholder()} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='male'>{m.profile_complete_genderMale()}</SelectItem>
                      <SelectItem value='female'>{m.profile_complete_genderFemale()}</SelectItem>
                      <SelectItem value='other'>{m.profile_complete_genderOther()}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              {...form.register('jerseyNumber')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.profile_complete_jerseyNumber()}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder={m.profile_complete_jerseyNumberPlaceholder()}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              {...form.register('position')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.profile_complete_position()}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder={m.profile_complete_positionPlaceholder()} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='goalkeeper'>
                        {m.profile_complete_positionGoalkeeper()}
                      </SelectItem>
                      <SelectItem value='defender'>
                        {m.profile_complete_positionDefender()}
                      </SelectItem>
                      <SelectItem value='midfielder'>
                        {m.profile_complete_positionMidfielder()}
                      </SelectItem>
                      <SelectItem value='forward'>
                        {m.profile_complete_positionForward()}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              {...form.register('proficiency')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.profile_complete_proficiency()}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder={m.profile_complete_proficiencyPlaceholder()} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='beginner'>
                        {m.profile_complete_proficiencyBeginner()}
                      </SelectItem>
                      <SelectItem value='intermediate'>
                        {m.profile_complete_proficiencyIntermediate()}
                      </SelectItem>
                      <SelectItem value='advanced'>
                        {m.profile_complete_proficiencyAdvanced()}
                      </SelectItem>
                      <SelectItem value='pro'>{m.profile_complete_proficiencyPro()}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type='submit' disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? m.members_saving() : m.members_saveChanges()}
            </Button>
          </form>
        </Form>
      ) : (
        <div className='flex flex-col gap-2'>
          <p>
            <strong>{m.profile_complete_position()}:</strong> {player.position ?? '—'}
          </p>
          <p>
            <strong>{m.profile_complete_proficiency()}:</strong> {player.proficiency ?? '—'}
          </p>
          <p>
            <strong>{m.profile_complete_jerseyNumber()}:</strong>{' '}
            {player.jerseyNumber !== null ? `#${player.jerseyNumber}` : '—'}
          </p>
        </div>
      )}
    </div>
  );
}
