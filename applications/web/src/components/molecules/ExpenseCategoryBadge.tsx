import type { Expense } from '@sideline/domain';
import { Bus, MapPin, MoreHorizontal, Trophy, Wrench } from 'lucide-react';
import type React from 'react';
import { tr } from '~/lib/translations.js';

type ExpenseCategory = Expense.ExpenseCategory;

type CategoryIconComponent = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

const categoryConfig: Record<
  ExpenseCategory,
  { className: string; Icon: CategoryIconComponent; labelKey: string }
> = {
  fields: {
    className:
      'border border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    Icon: MapPin,
    labelKey: 'expense_category_fields',
  },
  equipment: {
    className:
      'border border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
    Icon: Wrench,
    labelKey: 'expense_category_equipment',
  },
  travel: {
    className:
      'border border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    Icon: Bus,
    labelKey: 'expense_category_travel',
  },
  tournaments: {
    className:
      'border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    Icon: Trophy,
    labelKey: 'expense_category_tournaments',
  },
  other: {
    className:
      'border border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300',
    Icon: MoreHorizontal,
    labelKey: 'expense_category_other',
  },
};

interface ExpenseCategoryBadgeProps {
  category: ExpenseCategory;
}

export function ExpenseCategoryBadge({ category }: ExpenseCategoryBadgeProps) {
  const { className, Icon, labelKey } = categoryConfig[category];

  return (
    <span
      data-category={category}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      <Icon className='size-3' aria-hidden={true} />
      {tr(labelKey)}
    </span>
  );
}
