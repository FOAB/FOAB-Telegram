# BotFather Setup and Capability Checklist

This runbook turns the BotFather screens supplied for FOAB into explicit setup decisions. The screenshots are user-provided reference evidence, not a verified live reading of the current bot settings. Do not toggle a mode solely because it appears in a screenshot.

## Current stage

The current runtime requires a valid bot token and a migrated local PostgreSQL database. On startup it publishes localized `/start`, `/help`, `/ping`, `/id`, `/settings`, and `/cancel` menus with `setMyCommands`, then starts long polling. In private chats, the optional validated `FOAB_WEB_APP_URL` is shown as the primary settings entry point and inline buttons remain available as the fallback. Group commands are marked ephemeral and their responses target only the requesting user; private-chat responses are ordinary messages. Delivery is not guaranteed and must be verified in a supported client. The bot stores group metadata when Telegram reports a bot membership change or when someone invokes a command in a group. The settings handler checks current administrator status for the exact group before writing language or time-zone settings; `/ping` and `/id` are read-only; no moderation is performed. The screenshots show Allow Groups enabled and Group Privacy enabled, which are sufficient for these initial command and membership updates.

The bot token and runtime database URL are in the local ignored `.env`; migration credentials are in `.env.database`, and the integration-test URL is in `.env.test`. Do not paste any of them into chat, logs, screenshots, tests, or commits. Startup and command-menu publication have not been tested against Telegram during the current implementation slice; no live group or moderation action was used.

## Decisions from the supplied screens

| BotFather setting | Screenshot state | FOAB decision |
|---|---|---|
| Allow Groups | On | Keep enabled for installation in target groups. This does not grant moderation permissions. |
| Group Privacy | On | Keep enabled for the current commands and membership registry. Features that inspect ordinary member messages need full message updates; use a dedicated test group and follow the controlled steps below before testing them. Privacy mode affects which updates arrive; it is not an authorization check. |
| Group Admin Rights | 0 of 13 | Keep unset until a feature needs a specific right. Grant only the smallest required rights, then validate the bot's current Telegram status and rights before each action. |
| Channel Admin Rights | 0 of 13 | Keep unset unless a group explicitly configures channel publishing or linked-channel management. |
| Same-Origin Restriction | On | Keep enabled. Do not opt out to make an integration easier. Host the Mini App on its configured origin and validate Telegram launch data on the backend. |
| Menu Button and Main App | Disabled | Leave disabled until the Mini App has a deployed HTTPS URL. The menu button is the practical in-chat entry point; Main App/profile launch is an optional presentation decision. Neither replaces server-side authentication. |
| Inline Mode | Off | Not required for group moderation or the first release. Enable only for a separately approved inline feature. |
| Bot Management Mode | Off | Keep off. The initial product does not create or manage other users' bots. |
| Guest Chat Mode | Off | Keep off until a specific guest feature is implemented and reviewed. Guest access must never imply group membership or moderation authority. |
| Guard Mode | Off | Keep off until Guard admission handling is implemented. A real Guard test will require enabling it and configuring the bot for one dedicated test group. |
| Secretary Mode | Off | Not part of the initial FOAB scope; leave off. |
| Bot-to-Bot Communication | Off | Keep off until an allowlisted integration is designed with loop limits, scoped capabilities, and audit. |
| Threaded Mode | Off | Not needed for ordinary forum-topic support. Consider only with a specific Telegram threaded-conversation workflow. |
| Games / Inline Games | Off | Not part of the group-management baseline; leave off. |
| Login Widget / OpenID Connect | Not configured | No separate website login is planned for the initial Mini App. Telegram Mini App launch data must be validated server-side. Do not add a parallel login surface without a product need. |
| Restrict bot usage | Off | Optional owner-managed access restriction, not a substitute for FOAB's group-scoped authorization. Keep off for a bot intended for multiple communities unless the operator deliberately chooses a private allowlist. |
| Welcome image and profile description | Empty | Optional profile presentation. This is separate from per-group welcome messages and can be configured after product copy is approved. |
| Commands | Not configured in the supplied screenshot | The application publishes localized private menus and ephemeral group menus for `/start`, `/help`, `/ping`, `/id`, and `/cancel`, plus `/settings` in the administrator scope. Group responses target the invoking member and never fall back to a public reply if ephemeral delivery fails. The menu is discoverability only; `/settings` still rechecks the actor and target chat. |
| Payment providers / Telegram Stars | Providers visible; no FOAB product configured | No payment setup is needed. Payments are an optional future product track, separate from core moderation. If digital goods or services are ever sold inside Telegram, use the current Telegram Stars requirements and implement transaction, delivery, support, and refund handling before activation. |

