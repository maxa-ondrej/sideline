/**
 * Pick the currency with the highest total transaction volume (income + expenses)
 * from an array of BalanceSummary objects.
 *
 * Returns null when the array is empty. When multiple summaries share the maximum
 * volume, the earliest entry wins (Array.reduce evaluates left-to-right and only
 * replaces the accumulator on strict `>`).
 */
type VolumeRow = { currency: string; incomeMinor: number; expensesMinor: number };

const volume = (row: VolumeRow) => row.incomeMinor + row.expensesMinor;

export function pickDominantCurrency(summaries: ReadonlyArray<VolumeRow>): string | null {
  if (summaries.length === 0) return null;
  return summaries.reduce((best, cur) => (volume(cur) > volume(best) ? cur : best)).currency;
}
