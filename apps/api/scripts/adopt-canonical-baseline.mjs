import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  diffManifests,
  fingerprintManifest,
  formatManifestDiff,
  inspectSchema,
  loadExpectedManifest
} from './schema-fingerprint.mjs';

const { Client } = pg;
const MIGRATIONS_DIRECTORY = fileURLToPath(new URL('../drizzle/', import.meta.url));
const CONFIRMATION_PHRASE = 'ADOPT_CANONICAL_BASELINE';

function parseArgs(args) {
  const parsed = { adopt: false, environment: null, confirmedDatabase: null, confirmationPhrase: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--adopt-baseline') parsed.adopt = true;
    else if (arg === '--environment') parsed.environment = args[++index];
    else if (arg === '--confirm-production-database') parsed.confirmedDatabase = args[++index];
    else if (arg === '--confirm-adoption') parsed.confirmationPhrase = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

async function baselineMigrationMetadata() {
  const journal = JSON.parse(await readFile(`${MIGRATIONS_DIRECTORY}/meta/_journal.json`, 'utf8'));
  if (journal.entries.length !== 1 || journal.entries[0].tag !== '0000_canonical_baseline') {
    throw new Error('Active migration journal does not contain exactly the expected canonical baseline.');
  }
  const entry = journal.entries[0];
  const sql = await readFile(`${MIGRATIONS_DIRECTORY}/${entry.tag}.sql`, 'utf8');
  return {
    createdAt: entry.when,
    hash: createHash('sha256').update(sql).digest('hex')
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  if (args.environment !== 'production') throw new Error('Refusing: --environment production is required.');
  if (!args.confirmedDatabase) throw new Error('Refusing: --confirm-production-database <exact-name> is required.');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let transactionOpen = false;
  try {
    await client.query(args.adopt
      ? 'BEGIN ISOLATION LEVEL SERIALIZABLE'
      : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    transactionOpen = true;

    const identity = await client.query('SELECT current_database() AS database_name');
    const databaseName = identity.rows[0].database_name;
    if (databaseName !== args.confirmedDatabase) {
      throw new Error(`Refusing: connected database name does not match --confirm-production-database (${databaseName}).`);
    }

    const expected = await loadExpectedManifest();
    const actual = await inspectSchema(client);
    const differences = diffManifests(expected, actual);
    console.log(`Database: ${databaseName}`);
    console.log(`Expected fingerprint: ${fingerprintManifest(expected)}`);
    console.log(`Actual fingerprint:   ${fingerprintManifest(actual)}`);
    if (differences.length > 0) {
      throw new Error(`Schema mismatch; baseline adoption refused.\n${formatManifestDiff(differences)}`);
    }

    if (!args.adopt) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      console.log('DRY RUN: schema matches; no migration metadata was written.');
      return;
    }

    if (args.confirmationPhrase !== CONFIRMATION_PHRASE) {
      throw new Error(`Refusing write: --confirm-adoption ${CONFIRMATION_PHRASE} is required.`);
    }
    if (process.env.ALLOW_PRODUCTION_BASELINE_ADOPTION !== 'true') {
      throw new Error('Refusing write: ALLOW_PRODUCTION_BASELINE_ADOPTION must be exactly "true".');
    }

    const migration = await baselineMigrationMetadata();
    await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);
    const existing = await client.query('SELECT id, hash, created_at FROM drizzle.__drizzle_migrations');
    if (existing.rowCount !== 0) throw new Error('Refusing write: migration ledger is not empty.');
    await client.query(
      'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
      [migration.hash, migration.createdAt]
    );
    await client.query('COMMIT');
    transactionOpen = false;
    console.log('ADOPTED: canonical baseline metadata initialized; no baseline DDL was executed.');
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
