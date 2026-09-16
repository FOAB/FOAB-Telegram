import { describe, expect, it } from 'vitest';
import {
  ephemeralCommandReplyOptions,
} from '../../src/telegram/create-bot.js';
import {
  groupCommandMenu,
  privateCommandMenu,
} from '../../src/telegram/commands.js';
import { ephemeralMessageUpdate } from '../fixtures/telegram-api-10-3.js';

describe('private group command feedback', () => {
  it('marks every registered group command as ephemeral', () => {
    expect(groupCommandMenu.map((command) => command.is_ephemeral)).toEqual([
      true,
      true,
    ]);
    expect(
      privateCommandMenu.every(
        (command) => !('is_ephemeral' in command) || command.is_ephemeral !== true,
      ),
    ).toBe(true);
  });

  it('targets the requester and replies to the incoming ephemeral command', () => {
    const message = ephemeralMessageUpdate.message;
    if (!message) {
      throw new Error('The synthetic ephemeral command fixture is missing its message.');
    }

    expect(ephemeralCommandReplyOptions(message, 1_000_000_001)).toEqual({
      ephemeral_message_parameters: { receiver_user_id: 1_000_000_001 },
      reply_parameters: { ephemeral_message_id: 7_000_000_001 },
    });
  });
});
