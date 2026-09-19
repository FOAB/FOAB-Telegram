# Mini App API Contract

This document describes the first HTTP contract for the FOAB administration Mini App. The API and the built Vite bundle are served by the same application process as the bot when `FOAB_WEB_APP_URL` is configured. The bundle is mounted at the URL path, while API requests use `/api`. It currently supports the private administration settings slice; moderation, federation, and other group capabilities are not exposed here.

The process exposes `GET /healthz` as an unauthenticated liveness endpoint for Docker and Dokploy. It reports process availability only; it does not claim that PostgreSQL, Telegram, or the administration session flow is ready.

## Transport and browser boundary

The configured Mini App URL must use HTTPS and must not contain credentials or a fragment. The API accepts JSON bodies up to 16 KiB and returns machine-readable error codes rather than framework or database messages. Responses are marked `no-store` and include a restrictive content security policy.

State-changing requests must include the exact configured `Origin` header and the `application/json` content type. The API does not enable permissive cross-origin access. A browser must send the CSRF value in `X-FOAB-CSRF`; the value is issued during login and is also placed in the same-origin, `SameSite=Strict`, secure `foab_csrf` cookie so a page reload can recover it. The session cookie is `HttpOnly`, secure, `SameSite=Strict`, and scoped to `/`.

## Session endpoints

### `POST /api/session`

The body must contain exactly one field:

```json
{
  "initData": "<the exact Telegram.WebApp.initData string>"
}
```

The server validates the Telegram HMAC and freshness using the bot token belonging to the current installation. It rejects bot identities and does not accept `initDataUnsafe`, a browser-supplied user ID, or a browser-supplied installation ID.

A successful response is `201` and contains the authenticated user, a CSRF value, and the session expiration time:

```json
{
  "user": { "id": 1000000001, "languageCode": "pt-BR", "privateLocale": "pt-BR" },
  "csrfToken": "<opaque value>",
  "expiresAt": "<ISO-8601 timestamp>"
}
```

The raw Telegram `initData`, session token, and CSRF token are never logged or stored in PostgreSQL. The initial session store is in memory with a one-hour absolute lifetime and a fifteen-minute idle lifetime. A process restart revokes its sessions; durable session storage and rate limiting are required before running multiple API instances or exposing the service broadly.

### `GET /api/session`

Requires the `foab_session` cookie. It returns the authenticated user and expiration time. The CSRF value is intentionally omitted from this response; the browser can read its same-origin `foab_csrf` cookie.

### `DELETE /api/session`

Requires the exact origin and a valid CSRF header when a live session cookie is present. It revokes the session and clears both cookies. The operation is idempotent when no session cookie is supplied.

### `PATCH /api/preferences`

Requires a live session, the exact origin, and a valid CSRF header. The preference is scoped to the authenticated Telegram user and the current FOAB installation; the browser cannot select another user or installation.

The body must contain exactly one supported locale:

```json
{
  "locale": "es-ES"
}
```

The response is `{ "privateLocale": "es-ES" }`. Supported values are `en-US`, `pt-BR`, and `es-ES`. The same value is returned in both session responses and controls the language of FOAB's private-chat replies. Group replies continue to use the selected group's locale.

## Group settings endpoints

### `GET /api/groups`

Requires a live session. The server lists active groups in the current installation and calls Telegram for each group to confirm that the authenticated user is a current administrator of that exact group. The response contains only:

```json
{
  "groups": [
    {
      "chatId": "-100100000001",
      "chatType": "supergroup",
      "title": "Primary Group",
      "username": "primary_group",
      "locale": "en-US",
      "timeZone": "UTC",
      "settingsRevision": 0,
      "welcomeMessage": null,
      "welcomeMode": "always",
      "deletePreviousWelcomeMessage": false,
      "goodbyeMessage": null,
      "goodbyeMode": "always",
      "deletePreviousGoodbyeMessage": false,
      "rulesText": null
    }
  ]
}
```

### `PATCH /api/groups/{chatId}/settings`

Requires a live session, the exact origin, and a valid CSRF header. The path identifies a selector only. The server parses a negative Telegram group ID, resolves it inside the current installation, rechecks the user's current administrator status for that group, validates the exact body fields, and then applies an optimistic revision update.

The body must contain `expectedRevision` and at least one of the following fields:

```json
{
  "expectedRevision": 0,
  "locale": "pt-BR",
  "timeZone": "America/Sao_Paulo",
  "welcomeMessage": "Welcome to the group!",
  "welcomeMode": "first",
  "deletePreviousWelcomeMessage": true,
  "goodbyeMessage": null,
  "goodbyeMode": "always",
  "deletePreviousGoodbyeMessage": false,
  "rulesText": "Be respectful and keep conversations on topic."
}
```

Supported locales are `en-US`, `pt-BR`, and `es-ES`. Time zones must be bounded IANA names supported by the server ICU data. Welcome and goodbye messages accept up to 4,096 characters; rules accept up to 3,800 characters so the `/rules` heading fits within Telegram's message limit. `welcomeMode` and `goodbyeMode` accept `always` or `first`; the latter sends only on the first delivery after the feature is configured. The deletion flags remove only the previous automated message recorded by FOAB, when Telegram permits deletion. Sending `null` or whitespace-only text clears that feature. Unknown fields, private-chat IDs, invalid values, stale revisions, inactive groups, and users who are not current administrators are rejected. A stale revision returns `409` with `{ "error": "revision_conflict" }` so the UI can reload and show the current value before retrying.

The endpoint returns the same allowlisted group shape after a successful update. It never returns installation identifiers, Telegram membership objects, cookies, credentials, message content, or arbitrary database fields.

## Error codes

The API uses a stable `{ "error": "code" }` shape. Current codes include `invalid_request`, `invalid_telegram_session`, `unauthorized`, `origin_denied`, `csrf_denied`, `forbidden`, `revision_conflict`, `payload_too_large`, `session_unavailable`, and `server_error`. Internal exception text is not sent to the browser.

Automated coverage uses only synthetic Telegram signatures, users, groups, and membership responses. Live Telegram delivery, Telegram client rendering, HTTPS deployment, browser behavior, and durable session recovery remain external verification gates.
