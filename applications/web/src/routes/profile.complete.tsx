import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Effect } from 'effect';
import React from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ApiClient, ClientError, runPromise } from '../lib/runtime';

export const Route = createFileRoute('/profile/complete')({
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
const birthYears = Array.from({ length: currentYear - 1900 - 5 }, (_, i) => currentYear - 6 - i);

const genderOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const;

const positionOptions = [
  { value: 'goalkeeper', label: 'Goalkeeper' },
  { value: 'defender', label: 'Defender' },
  { value: 'midfielder', label: 'Midfielder' },
  { value: 'forward', label: 'Forward' },
] as const;

const proficiencyOptions = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'pro', label: 'Pro' },
] as const;

function ProfileComplete() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const [name, setName] = React.useState(user?.username ?? '');
  const [birthYear, setBirthYear] = React.useState('');
  const [gender, setGender] = React.useState('');
  const [jerseyNumber, setJerseyNumber] = React.useState('');
  const [position, setPosition] = React.useState('');
  const [proficiency, setProficiency] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);

      const payload: Record<string, unknown> = {
        name: name.trim(),
        birthYear: Number(birthYear),
        gender,
        position,
        proficiency,
      };
      if (jerseyNumber !== '') {
        payload.jerseyNumber = Number(jerseyNumber);
      }

      try {
        await ApiClient.pipe(
          Effect.flatMap((api) => api.auth.completeProfile({ payload: payload as any })),
          Effect.catchAll(() =>
            Effect.fail(new ClientError({ message: 'Failed to save profile.' })),
          ),
          runPromise(),
        );
        navigate({ to: '/dashboard' });
      } catch (err) {
        setError(err instanceof ClientError ? err.message : 'Failed to save profile.');
        setSubmitting(false);
      }
    },
    [name, birthYear, gender, jerseyNumber, position, proficiency, navigate],
  );

  const isValid =
    name.trim().length > 0 &&
    birthYear !== '' &&
    gender !== '' &&
    position !== '' &&
    proficiency !== '';

  return (
    <div className='mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8'>
      <h1 className='mb-2 text-2xl font-bold'>Complete Your Profile</h1>
      <p className='text-muted-foreground mb-6 text-sm'>Fill in your details to get started.</p>

      {error && (
        <div className='bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm'>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='name'>Display Name</Label>
          <Input
            id='name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Your name'
            required
          />
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='birthYear'>Birth Year</Label>
          <Select value={birthYear} onValueChange={setBirthYear}>
            <SelectTrigger id='birthYear' className='w-full'>
              <SelectValue placeholder='Select year' />
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
          <Label htmlFor='gender'>Gender</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger id='gender' className='w-full'>
              <SelectValue placeholder='Select gender' />
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
          <Label htmlFor='jerseyNumber'>Jersey Number (optional)</Label>
          <Input
            id='jerseyNumber'
            type='number'
            min={0}
            max={99}
            value={jerseyNumber}
            onChange={(e) => setJerseyNumber(e.target.value)}
            placeholder='0-99'
          />
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='position'>Position</Label>
          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger id='position' className='w-full'>
              <SelectValue placeholder='Select position' />
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
          <Label htmlFor='proficiency'>Skill Level</Label>
          <Select value={proficiency} onValueChange={setProficiency}>
            <SelectTrigger id='proficiency' className='w-full'>
              <SelectValue placeholder='Select skill level' />
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
          {submitting ? 'Saving...' : 'Complete Profile'}
        </Button>
      </form>
    </div>
  );
}
