import type { FinanceApi } from '@sideline/domain';
import { Option } from 'effect';
import React from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { tr } from '~/lib/translations.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WaiveAssignmentDialogProps {
  open: boolean;
  assignmentId: string;
  feeId: string;
  teamId: string;
  memberName?: string;
  feeName?: string;
  onSubmit: (req: FinanceApi.UpdateAssignmentRequest) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WaiveAssignmentDialog({
  open,
  memberName,
  feeName,
  onSubmit,
  onCancel,
}: WaiveAssignmentDialogProps) {
  const [reason, setReason] = React.useState('');
  const [reasonError, setReasonError] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setReason('');
      setReasonError('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      setReasonError(tr('waive_dialog_validation_reasonRequired'));
      return;
    }

    setReasonError('');

    const req: FinanceApi.UpdateAssignmentRequest = {
      waived: Option.some(true),
      waivedReason: Option.some(Option.some(reason.trim())),
      amountMinor: Option.none(),
      dueAt: Option.none(),
    };

    onSubmit(req);
  };

  const title = [tr('waive_dialog_title'), memberName, feeName].filter(Boolean).join(' — ');

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onCancel();
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          {/* Reason */}
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='waive-reason'>{tr('waive_dialog_reason')}</Label>
            <Textarea
              id='waive-reason'
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tr('waive_dialog_reasonPlaceholder')}
            />
            {reasonError && <p className='text-sm text-destructive'>{reasonError}</p>}
          </div>

          <DialogFooter>
            <Button type='button' variant='outline' onClick={onCancel}>
              {tr('waive_dialog_cancel')}
            </Button>
            <Button type='submit'>{tr('waive_dialog_submit')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
