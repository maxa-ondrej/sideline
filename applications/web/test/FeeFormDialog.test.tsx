// TDD mode — tests written BEFORE the FeeFormDialog component exists.
// These tests WILL FAIL until the developer implements:
//   - applications/web/src/components/organisms/FeeFormDialog.tsx
//
// Assumed component contract:
//   FeeFormDialog({
//     open: boolean,
//     mode: 'create' | 'edit',
//     fee?: FeeView,           // provided when mode='edit'
//     teamId: string,
//     onSubmit: (req: CreateFeeRequest | UpdateFeeRequest) => void,
//     onCancel: () => void,
//   })
//
// Form fields:
//   - name (text, required)
//   - amount (decimal input, required, >0; converted to minor on submit: 15.50 → 1550)
//   - currency (select, default 'CZK')
//   - dueAt (date, optional)
//   - targetScope (select, default 'all_members')
//
// Validation:
//   - amount=0 → blocked
//   - negative amount → blocked

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Option } from 'effect';
import { describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/translations.js', () => ({
  tr: (key: string) => {
    const map: Record<string, string> = {
      fee_form_title_create: 'Create Fee',
      fee_form_title_edit: 'Edit Fee',
      fee_form_name: 'Name',
      fee_form_description: 'Description',
      fee_form_descriptionPlaceholder: 'Optional note about this fee',
      fee_form_amount: 'Amount',
      fee_form_currency: 'Currency',
      fee_form_dueAt: 'Due date',
      fee_form_targetScope: 'Target',
      fee_form_targetScope_all_members: 'All members',
      fee_form_targetScope_manual: 'Manual',
      fee_form_submit_create: 'Create',
      fee_form_submit_edit: 'Save',
      fee_form_cancel: 'Cancel',
      fee_form_validation_amountRequired: 'Amount must be greater than 0',
      fee_form_validation_nameRequired: 'Name is required',
    };
    return map[key] ?? key;
  },
  setTranslationOverrides: vi.fn(),
}));

// Dynamic import — will fail until the component exists
const { FeeFormDialog } = await import('~/components/organisms/FeeFormDialog.js');

type FeeView = {
  feeId: string;
  teamId: string;
  name: string;
  description: any;
  amountMinor: number;
  currency: string;
  dueAt: any;
  targetScope: string;
  archivedAt: any;
  assignmentCount: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
};

const SAMPLE_FEE: FeeView = {
  feeId: 'fee-1',
  teamId: 'team-1',
  name: 'Existing Fee',
  description: Option.none(),
  amountMinor: 5000, // 50.00
  currency: 'CZK',
  dueAt: Option.none(),
  targetScope: 'all_members',
  archivedAt: Option.none(),
  assignmentCount: 0,
  paidCount: 0,
  pendingCount: 0,
  overdueCount: 0,
};

