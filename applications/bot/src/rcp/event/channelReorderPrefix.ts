import type { Discord } from '@sideline/domain';
import { Option } from 'effect';

/** Compare two snowflakes numerically via BigInt. Returns -1, 0, or 1. */
export const compareSnowflakes = (a: Discord.Snowflake, b: Discord.Snowflake): number => {
  const ai = BigInt(a);
  const bi = BigInt(b);
  return ai < bi ? -1 : ai > bi ? 1 : 0;
};

/**
 * Compute the longest keepable prefix length k.
 *
 * An item can be in the kept prefix if:
 * 1. Its snowflake is Some.
 * 2. Its snowflake is strictly greater than the previous kept item's snowflake.
 * 3. Its snowflake is strictly less than the minimum snowflake in the remaining suffix.
 */
export const longestKeepablePrefix = (
  items: ReadonlyArray<{ readonly snowflake: Option.Option<Discord.Snowflake> }>,
): number => {
  const n = items.length;
  // Build minSuffix[i] = minimum snowflake in items[i..n-1] (only counting Some snowflakes)
  const minSuffix: Array<Option.Option<Discord.Snowflake>> = new Array(n + 1);
  minSuffix[n] = Option.none();
  for (let i = n - 1; i >= 0; i--) {
    const itemSf = items[i].snowflake;
    const suffMin = minSuffix[i + 1];
    if (Option.isNone(itemSf)) {
      minSuffix[i] = suffMin;
    } else if (Option.isNone(suffMin)) {
      minSuffix[i] = itemSf;
    } else {
      minSuffix[i] = compareSnowflakes(itemSf.value, suffMin.value) <= 0 ? itemSf : suffMin;
    }
  }

  let k = 0;
  let lastKept: Option.Option<Discord.Snowflake> = Option.none();

  for (let i = 0; i < n; i++) {
    const sf = items[i].snowflake;
    // Must have a snowflake to be in kept prefix
    if (Option.isNone(sf)) break;
    // Must be strictly greater than last kept
    if (Option.isSome(lastKept) && compareSnowflakes(sf.value, lastKept.value) <= 0) break;
    // The minimum of the next suffix must be greater than this snowflake
    const nextMin = minSuffix[i + 1];
    if (Option.isSome(nextMin) && compareSnowflakes(nextMin.value, sf.value) <= 0) break;

    k = i + 1;
    lastKept = sf;
  }

  return k;
};
