# Implementation Progress

## Current checkpoint

- **T-00 — Telegram Bot API/SDK compatibility:** implemented for compile-time API surfaces and synthetic fixture shapes. This does not prove live Bot API delivery, client rendering, or permissions.
- **Repository security foundation:** implemented with ignored local secrets/data, a pinned secret scanner, synthetic scanner self-test, dependency age policy, dependency audit, and GitHub workflows. GitHub-hosted workflow execution and repository branch protection still need external verification.
- **T-01 — TypeScript runtime bootstrap:** implemented with typed token/database configuration, grammY long polling, scoped `/start` and `/help` handlers, ephemeral group command-menu publication and requester-targeted replies, safe structured logs, and database-pool cleanup. Live Telegram behavior has not been exercised in this implementation slice.
- **T-02 — PostgreSQL/Drizzle identity and group storage:** implemented and locally verified on PostgreSQL 18. The reviewed migration creates installation identity, singleton runtime state, and installation-scoped group records. Migration, runtime, and test roles are separate; runtime roles cannot create or alter schema objects.
- **F-001 — Onboarding and help:** in progress. Private/group `/start`, `/help`, group registration, requester-only group feedback, and initial en-US/pt-BR/es-ES messages exist. `/settings`, `/cancel`, broader help, localized command descriptions, and live Telegram checks remain.
- **F-065 — Ephemeral command feedback:** in progress. The group command registry opts `/start` and `/help` into ephemeral delivery; response payloads target the authenticated sender and reply to the incoming ephemeral message. Telegram eligibility and client delivery remain unverified; failed private delivery never falls back to a public group response.

## Evidence from this implementation slice

- Local PostgreSQL service `postgresql-x64-18` — running on loopback port 5432; administrator authentication was verified without printing query results or credentials.
- `pnpm db:provision:local` — passed; created `foab_dev` and `foab_test`, generated three least-privilege roles, wrote credentials only to ignored local environment files, and removed the temporary administrator password from `.env`.
- `pnpm db:generate` — passed; generated the reviewed initial SQL migration for three tables.
- `pnpm db:migrate` — passed against `foab_dev`.
- `pnpm db:migrate:test` — passed against the separate `foab_test` database.
- `pnpm test:integration` — passed; four PostgreSQL integration tests cover concurrent installation initialization, identical chat IDs in separate installations, stale group updates after bot removal, and runtime role privileges.
- `pnpm check` — passed; strict typecheck and 22 unit tests, including environment-file separation and ephemeral command payloads.
- `pnpm build` — passed after the ephemeral group command changes.
- `pnpm install --frozen-lockfile` and `pnpm audit` — passed; no known dependency vulnerabilities remain after pinning the affected transitive `esbuild` dependency to a patched release.
- `pwsh -NoProfile -File scripts/security/Invoke-SecurityChecks.ps1 -SelfTest` — passed synthetic positive/negative checks, Git-visible working-tree scanning, and full available Git-history scanning.

## Scope and safety gates

- The user-provided PostgreSQL administrator password was used locally for provisioning and removed from `.env` after successful setup. It is not in tracked files, examples, migration SQL, or application logs.
- The bot token was not used during this implementation slice. No Telegram request, BotFather setting change, group access, message send, or moderation action was performed.
- Runtime, migration, and test credentials are separated: `.env` contains only bot/runtime values, `.env.database` contains migration URLs, and `.env.test` contains the test database URL. All are ignored by Git.
- Group records are keyed and queried by server-owned installation UUID plus Telegram chat ID. The database stores group metadata and bot membership state only; message bodies and member names are not persisted.
- Group registration does not establish administrator authority. Authorization, moderation, durable jobs, audit, and recovery remain unimplemented.
- Every multi-group feature must preserve the contracts in [authorization and data handling](../security/authorization-and-data-contracts.md).
- Source identifiers, comments, TSDoc, tests, and technical documentation remain in English. User-facing messages belong in the en-US, pt-BR, and es-ES catalogs.

## Next dependency-ready work

1. Finish F-001 with persisted group language/time-zone settings, `/settings`, `/cancel`, and authorization-aware help behavior.
2. Add typed update normalization, durable inbox/outbox processing, and group-scoped authorization before implementing group mutations.
3. Implement one complete feature from the English [feature checklist](../product/feature-checklist.md), record its behavior tests and failure handling, then arrange an exact, bounded Telegram test with a dedicated bot/group when external verification is needed.
