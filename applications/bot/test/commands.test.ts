import { Chunk } from 'effect';
import { describe, expect, it } from 'vitest';
import { commandBuilder, PingCommand } from '~/index.js';

describe('commands', () => {
  describe('PingCommand', () => {
    it('has correct name', () => {
      expect(PingCommand.command.name).toBe('ping');
    });

    it('has english description', () => {
      expect(PingCommand.command.description).toBe('Check if the bot is alive');
    });

    it('has czech localization', () => {
      expect(PingCommand.command.description_localizations?.cs).toBe(
        'Zkontrolovat, jestli bot žije',
      );
    });
  });

  describe('commandBuilder', () => {
    it('contains the ping command', () => {
      expect(Chunk.size(commandBuilder.definitions)).toBe(1);
    });
  });
});
