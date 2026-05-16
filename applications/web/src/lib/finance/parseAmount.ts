/**
 * Minor-unit counts per currency.
 * Currently all supported currencies use 2 decimal places (100 minor units per major unit).
 * Add new currencies here if they use a different number of decimals (e.g. JPY = 0).
 */
const MINOR_UNITS: Record<string, number> = {
  CZK: 2,
  EUR: 2,
  USD: 2,
};

/**
 * Parses a decimal string (e.g. "15.50") into a minor-unit integer (1550).
 *
 * Rules:
 *  - Empty string → throws Error
 *  - Zero → throws Error
 *  - Negative → throws Error
 *  - Non-numeric → throws Error
 *  - Two decimal places max; "15.505" rounds to 1551 (standard JS rounding)
 *
 * @param value - The decimal string to parse (e.g. "15.50").
 * @param currency - Optional ISO 4217 currency code used to determine the minor-unit
 *   multiplier. Defaults to 2 decimal places (multiplier 100) for any unlisted currency.
 */
export function parseAmount(value: string, currency?: string): number {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Amount is required');

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) throw new Error('Amount must be a number');
  if (parsed <= 0) throw new Error('Amount must be greater than 0');

  const decimals = currency !== undefined ? (MINOR_UNITS[currency] ?? 2) : 2;
  const multiplier = 10 ** decimals;
  return Math.round(parsed * multiplier);
}
