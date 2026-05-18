import { Expense, type ExpenseApi } from '@sideline/domain';
import { type DateTime, Option, Schema } from 'effect';
import React from 'react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { dateOnlyToUtc, formatLocalDate } from '~/lib/datetime.js';
import { parseAmount } from '~/lib/finance/parseAmount.js';
import { tr } from '~/lib/translations.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExpenseCategory = Expense.ExpenseCategory;

export type ExpenseView = {
  expenseId: string;
  teamId: string;
  amountMinor: number;
  currency: string;
  spentAt: DateTime.Utc;
  category: ExpenseCategory;
  description: string;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: DateTime.Utc;
  updatedAt: DateTime.Utc;
};

type ExpenseFormDialogProps =
  | {
      open: boolean;
      mode: 'create';
      expense?: undefined;
      teamId: string;
      onSubmit: (req: ExpenseApi.CreateExpenseRequest) => void;
      onCancel: () => void;
    }
  | {
      open: boolean;
      mode: 'edit';
      expense?: ExpenseView;
      teamId: string;
      onSubmit: (req: ExpenseApi.UpdateExpenseRequest) => void;
      onCancel: () => void;
    };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: ReadonlyArray<{ value: ExpenseCategory; labelKey: string }> = [
  { value: 'fields', labelKey: 'expense_category_fields' },
  { value: 'equipment', labelKey: 'expense_category_equipment' },
  { value: 'travel', labelKey: 'expense_category_travel' },
  { value: 'tournaments', labelKey: 'expense_category_tournaments' },
  { value: 'other', labelKey: 'expense_category_other' },
];

const isExpenseCategory = (value: string): value is ExpenseCategory =>
  CATEGORIES.some((c) => c.value === value);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExpenseFormDialog(props: ExpenseFormDialogProps) {
  const { open, mode, expense, onCancel } = props;
  const isEdit = mode === 'edit';

  const [amountStr, setAmountStr] = React.useState(
    isEdit && expense ? String(expense.amountMinor / 100) : '',
  );
  const [currency, setCurrency] = React.useState(isEdit && expense ? expense.currency : 'CZK');
  const [spentAt, setSpentAt] = React.useState(
    isEdit && expense ? formatLocalDate(expense.spentAt) : '',
  );
  const [category, setCategory] = React.useState<ExpenseCategory>(
    isEdit && expense ? expense.category : 'other',
  );
  const [description, setDescription] = React.useState(
    isEdit && expense ? expense.description : '',
  );
  const [amountError, setAmountError] = React.useState('');
  const [descriptionError, setDescriptionError] = React.useState('');

  // Reset when dialog opens/closes or mode changes
  React.useEffect(() => {
    if (open) {
      setAmountStr(isEdit && expense ? String(expense.amountMinor / 100) : '');
      setCurrency(isEdit && expense ? expense.currency : 'CZK');
      setSpentAt(isEdit && expense ? formatLocalDate(expense.spentAt) : '');
      setCategory(isEdit && expense ? expense.category : 'other');
      setDescription(isEdit && expense ? expense.description : '');
      setAmountError('');
      setDescriptionError('');
    }
  }, [open, isEdit, expense]);

  // Check if spentAt is in the future.
  // Both sides use local midnight to avoid a false positive when the user picks
  // "today" in a timezone west of UTC (where new Date("YYYY-MM-DD") → UTC midnight
  // which is still "tomorrow" locally late in the evening).
  const isFutureDate = React.useMemo(() => {
    if (!spentAt) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(`${spentAt}T00:00:00`);
    return selected > today;
  }, [spentAt]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    let hasError = false;

    let amountMinor = 0;
    try {
      amountMinor = parseAmount(amountStr, currency);
      setAmountError('');
    } catch {
      setAmountError(tr('expense_form_validation_amountRequired'));
      hasError = true;
    }

    if (description.length > 500) {
      setDescriptionError(tr('expense_form_validation_descriptionTooLong'));
      hasError = true;
    } else {
      setDescriptionError('');
    }

    if (hasError) return;

    const spentAtUtc = spentAt
      ? dateOnlyToUtc(spentAt)
      : dateOnlyToUtc(new Date().toISOString().split('T')[0]);

    if (props.mode === 'edit') {
      props.onSubmit({
        amountMinor: Option.some(Schema.decodeSync(Expense.AmountMinor)(amountMinor)),
        currency: Option.some(Schema.decodeSync(Expense.CurrencyCode)(currency)),
        spentAt: Option.some(spentAtUtc),
        category: Option.some(category),
        description: Option.some(description.trim()),
      });
    } else {
      props.onSubmit({
        amountMinor: Schema.decodeSync(Expense.AmountMinor)(amountMinor),
        currency: Schema.decodeSync(Expense.CurrencyCode)(currency),
        spentAt: spentAtUtc,
        category,
        description: description.trim(),
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onCancel();
      }}
    >
      <DialogContent
        aria-label={isEdit ? tr('expense_form_title_edit') : tr('expense_form_title_create')}
        aria-describedby={undefined}
      >
        <div className='flex flex-col gap-4'>
          {/* Amount + Currency row */}
          <div className='flex gap-3'>
            <div className='flex flex-1 flex-col gap-1.5'>
              <Label htmlFor='expense-amount'>{tr('expense_form_amount')}</Label>
              <Input
                id='expense-amount'
                type='number'
                step='0.01'
                min='0.01'
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder='0.00'
              />
              {amountError && <p className='text-sm text-destructive'>{amountError}</p>}
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='expense-currency'>{tr('expense_form_currency')}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id='expense-currency' className='w-24'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='CZK'>CZK</SelectItem>
                  <SelectItem value='EUR'>EUR</SelectItem>
                  <SelectItem value='USD'>USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date */}
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='expense-spentAt'>{tr('expense_form_date')}</Label>
            <Input
              id='expense-spentAt'
              type='date'
              value={spentAt}
              onChange={(e) => setSpentAt(e.target.value)}
            />
            {isFutureDate && (
              <p className='text-sm text-amber-600'>{tr('expense_form_warning_futureDate')}</p>
            )}
          </div>

          {/* Category */}
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='expense-category'>{tr('expense_form_category')}</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                if (isExpenseCategory(v)) setCategory(v);
              }}
            >
              <SelectTrigger id='expense-category'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {tr(c.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='expense-description'>{tr('expense_form_description')}</Label>
            <Textarea
              id='expense-description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr('expense_form_descriptionPlaceholder')}
              maxLength={500}
            />
            {descriptionError && <p className='text-sm text-destructive'>{descriptionError}</p>}
          </div>

          <DialogFooter>
            <Button type='button' variant='outline' onClick={onCancel}>
              {tr('expense_form_cancel')}
            </Button>
            <Button type='button' onClick={() => handleSubmit()}>
              {isEdit ? tr('expense_form_submit_edit') : tr('expense_form_submit_create')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
