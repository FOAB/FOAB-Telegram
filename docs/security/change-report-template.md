# Security Change Report

Copy this template into the change report for each feature or security-sensitive fix. Mark evidence as executed or pending; never label a proposed test as a pass.

## Change

- Feature, commit, and implementation status:
- Product requirement IDs:
- Data and trust boundaries touched:
- External services or provider settings involved:

## Authorization and data contracts

- Actors, installation/group/federation scope, action, and target:
- Input fields accepted; fields rejected or derived server-side:
- Output fields and intended audience:
- Revalidation required for delayed/retried effects:

## Threat and failure cases

- Unauthorized or revoked actor:
- Cross-installation/group/federation attempt:
- Anonymous actor or missing identity evidence:
- Malformed, oversized, repeated, stale, or unknown input:
- Error, timeout, retry, partial success, and fallback behavior:

## Evidence

- Synthetic positive and negative cases executed:
- Commands, tool versions, environment, and exit codes:
- Expected and observed durable state and returned fields:
- Scanner/dependency/code-analysis results:
- Live Telegram/client or external-provider checks (must name authorization; otherwise `not run`):

## Findings and remaining work

- Confirmed, suspected, corrected and retested, or not tested:
- Known limitations and unsupported contexts:
- GitHub/hosting settings not independently verified:
- Rollback, data recovery, and credential response if relevant:
- Next task and evidence required:
