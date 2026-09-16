# Implementation Progress

## Current checkpoint

- **T-00 — Telegram Bot API/SDK compatibility:** implemented for compile-time API surface and synthetic fixture shapes. This does not prove live Bot API behavior or client rendering.
- **Security foundation:** implemented in source with ignored local secrets/data, a pinned secret scanner, synthetic scanner self-test, dependency age policy, dependency audit, and GitHub workflows. The local scanner covers Git-visible tracked and non-ignored files plus available Git history; ignored local files are excluded, and ignored paths in the Git index are rejected. GitHub-hosted workflow execution and repository branch protection still require external verification.
- **T-01 — TypeScript application bootstrap:** implemented as a minimal grammY long-polling process with typed token validation, safe structured logs, and a non-mutating `/start` response. Strict typing, unit tests, and build passed. It is not yet a group-management bot.
- **T-02 — PostgreSQL/Drizzle identity and group storage:** not started. PostgreSQL service availability was checked previously; no FOAB database, schema, or role has been created.

## Evidence so far

- `pnpm typecheck` — passed with strict TypeScript options on Node 24.19.0 and pnpm 11.22.0.
- `pnpm test` — 8 local tests passed across typed environment configuration and synthetic Telegram API compatibility fixtures.
- `pnpm build` — passed; emitted application files are ignored under `dist/`.
- `pnpm audit --audit-level high` — passed; no known vulnerabilities were reported at the time of the check.
- `pwsh -NoProfile -File scripts/security/Invoke-SecurityChecks.ps1 -SelfTest` — positive and negative synthetic secret fixtures passed; working-tree and full Git-history scans passed locally after applying the documented Windows URI workaround.

## Scope and safety gates

- The owner-provided bot token was used only for a read-only Telegram `getMe` credential smoke check; the token value was not printed or stored in the repository. No message was sent, no group was accessed, and no moderation action was tested.
- BotFather screenshots are treated as setup evidence. No BotFather setting has been changed; no owner action is currently required.
- The PostgreSQL password previously supplied for local setup is not stored in the repository, environment files, test fixtures, or logs.
- Every multi-group feature must preserve installation and chat scope as defined in `docs/security/authorization-and-data-contracts.md`.
- Comments, TSDoc, source identifiers, and newly written technical documentation remain in English. User-facing text belongs in localization catalogs.
- README feature descriptions distinguish planned capabilities from behavior available in the current bootstrap.

## Next

1. Implement T-02's first scoped PostgreSQL migration and repository tests using synthetic installations/groups.
2. Build the update normalization, durable inbox/outbox, and group-scoped authorization foundations before adding group mutations.
3. Select the next dependency-ready item in the English [feature checklist](../product/feature-checklist.md), implement one complete slice, and record its tests and external verification gaps here.
