// TDD mode — tests written BEFORE the AssignmentsTab component exists.
// These tests WILL FAIL until the developer implements:
//   - applications/web/src/components/organisms/AssignmentsTab.tsx
//
// Assumed component contract:
//   AssignmentsTab({
//     assignments: FeeAssignmentView[],
//     fees: FeeView[],             // for the fee-select filter options
//     members: MemberSummary[],    // for the member-select filter options
//     canRecordPayments: boolean,
//     canManageFees: boolean,
//     onLogPayment?: (assignment: FeeAssignmentView) => void,
//     onWaive?: (assignment: FeeAssignmentView) => void,
//   })
//
// FeeAssignmentView shape (from domain):
//   { assignmentId, feeId, teamMemberId, memberName, feeName, currency,
//     dueMinor, paidMinor, status, effectiveDueAt, waivedReason }
//
// FeeView shape (simplified for filter dropdown):
//   { feeId, name }
//
// MemberSummary shape (for filter dropdown):
//   { teamMemberId, memberName }
//
// Filters (all client-side):
//   - status chip filter (pending / paid / overdue / waived / all)
//   - fee select filter
//   - member select filter
//   - search input (member name, case-insensitive)

import { fireEvent, render, screen } from '@testing-library/react';
import { Option } from 'effect';
import { describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/translations.js', () => ({
  tr: (key: string) => {
    const map: Record<string, string> = {
      assignments_tab_title: 'All Assignments',
      assignments_tab_colMember: 'Member',
      assignments_tab_colFee: 'Fee',
      assignments_tab_colDue: 'Due',
      assignments_tab_colPaid: 'Paid',
      assignments_tab_colStatus: 'Status',
      assignments_tab_colActions: 'Actions',
      assignments_tab_empty_noFees: 'No fees yet',
      assignments_tab_empty_noResults: 'No payments match these filters',
      assignments_tab_clearFilters: 'Clear filters',
      assignments_tab_filterAll: 'All',
      assignments_tab_filterPending: 'Pending',
      assignments_tab_filterPaid: 'Paid',
      assignments_tab_filterOverdue: 'Overdue',
      assignments_tab_filterWaived: 'Waived',
      assignments_tab_actionLogPayment: 'Log payment',
      assignments_tab_actionWaive: 'Mark waived',
      assignments_tab_actionUnwaive: 'Un-waive',
      assignments_tab_searchPlaceholder: 'Search by member...',
      assignments_tab_filterFee: 'Filter by fee',
      assignments_tab_filterMember: 'Filter by member',
    };
    return map[key] ?? key;
  },
  setTranslationOverrides: vi.fn(),
}));

vi.mock('~/lib/finance/formatMoney.js', () => ({
  formatMoney: (minor: number, currency: string) => `${minor / 100} ${currency}`,
}));

// Dynamic import — will fail until the component exists
const { AssignmentsTab } = await import('~/components/organisms/AssignmentsTab.js');

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

type FeeAssignmentView = {
  assignmentId: string;
  feeId: string;
  teamMemberId: string;
  memberName: any; // Option<string>
  feeName: string;
  currency: string;
  dueMinor: number;
  paidMinor: number;
  status: string;
  effectiveDueAt: any;
  waivedReason: any;
};

type FeeView = { feeId: string; name: string };
type MemberSummary = { teamMemberId: string; memberName: string | null };

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ASSIGNMENT_ALICE_ANNUAL: FeeAssignmentView = {
  assignmentId: 'a-1',
  feeId: 'fee-1',
  teamMemberId: 'member-1',
  memberName: Option.some('Alice'),
  feeName: 'Annual Fee',
  currency: 'CZK',
  dueMinor: 100000, // 1000 CZK
  paidMinor: 0,
  status: 'pending',
  effectiveDueAt: Option.none(),
  waivedReason: Option.none(),
};

const ASSIGNMENT_BOB_EQUIPMENT: FeeAssignmentView = {
  assignmentId: 'a-2',
  feeId: 'fee-2',
  teamMemberId: 'member-2',
  memberName: Option.some('Bob'),
  feeName: 'Equipment Fee',
  currency: 'CZK',
  dueMinor: 30000, // 300 CZK
  paidMinor: 30000,
  status: 'paid',
  effectiveDueAt: Option.none(),
  waivedReason: Option.none(),
};

const ASSIGNMENT_CAROL_OVERDUE: FeeAssignmentView = {
  assignmentId: 'a-3',
  feeId: 'fee-1',
  teamMemberId: 'member-3',
  memberName: Option.some('Carol'),
  feeName: 'Annual Fee',
  currency: 'CZK',
  dueMinor: 100000,
  paidMinor: 0,
  status: 'overdue',
  effectiveDueAt: Option.none(),
  waivedReason: Option.none(),
};

