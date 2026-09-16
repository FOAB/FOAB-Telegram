# Father of All Bots (FOAB)

FOAB is a new, independent Telegram group-management bot in active development. Its identity, architecture, code, interface, and documentation are being created specifically for FOAB. One self-hosted installation is designed to manage multiple Telegram groups while keeping each group's settings, moderation records, messages, and permissions within that group's scope.

This repository documents the intended product and its current implementation separately. **Most features below are planned; they are not available in the bot yet.**

## Project status

The current runnable bot uses strict TypeScript, Node.js 24, grammY, and PostgreSQL. It validates its token and database URL, loads a database-owned installation identity, publishes localized role-scoped command menus, and starts long polling. It records group metadata, the bot's membership state, and the group's language/time-zone settings. Private chats receive ordinary responses; group commands are registered as ephemeral and their responses target only the requesting member.

Implemented foundation:

- Typed runtime configuration, safe structured logs, graceful database-pool cleanup, and a grammY long-polling process.
- PostgreSQL schema and reviewed Drizzle migration for installation identity and group metadata, with every group key/query scoped by installation.
- Separate database migration and runtime roles; the runtime role has data access but no schema or cluster-administration privileges.
- Automatic group registration from Telegram bot-membership updates and onboarding commands; removing the bot marks that group inactive.
- Ephemeral group `/start`, `/help`, `/settings`, and `/cancel` commands and requester-only ephemeral responses; Telegram delivery and client support are not yet live-tested.
- Initial en-US, pt-BR, and es-ES onboarding, help, and settings messages, with the group locale defaulting to en-US.
- Current group-administrator checks for settings, installation/group-scoped settings writes, and optimistic settings revisions.
- A repeatable local PostgreSQL provisioner and synthetic integration tests for concurrent startup and cross-installation isolation.
- Strict TypeScript compiler settings and synthetic unit tests.
- A dated Telegram Bot API and SDK compatibility record with compile-time contracts and synthetic fixtures.
- A security policy, secret-safe logging rules, ignored local credentials/data, and a pinned local secret scanner.

Not implemented yet:

- Broader administrator roles and authorization, plus all moderation or protection actions.
- Durable update processing, jobs, audit records, and recovery workflows.
- Moderation, automatic replies, admission/Guard, federations, or any other group feature.
- The HTTP API, Mini App, deployment packaging, and the full three-language interface.

See the [feature checklist](docs/product/feature-checklist.md) for planned, implemented, and verified capabilities, and [implementation progress](docs/developer/progress.md) for current evidence and the next task. The [BotFather setup checklist](docs/developer/botfather-setup.md) records when owner-side configuration is and is not needed.

## Product goals

### Multi-group by design

FOAB is intended to serve many groups from one self-hosted installation and one Telegram bot token. Every group-level operation must resolve the installation and target chat, verify the actor's current authority for that chat, and keep group data isolated. A user's personal language preference is separate from each group's settings. Being an administrator in one group must not grant access in another.

The first release is designed as a modular monolith backed by PostgreSQL. It does not depend on a central FOAB service, a managed bot-token factory, or an automated personal Telegram account. Telegram permissions and API limitations remain explicit; the bot must report missing rights instead of claiming an action succeeded.

### One implementation per capability

FOAB's feature set is defined by its own product goals, security policy, and Telegram API contracts. Each capability has one canonical service, data model, and authorization path. Related settings and entry points extend that capability; a separate module is created only when it has a distinct responsibility and lifecycle.

**Automatic Replies** is designed as one FOAB capability for exact commands such as `/discord` and matching phrases such as “what is the Discord?”. It will support configurable matching modes, response templates, group or topic scope, cooldowns, and delivery. Custom commands, aliases, and sticker/GIF triggers use the same typed content and trigger system, so they cannot bypass command permissions.

Federations remain a distinct feature because they introduce a separate trust and membership lifecycle. A group owner must explicitly consent before federation actions can affect that group. Native Telegram communities and linked chats do not imply federation membership or permission to share bans.

## Planned feature set

The following describes the product roadmap, not shipped commands. The [feature checklist](docs/product/feature-checklist.md) tracks each capability and its delivery status. Every requirement has one canonical owner; related triggers, settings, aliases, and delivery options extend that owner instead of creating duplicate implementations.

