import { MIN_AGE } from '@sideline/domain/api/Auth';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Effect, Option } from 'effect';
import React from 'react';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { ApiClient, ClientError } from '../../lib/runtime';
import * as m from '../../paraglide/messages.js';

export const Route = createFileRoute('/(authenticated)/profile/complete')({
  component: ProfileComplete,
  ssr: false,
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: '/' });
    }
    if (context.user.isProfileComplete) {
      throw redirect({ to: '/dashboard' });
    }
  },
});

const currentYear = new Date().getFullYear();
const maxBirthYear = currentYear - MIN_AGE;
const birthYears = Array.from({ length: maxBirthYear - 1900 + 1 }, (_, i) => maxBirthYear - i);

function ProfileComplete() {
  const { user, makeRun } = Route.useRouteContext();
  const navigate = useNavigate();

  const [name, setName] = React.useState(user.discordUsername);
  const [birthYear, setBirthYear] = React.useState('');
  const [gender, setGender] = React.useState('');
  const [jerseyNumber, setJerseyNumber] = React.useState('');
  const [position, setPosition] = React.useState('');
  const [proficiency, setProficiency] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const genderOptions = [
    { value: 'male', label: m.profile_complete_genderMale() },
    { value: 'female', label: m.profile_complete_genderFemale() },
    { value: 'other', label: m.profile_complete_genderOther() },
  ];

  const positionOptions = [
    { value: 'goalkeeper', label: m.profile_complete_positionGoalkeeper() },
    { value: 'defender', label: m.profile_complete_positionDefender() },
    { value: 'midfielder', label: m.profile_complete_positionMidfielder() },
    { value: 'forward', label: m.profile_complete_positionForward() },
  ];

  const proficiencyOptions = [
    { value: 'beginner', label: m.profile_complete_proficiencyBeginner() },
    { value: 'intermediate', label: m.profile_complete_proficiencyIntermediate() },
    { value: 'advanced', label: m.profile_complete_proficiencyAdvanced() },
    { value: 'pro', label: m.profile_complete_proficiencyPro() },
  ];

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);

      const payload = {
        name: name.trim(),
        birthYear: Number(birthYear),
        gender,
        position,
        proficiency,
        jerseyNumber: jerseyNumber !== '' ? Option.some(Number(jerseyNumber)) : Option.none(),
      };

      try {
        await ApiClient.pipe(
          Effect.flatMap((api) =>
            api.auth.completeProfile({
              payload: {
                ...payload,
                gender: payload.gender as 'male' | 'female' | 'other',
                position: payload.gender as 'goalkeeper' | 'defender' | 'midfielder' | 'forward',
                proficiency: payload.proficiency as
                  | 'beginner'
                  | 'intermediate'
                  | 'advanced'
                  | 'pro',
              },
            }),
          ),
          Effect.catchAll(() =>
            Effect.fail(new ClientError({ message: m.profile_complete_saveFailed() })),
          ),
          makeRun(),
        );
        navigate({ to: '/dashboard' });
      } catch (err) {
        setError(err instanceof ClientError ? err.message : m.profile_complete_saveFailed());
        setSubmitting(false);
      }
    },
    [name, birthYear, gender, jerseyNumber, position, proficiency, navigate, makeRun],
  );

  const isValid =
    name.trim().length > 0 &&
    birthYear !== '' &&
    gender !== '' &&
    position !== '' &&
    proficiency !== '';

  return (
    <div className='mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8'>
      <div className='mb-6 flex items-center justify-between'>
        <div>
          <h1 className='mb-2 text-2xl font-bold'>{m.profile_complete_title()}</h1>
          <p className='text-muted-foreground text-sm'>{m.profile_complete_subtitle()}</p>
        </div>
        <LanguageSwitcher isAuthenticated={!!user} />
      </div>

      {error && (
        <div className='bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm'>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='name'>{m.profile_complete_displayName()}</Label>
          <Input
            id='name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={m.profile_complete_displayNamePlaceholder()}
            required
          />
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='birthYear'>{m.profile_complete_birthYear()}</Label>
          <Select value={birthYear} onValueChange={setBirthYear}>
            <SelectTrigger id='birthYear' className='w-full'>
              <SelectValue placeholder={m.profile_complete_birthYearPlaceholder()} />
            </SelectTrigger>
            <SelectContent>
              {birthYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='gender'>{m.profile_complete_gender()}</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger id='gender' className='w-full'>
              <SelectValue placeholder={m.profile_complete_genderPlaceholder()} />
            </SelectTrigger>
            <SelectContent>
              {genderOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='jerseyNumber'>{m.profile_complete_jerseyNumber()}</Label>
          <Input
            id='jerseyNumber'
            type='number'
            min={0}
            max={99}
            value={jerseyNumber}
            onChange={(e) => setJerseyNumber(e.target.value)}
            placeholder={m.profile_complete_jerseyNumberPlaceholder()}
          />
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='position'>{m.profile_complete_position()}</Label>
          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger id='position' className='w-full'>
              <SelectValue placeholder={m.profile_complete_positionPlaceholder()} />
            </SelectTrigger>
            <SelectContent>
              {positionOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='proficiency'>{m.profile_complete_proficiency()}</Label>
          <Select value={proficiency} onValueChange={setProficiency}>
            <SelectTrigger id='proficiency' className='w-full'>
              <SelectValue placeholder={m.profile_complete_proficiencyPlaceholder()} />
            </SelectTrigger>
            <SelectContent>
              {proficiencyOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type='submit' disabled={!isValid || submitting} className='mt-2'>
          {submitting ? m.profile_complete_saving() : m.profile_complete_submit()}
        </Button>
      </form>
    </div>
  );
}
