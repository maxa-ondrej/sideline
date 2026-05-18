import { fireEvent, render, screen } from '@testing-library/react';
import { DateTime } from 'effect';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Radix UI Select uses scrollIntoView which is not implemented in JSDOM.
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

// ---------------------------------------------------------------------------
// Module mocks — before any imports using them
// ---------------------------------------------------------------------------

vi.mock('~/lib/translations.js', () => ({
  tr: (key: string) => {
    const map: Record<string, string> = {
      expense_form_title_create: 'Add Expense',
      expense_form_title_edit: 'Edit Expense',
      expense_form_amount: 'Amount',
      expense_form_currency: 'Currency',
      expense_form_date: 'Date',
      expense_form_category: 'Category',
      expense_form_description: 'Description',
      expense_form_submit_create: 'Add Expense',
      expense_form_submit_edit: 'Save Changes',
      expense_form_cancel: 'Cancel',
      expense_form_validation_amountRequired: 'Amount must be positive',
      expense_form_validation_descriptionTooLong: 'Description too long (max 500 chars)',
      expense_form_warning_futureDate: 'Expense date is in the future',
      expense_category_fields: 'Fields',
      expense_category_equipment: 'Equipment',
      expense_category_travel: 'Travel',
      expense_category_tournaments: 'Tournaments',
      expense_category_other: 'Other',
    };
    return map[key] ?? key;
  },
  setTranslationOverrides: vi.fn(),
}));

vi.mock('~/lib/finance/formatMoney.js', () => ({
  formatMoney: (minor: number, currency: string) => `${minor / 100} ${currency}`,
}));

vi.mock('~/lib/finance/parseAmount.js', () => ({
  parseAmount: (value: string, _currency?: string) => {
    const parsed = Number(value.trim());
    if (Number.isNaN(parsed) || parsed <= 0) throw new Error('Amount must be greater than 0');
    return Math.round(parsed * 100);
  },
}));

// ---------------------------------------------------------------------------
// Dynamic imports (after mocks)
// ---------------------------------------------------------------------------

const { ExpenseFormDialog } = await import('~/components/organisms/ExpenseFormDialog.js');

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

type ExpenseCategory = 'fields' | 'equipment' | 'travel' | 'tournaments' | 'other';