| Feature area | Planned capabilities |
|---|---|
| Setup and access | Group onboarding and selection, help, personal and group settings, time zones, localized menus, command permissions, scoped moderator roles, and diagnostics for missing Telegram rights. |
| Content and automatic replies | Rules, reusable notes and templates, welcome/goodbye messages, exact and phrase-based filters/replies, custom commands and aliases, media triggers, formatting, and scheduled messages. |
| Moderation | Ban, mute, kick, warnings, exemptions, reports, appeals, protected targets, reasons and durations, and auditable outcomes. A restriction from one cause must not accidentally erase another active restriction. |
| Spam and content protection | Link and invite checks, flood control, duplicate messages, phrases and blocklists, content-type policies, forwarding controls, Unicode/name checks, raid detection, and optional observe-before-enforce behavior. Punitive rules are designed to be disabled or observe-only by default. |
| Joining and Guard | Join-request review, rules acceptance, CAPTCHA, admission requirements, raid controls, and a Guard quiz before admission where Telegram supports the required flow. Manual review is the fallback when a capability is unavailable. |
| Cleanup and group operations | Message purge and scheduled deletion, service-message cleanup, topics, invite links, linked discussions/channels, staff reports, audit destinations, and permission health checks. |
| Federations and shared lists | User-created federations, explicit group consent, federation roles, subscriptions, bans with provenance and expiry, review/appeal flows, and per-group delivery status. Cross-installation federation feeds are outside the initial design. |
| Administration and portability | A Telegram Mini App, policy simulation, configuration history and presets, privacy controls, scoped export/import, and recovery guidance. Imports require validation and preview; they must not silently activate external ban lists. |
| Community workflows | Topic-aware schedules, polls, reactions, events, bounded declarative workflows, and optional extensions for newer Telegram message and community capabilities when the required API, rights, and client behavior are verified. |
| Optional payments | A separately gated extension for subscriptions or digital services. No payment configuration is required for FOAB's core features. Digital goods sold inside Telegram must follow the current [Telegram Stars requirements](https://core.telegram.org/bots/payments-stars), with payment confirmation, fulfillment, support, terms, and refunds implemented before activation. |

### Telegram API capabilities

The project treats newer Telegram Bot API features as delivery or interaction capabilities that existing FOAB features may use—not as duplicate product modules. Initial ephemeral `/start` and `/help` handling is implemented for group chats. Delivery is not guaranteed and supported-client behavior still needs verification. Other planned examples include Guard admission queries, structured Rich Messages with a useful text fallback, disabled buttons, and selected community/reaction/poll flows.

The compatibility record was checked against Bot API 10.3 and grammY 1.46.0 on September 16, 2026. Compile-time type contracts and synthetic fixtures confirm that the selected SDK exposes the documented API shapes; they do **not** prove real Telegram delivery, client rendering, permissions, or end-to-end behavior. See [Telegram compatibility and open verification gates](docs/compatibility/telegram-api.md).

## Languages and documentation

English is the canonical language for root documentation, source identifiers, comments, TSDoc, tests, and technical documentation. Code must be clearly and usefully documented, especially where permissions, data scope, side effects, or recovery are involved. User-facing text will use localization catalogs for **English (en-US), Brazilian Portuguese (pt-BR), and Spanish (es-ES)**. Personal and group language choices are independent.

Implementation and technical documentation are written in English. User-facing text belongs in localization catalogs for **English (en-US), Brazilian Portuguese (pt-BR), and Spanish (es-ES)**.

## Security and privacy

Security is part of the feature contracts from the first implementation slice. The repository policy is in [`SECURITY.md`](SECURITY.md), and the [security evidence ledger](docs/security/README.md) distinguishes repository controls from protections that still require application code.

Current safeguards include:

- **No committed runtime credentials:** `.env` files, local credentials, database files/dumps, private keys, logs, exports, and local scanner binaries are ignored. `.env.example` contains placeholders only. Ignore rules do not remove data already committed, so changes and Git history still need scanning.
- **Secret-safe configuration and logs:** the runtime rejects a missing or malformed token without printing its value. Logs use an explicit allowlist and do not serialize raw Telegram updates or exception messages.
- **Secret scanning:** the local and CI workflow pins TruffleHog and verifies the scanner archive checksum, runs synthetic positive/negative checks, scans Git-visible working-tree paths and Git history, and excludes ignored local files such as `.env`. It rejects ignored files present in the Git index. It does not verify credentials with external providers or print scanner findings into routine logs.
- **Strict typing and dependency checks:** strict TypeScript checks the application contracts; the lockfile pins package versions and an age policy delays newly published dependencies. Type checking reduces certain coding mistakes but is not an authorization or security proof.
- **Least privilege in CI:** repository permissions are read-only for the secret-scan workflow. The actual GitHub workflow result and repository settings such as branch protection must be verified on GitHub; YAML alone does not enforce them.

