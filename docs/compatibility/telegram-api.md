# Telegram Bot API Compatibility Record

Checked on 2026-09-16 against the official [Bot API reference](https://core.telegram.org/bots/api), [Bot API changelog](https://core.telegram.org/bots/api-changelog), and [grammY API reference](https://grammy.dev/ref/). This is a dated compatibility record. Recheck it before each implementation release.

## Pinned baseline

| Component | Version | Evidence in this repository |
|---|---:|---|
| Telegram Bot API | 10.3 (2026-08-24) | Official changelog and method/object reference |
| grammY | 1.46.0 | Exact dependency in `package.json` and `pnpm-lock.yaml` |
| `@grammyjs/types` | 5.0.0 | Locked transitive dependency of grammY |
| Node.js | 24.19.0 | `.node-version`; supported engine range is Node 24 |
| pnpm | 11.22.0 | `packageManager` in `package.json` |
| TypeScript | 7.0.2 | Exact development dependency; strict compiler settings |

## Contract tests

`tests/compatibility/telegram-api-10-3.types.ts` is compiled but never invoked. It proves that the installed SDK types expose the API methods and fields FOAB intends to use; it cannot make a Telegram request. Synthetic fixtures in `tests/fixtures/telegram-api-10-3.ts` are checked against grammY's `Update` type and exercised by local unit tests.

The compile-only contract currently checks:

- `sendMessage` with `ephemeral_message_parameters`, including recipient, callback query, and replacement behavior.
- `sendRichMessage` with structured rich content and ephemeral delivery parameters.
- `answerChatJoinRequestQuery` and its explicit `approve`, `decline`, or `queue` result.
- `editEphemeralMessageText` with chat, recipient, and ephemeral message identifiers.
- Ephemeral command registration with `BotCommand.is_ephemeral`.
- `setMyCommands` with localized descriptions, explicit command scopes, and the ephemeral-command flag.
- The `can_send_welcome_messages` administrator right.

These are SDK/type checks, not proof that a Telegram client displays a feature, that a bot has the required rights, or that the API will deliver an ephemeral message.

The current `/start` and `/help` group menu entries set `is_ephemeral: true`. Their handler responses set `ephemeral_message_parameters.receiver_user_id` from the authenticated update and, when the incoming command includes an ephemeral message ID, reply using `reply_parameters.ephemeral_message_id`. Delivery failures do not trigger a public group fallback. See Telegram's current [ephemeral message and command rules](https://core.telegram.org/bots/api#ephemeral-messages-and-commands); actual client delivery remains an open verification gate.

FOAB's command registry will publish separate member and administrator menu lists using Telegram's command scopes and language codes. The menu is discoverability only; command handlers still perform server-side authorization for the actual group and actor. See the [BotFather setup checklist](../developer/botfather-setup.md).

## Behavior and privacy constraints

Bot API 10.3 groups ephemeral delivery options in `EphemeralMessageParameters`; it replaced the older standalone recipient/callback parameters for supported send methods. A non-administrator's ephemeral response requires an eligible callback or ephemeral-message reference and a short response window. An administrator may address a human member of the group without that trigger, but delivery is still not guaranteed. The recipient must be derived from an authenticated Telegram update, never from an arbitrary command or Mini App field. A response to an ephemeral message must remain ephemeral. For a callback originating from an ephemeral message, edit the ephemeral response rather than replacing the original callback message.

Guard join-request queries expose `ChatJoinRequest.query_id`. The bot must answer query-aware requests within 10 seconds through `answerChatJoinRequestQuery` or the documented Guard Web App flow. FOAB must acknowledge or queue quickly and keep longer admission checks in durable jobs; a delayed quiz or database call must not consume the query deadline.

Rich Messages support structured content and new block/button/media types. Their larger limits do not make arbitrary administrator or member content safe to parse as HTML, commands, templates, or regular expressions. FOAB will validate allowed block forms and provide plain-text fallbacks when a client or SDK cannot render a supported block.

## FAQ and version conflicts

Use the versioned method reference and changelog to establish API availability. A FAQ statement may describe an older API or a narrower client context; record the exact conflicting statement and date in the feature report instead of turning it into a universal prohibition or assuming the newer API works in every client. API support, SDK support, bot rights, BotFather configuration, eligible update context, and client evidence remain separate capability fields.

## Open verification gates

| Gate | Current evidence | Required before claiming support |
|---|---|---|
| Type availability | Compile-only tests against grammY 1.46.0 | Keep compile test green on dependency updates |
| Synthetic update shape | Typed, fictional fixtures | Add fixtures for each newly consumed update variant |
| Guard deadline behavior | Official API reference and typed method | Integration test a synthetic queue/timeout path; later verify in a controlled test chat |
| Ephemeral eligibility and privacy | Official API reference and compile-time method contract | Test allowed and rejected paths with separate synthetic actors, then verify supported Telegram clients |
| Rich rendering and fallback | SDK type surface and official format reference | Renderer tests per supported block plus real-client evidence |
| FAQ differences | Policy recorded above; no FAQ behavior copied into runtime | Attach each disputed FAQ excerpt and method-specific evidence to its implementation task |

This compatibility spike used only fictional API fixtures and made no message or group calls. A separate credential smoke check later called `getMe` using the owner-provided local token; it did not send a message or access a chat.
