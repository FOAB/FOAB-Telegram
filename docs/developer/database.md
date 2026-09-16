# Local PostgreSQL and Database Access

FOAB uses one PostgreSQL database per self-hosted installation. One installation may register multiple Telegram groups. Every group row uses the installation UUID together with the Telegram chat ID as its primary key, and repository reads require both values. The schema stores group title, optional username, locale/time-zone defaults, bot membership status, timestamps, and metadata-only Telegram update receipts. It does not store message bodies or usernames of individual members.

## Local setup

Install PostgreSQL 18 and start its local service. Copy `.env.example` to `.env`, add the development bot token, and temporarily add the local PostgreSQL administrator password as `FOAB_PG_ADMIN_PASSWORD`. Keep this value in the ignored `.env` file only. Then run:

```powershell
pnpm db:provision:local
pnpm db:migrate
pnpm db:migrate:test
pnpm test:integration
```

The provisioner creates `foab_dev` and `foab_test`, creates separate migration/runtime roles, and generates high-entropy local credentials. It writes only the development runtime URL to `.env`, migration URLs to `.env.database`, and the integration-test URL to `.env.test`. It removes `FOAB_PG_ADMIN_PASSWORD` from `.env` after a successful run. It does not drop databases. If either database already exists under an unexpected owner, provisioning stops instead of taking it over. To provision again later, add the local administrator variable to `.env` temporarily and run the command again; this rotates the generated FOAB role passwords.

The `.env.example` contains URL shapes with placeholders only. Replace them only with values created for your local instance. Never copy real credentials into that template, source files, tests, logs, or commits.

## Roles and migration workflow

`foab_app` is the development runtime role. It can connect to `foab_dev` and read/write application tables; it cannot create roles, databases, schemas, or tables. `foab_app_test` has the equivalent data access only in `foab_test`. Automated integration tests require the test URL to target loopback, database `foab_test`, and role `foab_app_test`; the suite checks the connected database identity before it changes data.

`foab_migrator` owns both local databases and runs Drizzle migrations. The bot process loads only `.env`, so it never receives the migration URL or test-database credential. Integration tests load `.env.test`; migration commands load `.env.database`. Database provisioning establishes default table grants for each runtime role so new tables created by this migration role receive data access without granting schema ownership to the bot.

After changing `src/db/schema.ts`, generate and review a SQL migration, then apply it to the development and test databases:

```powershell
pnpm db:generate
pnpm db:migrate
pnpm db:migrate:test
```

Generated migration SQL and Drizzle's journal are source-controlled. Review them before commit. Do not run development migration commands against production; production migration and credential rotation procedures need their own deployment configuration and review.

## Scope and privacy invariants

- Resolve the installation UUID from `runtime_state`; never accept it from a Telegram command or client.
- Include the installation UUID and Telegram chat ID in every group lookup, update, and list operation.
- Membership service updates set the bot's current group status. Ordinary `/start` and `/help` updates refresh only group metadata, so a delayed command cannot reactivate a group after a bot-removal event.
- Database connection and statement timeouts are bounded so local database stalls do not leave a command handler waiting indefinitely. Ephemeral replies to an incoming ephemeral command must still meet Telegram's short response window.
- A removed or kicked bot is stored as inactive. The registry does not imply that the caller is a group administrator or authorize moderation; the settings command performs its own current Telegram administrator check.
- The update inbox stores installation-scoped update ID, normalized update kind, processing state, attempt count, timestamps, lease, and sanitized error class only. It never stores the raw Telegram update or message text.
- Keep member names and message content out of this first schema. Add personal data only with a defined feature need, retention, and deletion contract.
- Use synthetic installation and chat IDs in automated tests. Never point the integration suite at a production database or Telegram group.

The integration suite proves local PostgreSQL constraints, concurrent installation initialization, installation/chat scoping, stale-update handling, optimistic settings writes, and concurrent inbox claims. It does not prove Bot API delivery, live Telegram permissions, transactional outbox delivery, moderation, backups, or production migration recovery.