const ASSIGNMENT_EUR: FeeAssignmentView = {
  assignmentId: 'a-4',
  feeId: 'fee-3',
  teamMemberId: 'member-4',
  memberName: Option.some('Dave'),
  feeName: 'EUR Fee',
  currency: 'EUR',
  dueMinor: 12000, // 120 EUR
  paidMinor: 0,
  status: 'pending',
  effectiveDueAt: Option.none(),
  waivedReason: Option.none(),
};

const allAssignments = [
  ASSIGNMENT_ALICE_ANNUAL,
  ASSIGNMENT_BOB_EQUIPMENT,
  ASSIGNMENT_CAROL_OVERDUE,
];

const fees: FeeView[] = [
  { feeId: 'fee-1', name: 'Annual Fee' },
  { feeId: 'fee-2', name: 'Equipment Fee' },
];

const members: MemberSummary[] = [
  { teamMemberId: 'member-1', memberName: 'Alice' },
  { teamMemberId: 'member-2', memberName: 'Bob' },
  { teamMemberId: 'member-3', memberName: 'Carol' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AssignmentsTab', () => {
  describe('basic rendering', () => {
    it('renders one row per assignment with member name, fee name, amounts, status', () => {
      render(
        <AssignmentsTab
          assignments={allAssignments}
          fees={fees}
          members={members}
          canRecordPayments={false}
          canManageFees={false}
        />,
      );
      expect(screen.getByText('Alice')).not.toBeNull();
      expect(screen.getByText('Bob')).not.toBeNull();
      expect(screen.getByText('Carol')).not.toBeNull();
      // Fee names
      expect(screen.getAllByText('Annual Fee').length).toBeGreaterThan(0);
      expect(screen.getByText('Equipment Fee')).not.toBeNull();
      // Status badges (note: "Pending", "Paid", "Overdue" also appear in filter chips)
      expect(screen.getAllByText(/pending/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/paid/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/overdue/i).length).toBeGreaterThan(0);
    });

    it('renders outstanding amounts in correct currency using formatMoney', () => {
      render(
        <AssignmentsTab
          assignments={allAssignments}
          fees={fees}
          members={members}
          canRecordPayments={false}
          canManageFees={false}
        />,
      );
      // Alice (pending, dueMinor=100000, paidMinor=0) → outstanding 1000 CZK
      // Carol (overdue, dueMinor=100000, paidMinor=0) → outstanding 1000 CZK
      expect(screen.getAllByText(/1000 CZK/).length).toBeGreaterThan(0);
      // Bob (paid, dueMinor=30000, paidMinor=30000) → outstanding 0 CZK
      expect(screen.getByText(/^0 CZK$/)).not.toBeNull();
      // Original 300 CZK total is NOT shown (outstanding, not total)
      expect(screen.queryByText(/300 CZK/)).toBeNull();
    });
  });

  describe('empty states', () => {
    it('shows "No fees yet" when assignments=[]', () => {
      render(
        <AssignmentsTab
          assignments={[]}
          fees={[]}
          members={[]}
          canRecordPayments={false}
          canManageFees={false}
        />,
      );
      expect(screen.getByText(/No fees yet/i)).not.toBeNull();
    });

    it('shows "No payments match" + Clear filters button when filters yield no results', () => {
      render(
        <AssignmentsTab
          assignments={allAssignments}
          fees={fees}
          members={members}
          canRecordPayments={false}
          canManageFees={false}
        />,
      );
      // Search for a member that doesn't exist
      const searchInput = screen.getByPlaceholderText(/Search by member/i);
      fireEvent.change(searchInput, { target: { value: 'ZzZzNobody' } });
      expect(screen.getByText(/No payments match these filters/i)).not.toBeNull();
      expect(screen.getByText(/Clear filters/i)).not.toBeNull();
    });

    it('clicking "Clear filters" resets the search and shows all rows again', () => {
      render(
        <AssignmentsTab
          assignments={allAssignments}
          fees={fees}
          members={members}
          canRecordPayments={false}
          canManageFees={false}
        />,
      );
      const searchInput = screen.getByPlaceholderText(/Search by member/i);
      fireEvent.change(searchInput, { target: { value: 'ZzZzNobody' } });
      fireEvent.click(screen.getByText(/Clear filters/i));
      expect(screen.getByText('Alice')).not.toBeNull();
    });
  });

  describe('filters', () => {
    it('status chip "Paid" narrows to only paid rows', () => {
      render(
        <AssignmentsTab
          assignments={allAssignments}
          fees={fees}
          members={members}
          canRecordPayments={false}
          canManageFees={false}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /^Paid$/i }));
      // Bob (paid) should be visible; Alice and Carol (pending/overdue) should not
      expect(screen.getByText('Bob')).not.toBeNull();
      expect(screen.queryByText('Alice')).toBeNull();
      expect(screen.queryByText('Carol')).toBeNull();
    });

    it('status chip "Overdue" narrows to only overdue rows', () => {
      render(
        <AssignmentsTab
          assignments={allAssignments}
          fees={fees}
          members={members}
          canRecordPayments={false}
          canManageFees={false}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /^Overdue$/i }));
      expect(screen.getByText('Carol')).not.toBeNull();
      expect(screen.queryByText('Alice')).toBeNull();
      expect(screen.queryByText('Bob')).toBeNull();
    });

    it('search by member name (case-insensitive) narrows rows', () => {
      render(
        <AssignmentsTab
          assignments={allAssignments}
          fees={fees}
          members={members}
          canRecordPayments={false}
          canManageFees={false}
        />,
      );
      const searchInput = screen.getByPlaceholderText(/Search by member/i);
      fireEvent.change(searchInput, { target: { value: 'alice' } });
      expect(screen.getByText('Alice')).not.toBeNull();
      expect(screen.queryByText('Bob')).toBeNull();
      expect(screen.queryByText('Carol')).toBeNull();
    });
  });

  describe('row actions', () => {
    it('hides "Log payment" when canRecordPayments=false', () => {
      render(
        <AssignmentsTab
          assignments={allAssignments}
          fees={fees}
          members={members}
          canRecordPayments={false}
          canManageFees={false}
        />,
      );
      expect(screen.queryByText(/Log payment/i)).toBeNull();
    });

    it('shows "Log payment" when canRecordPayments=true', () => {
      render(
        <AssignmentsTab
          assignments={allAssignments}
          fees={fees}
          members={members}
          canRecordPayments={true}
          canManageFees={false}
        />,
      );
      expect(screen.getAllByText(/Log payment/i).length).toBeGreaterThan(0);
    });

    it('shows "Mark waived" when canManageFees=true', () => {
      render(
        <AssignmentsTab
          assignments={allAssignments}
          fees={fees}
          members={members}
          canRecordPayments={false}
          canManageFees={true}
        />,
      );
      expect(screen.getAllByText(/Mark waived/i).length).toBeGreaterThan(0);
    });

    it('hides "Mark waived" when canManageFees=false', () => {
      render(
        <AssignmentsTab
          assignments={allAssignments}
          fees={fees}
          members={members}
          canRecordPayments={false}
          canManageFees={false}
        />,
      );
      expect(screen.queryByText(/Mark waived/i)).toBeNull();
    });

    it('clicking "Log payment" calls onLogPayment with the assignment', () => {
      const onLogPayment = vi.fn();
      render(
        <AssignmentsTab
          assignments={[ASSIGNMENT_ALICE_ANNUAL]}
          fees={fees}
          members={members}
          canRecordPayments={true}
          canManageFees={false}
          onLogPayment={onLogPayment}
        />,
      );
      fireEvent.click(screen.getByText(/Log payment/i));
      expect(onLogPayment).toHaveBeenCalledWith(ASSIGNMENT_ALICE_ANNUAL);
    });

    it('clicking "Mark waived" calls onWaive with the assignment', () => {
      const onWaive = vi.fn();
      render(
        <AssignmentsTab
          assignments={[ASSIGNMENT_ALICE_ANNUAL]}
          fees={fees}
          members={members}
          canRecordPayments={false}
          canManageFees={true}
          onWaive={onWaive}
        />,
      );
      fireEvent.click(screen.getByText(/Mark waived/i));
      expect(onWaive).toHaveBeenCalledWith(ASSIGNMENT_ALICE_ANNUAL);
    });
  });

  describe('multi-currency', () => {
    it('rows preserve their own currency (CZK and EUR in same table)', () => {
      const multiCurrency = [ASSIGNMENT_ALICE_ANNUAL, ASSIGNMENT_EUR];
      render(
        <AssignmentsTab
          assignments={multiCurrency}
          fees={[...fees, { feeId: 'fee-3', name: 'EUR Fee' }]}
          members={[...members, { teamMemberId: 'member-4', memberName: 'Dave' }]}
          canRecordPayments={false}
          canManageFees={false}
        />,
      );
      // Alice: 1000 CZK
      expect(screen.getByText(/1000 CZK/)).not.toBeNull();
      // Dave: 120 EUR
      expect(screen.getByText(/120 EUR/)).not.toBeNull();
    });
  });
});