Application safeguards still to implement and test include server-side authorization for the remaining mutations, feature-specific data access, federation consent, input/output allowlists, rate limits, safe durable job retries, audit redaction, retention/export/deletion rules, and Mini App authentication. The current settings path authorizes only the exact current group administrator and does not authorize moderation. Synthetic fixtures and local checks never authorize testing against third-party bots, groups, or production accounts.

## Technology

| Layer | Current status | Choice |
|---|---|---|
| Runtime and language | In use | Node.js 24, strict TypeScript |
| Telegram bot | Minimal bootstrap in use | grammY 1.46.0 |
| Package manager | In use | pnpm 11.22.0 with a committed lockfile |
| Tests | In use | Vitest 5 with synthetic fixtures; no real Telegram calls |
| Database | Local schema and group registry in use | PostgreSQL 18 with Drizzle and reviewed SQL migrations |
| HTTP API | Planned | Fastify with schema-validated contracts |
| Administration UI | Planned | React, Vite, and TypeScript Telegram Mini App |
| Durable background work | Planned | PostgreSQL-backed inbox, outbox, and scheduled jobs; Redis/Valkey is not required initially |

The first database slice stores installation identity, group metadata, and versioned group language/time-zone settings. It does not store message bodies or perform moderation. The settings command checks current authority for the exact group before writing. See the [database runbook](docs/developer/database.md) and track remaining work in the [feature checklist](docs/product/feature-checklist.md) and [implementation progress](docs/developer/progress.md).

## Run locally

Requirements: Windows, Linux, or macOS; Node.js 24; Corepack; a local PostgreSQL 18 service; and a development bot token created for this project through Telegram's BotFather. The token and database URLs are local secrets. Never send them in chat, commit them, or paste them into an issue.

```powershell
corepack enable pnpm
corepack prepare pnpm@11.22.0 --activate
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

Put the development token in `.env` as `FOAB_TELEGRAM_BOT_TOKEN=...`. To provision a local database, temporarily add your PostgreSQL administrator password to the ignored `.env` as `FOAB_PG_ADMIN_PASSWORD=...`, then run:

```powershell
pnpm db:provision:local
pnpm db:migrate
pnpm db:migrate:test
pnpm test:integration
```

The provisioner creates separate development and test databases, generates local role credentials, writes runtime, migration, and test URLs to separate ignored environment files, and removes the temporary administrator password from `.env`. The bot process receives only its runtime database URL. It refuses to take over an existing database owned by another role. Do not put an administrator password in `.env.example` or source control.

Start the bot after the local databases are migrated:

```powershell
pnpm dev
```

On startup, the bot publishes its current localized command menus through Telegram's Bot API and begins long polling. Adding it to a group or sending a group command registers that group; leaving/removing the bot marks it inactive. `/settings` checks the invoking user's current Telegram administrator status in that exact group before changing the group's language or time zone. The bot does not read message history or execute moderation. Stop it with `Ctrl+C`. Do not use a production token for development. The code has not yet been exercised against a live Telegram test group.

## Checks

```powershell
pnpm check
pnpm build
pnpm audit --audit-level high
pnpm security:secrets
```

`pnpm check` runs strict type checking and local unit tests. `pnpm test:integration` uses only the local `foab_test` database and verifies group isolation. `pnpm build` emits the runtime to the ignored `dist/` directory. `pnpm audit` checks the locked dependency tree against the configured advisory database at run time. `pnpm security:secrets` runs synthetic scanner self-tests and secret scans over Git-visible working-tree paths and available Git history; ignored local files are excluded, and ignored paths in the Git index fail the check. These checks are useful evidence, not a certification that the application is secure or that GitHub enforcement is active.

## Security reports and contributions

Read [`SECURITY.md`](SECURITY.md) before changing a trust boundary or handling credentials. The [security change-report template](docs/security/change-report-template.md) records scope, checks, evidence, and limitations. For implementation work, also follow [`AGENTS.md`](AGENTS.md), the [feature checklist](docs/product/feature-checklist.md), and the relevant security and compatibility contracts.

FOAB's future license choice has not yet been ratified. Do not assume a license or copy third-party code, branding, datasets, or translations. FOAB's code and user experience are developed as an independent implementation under the project's own requirements.
