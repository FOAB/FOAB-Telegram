import type { Api } from 'grammy';
import type { InputRichMessage } from 'grammy/types';

/**
 * Compile-only contract for Bot API capabilities required by the first FOAB release.
 * This function is never invoked, so it cannot make a network request.
 */
function verifyTelegramApi103Types(api: Api): void {
  const chatId = -1_000_000_000_001;
  const userId = 1_000_000_001;
  const callbackQueryId = 'synthetic-callback-query-001';
  const ephemeralMessageId = 7_000_000_001;

  void api.sendMessage(chatId, 'Synthetic private feedback', {
    ephemeral_message_parameters: {
      receiver_user_id: userId,
      callback_query_id: callbackQueryId,
      replace_callback_query_message: false,
    },
  });

  const richMessage: InputRichMessage = { markdown: '**Synthetic rules**' };
  void api.sendRichMessage(chatId, richMessage, {
    ephemeral_message_parameters: { receiver_user_id: userId },
  });

  void api.answerChatJoinRequestQuery('synthetic-guard-query-001', 'queue');
  void api.editEphemeralMessageText(
    chatId,
    userId,
    ephemeralMessageId,
    'Synthetic updated feedback',
  );

  void api.setMyCommands([
    { command: 'config', description: 'Open settings', is_ephemeral: true },
  ], {
    scope: { type: 'all_chat_administrators' },
    language_code: 'en',
  });
  void api.promoteChatMember(chatId, userId, { can_send_welcome_messages: true });
}

void verifyTelegramApi103Types;
