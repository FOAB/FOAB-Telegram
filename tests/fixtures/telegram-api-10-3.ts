import type { Update } from 'grammy/types';

const syntheticGroup = {
  id: -1_000_000_000_001,
  title: 'Synthetic FOAB Community',
  type: 'supergroup',
} as const;

const syntheticUser = {
  first_name: 'Synthetic Member',
  id: 1_000_000_001,
  is_bot: false,
} as const;

/** A synthetic incoming ephemeral message carrying its recipient and scoped message ID. */
export const ephemeralMessageUpdate = {
  update_id: 9_000_000_001,
  message: {
    chat: syntheticGroup,
    date: 1_800_000_000,
    ephemeral_message_id: 7_000_000_001,
    from: syntheticUser,
    message_id: 0,
    receiver_user: syntheticUser,
    text: '/config',
  },
} satisfies Update;

/** A synthetic join-request query used to type-check Guard's short response window. */
export const guardJoinRequestUpdate = {
  update_id: 9_000_000_002,
  chat_join_request: {
    chat: syntheticGroup,
    date: 1_800_000_001,
    from: { ...syntheticUser, id: 1_000_000_002 },
    query_id: 'synthetic-guard-query-001',
    user_chat_id: 1_000_000_002,
  },
} satisfies Update;

/** A synthetic rich-message update with no real user or community data. */
export const richMessageUpdate = {
  update_id: 9_000_000_003,
  message: {
    chat: syntheticGroup,
    date: 1_800_000_002,
    from: { ...syntheticUser, id: 1_000_000_003 },
    message_id: 7_000_000_002,
    rich_message: { blocks: [] },
  },
} satisfies Update;
