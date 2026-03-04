import { format, parse } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Calendar } from '~/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { cn } from '~/lib/utils';

interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  fromYear?: number;
  toYear?: number;
}

function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  fromYear,
  toYear,
}: DatePickerProps) {
  const selected = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          disabled={disabled}
          className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}
        >
          <CalendarIcon className='mr-2 size-4' />
          {selected ? format(selected, 'PPP') : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <Calendar
          mode='single'
          selected={selected}
          onSelect={(date) => {
            if (date) {
              onChange(format(date, 'yyyy-MM-dd'));
            }
          }}
          captionLayout={fromYear || toYear ? 'dropdown' : 'label'}
          startMonth={fromYear ? new Date(fromYear, 0) : undefined}
          endMonth={toYear ? new Date(toYear, 11) : undefined}
          defaultMonth={selected}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