type ExpenseView = {
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

type CreateExpenseRequest = {
  amountMinor: number;
  currency: string;
  spentAt: DateTime.Utc;
  category: ExpenseCategory;
  description: string;
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SPENT_AT = DateTime.fromDateUnsafe(new Date('2025-05-01T12:00:00Z'));

function makeExpense(overrides: Partial<ExpenseView> = {}): ExpenseView {
  return {
    expenseId: 'exp-1',
    teamId: 'team-1',
    amountMinor: 1050,
    currency: 'CZK',
    spentAt: SPENT_AT,
    category: 'travel',
    description: 'Test expense',
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    createdAt: SPENT_AT,
    updatedAt: SPENT_AT,
    ...overrides,
  };
}

const TEAM_ID = 'team-1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCreate(onSubmit = vi.fn(), onCancel = vi.fn()) {
  return render(
    <ExpenseFormDialog
      open={true}
      mode='create'
      teamId={TEAM_ID}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
}

function renderEdit(expense: ExpenseView, onSubmit = vi.fn(), onCancel = vi.fn()) {
  return render(
    <ExpenseFormDialog
      open={true}
      mode='edit'
      expense={expense}
      teamId={TEAM_ID}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExpenseFormDialog', () => {
  it('renders all required fields: amount, currency, date, category, description', () => {
    renderCreate();

    // Amount field
    const amountLabel = screen.queryByText('Amount') ?? screen.queryByLabelText(/amount/i);
    expect(amountLabel).not.toBeNull();

    // Currency field
    const currencyLabel = screen.queryByText('Currency') ?? screen.queryByLabelText(/currency/i);
    expect(currencyLabel).not.toBeNull();

    // Date field
    const dateLabel = screen.queryByText('Date') ?? screen.queryByLabelText(/date/i);
    expect(dateLabel).not.toBeNull();

    // Category field
    const categoryLabel = screen.queryByText('Category') ?? screen.queryByLabelText(/category/i);
    expect(categoryLabel).not.toBeNull();

    // Description field
    const descriptionLabel =
      screen.queryByText('Description') ?? screen.queryByLabelText(/description/i);
    expect(descriptionLabel).not.toBeNull();
  });

  it('submitting with amount "10.50" calls onSubmit with amountMinor 1050', () => {
    const onSubmit = vi.fn();
    renderCreate(onSubmit);

    const amountInput = document.querySelector('input[type="number"]') as HTMLInputElement | null;
    expect(amountInput).not.toBeNull();
    fireEvent.change(amountInput!, { target: { value: '10.50' } });

    // Submit the form
    const submitBtn = screen.getByText('Add Expense');
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledOnce();
    const arg = onSubmit.mock.calls[0][0] as CreateExpenseRequest;
    expect(arg.amountMinor).toBe(1050);
  });

  it('submitting with amount "0" shows inline validation error; onSubmit NOT called', () => {
    const onSubmit = vi.fn();
    renderCreate(onSubmit);

    const amountInput = document.querySelector('input[type="number"]') as HTMLInputElement | null;
    fireEvent.change(amountInput!, { target: { value: '0' } });

    const submitBtn = screen.getByText('Add Expense');
    fireEvent.click(submitBtn);

    expect(onSubmit).not.toHaveBeenCalled();

    // An inline validation error should appear
    const pageText = document.body.textContent ?? '';
    expect(pageText).toMatch(/amount must be positive|Amount must be/i);
  });

  it('submitting with description > 500 chars shows validation error; onSubmit NOT called', () => {
    const onSubmit = vi.fn();
    renderCreate(onSubmit);

    const textarea = document.querySelector('textarea');
    expect(textarea).not.toBeNull();
    fireEvent.change(textarea!, { target: { value: 'a'.repeat(501) } });

    // Set a valid amount to avoid that error
    const amountInput = document.querySelector('input[type="number"]') as HTMLInputElement | null;
    fireEvent.change(amountInput!, { target: { value: '10' } });

    const submitBtn = screen.getByText('Add Expense');
    fireEvent.click(submitBtn);

    expect(onSubmit).not.toHaveBeenCalled();

    // An inline validation error should appear
    const pageText = document.body.textContent ?? '';
    expect(pageText).toMatch(/too long|max 500/i);
  });

  it('category select shows all 5 expense categories when opened', () => {
    renderCreate();

    // Open the category Shadcn Select by clicking its trigger button.
    // The trigger displays the current value label (default: "Other").
    const categoryTrigger = screen.getByRole('combobox', { name: /category/i });
    expect(categoryTrigger).not.toBeNull();
    fireEvent.click(categoryTrigger);

    // After opening, all options should be rendered in the portal.
    const pageText = document.body.textContent ?? '';
    expect(pageText).toContain('Fields');
    expect(pageText).toContain('Equipment');
    expect(pageText).toContain('Travel');
    expect(pageText).toContain('Tournaments');
    expect(pageText).toContain('Other');
  });

  it('in edit mode, fields are pre-populated from the provided expense', () => {
    const expense = makeExpense({
      amountMinor: 2500,
      currency: 'EUR',
      category: 'equipment',
      description: 'Pre-filled description',
    });

    renderEdit(expense);

    // Amount should be pre-filled (2500 minor = 25.00)
    const amountInput = document.querySelector('input[type="number"]') as HTMLInputElement | null;
    expect(amountInput?.value).toBeTruthy();
    // Either raw minor value or formatted decimal — check it's not empty
    const pageText = document.body.textContent ?? '';
    expect(pageText).toContain('Pre-filled description');
    expect(pageText).toContain('EUR');
  });

  it('future-dated spent_at shows a soft warning but submit button stays enabled', () => {
    const onSubmit = vi.fn();
    renderCreate(onSubmit);

    // Set a future date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const futureDateStr = futureDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement | null;
    if (dateInput) {
      fireEvent.change(dateInput, { target: { value: futureDateStr } });
    }

    // Submit button should still be enabled / present
    const submitBtn = screen.getByText('Add Expense');
    expect(submitBtn).not.toBeNull();
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);

    // Warning text should appear in the DOM
    const pageText = document.body.textContent ?? '';
    expect(pageText).toMatch(/future/i);
  });

  it('cancel button calls onCancel without submitting', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    renderCreate(onSubmit, onCancel);

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
