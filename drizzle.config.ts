import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.FOAB_MIGRATION_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('FOAB_MIGRATION_DATABASE_URL must be configured before running Drizzle Kit.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: databaseUrl },
  strict: true,
});