## Group privacy and message visibility

Telegram's default privacy mode limits ordinary group updates to messages relevant to the bot. Bot administrators and bots with privacy mode disabled receive ordinary group messages (with Telegram's documented exceptions). A message filter that matches ordinary member phrases, flood protection, and several content rules cannot be claimed to work on messages the bot never receives. See the [official bot features guidance](https://core.telegram.org/bots/features) and [Bots FAQ](https://core.telegram.org/bots/faq).

For a controlled test of those features, use a dedicated test bot and group. Choose one of these paths explicitly:

1. Add the bot as a group administrator with only the exact Telegram rights required by the test. Telegram administrators receive all group messages; FOAB must still restrict which actions the bot may perform.
2. If the bot does not need administrator status for that test, change privacy mode with BotFather's `/setprivacy` flow and re-add the bot to the dedicated group for the new setting to take effect. Avoid applying this change to a production bot or unrelated groups without an explicit decision.

In either path, test only synthetic messages and known test participants. The application must fail with a clear capability status if full message visibility is unavailable; it must not silently report that phrase filters or anti-spam protection are active.

## Command menu and multi-group behavior

`setMyCommands` supports scopes for default commands, private chats, all groups, chat administrators, a specific chat, and a specific chat member. It also supports language-specific command descriptions and accepts up to 100 commands per list. FOAB publishes localized private menus, member group menus, and administrator group menus; `/settings` is visible in the administrator scope and its handler rechecks current authority. Menu visibility is never permission enforcement. See Telegram's [ephemeral messages and commands](https://core.telegram.org/bots/api#ephemeral-messages-and-commands) contract for delivery eligibility and its 15-second reply window.

The relevant Telegram methods and scopes are documented in [`setMyCommands`](https://core.telegram.org/bots/api#setmycommands). If an administrator opens a private chat to configure one of several groups, the selected group must remain explicit and must not be inferred from the command-menu scope.

## Mini App setup and origin protection

The repository now has the signed `initData` verification boundary and optional URL gating. When the React/Vite Mini App HTTP API and UI are implemented and deployed:

1. Use an HTTPS deployment with a stable, reviewed origin.
2. Configure the BotFather Menu Button to that URL. Configure Main App/profile launch only if the project wants that additional entry point.
3. Keep Same-Origin Restriction enabled. Do not accept navigation or authentication from an untrusted origin.
4. Send raw `Telegram.WebApp.initData` to the backend, validate its Telegram signature and freshness, then authorize the actor for the selected installation and chat. Never trust `initDataUnsafe`, browser-supplied roles, or chat IDs on their own.
5. Test invalid, stale, replayed, cross-origin, and wrong-group requests before allowing settings changes.

See Telegram's [Mini Apps documentation](https://core.telegram.org/bots/webapps), the [Telegram compatibility record](../compatibility/telegram-api.md), and the [Mini App security contract](../security/authorization-and-data-contracts.md).

## Guard Mode activation gate

Guard is a transport for the existing admission lifecycle, not a second permissions system. Before any real-client test, the implementation must already handle synthetic success, failure, expiry, duplicate, stale-request, and approval-failure cases. Then the owner can enable Guard Mode in BotFather and configure the bot as Guard for one dedicated test group. We will provide the exact setting path and required group rights when that code slice is ready. Keep manual admission review as the fallback.

## Payments and Telegram Stars gate

Payments are not required to run FOAB and are not part of the initial community-moderation release. If a later product decision adds digital goods or services inside Telegram, first implement an idempotent transaction ledger, timely pre-checkout handling, fulfillment only after `successful_payment`, support and terms, and refund handling. Then use a dedicated test environment before any production activation. Review Telegram's [Bot Payments API for digital goods and services](https://core.telegram.org/bots/payments-stars) at that time; provider lists shown in BotFather do not mean FOAB has a payment integration.

## Requesting an owner action

No setting needs activation now. If a later implementation or real-client test needs an owner-controlled BotFather or group change, the task report will name the exact setting path, current state, required value, feature and rights it unlocks, test-only scope, and rollback. Until then, leave optional BotFather modes disabled and keep administrator rights minimal.
