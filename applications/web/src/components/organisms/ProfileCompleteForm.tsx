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
const defaultBirthMonth = new Date(currentYear - Auth.DEFAULT_BIRTH_YEAR_OFFSET, 0);

const ProfileFormSchema = Schema.Struct({
  name: Schema.NonEmptyString.annotations({ message: () => m.validation_required() }),
  birthDate: Schema.NonEmptyString.annotations({ message: () => m.validation_required() }).pipe(
    Schema.check((s) => {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return m.validation_required();
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - Auth.MIN_AGE);
      if (d > minDate) return m.validation_minAge({ minAge: Auth.MIN_AGE });
      return true;
    }),
  ),
  gender: Schema.Literals(['male', 'female', 'other']).annotations({
    message: () => m.validation_invalidOption(),
  }),
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
      birthDate: '',
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
      run({ success: m.profile_profileCompleted() }),
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
                  defaultMonth={defaultBirthMonth}
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
