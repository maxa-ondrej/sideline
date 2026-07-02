import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { recordSyncFailure } from '~/rcp/recordSyncFailure.js';

describe('recordSyncFailure', () => {
  it('returns the mark-failed RPC result unchanged', () => {
    const result = Effect.runSync(
      recordSyncFailure(Effect.succeed('marked'), {
        syncType: 'test',
        message: 'Failed to process test event 1',
        error: new Error('boom'),
      }),
    );
    expect(result).toBe('marked');
  });

  it('propagates a failure from the mark-failed RPC call (log/metric taps only run on success)', () => {
    const exit = Effect.runSyncExit(
      recordSyncFailure(Effect.fail('mark-rpc-down'), {
        syncType: 'test',
        message: 'Failed to process test event 1',
        error: new Error('boom'),
      }),
    );
    expect(exit._tag).toBe('Failure');
  });
});
