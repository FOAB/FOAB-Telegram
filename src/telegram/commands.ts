import type { BotCommand } from 'grammy/types';

/** Commands shown in private chats, where ordinary message delivery is appropriate. */
export const privateCommandMenu = [
  { command: 'start', description: 'Start FOAB or get setup guidance' },
  { command: 'help', description: 'Show available commands' },
] satisfies readonly BotCommand[];

/** Group commands are explicitly ephemeral so invoking them does not post to the group. */
export const groupCommandMenu = [
  {
    command: 'start',
    description: 'Register this group',
    is_ephemeral: true,
  },
  {
    command: 'help',
    description: 'Show available commands',
    is_ephemeral: true,
  },
] satisfies readonly BotCommand[];
