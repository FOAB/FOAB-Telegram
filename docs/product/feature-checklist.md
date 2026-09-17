# FOAB Feature Checklist

This is the versioned, English-language status tracker for FOAB product capabilities. It records what is planned, implemented, and verified without treating a command stub or an API type declaration as a finished feature.

## Completion rules

- **Not started:** no production-ready implementation exists.
- **In progress:** some behavior exists, but the complete capability or its acceptance checks are missing.
- **Implemented:** the scoped behavior, persistence/migrations where needed, authorization, localization, documentation, and automated tests are present.
- **Verified:** implementation checks pass and any required Telegram-client, permission, deployment, or recovery checks have evidence recorded in [implementation progress](../developer/progress.md).

Leave the checkbox empty until the capability meets its acceptance contract. Set `Implemented` and `Verified` separately; external behavior must not be inferred from unit tests. Preserve the F-number for traceability. It does not mean that each item needs its own service, menu, table, or command. Extend the canonical capability when related behavior shares its outcome and lifecycle.

## Foundation already in place

- [x] **T-00 — Telegram API/SDK compatibility baseline.** Compile-time contracts and synthetic fixtures cover selected API shapes. Live delivery, client rendering, and permissions are not proven by this work.
- [x] **T-01 — TypeScript runtime bootstrap.** Strict TypeScript, typed token/database validation, grammY long polling, safe structured logs, database-pool cleanup, and initial `/start`/`/help`/`/settings`/`/cancel` handlers. Live Telegram behavior is not yet verified.
- [x] **Repository security baseline.** Ignored local secrets/data, a pinned secret scanner with synthetic checks, dependency checks, and GitHub workflow definitions. Hosted workflow execution and repository protection settings still need GitHub evidence.
- [x] **T-02 — PostgreSQL and durable identity/group storage.** Initial Drizzle migration, one installation identity per database, installation-scoped group records, local role separation, and synthetic multi-installation integration tests. **Status: Implemented and verified on local PostgreSQL 18; live Telegram registration remains unverified.**
- [x] **T-03 — Typed Telegram update boundary and inbox.** Bounded projection of supported updates, rejection of unknown top-level variants, installation-scoped processing leases, retry after failure, and duplicate suppression without raw update storage. **Status: Implemented and verified locally; transactional outbox and live Telegram behavior remain.**

The product capabilities below remain unfinished unless their own status says otherwise. F-001 is still in progress: onboarding, settings, cancellation, scoped administrator checks, and localized menus exist, but live Telegram checks and the remaining contextual flows are outstanding.

## Platform and group access

- [ ] **F-001 · P0 — Onboarding, help, and settings.** `/start`, `/help`, `/settings`, and `/cancel`; contextual help; private start guidance; cancellation affects only the active flow. **Status: In progress** — onboarding, help, read-only diagnostics, settings, cancellation, scoped group settings with optimistic revisions, current exact-group administrator checks, localized menus, transient-flow cancellation, and private group selection exist; live Telegram verification and broader contextual help remain.
- [ ] **F-002 · P0 — Group selection and private administration.** List only known groups, search/page results, bind a private conversation to an explicit group, and reload known administrators; revalidate the actor's current group authority. **Status: In progress** — private `/settings` lists only active groups whose current administrator status can be confirmed, binds a short-lived numeric selection to the installation/private user, and rechecks the selected group before writes; pagination, administrator reload, and broader private administration remain.
- [ ] **F-003 · P0 — Language, time zone, and local formats.** Independent personal and per-group language, IANA time zones, localized formatting, and localized help. **Locales:** en-US, pt-BR, es-ES.
- [ ] **F-015 · P2 — Staff, user, chat, and bot information.** Provide `/staff`, `/id`, `/info`, `/me`, and `/ping` from observed/known data; distinguish unknown data from nonexistence and never treat an old username as current identity. **Status: In progress** — `/ping` and `/id` are read-only, localized, and scoped to the authenticated current update; staff, `/info`, `/me`, and richer known-data handling remain.
- [ ] **F-047 · P0 — Access-control lists and roles.** Authorize each command and setting by actor, group, context, and capability; support scoped/expiring custom grants. Hidden UI elements are not authorization.
- [ ] **F-055 · P3 — Managed instances and bot clones.** Custom start copy, command visibility, and branding only after independent hosting and token custody are designed; no token factory in the initial release.
- [ ] **F-064 · P2 — Diagnostics and health center.** Show missing Telegram rights, recent failures, queue/integration health, and recovery guidance without disclosing tokens.

