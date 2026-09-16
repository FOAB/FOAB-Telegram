# Repository guidance

Before changing code or configuration, read [SECURITY.md](SECURITY.md), [the security data contracts](docs/security/authorization-and-data-contracts.md), [implementation progress](docs/developer/progress.md), and the task-specific English documentation. `SECURITY.md` is the canonical source for system boundaries, security invariants, and review expectations; keep this file limited to workflow instructions that point to that policy.

## Required working rules

- Keep all application code in strict TypeScript. Do not add JavaScript application modules or use `any` to bypass a type contract.
- Write canonical README files, identifiers, comments, TSDoc, tests, and technical documentation in English. User-facing text belongs in the en-US, pt-BR, and es-ES catalogs.
- Work on one dependency-ready task at a time. Respect canonical feature ownership and merge equivalent capabilities before adding a module.
- Keep secrets, real user data, production identifiers, and connection strings out of source, tests, fixtures, command output, reports, and commits. Use synthetic values only.
- Do not call Telegram using real bot credentials or perform live sanctions. Real-client checks require a dedicated test bot/group and explicit authorization for the exact action.
- Validate server-side identity, group scope, permission, allowed fields, size limits, and freshness at each mutation boundary. Fail closed when authorization cannot be established.
- Add behavior tests for the changed contract, including cross-group denial where the feature touches group data. Document meaningful invariants, permissions, failure modes, and recovery behavior.
- Run `pwsh -NoProfile -File scripts/security/Invoke-SecurityChecks.ps1 -SelfTest` before staging changes. The scanner must not contact credential providers to verify discovered values.
- Never suppress a security finding or add a scanner allowlist without documenting the exact path, rule, reason, and reviewer-visible expiration condition.

## Completion notes

Report the exact task, changed paths, checks and exit status, security-review result, unverified runtime behavior, and remaining risks. A clean scanner or green build does not prove that the application is secure.
