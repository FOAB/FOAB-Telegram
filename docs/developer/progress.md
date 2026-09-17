# Implementation Progress

## Current checkpoint

- **T-00 — Telegram Bot API/SDK compatibility:** implemented for compile-time API surfaces and synthetic fixture shapes. This does not prove live Bot API delivery, client rendering, or permissions.
- **Repository security foundation:** implemented with ignored local secrets/data, a pinned secret scanner, synthetic scanner self-test, dependency age policy, dependency audit, and GitHub workflows. GitHub-hosted workflow execution and repository branch protection still need external verification.
- **T-01 — TypeScript runtime bootstrap:** implemented with typed token/database configuration, grammY long polling, scoped onboarding/settings handlers, read-only `/ping` and `/id` diagnostics, Web App URL gating, private Menu Button selection, ephemeral group command-menu publication and requester-targeted replies, inline callback fallback, normal private-chat replies, safe structured logs, and database-pool cleanup. Live Telegram behavior has not been exercised in this implementation slice.
- **T-02 — PostgreSQL/Drizzle identity and group storage:** implemented and locally verified on PostgreSQL 18. The reviewed migration creates installation identity, singleton runtime state, and installation-scoped group records. Migration, runtime, and test roles are separate; runtime roles cannot create or alter schema objects.
- **T-03 — Typed Telegram update boundary and inbox:** implemented and locally verified. Supported `message` and `my_chat_member` updates are projected into bounded internal shapes, unknown top-level variants are rejected, and an installation-scoped lease prevents concurrent duplicate processing without storing raw update content. A transactional outbox is still pending.
- **F-001 — Onboarding and help:** in progress. Private/group `/start`, `/help`, `/ping`, `/id`, `/settings`, and `/cancel`, group registration, requester-only group feedback, localized command descriptions, current exact-group administrator checks, optimistic group settings writes, and private group selection exist. Live Telegram checks and broader help flows remain.
- **F-015 — Read-only identity diagnostics:** in progress. `/ping` reports process reachability through the bot handler, while `/id` reports only the authenticated sender's current chat and user IDs from the current update. Staff, user, bot, and richer chat information remain.
- **F-060 — Administration Mini App:** in progress. The optional HTTPS URL boundary, private Menu Button and settings-flow launch, signed `initData` verifier, schema-validated HTTP API, short-lived server-side session lifecycle, origin/CSRF controls, allowlisted group responses, administrator-filtered group listing, optimistic settings write route, and initial React/Vite group/settings UI exist. Durable multi-instance sessions, rate limits, broader administration screens, browser/runtime evidence, and deployment remain. Inline callback keyboards are the fallback.
- **F-065 — Ephemeral command feedback:** in progress. The group command registry opts `/start`, `/help`, `/ping`, `/id`, `/settings`, and `/cancel` into ephemeral delivery; response payloads target the authenticated sender and reply to the incoming ephemeral message. Private-chat responses use ordinary messages. Telegram eligibility and client delivery remain unverified; failed private delivery never falls back to a public group response.
- **F-002 — Group selection and private administration:** in progress. A private `/settings` flow lists only active groups where the current user's administrator status can be confirmed, binds a short-lived numeric selection to that private user and installation, and rechecks the selected group before every settings write. Pagination, administrator reload, and the broader private administration surface remain.

## Evidence from this implementation slice

- Local PostgreSQL service `postgresql-x64-18` — running on loopback port 5432; administrator authentication was verified without printing query results or credentials.
- `pnpm db:provision:local` — passed; created `foab_dev` and `foab_test`, generated three least-privilege roles, wrote credentials only to ignored local environment files, and removed the temporary administrator password from `.env`.
- `pnpm db:generate` — passed; generated the reviewed settings-revision migration for the existing three-table schema.
- `pnpm db:migrate` — passed against `foab_dev`.
- `pnpm db:migrate:test` — passed against the separate `foab_test` database.
- `pnpm test:integration` — passed; eight PostgreSQL integration tests cover concurrent installation initialization, identical chat IDs in separate installations, stale group updates after bot removal, runtime role privileges, optimistic settings revisions, cross-installation settings denial, and concurrent/failed inbox claims.
- `pnpm check` — passed; strict typecheck and 55 unit tests, including callback normalization, signed Web App `initData`, session expiry/revocation, origin/CSRF handling, allowlisted API output, cross-group denial, private selection, authorization, environment-file separation, keyboard contracts, and group ephemeral command payloads.
- `pnpm build` — passed after the Mini App API and session changes.
- The settings slice added `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:migrate:test` coverage for the settings revision column; integration tests now cover stale and cross-installation settings writes.
- `pnpm install --frozen-lockfile` and `pnpm audit` — passed; no known dependency vulnerabilities remain after pinning the affected transitive `esbuild` dependency to a patched release.
- `pwsh -NoProfile -File scripts/security/Invoke-SecurityChecks.ps1 -SelfTest` — passed synthetic positive/negative checks, Git-visible working-tree scanning, and full available Git-history scanning.

## Scope and safety gates

- The user-provided PostgreSQL administrator password was used locally for provisioning and removed from `.env` after successful setup. It is not in tracked files, examples, migration SQL, or application logs.
- The bot token was not used during this implementation slice. No Telegram request, BotFather setting change, group access, message send, or moderation action was performed.
- Runtime, migration, and test credentials are separated: `.env` contains only bot/runtime values, `.env.database` contains migration URLs, and `.env.test` contains the test database URL. All are ignored by Git.
- Group records are keyed and queried by server-owned installation UUID plus Telegram chat ID. The database stores group metadata, bot membership state, and versioned language/time-zone settings only; message bodies and member names are not persisted.
- Private group selection stores only short-lived server-owned group IDs bound to the installation, private chat, and user. It does not accept a client-supplied chat ID as proof of authority.
- The inbox stores only normalized update metadata and a short processing lease. It can retry a failed handler, but it does not make external sends transactional; that guarantee belongs to the pending outbox.
- Group registration does not establish administrator authority. The settings command and Mini App API separately check the current Telegram administrator status for the exact target group; moderation, broader roles, durable jobs, audit, and recovery remain unimplemented.
- Every multi-group feature must preserve the contracts in [authorization and data handling](../security/authorization-and-data-contracts.md).
- Source identifiers, comments, TSDoc, tests, and technical documentation remain in English. User-facing messages belong in the en-US, pt-BR, and es-ES catalogs.

## Next dependency-ready work

1. Replace in-memory sessions with durable server-side storage and rate limiting before multi-instance deployment, then expand the UI across the next authorized capabilities.
2. Finish F-001/F-002 with live Telegram validation, bounded pagination, administrator reload, and contextual help.
3. Add a transactional outbox and durable job claims before implementing moderation or other external group mutations.
