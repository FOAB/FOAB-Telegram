import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.FOAB_TEST_MIGRATION_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('FOAB_TEST_MIGRATION_DATABASE_URL must be configured before migrating the test database.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: databaseUrl },
  strict: true,
});