function renderCreateDialog(onSubmit = vi.fn(), onCancel = vi.fn()) {
  render(
    <FeeFormDialog
      open={true}
      mode='create'
      teamId='team-1'
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
  return { onSubmit, onCancel };
}

function renderEditDialog(fee = SAMPLE_FEE, onSubmit = vi.fn(), onCancel = vi.fn()) {
  render(
    <FeeFormDialog
      open={true}
      mode='edit'
      fee={fee}
      teamId='team-1'
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
  return { onSubmit, onCancel };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FeeFormDialog', () => {
  describe('validation', () => {
    it('submit blocked when amountMinor is 0 (blank amount field)', () => {
      const { onSubmit } = renderCreateDialog();
      // Fill in name but leave amount blank/zero
      fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Test Fee' } });
      // Try submitting without filling amount
      fireEvent.click(screen.getByRole('button', { name: /Create/i }));
      expect(onSubmit).not.toHaveBeenCalled();
      // Validation message should be shown
      expect(screen.getByText(/Amount must be greater than 0/i)).not.toBeNull();
    });

    it('submit blocked when amount is negative', () => {
      const { onSubmit } = renderCreateDialog();
      fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Test Fee' } });
      fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '-5' } });
      fireEvent.click(screen.getByRole('button', { name: /Create/i }));
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('decimal-to-minor conversion', () => {
    it('typing "15.50" submits amountMinor: 1550', async () => {
      const { onSubmit } = renderCreateDialog();
      fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Converted Fee' } });
      fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '15.50' } });
      fireEvent.click(screen.getByRole('button', { name: /Create/i }));
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        const callArg = onSubmit.mock.calls[0][0];
        expect(callArg.amountMinor).toBe(1550);
      });
    });

    it('typing "100" submits amountMinor: 10000', async () => {
      const { onSubmit } = renderCreateDialog();
      fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Round Fee' } });
      fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '100' } });
      fireEvent.click(screen.getByRole('button', { name: /Create/i }));
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        const callArg = onSubmit.mock.calls[0][0];
        expect(callArg.amountMinor).toBe(10000);
      });
    });
  });

  describe('edit mode', () => {
    it('pre-fills name from existing fee', () => {
      renderEditDialog();
      const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement;
      expect(nameInput.value).toBe('Existing Fee');
    });

    it('pre-fills amount from existing fee (5000 minor → 50.00)', () => {
      renderEditDialog();
      const amountInput = screen.getByLabelText(/Amount/i) as HTMLInputElement;
      // 5000 minor = 50.00
      expect(parseFloat(amountInput.value)).toBeCloseTo(50.0, 1);
    });

    it('shows "Save" button (not "Create") in edit mode', () => {
      renderEditDialog();
      expect(screen.getByRole('button', { name: /Save/i })).not.toBeNull();
      expect(screen.queryByRole('button', { name: /^Create$/i })).toBeNull();
    });
  });

  describe('optional fields', () => {
    it('submitting without dueAt sends dueAt as Option.none() equivalent (null)', async () => {
      const { onSubmit } = renderCreateDialog();
      fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'No Due Date Fee' } });
      fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '50' } });
      // Do NOT fill dueAt
      fireEvent.click(screen.getByRole('button', { name: /Create/i }));
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        const callArg = onSubmit.mock.calls[0][0];
        // dueAt should be absent/null/Option.none
        const dueAt = callArg.dueAt;
        expect(dueAt === null || dueAt === undefined || Option.isNone(dueAt)).toBe(true);
      });
    });
  });

  describe('defaults', () => {
    it('targetScope defaults to "all_members" on fresh form', () => {
      renderCreateDialog();
      // The "All members" option should be selected by default
      const scope = screen.getByText(/All members/i);
      expect(scope).not.toBeNull();
    });
  });

  describe('cancel', () => {
    it('Cancel button calls onCancel and does NOT call onSubmit', () => {
      const { onSubmit, onCancel } = renderCreateDialog();
      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(onCancel).toHaveBeenCalledOnce();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('description field', () => {
    it('renders description textarea', () => {
      renderCreateDialog();
      expect(screen.getByLabelText(/Description/i)).not.toBeNull();
    });

    it('prefills description in edit mode', () => {
      const feeWithDesc: FeeView = { ...SAMPLE_FEE, description: Option.some('My desc') };
      renderEditDialog(feeWithDesc);
      const textarea = screen.getByLabelText(/Description/i) as HTMLTextAreaElement;
      expect(textarea.value).toBe('My desc');
    });

    it('submits with description when populated', async () => {
      const { onSubmit } = renderCreateDialog();
      fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Fee With Desc' } });
      fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '10' } });
      fireEvent.change(screen.getByLabelText(/Description/i), {
        target: { value: 'A useful note' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Create/i }));
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        const callArg = onSubmit.mock.calls[0][0];
        expect(Option.isSome(callArg.description)).toBe(true);
        expect(Option.getOrElse(callArg.description, () => '')).toBe('A useful note');
      });
    });

    it('submits with Option.none() when description is empty', async () => {
      const { onSubmit } = renderCreateDialog();
      fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Fee No Desc' } });
      fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '20' } });
      // Leave description blank
      fireEvent.click(screen.getByRole('button', { name: /Create/i }));
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        const callArg = onSubmit.mock.calls[0][0];
        expect(Option.isNone(callArg.description)).toBe(true);
      });
    });
  });
});
