import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { MIN_AGE } from '@sideline/domain/api/Auth';
import { Effect, Option, Schema } from 'effect';
import { useForm } from 'react-hook-form';
import { ApiClient, ClientError, useRun } from '../../lib/runtime';
import * as m from '../../paraglide/messages.js';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const currentYear = new Date().getFullYear();
const maxBirthYear = currentYear - MIN_AGE;
const birthYears = Array.from({ length: maxBirthYear - 1900 + 1 }, (_, i) => maxBirthYear - i);

const genders = ['male', 'female', 'other'] as const;
const positions = ['goalkeeper', 'defender', 'midfielder', 'forward'] as const;
const proficiencies = ['beginner', 'intermediate', 'advanced', 'pro'] as const;

const ProfileFormSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  birthYear: Schema.NonEmptyString,
  gender: Schema.Literal(...genders),
  jerseyNumber: Schema.String,
  position: Schema.Literal(...positions),
  proficiency: Schema.Literal(...proficiencies),
});

type ProfileFormValues = Schema.Schema.Type<typeof ProfileFormSchema>;

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

interface ProfileCompleteFormProps {
  initialName: string;
  onSuccess: () => void;
}

export function ProfileCompleteForm({ initialName, onSuccess }: ProfileCompleteFormProps) {
  const run = useRun();

  const form = useForm<ProfileFormValues>({
    resolver: standardSchemaResolver(Schema.standardSchemaV1(ProfileFormSchema)),
    defaultValues: {
      name: initialName,
      jerseyNumber: '',
    },
  });

  const onSubmit = async (values: ProfileFormValues) => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.auth.completeProfile({
          payload: {
            name: values.name,
            birthYear: Number(values.birthYear),
            gender: values.gender,
            position: values.position,
            proficiency: values.proficiency,
            jerseyNumber:
              values.jerseyNumber !== '' ? Option.some(Number(values.jerseyNumber)) : Option.none(),
          },
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
          control={form.control}
          name='name'
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
          control={form.control}
          name='birthYear'
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
          control={form.control}
          name='gender'
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

        <FormField
          control={form.control}
          name='jerseyNumber'
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
          control={form.control}
          name='position'
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
          control={form.control}
          name='proficiency'
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
          {form.formState.isSubmitting ? m.profile_complete_saving() : m.profile_complete_submit()}
        </Button>
      </form>
    </Form>
  );
}
