import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { Auth } from '@sideline/domain';
import { Link } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { LanguageSwitcher } from '~/components/organisms/LanguageSwitcher';
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
import { ApiClient, ClientError, useRun } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

const currentYear = new Date().getFullYear();
const maxBirthYear = currentYear - Auth.MIN_AGE;
const birthYears = Array.from({ length: maxBirthYear - 1900 + 1 }, (_, i) => maxBirthYear - i);

const NONE_VALUE = '__none__';

const ProfileEditSchema = Schema.Struct({
  name: Schema.String,
  birthYear: Schema.Union(Schema.NumberFromString, Schema.Literal(NONE_VALUE)),
  gender: Schema.Union(Schema.Literal('male', 'female', 'other'), Schema.Literal(NONE_VALUE)),
  jerseyNumber: Schema.Union(Schema.NumberFromString, Schema.Literal('')),
  position: Schema.Union(
    Schema.Literal('goalkeeper', 'defender', 'midfielder', 'forward'),
    Schema.Literal(NONE_VALUE),
  ),
  proficiency: Schema.Union(
    Schema.Literal('beginner', 'intermediate', 'advanced', 'pro'),
    Schema.Literal(NONE_VALUE),
  ),
});

type ProfileEditValues = Schema.Schema.Type<typeof ProfileEditSchema>;
type ProfileEditEncoded = Schema.Schema.Encoded<typeof ProfileEditSchema>;

const genderOptions = [
  { value: 'male', label: () => m.profile_complete_genderMale() },
  { value: 'female', label: () => m.profile_complete_genderFemale() },
  { value: 'other', label: () => m.profile_complete_genderOther() },
] as const;

const positionOptions = [
  { value: 'goalkeeper', label: () => m.profile_complete_positionGoalkeeper() },
  { value: 'defender', label: () => m.profile_complete_positionDefender() },
  { value: 'midfielder', label: () => m.profile_complete_positionMidfielder() },
  { value: 'forward', label: () => m.profile_complete_positionForward() },
] as const;

const proficiencyOptions = [
  { value: 'beginner', label: () => m.profile_complete_proficiencyBeginner() },
  { value: 'intermediate', label: () => m.profile_complete_proficiencyIntermediate() },
  { value: 'advanced', label: () => m.profile_complete_proficiencyAdvanced() },
  { value: 'pro', label: () => m.profile_complete_proficiencyPro() },
] as const;

function discordAvatarUrl(discordId: string, avatar: string): string {
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=128`;
}

interface MyProfilePageProps {
  user: Auth.CurrentUser;
  onUpdated: () => void;
}

export function MyProfilePage({ user, onUpdated }: MyProfilePageProps) {
  const run = useRun();

  const defaultValues: ProfileEditEncoded = {
    name: user.name ?? '',
    birthYear: user.birthYear != null ? String(user.birthYear) : NONE_VALUE,
    gender: user.gender ?? NONE_VALUE,
    jerseyNumber: user.jerseyNumber != null ? String(user.jerseyNumber) : '',
    position: user.position ?? NONE_VALUE,
    proficiency: user.proficiency ?? NONE_VALUE,
  };

  const form = useForm({
    resolver: effectTsResolver(ProfileEditSchema),
    mode: 'onChange',
    defaultValues,
  });

  const onSubmit = async (values: ProfileEditValues) => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.auth.updateProfile({
          payload: {
            name: values.name || null,
            birthYear: typeof values.birthYear === 'number' ? values.birthYear : null,
            gender: values.gender === NONE_VALUE ? null : values.gender,
            jerseyNumber: typeof values.jerseyNumber === 'number' ? values.jerseyNumber : null,
            position: values.position === NONE_VALUE ? null : values.position,
            proficiency: values.proficiency === NONE_VALUE ? null : values.proficiency,
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.profile_updateFailed())),
      run,
    );
    if (Option.isSome(result)) {
      toast.success(m.profile_saveSuccess());
      onUpdated();
    }
  };

  const initials = (user.name ?? user.discordUsername).slice(0, 2).toUpperCase();

  return (
    <div className='mx-auto max-w-md px-4 py-8'>
      <div className='mb-6 flex items-center justify-between'>
        <Button asChild variant='ghost' size='sm'>
          <Link to='/dashboard'>{m.profile_backToDashboard()}</Link>
        </Button>
        <LanguageSwitcher isAuthenticated />
      </div>

      <div className='mb-6 flex items-center gap-4'>
        {user.discordAvatar ? (
          <img
            src={discordAvatarUrl(user.discordId, user.discordAvatar)}
            alt={m.profile_discordAvatar()}
            className='h-16 w-16 rounded-full'
          />
        ) : (
          <div className='bg-muted flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold'>
            {initials}
          </div>
        )}
        <div>
          <h1 className='text-2xl font-bold'>{m.profile_title()}</h1>
          <p className='text-muted-foreground text-sm'>@{user.discordUsername}</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='flex flex-col gap-4'>
          <FormField
            {...form.register('name')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.profile_complete_displayName()}</FormLabel>
                <FormControl>
                  <Input placeholder={m.profile_complete_displayNamePlaceholder()} {...field} />
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
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder={m.profile_complete_birthYearPlaceholder()} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>—</SelectItem>
                    {birthYears.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            {...form.register('gender')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.profile_complete_gender()}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder={m.profile_complete_genderPlaceholder()} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>—</SelectItem>
                    {genderOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label()}
                      </SelectItem>
                    ))}
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
                    type='number'
                    min={0}
                    max={99}
                    placeholder={m.profile_complete_jerseyNumberPlaceholder()}
                    {...field}
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
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder={m.profile_complete_positionPlaceholder()} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>—</SelectItem>
                    {positionOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label()}
                      </SelectItem>
                    ))}
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
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder={m.profile_complete_proficiencyPlaceholder()} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>—</SelectItem>
                    {proficiencyOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type='submit' disabled={form.formState.isSubmitting} className='mt-2'>
            {form.formState.isSubmitting ? m.profile_saving() : m.profile_saveChanges()}
          </Button>
        </form>
      </Form>
    </div>
  );
}