## Content, templates, and automatic replies

- [ ] **F-004 · P1 — Group rules and acceptance.** Versioned text/media/buttons, authorized delivery, optional acceptance tied to a rules revision, and a safe update/reset flow.
- [ ] **F-005 · P1 — Shared message-template editor.** Placeholders, media/captions, URL buttons, previews, topic and locale selection; escape untrusted values and validate the fully rendered message before delivery.
- [ ] **F-008 · P2 — Saved notes and reusable content.** Named text/media/buttons, aliases, search/list/get/clear, and visibility rules so private notes never leak to unauthorized members.
- [ ] **F-009 · P2 — Automatic replies and custom triggers.** One rule system for exact commands, prefixes, words, and phrases such as “what is the Discord?”; support matching mode, alternatives, templates, scope, cooldown, preview, and safe delivery. `/reply` and `/filter` are entry-point aliases to this single capability.
- [ ] **F-010 · P2 — Native command aliases.** Bind aliases to registered commands and their existing authorization; validate arguments and reject cycles or excessive alias depth.
- [ ] **F-011 · P2 — Sticker and GIF triggers.** Match stable media identity and reauthorize the person who triggers the action; never inherit the creator's permissions.
- [ ] **F-012 · P2 — Long-message delivery.** Split at safe paragraph/entity boundaries without breaking Unicode or formatting; preserve order and apply rate limits.
- [ ] **F-016 · P2 — User-requested translation.** Configurable provider, target locale, and usage budget; disclose when unavailable and never send group content to a third party silently.
- [ ] **F-063 · P2 — Configuration presets and history.** Compare versions and apply changes as a new revision after checking current permissions.
- [ ] **F-072 · P3 — Help/notes search and optional assistant.** Answers may suggest actions; every executed action still passes through the normal authorized command path. Group data must not train a central service.

## Greetings

- [ ] **F-006 · P1 — Welcome messages.** Shared templates for group/private delivery, topics, previous-message cleanup, raid batches, and post-challenge admission; deduplicate overlapping join updates and handle unavailable DMs.
- [ ] **F-007 · P1 — Goodbye messages.** Configurable template, destination, TTL, and distinct voluntary-leave/removal behavior; do not recurse when FOAB itself removes a member.

## Moderation cases and sanctions

- [ ] **F-020 · P1 — Ban, unban, mute, unmute, and kick.** Support duration, reason, quiet feedback, and evidence; report success only after Telegram confirms it and preserve other active restriction causes.
- [ ] **F-021 · P1 — Warnings.** Weighted warnings, expiry, thresholds, reset/list, and configured terminal action; concurrent threshold crossings produce one sanction.
- [ ] **F-038 · P2 — Scoped exemptions.** Exempt users from a selected module for a reason and optional duration; an exemption grants neither admin authority nor blanket immunity.
- [ ] **F-044 · P2 — Batch sanction cleanup.** Preview and revalidate known targets before batch unmute/unban/removal; distinguish unavailable targets without guessing from display names.
- [ ] **F-062 · P2 — Cases, appeals, and review.** Audited state transitions, restricted evidence, deadlines, reviewers, and decisions; filing an appeal does not itself undo a sanction.

## Protection policies

