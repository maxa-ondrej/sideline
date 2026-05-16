// TDD mode — tests written BEFORE the RecordPaymentDialog component exists.
// These tests WILL FAIL until the developer implements:
//   - applications/web/src/components/organisms/RecordPaymentDialog.tsx
//
// Assumed component contract:
//   RecordPaymentDialog({
//     open: boolean,
//     assignmentId: string,
//     feeId: string,
//     teamId: string,
//     memberName?: string,        // displayed for context
//     dueMinor: number,           // shown as hint
//     currency: string,
//     onSubmit: (req: RecordPaymentRequest) => void,
//     onCancel: () => void,
//   })
//
// Form fields:
//   - amount (decimal, required, >0)
//   - method (radio: 'cash' | 'bank_transfer')
//   - paidAt (date, required — defaults to today/now)
//   - note (textarea, optional)

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/translations.js', () => ({
  tr: (key: string) => {
    const map: Record<string, string> = {
      payment_record_title: 'Record Payment',
      payment_record_amount: 'Amount',
      payment_record_method: 'Payment method',
      payment_record_method_cash: 'Cash',
      payment_record_method_bank_transfer: 'Bank transfer',
      payment_record_paidAt: 'Date paid',
      payment_record_note: 'Note (optional)',
      payment_record_submit: 'Record',
      payment_record_cancel: 'Cancel',
      payment_record_validation_amountRequired: 'Amount must be greater than 0',
    };
    return map[key] ?? key;
  },
  setTranslationOverrides: vi.fn(),
}));

// Dynamic import — will fail until the component exists
const { RecordPaymentDialog } = await import('~/components/organisms/RecordPaymentDialog.js');

function renderDialog(
  overrides: Record<string, unknown> = {},
  onSubmit = vi.fn(),
  onCancel = vi.fn(),
) {
  render(
    <RecordPaymentDialog
      open={true}
      assignmentId='assignment-1'
      feeId='fee-1'
      teamId='team-1'
      memberName='Alice'
      dueMinor={10000}
      currency='CZK'
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onSubmit, onCancel };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecordPaymentDialog', () => {
  describe('initial state', () => {
    it("paidAt input is pre-populated with today's date", () => {
      renderDialog();
      const paidAtInput = screen.getByLabelText(/Date paid/i) as HTMLInputElement;
      // Should be non-empty — we don't assert the exact value to avoid timezone flakiness
      expect(paidAtInput.value).not.toBe('');
    });

    it('renders "Cash" and "Bank transfer" radio options', () => {
      renderDialog();
      expect(screen.getByLabelText(/Cash/i)).not.toBeNull();
      expect(screen.getByLabelText(/Bank transfer/i)).not.toBeNull();
    });

    it('renders "Note (optional)" textarea', () => {
      renderDialog();
      expect(screen.getByLabelText(/Note \(optional\)/i)).not.toBeNull();
    });
  });

  describe('validation', () => {
    it('submit blocked when amount is 0', () => {
      const { onSubmit } = renderDialog();
      const amountInput = screen.getByLabelText(/Amount/i);
      // Ensure it's blank/0
      fireEvent.change(amountInput, { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /^Record$/i }));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText(/Amount must be greater than 0/i)).not.toBeNull();
    });
  });

  describe('amount conversion', () => {
    it('typing "25.00" submits amountMinor: 2500', async () => {
      const { onSubmit } = renderDialog();
      fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '25.00' } });
      fireEvent.click(screen.getByRole('button', { name: /^Record$/i }));
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        const callArg = onSubmit.mock.calls[0][0];
        expect(callArg.amountMinor).toBe(2500);
      });
    });

    it('typing "10" submits amountMinor: 1000', async () => {
      const { onSubmit } = renderDialog();
      fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '10' } });
      fireEvent.click(screen.getByRole('button', { name: /^Record$/i }));
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        const callArg = onSubmit.mock.calls[0][0];
        expect(callArg.amountMinor).toBe(1000);
      });
    });
  });

  describe('optional note', () => {
    it('submitting with empty note is allowed (note sent as null/none)', async () => {
      const { onSubmit } = renderDialog();
      fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '50' } });
      fireEvent.click(screen.getByRole('button', { name: /^Record$/i }));
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        // No assertion about note value — the test just confirms it didn't block
      });
    });
  });

  describe('method selection', () => {
    it('can select "Bank transfer" method', async () => {
      const { onSubmit } = renderDialog();
      fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '50' } });
      fireEvent.click(screen.getByLabelText(/Bank transfer/i));
      fireEvent.click(screen.getByRole('button', { name: /^Record$/i }));
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        const callArg = onSubmit.mock.calls[0][0];
        expect(callArg.method).toBe('bank_transfer');
      });
    });
  });

  describe('cancel', () => {
    it('Cancel button calls onCancel and does NOT call onSubmit', () => {
      const { onSubmit, onCancel } = renderDialog();
      fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
      expect(onCancel).toHaveBeenCalledOnce();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
