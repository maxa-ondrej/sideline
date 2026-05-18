import { describe, expect, it } from 'vitest';
import { pickDominantCurrency } from './pickDominantCurrency.js';

describe('pickDominantCurrency', () => {
  it('returns null for empty array', () => {
    expect(pickDominantCurrency([])).toBeNull();
  });

  it('returns the only currency for a single-entry array', () => {
    expect(pickDominantCurrency([{ currency: 'CZK', incomeMinor: 1000, expensesMinor: 500 }])).toBe(
      'CZK',
    );
  });

  it('picks the currency with the highest total volume (income + expenses)', () => {
    const summaries = [
      { currency: 'CZK', incomeMinor: 1000, expensesMinor: 500 },
      { currency: 'EUR', incomeMinor: 5000, expensesMinor: 3000 },
    ];
    expect(pickDominantCurrency(summaries)).toBe('EUR');
  });

  it('picks first when volumes are equal', () => {
    // Equal volume: 1000+500 = 1500 for both → returns first one (CZK)
    const summaries = [
      { currency: 'CZK', incomeMinor: 1000, expensesMinor: 500 },
      { currency: 'EUR', incomeMinor: 800, expensesMinor: 700 },
    ];
    expect(pickDominantCurrency(summaries)).toBe('CZK');
  });

  it('works with zero income and non-zero expenses', () => {
    const summaries = [
      { currency: 'CZK', incomeMinor: 0, expensesMinor: 10000 },
      { currency: 'EUR', incomeMinor: 500, expensesMinor: 0 },
    ];
    expect(pickDominantCurrency(summaries)).toBe('CZK');
  });

  it('works with all-zero volumes → returns first', () => {
    const summaries = [
      { currency: 'CZK', incomeMinor: 0, expensesMinor: 0 },
      { currency: 'EUR', incomeMinor: 0, expensesMinor: 0 },
    ];
    expect(pickDominantCurrency(summaries)).toBe('CZK');
  });
});