- [ ] **F-022 · P1 — Link and invite protection.** Detect configured Telegram links, invites, bots, usernames, domains, and URLs; normalize internationalized domains and use exact safe allowlist boundaries.
- [ ] **F-023 · P2 — Forwarded and quoted-source policy.** Configure trusted/blocked channel, group, user, or bot origins; represent hidden/unknown sources honestly and distinguish linked-channel forwards.
- [ ] **F-024 · P1 — Flood and duplicate detection.** Per-member/chat/topic count and time windows, consecutive bursts, duplicate handling, and optional cleanup; deduplicate repeated updates and define album counting.
- [ ] **F-025 · P2 — Word and phrase policies.** Literal, whole-word, and bounded safe-pattern matching with independent lists, configurable case/accent behavior, limits, and an explainable simulator.
- [ ] **F-026 · P2 — Unicode/script and name checks.** Opt-in script/mix thresholds with emoji/number tolerance; never infer nationality and avoid treating multilingual Latin text as suspicious by default.
- [ ] **F-027 · P1 — Message-type policy registry.** Per-type/subtype allow, delete, or other configured policy for supported media and service classes; capability-gate newer types and fail safely for unknown payloads.
- [ ] **F-028 · P2 — Caps, length, mentions, duplicates, and edits.** Bound text/mention rules; exclude URLs where appropriate and reevaluate edits without repeating the same sanction.
- [ ] **F-029 · P3 — Optional visual content review.** Explicit provider, threshold, timeout, cost, and human-review policy; disabled without a provider, uncertain scores are not proof, and failure never causes an automatic ban.
- [ ] **F-037 · P2 — Anonymous administrators and sender chats.** Preserve channel/anonymous-admin identity without inventing a person; make actions against a channel distinct from actions against a member.
- [ ] **F-039 · P2 — Quiet hours and scheduled restrictions.** Local time zone, days, role/exemption rules, and daylight-saving behavior; never overwrite an external admin change when the schedule ends.

## Admission and raid response

- [ ] **F-030 · P1 — Admission challenges.** Rules acceptance, button/simple challenge, or Mini App transport with deadlines, attempts, cleanup, topic, and configured failure action; only the pending applicant can complete it.
- [ ] **F-031 · P1 — Join-request review.** Approve, reject, manual review, or challenge flows with configurable welcome; reconcile external approval and repeated join requests without duplicate sanctions.
- [ ] **F-032 · P2 — Guard admission quiz.** Per-group quiz, stages, progress, low-latency decision, required Telegram capability/setup, and manual-review fallback.
- [ ] **F-033 · P2 — Additional join requirements.** Configurable username/name/photo/channel relationship and observable inviter checks; unavailable data is not proof of absence, with private challenge or review fallback.
- [ ] **F-034 · P2 — Join restrictions and bot/leave events.** Block configured joins or added bots and handle fast leave/rejoin; never claim a member can be prevented from leaving, and sanction inviters only when Telegram identifies them reliably.
- [ ] **F-035 · P1 — Anti-raid state machine.** Join threshold/window, duration, cooldown, suspect review, and normal/suspected/raid/recovery states; default response protects new arrivals rather than mass-banning existing members.

## Federations and shared user lists

- [ ] **F-036 · P2 — Local/shared user lists.** Explicitly opt-in sources with provenance, reason, expiry, review/appeal and revocation; unavailable or expired sources never create new sanctions.
- [ ] **F-052 · P2 — User-created federations.** Create/manage federations; grant federation roles; join/leave groups only with group-owner consent; manage subscriptions, bans, reasons, expiry, appeals, import/export, audit, and per-group delivery. Prevent trust cycles and preserve each source cause when lifting or detaching sanctions.

## Cleanup

- [ ] **F-040 · P1 — Message deletion and purge.** Individual/scheduled delete, range/bulk preview, and selection by group/topic/author/date; report deleted, unavailable, and failed items separately.
- [ ] **F-041 · P2 — Command and bot-message cleanup.** Configure by command, actor role, message category, and TTL; run a command before scheduling its cleanup and retain important errors long enough to read.
- [ ] **F-042 · P2 — Service-message cleanup.** Select supported join/leave/profile/title/pin/topic/boost/voice/checklist/community service updates and disclose unsupported types or Telegram deletion limits.
- [ ] **F-043 · P2 — Message expiry and edit guidance.** Configure observed-message expiry and late-edit handling; never promise full historical cleanup and rate-limit suggestions to edit.

## Reports, notifications, and audit

- [ ] **F-045 · P1 — Member reports and staff calls.** `/report` and staff escalation with case ID, destination, cooldown, triage, and loop prevention; members can report even when private messages to them are unavailable.
- [ ] **F-046 · P2 — Personal notifications and mute preferences.** Opt-in mention notices, personal mute, summaries, and exclusion controls; do not reveal private text to removed members and stop retrying blocked DMs.
- [ ] **F-048 · P1 — Internal audit and log destinations.** Record actor/action/target/result/correlation internally before optional authorized mirroring; support category filters and destination language without losing internal evidence on mirror failure.

