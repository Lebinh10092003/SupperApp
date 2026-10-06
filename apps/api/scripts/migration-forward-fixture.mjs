import 'dotenv/config';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { assertDisposableTestDatabase } from './database-test-guard.mjs';

assertDisposableTestDatabase(process.env.DATABASE_URL, process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS);

const activeDirectory = fileURLToPath(new URL('../drizzle/', import.meta.url));
const fixtureDirectory = await mkdtemp(join(tmpdir(), 'supperapp-forward-migration-'));
await cp(activeDirectory, fixtureDirectory, { recursive: true });

const journalPath = join(fixtureDirectory, 'meta', '_journal.json');
const journal = JSON.parse(await readFile(journalPath, 'utf8'));
const nextWhen = journal.entries.at(-1).when + 1;
journal.entries.push({ idx: 1, version: '7', when: nextWhen, tag: '0001_forward_fixture', breakpoints: true });
await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
await writeFile(join(fixtureDirectory, '0001_forward_fixture.sql'), `
CREATE SCHEMA migration_forward_fixture;
--> statement-breakpoint
CREATE TABLE migration_forward_fixture.probe (
  id integer PRIMARY KEY,
  label text NOT NULL
);
--> statement-breakpoint
ALTER TABLE migration_forward_fixture.probe ADD COLUMN applied_at timestamp with time zone DEFAULT now() NOT NULL;
`);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await migrate(drizzle(pool), { migrationsFolder: fixtureDirectory });
  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'migration_forward_fixture' AND table_name = 'probe'
    ORDER BY ordinal_position
  `);
  const columns = result.rows.map((row) => row.column_name);
  if (JSON.stringify(columns) !== JSON.stringify(['id', 'label', 'applied_at'])) {
    throw new Error(`Forward migration fixture produced unexpected columns: ${JSON.stringify(columns)}`);
  }
  console.log('PASS: canonical baseline -> next forward migration fixture.');
} finally {
  await pool.end();
  await rm(fixtureDirectory, { recursive: true, force: true });
}
