import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { Auth } from '@sideline/domain';
import { Effect, Option, Schema } from 'effect';
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
import { ApiClient, ClientError, useRun } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

const currentYear = new Date().getFullYear();
const maxBirthYear = currentYear - Auth.MIN_AGE;
const birthYears = Array.from({ length: maxBirthYear - 1900 + 1 }, (_, i) => maxBirthYear - i);

const ProfileFormSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  birthYear: Schema.NumberFromString,
  gender: Schema.Literal('male', 'female', 'other'),
});

type ProfileFormValues = Schema.Schema.Type<typeof ProfileFormSchema>;

const genderOptions = [
  { value: 'male', label: () => m.profile_complete_genderMale() },
  { value: 'female', label: () => m.profile_complete_genderFemale() },
  { value: 'other', label: () => m.profile_complete_genderOther() },
] as const;

interface ProfileCompleteFormProps {
  initialName: string;
  onSuccess: () => void;
}

export function ProfileCompleteForm({ initialName, onSuccess }: ProfileCompleteFormProps) {
  const run = useRun();

  const form = useForm({
    resolver: effectTsResolver(ProfileFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: initialName,
    },
  });

  const onSubmit = async (values: ProfileFormValues) => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.auth.completeProfile({
          payload: values,
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.profile_complete_saveFailed())),
      run,
    );
    if (Option.isSome(result)) {
      onSuccess();
    }
  };

  return (
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
          {form.formState.isSubmitting ? m.profile_complete_saving() : m.profile_complete_submit()}
        </Button>
      </form>
    </Form>
  );
}
