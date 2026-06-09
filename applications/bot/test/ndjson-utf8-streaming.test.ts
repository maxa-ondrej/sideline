/**
 * Regression test for the UTF-8 streaming-decode bug in effect@4.0.0-beta.40.
 *
 * Root cause: `RpcSerialization.ndjson`'s internal decoder called
 *   `decoder.decode(bytes)` (without `{ stream: true }`)
 * which causes a `TextDecoder` to flush its incomplete-sequence buffer after
 * every chunk.  When an HTTP response body is split mid-character (e.g. the
 * two-byte UTF-8 sequence for "á" arriving as 0xC3 in chunk-1 and 0xA1 in
 * chunk-2), the decoder replaces the orphaned lead byte with U+FFFD (the
 * replacement character "�"), corrupting multi-byte characters and making JSON
 * parsing fail or return garbage.
 *
 * Fix: patches/effect@4.0.0-beta.40.patch changes the call to
 *   `decoder.decode(bytes, { stream: true })`
 * which tells the TextDecoder to hold incomplete sequences across calls.
 *
 * This test verifies the streaming-decode BEHAVIOUR is correct: it fails if the
 * patch is reverted while `effect@4.0.0-beta.40` stays installed. The hard guard
 * against the patch silently disappearing on an `effect` bump is pnpm itself —
 * `pnpm.patchedDependencies` is pinned to the exact `effect@4.0.0-beta.40`, so a
 * version bump fails at install until the patch is re-evaluated (and dropped if
 * upstream has fixed it).
 *
 * Note on the `{ stream: true }` invariant: the decoder is never explicitly
 * flushed at end-of-stream. That is safe because the NDJSON encoder terminates
 * every record with `\n` (a complete single-byte char), so a well-formed body
 * never ends mid-sequence and the decoder's internal buffer is empty at stream
 * end. The truncated-stream test below pins this behaviour: a body cut
 * mid-sequence yields zero records rather than a corrupted one.
 */

import { RpcSerialization } from 'effect/unstable/rpc';
import { describe, expect, it } from 'vitest';

describe('RpcSerialization.ndjson — UTF-8 streaming across chunk boundaries', () => {
  it('decodes Czech accented chars split mid-sequence (á = 0xC3 0xA1)', () => {
    const ser = RpcSerialization.ndjson.makeUnsafe();

    const obj = { from: 'Patrik Novák', subject: 'soutěž 2026', emoji: '📨🗓️' };
    const line = `${JSON.stringify(obj)}\n`;
    const bytes = new TextEncoder().encode(line);

    // Locate the two-byte UTF-8 sequence for "á": 0xC3 0xA1.
    // We split between them to exercise the TextDecoder's stream buffering.
    let splitAt = -1;
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] === 0xc3 && bytes[i + 1] === 0xa1) {
        splitAt = i + 1; // split after the lead byte, before the continuation byte
        break;
      }
    }

    // Guard: ensure we actually found a mid-sequence split point — if the test
    // object changes and no longer contains "á", this assertion fires to warn us.
    expect(splitAt).toBeGreaterThan(0);

    const chunk1 = bytes.slice(0, splitAt);
    const chunk2 = bytes.slice(splitAt);

    const items1 = ser.decode(chunk1);
    const items2 = ser.decode(chunk2);
    const decoded = [...items1, ...items2];

    // Exactly one NDJSON record should have been reassembled.
    expect(decoded).toHaveLength(1);

    // The decoded object must deep-equal the original.
    expect(decoded[0]).toEqual(obj);

    // The serialized form must not contain the U+FFFD replacement character,
    // which would indicate the TextDecoder flushed its buffer prematurely.
    expect(JSON.stringify(decoded[0])).not.toContain('�');
  });

  it('decodes 4-byte emoji split at the first byte (0xF0 …)', () => {
    const ser = RpcSerialization.ndjson.makeUnsafe();

    const obj = { emoji: '📨🗓️', val: 42 };
    const line = `${JSON.stringify(obj)}\n`;
    const bytes = new TextEncoder().encode(line);

    // Locate the first 4-byte emoji lead byte (0xF0).
    let splitAt = -1;
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] === 0xf0) {
        splitAt = i + 1; // split after the 0xF0 lead byte
        break;
      }
    }

    expect(splitAt).toBeGreaterThan(0);

    const chunk1 = bytes.slice(0, splitAt);
    const chunk2 = bytes.slice(splitAt);

    const items1 = ser.decode(chunk1);
    const items2 = ser.decode(chunk2);
    const decoded = [...items1, ...items2];

    expect(decoded).toHaveLength(1);
    expect(decoded[0]).toEqual(obj);
    expect(JSON.stringify(decoded[0])).not.toContain('�');
  });

  it('reassembles intact when fed one byte per chunk (worst-case boundaries)', () => {
    const ser = RpcSerialization.ndjson.makeUnsafe();

    const obj = { from: 'Patrik Novák', subject: 'soutěž 2026', emoji: '📨🗓️' };
    const bytes = new TextEncoder().encode(`${JSON.stringify(obj)}\n`);

    // Deliver the body one byte at a time — every multi-byte sequence is split
    // across decode() calls, exercising the stream buffer to its limit.
    const decoded: Array<unknown> = [];
    for (let i = 0; i < bytes.length; i++) {
      decoded.push(...ser.decode(bytes.slice(i, i + 1)));
    }

    expect(decoded).toHaveLength(1);
    expect(decoded[0]).toEqual(obj);
    expect(JSON.stringify(decoded[0])).not.toContain('�');
  });

  it('drops (does not corrupt) a body truncated mid-sequence with no trailing newline', () => {
    const ser = RpcSerialization.ndjson.makeUnsafe();

    const obj = { from: 'Patrik Novák' };
    const bytes = new TextEncoder().encode(JSON.stringify(obj)); // no trailing '\n'

    // Cut the body in the middle of "á" and never deliver the rest or a newline.
    let splitAt = -1;
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] === 0xc3 && bytes[i + 1] === 0xa1) {
        splitAt = i + 1;
        break;
      }
    }
    expect(splitAt).toBeGreaterThan(0);

    const decoded = ser.decode(bytes.slice(0, splitAt));

    // Without a terminating newline, no complete record is emitted. The pending
    // incomplete byte stays buffered in the decoder rather than surfacing as a
    // corrupted record — documenting the no-final-flush invariant.
    expect(decoded).toHaveLength(0);
  });
});
