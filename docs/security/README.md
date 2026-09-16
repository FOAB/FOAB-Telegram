# Security Controls and Evidence

This ledger tracks implemented repository controls separately from application protections still to be built. The canonical policy is [`SECURITY.md`](../../SECURITY.md); repository workflow requirements are in [`AGENTS.md`](../../AGENTS.md).

## Repository controls

| Risk or control | Implementation | Verification and status |
|---|---|---|
| Local credentials and data accidentally enter Git | Root `.gitignore` covers environment files, local credentials, database files/dumps, private keys, logs, exports, backups, dependencies, and scanner cache. `.env.example` is the only intentionally tracked environment template. | Verify with `git check-ignore .env` and review tracked/staged paths. Ignore rules do not remove files already committed or sanitize Git history. |
| A secret is present in Git-visible working-tree files or available Git history | `scripts/security/Invoke-SecurityChecks.ps1` pins TruffleHog 3.97.4, checks its release checksum, runs positive/negative synthetic fixtures, scans tracked and non-ignored paths plus Git history, excludes ignored local files, and rejects ignored files present in the Git index. | `pwsh -NoProfile -File scripts/security/Invoke-SecurityChecks.ps1 -SelfTest`. Local run passed on September 16, 2026. Scanner output is suppressed; provider verification and automatic updates are disabled. |
| Changes omit basic type/build/dependency checks | `.github/workflows/security.yml` runs strict TypeScript checks, tests, build, dependency audit, and the secret scan for repository events. | Workflow is configured in source. Confirm a successful hosted run on GitHub; workflow YAML alone is not execution evidence. |
| Source changes lack static security analysis | `.github/workflows/codeql.yml` is configured for JavaScript/TypeScript analysis. | Configuration is version-pinned. Confirm that GitHub accepts and completes analysis for this repository. |
| Dependencies and workflow references drift | `pnpm-lock.yaml`, a package-age policy, and `.github/dependabot.yml` weekly updates for npm dependencies and GitHub Actions. | `pnpm install --frozen-lockfile` and `pnpm audit --audit-level high`; review update PRs and rerun checks. Advisory results can change over time. |
| Implementation work ignores security contracts | Root `AGENTS.md` points to `SECURITY.md` as the canonical source and requires typed, scope-aware behavior and synthetic tests. | In-repository instruction chain is present; human review still has to verify each change. |

## Application security evidence ledger

The current application is only a token-validated grammY bootstrap with a non-mutating `/start` reply. It does not yet store or administer group data. The controls below are required for the corresponding features; do not infer their implementation from the repository baseline.

| Control area | Required proof when implemented | Status |
|---|---|---|
| Identity, roles, capabilities, protected targets | Allow/deny matrix for installation owner, Telegram admin, FOAB moderator, member, anonymous admin, bot, and revoked grant. Reauthorize every mutation. | Not implemented or tested. |
| Multi-group isolation | Use synthetic groups and installations for reads, writes, search, exports, caches, queued jobs, retries, and stale callbacks. Prove group A cannot access group B. | Product requirement documented; storage and tests not implemented. |
| Federation consent and isolation | Owner consent, explicit scopes, source provenance, cross-group effects, revocation, and per-destination outcome tests. | Product contract documented; feature not implemented. |
| Field allowlists and output filtering | Reject unauthorized `role`, `owner`, `instance`, and private evidence fields; redact output by actor and destination. | Not implemented or tested. |
| Mini App authentication and sessions | Invalid, replayed, and expired init data; origin/CSRF; session renewal; output redaction; direct-object access denial. | Not implemented or tested. |
| Telegram updates, webhooks, and API errors | Invalid webhook secret, duplicate/out-of-order updates, unknown fields, retries, timeouts, and uncertain-effect fixtures. | Long-poll bootstrap exists; webhook and durable update processing are not implemented. |
| Moderation and sanctions | Concurrent causes, protected targets, revoked rights, idempotency, delayed jobs, and privacy-safe feedback. | Not implemented or tested. |
| PostgreSQL | Scoped repositories, constraints, parameterized SQL, migration rollback/recovery, concurrent worker claims, and least-privilege roles. | PostgreSQL was checked locally; no FOAB database, schema, migration, or role exists. |
| Imports, files, and exports | Malformed/oversized inputs, path traversal, content type, formula injection, minimization, cancellation, and authorized scope. | Not implemented or tested. |
| Runtime security and recovery | Rate limits, retention, backup/restore, clean install, operational diagnostics, and real-client capability checks. | Not implemented or tested. |

## Running the local secret scan

Run from any directory in PowerShell:

```powershell
pwsh -NoProfile -File scripts/security/Invoke-SecurityChecks.ps1 -SelfTest
```

The first run downloads the pinned scanner to ignored `.tools/`. The script validates the archive against its recorded SHA-256 before extraction. It does not print scanner findings into routine output, verify credentials with providers, or auto-update itself. A finding or scanner error returns a nonzero exit status with a generic message. Run the positive/negative synthetic self-test after any scanner version change.

## Change report template

Use [`change-report-template.md`](change-report-template.md) for implementation and security changes. Record actual commands, environment, revision, evidence, unresolved limitations, and external verification gaps. A successful typecheck or secret scan is not a security certification.

## Response and recovery

If a real credential is found, stop publication, identify its provider and owner without copying the value into tickets or logs, revoke or rotate it through the provider, and review reachable Git history and artifacts. Removing the line or adding an ignore rule is not remediation. If the credential was pushed, assume it may have been copied. History rewriting is a separate coordinated operation because it disrupts collaborators; verify published refs and invalidate affected clones and credentials afterward.

For an application finding, preserve sanitized reproduction evidence, add regression coverage for both the failure and a legitimate allowed case, fix the authorization or data-flow cause, rerun relevant multi-group tests, and review queued/retried operations. Do not accept a risk or claim complete coverage on the owner's behalf.

Review scanner/runtime versions, CI permissions, GitHub code-scanning and secret-scanning availability, branch protection, and this evidence ledger when the application or deployment surface changes. Verify branch protection and provider features in the actual GitHub settings; workflow configuration alone does not establish enforcement.
