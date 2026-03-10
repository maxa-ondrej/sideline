import { Chunk } from 'effect';
import { describe, expect, it } from 'vitest';
import { commandBuilder } from '~/index.js';

describe('commands', () => {
  describe('commandBuilder', () => {
    it('contains registered commands', () => {
      expect(Chunk.size(commandBuilder.definitions)).toBeGreaterThanOrEqual(2);
    });
  });
});
