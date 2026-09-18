# Dokploy Deployment

This runbook deploys the FOAB bot and its Telegram Mini App from the GitHub repository. The application container runs the TypeScript bot process and the Fastify Mini App API. PostgreSQL remains a persistent service managed by Dokploy or by an external PostgreSQL provider.

## Deployment shape

Use one of the following Dokploy service types:

- **Application with Dockerfile:** use the repository root as the build context and `Dockerfile` as the build file. Disable Dokploy's **Create Environment File** option; the container receives its configuration as runtime environment variables, and the application does not load a generated `.env` file.
- **Docker Compose:** use the repository root and `compose.yaml`. The compose file loads the environment created by Dokploy and exposes port `3000` to Dokploy's domain router.

The repository does not embed PostgreSQL in the application image. This keeps database storage persistent across bot deployments and lets the runtime role remain separate from the migration role.

## Required runtime variables

Set these values in Dokploy's environment configuration. Never commit them to GitHub.

```text
FOAB_TELEGRAM_BOT_TOKEN=<development-or-production-bot-token>
FOAB_DATABASE_URL=postgresql://<runtime-user>:<runtime-password>@<postgres-host>:5432/<database>
# Optional: startup migration role; omit to skip automatic migrations.
FOAB_MIGRATION_DATABASE_URL=postgresql://<migration-user>:<migration-password>@<postgres-host>:5432/<database>
FOAB_WEB_APP_URL=https://example.invalid/foab
FOAB_WEB_APP_HOST=0.0.0.0
FOAB_WEB_APP_PORT=3000
```

`FOAB_WEB_APP_URL` must be the exact HTTPS origin and path that Dokploy routes to this service. Telegram opens this URL in the Mini App, and the API uses the same origin for session and CSRF checks. Do not use `localhost`, a private LAN address, or a temporary tunnel for the long-lived Main App configuration.

For a Dockerfile application, keep **Create Environment File** disabled and save environment changes before redeploying. This prevents a generated build-time file or stale placeholder from diverging from the runtime values injected into the container.

The image entrypoint runs pending migrations with `FOAB_MIGRATION_DATABASE_URL` when that variable is present. If it is absent, migration is skipped and the bot starts normally. The migration role must be separate from the runtime role and must not be exposed to application code after the migration step. Use one application replica while startup migrations run; a dedicated migration job remains preferable for multi-replica releases.

## PostgreSQL and migrations

Create a persistent PostgreSQL database in Dokploy or use an external PostgreSQL service. Create a least-privilege runtime role and a separate migration role. For automatic startup migrations, add `FOAB_MIGRATION_DATABASE_URL` to the Dokploy environment. The container applies committed Drizzle migrations before starting the bot and exits without starting it if a migration fails. If the variable is omitted, apply migrations manually with the migration connection before deploying:

```powershell
$env:FOAB_MIGRATION_DATABASE_URL = 'postgresql://<migration-user>:<migration-password>@<postgres-host>:5432/<database>'
pnpm db:migrate
```

Do not place the migration URL in the production bot container. The command above is an operator example; keep the actual value in a local ignored environment file or Dokploy's short-lived secret context.

## Domain and Telegram setup

1. Point a DNS record at the Dokploy host.
2. Add the domain to the Dokploy service and enable HTTPS through Dokploy's domain management.
3. Set `FOAB_WEB_APP_URL` to the resulting HTTPS URL with the `/foab` path.
4. Deploy the service and wait for the `healthz` check to become healthy.
5. Restart or redeploy the bot after changing `FOAB_WEB_APP_URL`. On startup, FOAB sets the private Menu Button to open the Mini App and serves the bundle at the configured path.
6. Configure the same URL as the bot's Main Mini App in BotFather when the stable domain is ready. The Main Mini App and the private Menu Button open the same FOAB application; inline settings buttons remain the fallback.

The Mini App lists only groups for which the authenticated user is currently an administrator. The group selector is not an authorization boundary by itself; every settings write is checked again by the API for the exact installation, group, user, permission, and revision.

## GitHub deployments

Connect the Dokploy service to this GitHub repository and branch, then enable its Git provider webhook or deployment automation. Each accepted commit can trigger a new image build and deployment. Keep database migration as an explicit release step before deploying code that requires a new schema.

Dokploy domain routing, environment injection, deployment history, and rollback behavior must be verified in the target Dokploy instance. The repository can validate the image definition and TypeScript build locally, but it cannot prove the remote host, DNS, TLS certificate, Telegram client rendering, or production database connectivity.
