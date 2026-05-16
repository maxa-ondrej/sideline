// TDD mode — tests written BEFORE the WaiveAssignmentDialog component exists.
// These tests WILL FAIL until the developer implements:
//   - applications/web/src/components/organisms/WaiveAssignmentDialog.tsx
//
// Assumed component contract:
//   WaiveAssignmentDialog({
//     open: boolean,
//     assignmentId: string,
//     feeId: string,
//     teamId: string,
//     memberName?: string,        // displayed for context
//     feeName?: string,           // displayed for context
//     onSubmit: (req: UpdateAssignmentRequest) => void,
//     onCancel: () => void,
//   })
//
// UpdateAssignmentRequest (from domain):
//   {
//     waived: Option.Option<boolean>,
//     waivedReason: Option.Option<Option.Option<string>>,
//     ...other optional fields
//   }
//
// Form:
//   - reason (textarea, required)
//
// On submit:
//   - sends { waived: Option.some(true), waivedReason: Option.some(Option.some(reason)) }

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Option } from 'effect';
import { describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/translations.js', () => ({
  tr: (key: string) => {
    const map: Record<string, string> = {
      waive_dialog_title: 'Mark as Waived',
      waive_dialog_reason: 'Reason',
      waive_dialog_reasonPlaceholder: 'Enter waiver reason',
      waive_dialog_submit: 'Waive',
      waive_dialog_cancel: 'Cancel',
      waive_dialog_validation_reasonRequired: 'Reason is required',
    };
    return map[key] ?? key;
  },
  setTranslationOverrides: vi.fn(),
}));

// Dynamic import — will fail until the component exists
const { WaiveAssignmentDialog } = await import('~/components/organisms/WaiveAssignmentDialog.js');

function renderDialog(onSubmit = vi.fn(), onCancel = vi.fn()) {
  render(
    <WaiveAssignmentDialog
      open={true}
      assignmentId='assignment-1'
      feeId='fee-1'
      teamId='team-1'
      memberName='Bob'
      feeName='Annual Fee'
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
  return { onSubmit, onCancel };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WaiveAssignmentDialog', () => {
  describe('validation', () => {
    it('submit blocked when reason textarea is empty', () => {
      const { onSubmit } = renderDialog();
      fireEvent.click(screen.getByRole('button', { name: /^Waive$/i }));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText(/Reason is required/i)).not.toBeNull();
    });
  });

  describe('submission', () => {
    it('submit calls onSubmit with waived=true and waivedReason wrapped in Option.some', async () => {
      const { onSubmit } = renderDialog();
      fireEvent.change(screen.getByLabelText(/Reason/i), {
        target: { value: 'Financial hardship' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^Waive$/i }));
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledOnce();
        const callArg = onSubmit.mock.calls[0][0];
        // waived: Option.some(true)
        expect(Option.isSome(callArg.waived)).toBe(true);
        expect(callArg.waived.value).toBe(true);
        // waivedReason: Option.some(Option.some('Financial hardship'))
        expect(Option.isSome(callArg.waivedReason)).toBe(true);
        const inner = callArg.waivedReason.value;
        expect(Option.isSome(inner)).toBe(true);
        expect(inner.value).toBe('Financial hardship');
      });
    });

    it('submits the exact reason text entered', async () => {
      const { onSubmit } = renderDialog();
      fireEvent.change(screen.getByLabelText(/Reason/i), {
        target: { value: 'Team captain waiver' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^Waive$/i }));
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        const callArg = onSubmit.mock.calls[0][0];
        const inner = Option.isSome(callArg.waivedReason) ? callArg.waivedReason.value : null;
        const reasonValue = inner && Option.isSome(inner) ? inner.value : null;
        expect(reasonValue).toBe('Team captain waiver');
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
