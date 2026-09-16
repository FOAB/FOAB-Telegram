# Authorization and Data Contract Baseline

This document defines the security baseline that every feature must refine before it handles real data. It is a design contract, not evidence that an unimplemented route or database query is already protected. The canonical security policy is [SECURITY.md](../../SECURITY.md).

## Actors and authority

| Actor | Permitted scope | Explicitly does not imply |
|---|---|---|
| Anonymous requester | Public help or a challenge explicitly designed for anonymous users | A Telegram identity, group membership, moderation permission, or installation ownership |
| Telegram member | Public/member functions in the exact chat proven by the update | Access to another group's settings, cases, member history, or federation data |
| Telegram group administrator | Actions whose required current Telegram rights and FOAB capability grant both pass for the exact chat | FOAB installation ownership, administrator identity when anonymous, or authority over another group |
| Anonymous group administrator | Only actions that do not require identifying the human actor; otherwise request authenticated confirmation | An inferred user identity from a title, sender chat, or anonymous-admin role |
| Installation operator | Bot instance configuration, secrets, backups, and installation lifecycle | Telegram group moderation authority unless separately granted in that group |
| Federation owner or moderator | Federation membership and federation-scoped actions explicitly consented to by each participating group | Group configuration or enforcement in a group that has not joined or has revoked consent |
| Worker or scheduled job | The exact persisted operation, target scope, and capability recorded when queued, after current authorization is rechecked | A reusable human identity or authority that outlives the grant, target membership, or federation consent |

Authorization decisions use the authenticated actor, installation, current group or federation scope, action, target, current role/capability, and any required explicit consent. Missing, stale, anonymous, or conflicting evidence denies the action. An ID is a selector, never an authorization claim.

## Input contracts

| Boundary | Accepted authority source | Required validation |
|---|---|---|
| Telegram update | Verified Telegram update and its typed sender/chat context | Allowlisted update fields; preserve unknown variants as unhandled; enforce payload, text, and media bounds; deduplicate before effects |
| Command or callback | Actor and chat from the update; callback state bound to actor, chat, action, target, expiry, and one-time nonce | Parse a closed command grammar; reject other-bot commands; recheck role, target, and rights at execution |
| Mini App/API request | Server-validated Telegram `initData`, session, and current group access | Never trust `initDataUnsafe`, browser-supplied instance/role/owner fields, or a chat ID without server-side verification; validate CSRF/origin where applicable |
| Worker/job input | Persisted operation ID and server-owned immutable scope | Re-read target state, permission grant, and federation consent; enforce expiry, idempotency, attempt limits, and cancellation |
| Import or uploaded content | Explicitly selected installation/group and an authenticated operator | Schema/version allowlist, byte/record/depth limits, safe filenames, preview, scoped authorization, and transactional application |
| Configuration write | Actor, group, namespace, expected revision, and allowlisted setting fields | Reject unknown/protected fields; validate values and business constraints; use optimistic revision checks and an audit record |

Client-supplied `instance_id`, `group_id`, `user_id`, role, permission, owner, actor, visibility, and audit fields are never accepted as proof of authority. The server resolves them from authenticated context and persisted relationships.

## Output contracts

| Audience | Allowed output | Never include by default |
|---|---|---|
| Requesting member | Public help and that member's own permitted result | Another member's private case, contact details, staff-only notes, or cross-group history |
| Group administrator | Only fields authorized for the exact group and current capability | Bot token, database credentials, private evidence from another group, or hidden identity of an anonymous administrator |
| Installation operator | Operational health and configuration for the installation | Secret values, message contents, or personal evidence unless a separately authorized workflow requires it |
| Federation moderator | Federation-scoped records and provenance for opted-in participating groups | Group-private configuration or records outside federation consent |
| Logs, metrics, and errors | Event ID, operation ID, error class, scoped identifiers where necessary, and redacted diagnostics | Tokens, cookies, connection strings, raw Mini App `initData`, unrestricted update bodies, or unsanitized user content |
| Export | Explicitly selected and authorized scope, documented fields, and retention metadata | Other groups, hidden fields, credentials, or data added by arbitrary object spreading |

Serialization is allowlist-based and audience-specific. A response does not become safe merely because the UI hides a field or the caller is an administrator somewhere else.

## Multi-group isolation checks

Every group-owned row and query is scoped by installation and chat. Composite keys and foreign keys must preserve that scope in PostgreSQL. Repositories do not expose unscoped `getById` or list-all operations for group data. A federation is a distinct explicit scope with join/leave state, consent revision, and source provenance.

Before a feature is marked verified, test synthetic installations A/B and groups A/B for direct reads, writes, list/search, exports, callback replay, caches, retries, and delayed jobs. Also test an anonymous requester, a lower-privilege member, a revoked grant, a group that left a federation, and a legitimate request inside the allowed scope. Assert returned data and durable state, not only HTTP or Telegram status codes.

## Test data rules

All fixtures use fictional IDs, names, tokens, messages, and communities. Automated tests do not connect to production groups, real Telegram accounts, or third-party services. A PostgreSQL integration test must use a separately named test database and verify isolation with at least two synthetic installations and two synthetic groups.
