# Security Policy

## System and scope

FOAB is an open-source, self-hosted Telegram group administration bot. One installation and bot token can serve multiple groups. The repository currently includes a strict TypeScript/Node.js bot bootstrap, PostgreSQL installation/group storage, localized onboarding/help, a scoped group settings path, optional HTTPS Web App URL gating, and a signed Telegram Web App init-data verifier. Broader roles, moderation, durable jobs, the HTTP API/session lifecycle, Web App UI, and deployment infrastructure are not yet implemented.

This policy applies to repository code, build and CI workflows, local development, the bot, API, Mini App, database, imported/exported group data, and integrations as they are added. No production environment or public service endpoint has been established by this repository.

## Assets and trust boundaries

Sensitive assets include Telegram bot tokens, database credentials, Mini App authentication data, operator configuration, group and user identifiers, moderation cases, federation membership and bans, message-derived evidence, exports, and audit records.

Telegram updates and administrator-provided configuration are untrusted input. A Telegram administrator is not automatically a FOAB installation operator or federation owner. Group IDs and user IDs from a browser, command argument, callback, import, or queued job are identifiers, not proof of authority. Group linkage and Telegram community membership do not grant cross-group access or federation consent.

The trust boundaries are Telegram to the bot; Telegram Mini App/browser to the API; each group and federation scope in PostgreSQL; background jobs and external effects; imports/exports and filesystem storage; CI/build dependencies and generated artifacts; and the AI coding workflow to repository instructions. The current repository has signed init-data verification and command handlers, but no HTTP request handlers, session lifecycle, or deployment configuration.

## Security invariants

- Deny access unless the actor, action, installation, and target group or federation are authorized at the point of use.
- Derive installation scope and authenticated identity on the server. Scope every group record and query to its installation and group; federation operations use an explicit federation context.
- Keep group settings, users, cases, sanctions, templates, membership, and exports isolated across groups. Cross-group effects require explicit, current federation consent and retain source provenance.
- Accept only schema-defined input fields and serialize only fields permitted for the caller. Validate type, size, format, revision, and business rules at server boundaries.
- Store no secrets in Git, browser bundles, logs, fixtures, CI artifacts, screenshots, or command output. Keep local credentials and data ignored by Git.
- Use parameterized database access. Never evaluate administrator-supplied rules or message content as code or unrestricted regular expressions.
- Record durable moderation outcomes and their causes before reporting success. Reauthorize queued effects, make retries idempotent, and preserve unrelated restrictions when one cause expires or is revoked.
- Prefer private/ephemeral feedback for sensitive command results. Never fall back to public output if that would expose private data.
- Treat Telegram permissions, ephemeral delivery, Guard, client rendering, and API capabilities as conditional until the relevant client and scope are verified.
- Use synthetic data for automated tests. Disable credential verification in secret scanning so scanners do not try discovered values against provider APIs.

## Reportable findings and severity context

Report a reachable defect that can expose or alter group data across tenants, bypass a permission or consent check, perform an unauthorized moderation action, disclose or misuse a credential, execute attacker-controlled content, corrupt durable sanction/job state, or materially weaken CI/release integrity.

Assess severity from realistic reachability, required privileges, affected groups/users, sensitivity, reversibility, and blast radius. Separate confirmed behavior from a plausible hypothesis. Include a minimal synthetic reproduction and sanitized evidence. Do not print the credential or private data that triggered a finding.

Do not classify a missing feature, Telegram client limitation, or planned-but-unverified control as a vulnerability unless it creates a concrete security impact. Report it as a limitation or verification gap instead.

## Out of scope, exclusions, and accepted risk

No vulnerability class is blanket-excluded and no security risk has been accepted by this policy. Payment processing, hosted multi-tenant SaaS, managed bot token custody, cloud infrastructure, and public production endpoints are not part of the initial self-hosted core plan. If any are introduced, update this scope before assessing or deploying them.

Only local repository and synthetic test assets are authorized for automated testing by this policy. Testing Telegram production groups, third-party services, public endpoints, or provider accounts requires separate, exact authorization and a bounded test plan. A workflow file does not prove that GitHub branch protection, secret scanning, or push protection is enabled.

## Known limitations and compensating controls

The initial application stores installation-scoped group metadata and local integration tests verify separation between synthetic installations. The settings command authorizes only the current administrator of the exact group and does not authorize moderation. The shared init-data verifier has synthetic tests, but session security, rate limits, durable audit, webhook handling, Mini App security headers, backup/restore, and Telegram permission behavior have not yet been runtime-tested.

The repository scanner is a defense-in-depth check, not a guarantee that every secret format is detected. Its tool version is pinned and checksum-validated. It scans the working tree and Git history without provider verification; rotate any confirmed exposed credential and investigate its exposure even after removing it from files or history.

Local `.gitignore` rules only affect this checkout. They do not protect already tracked files, Git history, GitHub settings, artifacts, backups, or another contributor's machine. Review the staged diff and full commit range before every push.

## Reporting

Do not open a public issue containing exploit details, credentials, or private user/group data. Use GitHub's private vulnerability reporting for this repository when available. Otherwise, contact the repository maintainer through a private channel listed on the project owner profile. Include the affected commit, impact, prerequisites, and a sanitized reproduction. Never include live tokens, passwords, cookies, or database records.