## Group, topic, channel, and schedule management

- [ ] **F-014 · P2 — Group links and invite management.** Create/manage FOAB-owned invite links with expiry, limits, or join approval; never revoke another administrator's link or expose a private invite publicly.
- [ ] **F-049 · P2 — Forum topics.** Configure defaults and topic-specific rules/welcome/challenge/schedules; manage supported topic lifecycle and define a safe pause/fallback when a destination topic disappears.
- [ ] **F-050 · P2 — Linked discussions.** Configure automatic-forward retention/deletion/unpin and comments with thread awareness; account for message-order races and unavailable source posts.
- [ ] **F-051 · P2 — Channel publishing and administration.** Schedule/template posts and manage only posts FOAB owns or can edit; pin/link/log actions require current channel rights.
- [ ] **F-013 · P2 — Recurring messages and schedules.** Interval/calendar/message-count triggers, destination/topic, and validity window; exclude FOAB's own messages and recover from downtime without sending every missed occurrence at once.
- [ ] **F-068 · P3 — Community events, polls, reactions, and reminders.** Use consent and idempotent event processing; do not infer voters in anonymous polls.
- [ ] **F-069 · P3 — Declarative workflows.** Bounded trigger → condition → allowed-action rules with step limits, cycle prevention, authorization, and auditable outcomes.

## Administration UI and Telegram delivery capabilities

- [ ] **F-060 · P1 — Administration Mini App.** Use the same API and authorization as commands; provide drafts, diff, save, and conflict handling. **Status: In progress** — HTTPS URL gating, private Menu Button and settings-flow launch placement, signed Telegram `initData` verification, a schema-validated API, short-lived server-side sessions, origin/CSRF checks, administrator-filtered group listing, optimistic settings writes, and allowlisted responses exist; the React/Vite UI, durable multi-instance sessions, rate limits, and deployment remain. Inline callback keyboards are the fallback.
- [ ] **F-061 · P2 — Policy simulation and observe mode.** Simulate without Telegram side effects and explain the result against a versioned policy.
- [ ] **F-065 · P1 — Ephemeral command feedback.** Show private-to-requester responses where the current Telegram method and client support it; retain an appropriate fallback and never mistake ephemeral feedback for group-wide enforcement. **Status: In progress** — `/start`, `/help`, `/ping`, `/id`, `/settings`, and `/cancel` are registered as ephemeral in group menus and reply to the requesting user; private-chat replies remain ordinary messages. Delivery eligibility and supported clients remain unverified, and fail-closed behavior does not publish a public fallback.
- [ ] **F-066 · P3 — Structured rich messages.** Render supported structured content with a readable text fallback that preserves its meaning.
- [ ] **F-067 · P3 — Guest mode and bot-to-bot integration.** Read/automation access requires explicit allowlists, capability limits, rate/loop controls, and audit; no authority is inherited implicitly.
- [ ] **F-070 · P3 — Optional newer Telegram capabilities.** Evaluate checklists, member tags, communities, channel direct messages, stories, and similar API additions behind capability checks; each addition must extend an existing owner unless a distinct lifecycle is justified.

## Portability, privacy, and optional payments

- [ ] **F-053 · P2 — Configuration import/export.** Versioned selective export/import for settings, templates, notes, and rules; preview merge/replace and conflicts; omit tokens, users, cases, and private evidence by default.
- [ ] **F-054 · P2 — Privacy and retention controls.** `/privacy`, authorized self-inspection/export/removal, documented operator retention, and evidence of the data actually removed or retained.
- [ ] **F-071 · P3 — Optional Telegram Stars products.** Separate from the core free moderation bot; implement server-confirmed, idempotent payments, fulfillment, support, terms, and refunds before activation.

## Current counts

At this checkpoint, **T-00, T-01, T-02, T-03, and the repository security foundation are implemented; T-02 and T-03 are verified against local PostgreSQL; F-001 and F-060 have locally tested implementation slices; and no full moderation or protection capability is implemented.** Update this statement and individual statuses as evidence changes. Do not mark a product capability verified until its behavior, authorization boundaries, multi-group isolation, failure modes, localization, and required external checks have evidence.
