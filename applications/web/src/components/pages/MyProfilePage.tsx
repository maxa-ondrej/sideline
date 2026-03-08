import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { Auth } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { Effect, Option, Schema } from 'effect';
import { useForm } from 'react-hook-form';

import { Button } from '~/components/ui/button';
import { DatePicker } from '~/components/ui/date-picker';
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

const currentYear = new Date().getFullYear();
const maxBirthYear = currentYear - Auth.MIN_AGE;

const NONE_VALUE = '__none__';

const ProfileEditSchema = Schema.Struct({
  name: Schema.String,
  birthDate: Schema.String,
  gender: Schema.Union(
    Schema.Literal('male', 'female', 'other'),
    Schema.Literal(NONE_VALUE),
  ).annotations({ message: () => m.validation_invalidOption() }),
});

type ProfileEditValues = Schema.Schema.Type<typeof ProfileEditSchema>;

const genderOptions = [
  { value: 'male', label: () => m.profile_complete_genderMale() },
  { value: 'female', label: () => m.profile_complete_genderFemale() },
  { value: 'other', label: () => m.profile_complete_genderOther() },
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

  const defaultValues: ProfileEditValues = {
    name: user.name ?? '',
    birthDate: user.birthDate ?? '',
    gender: user.gender ?? NONE_VALUE,
  };

  const form = useForm<ProfileEditValues>({
    resolver: effectTsResolver(ProfileEditSchema),
    mode: 'onChange',
    defaultValues,
  });

  const onSubmit = async (values: ProfileEditValues) => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.auth.updateProfile({
          payload: {
            name: values.name,
            birthDate: values.birthDate ? Option.some(values.birthDate) : Option.none(),
            gender: values.gender === NONE_VALUE ? null : values.gender,
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.profile_updateFailed())),
      run({ success: m.profile_saveSuccess() }),
    );
    if (Option.isSome(result)) {
      onUpdated();
    }
  };

  const initials = (user.name ?? user.username).slice(0, 2).toUpperCase();

  return (
    <div>
      <header className='mb-8'>
        <div className='flex items-center gap-4'>
          {user.avatar ? (
            <img
              src={discordAvatarUrl(user.discordId, user.avatar)}
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
            <p className='text-muted-foreground text-sm'>@{user.username}</p>
          </div>
        </div>
      </header>

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
            {...form.register('birthDate')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{m.profile_complete_birthDate()}</FormLabel>
                <FormControl>
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={m.profile_complete_birthDatePlaceholder()}
                    fromYear={1900}
                    toYear={maxBirthYear}
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

          <Button type='submit' disabled={form.formState.isSubmitting} className='mt-2'>
            {form.formState.isSubmitting ? m.profile_saving() : m.profile_saveChanges()}
          </Button>
        </form>
      </Form>
    </div>
  );
}
