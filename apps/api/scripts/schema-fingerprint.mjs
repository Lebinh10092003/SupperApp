import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const DEFAULT_EXPECTED_PATH = fileURLToPath(new URL('../schema/canonical-schema.json', import.meta.url));

const USER_SCHEMA_FILTER = `
  n.nspname NOT LIKE 'pg\\_%' ESCAPE '\\'
  AND n.nspname NOT IN ('information_schema', 'drizzle')
`;

function normalizeSql(value) {
  return value == null ? null : String(value).trim().replace(/\s+/g, ' ');
}

function sortByKey(rows, keyOf) {
  return [...rows].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
}

export function canonicalManifestJson(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function fingerprintManifest(manifest) {
  return createHash('sha256').update(canonicalManifestJson(manifest)).digest('hex');
}

export async function inspectSchema(client) {
  const schemasResult = await client.query(`
    SELECT n.nspname AS name
    FROM pg_namespace n
    WHERE ${USER_SCHEMA_FILTER}
    ORDER BY n.nspname
  `);

  const tablesResult = await client.query(`
    SELECT n.nspname AS schema_name, c.relname AS table_name,
           CASE c.relkind
             WHEN 'r' THEN 'table'
             WHEN 'p' THEN 'partitioned_table'
             WHEN 'v' THEN 'view'
             WHEN 'm' THEN 'materialized_view'
           END AS relation_type
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ${USER_SCHEMA_FILTER}
      AND c.relkind IN ('r', 'p', 'v', 'm')
    ORDER BY n.nspname, c.relname
  `);

  const columnsResult = await client.query(`
    SELECT n.nspname AS schema_name, c.relname AS table_name,
           a.attnum AS ordinal_position, a.attname AS column_name,
           pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
           NOT a.attnotnull AS nullable,
           pg_get_expr(ad.adbin, ad.adrelid, true) AS default_expression,
           a.attidentity AS identity_kind,
           a.attgenerated AS generated_kind,
           CASE WHEN a.attcollation <> t.typcollation THEN coll.collname ELSE NULL END AS collation
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    LEFT JOIN pg_collation coll ON coll.oid = a.attcollation
    WHERE ${USER_SCHEMA_FILTER}
      AND c.relkind IN ('r', 'p', 'v', 'm')
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY n.nspname, c.relname, a.attnum
  `);

  const constraintsResult = await client.query(`
    SELECT n.nspname AS schema_name, c.relname AS table_name,
           con.conname AS constraint_name,
           CASE con.contype
             WHEN 'p' THEN 'primary_key'
             WHEN 'f' THEN 'foreign_key'
             WHEN 'u' THEN 'unique'
             WHEN 'c' THEN 'check'
             WHEN 'x' THEN 'exclusion'
           END AS constraint_type,
           pg_get_constraintdef(con.oid, true) AS definition,
           con.convalidated AS validated,
           con.condeferrable AS deferrable,
           con.condeferred AS initially_deferred
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE ${USER_SCHEMA_FILTER}
      AND con.contype IN ('p', 'f', 'u', 'c', 'x')
    ORDER BY n.nspname, c.relname, con.conname
  `);

  const indexesResult = await client.query(`
    SELECT schemaname AS schema_name, tablename AS table_name,
           indexname AS index_name, indexdef AS definition
    FROM pg_indexes
    WHERE schemaname NOT LIKE 'pg\\_%' ESCAPE '\\'
      AND schemaname NOT IN ('information_schema', 'drizzle')
    ORDER BY schemaname, tablename, indexname
  `);

  const manifest = {
    formatVersion: 1,
    schemas: schemasResult.rows.map((row) => ({ name: row.name })),
    tables: sortByKey(tablesResult.rows.map((row) => ({
      schema: row.schema_name,
      name: row.table_name,
      type: row.relation_type
    })), (item) => `${item.schema}.${item.name}`),
    columns: sortByKey(columnsResult.rows.map((row) => ({
      schema: row.schema_name,
      table: row.table_name,
      name: row.column_name,
      type: normalizeSql(row.data_type),
      nullable: row.nullable,
      default: normalizeSql(row.default_expression),
      identity: row.identity_kind || null,
      generated: row.generated_kind || null,
      collation: row.collation || null
    })), (item) => `${item.schema}.${item.table}.${item.name}`),
    constraints: sortByKey(constraintsResult.rows.map((row) => ({
      schema: row.schema_name,
      table: row.table_name,
      name: row.constraint_name,
      type: row.constraint_type,
      definition: normalizeSql(row.definition),
      validated: row.validated,
      deferrable: row.deferrable,
      initiallyDeferred: row.initially_deferred
    })), (item) => `${item.schema}.${item.table}.${item.name}`),
    indexes: sortByKey(indexesResult.rows.map((row) => ({
      schema: row.schema_name,
      table: row.table_name,
      name: row.index_name,
      definition: normalizeSql(row.definition)
    })), (item) => `${item.schema}.${item.table}.${item.name}`)
  };

  return manifest;
}

function manifestEntries(manifest) {
  const groups = [
    ['schema', manifest.schemas, (item) => item.name],
    ['table', manifest.tables, (item) => `${item.schema}.${item.name}`],
    ['column', manifest.columns, (item) => `${item.schema}.${item.table}.${item.name}`],
    ['constraint', manifest.constraints, (item) => `${item.schema}.${item.table}.${item.name}`],
    ['index', manifest.indexes, (item) => `${item.schema}.${item.table}.${item.name}`]
  ];
  return groups.flatMap(([kind, items, keyOf]) =>
    sortByKey(items, keyOf).map((item) => ({ key: `${kind}:${keyOf(item)}`, value: item }))
  );
}

export function diffManifests(expected, actual) {
  const expectedMap = new Map(manifestEntries(expected).map((entry) => [entry.key, entry.value]));
  const actualMap = new Map(manifestEntries(actual).map((entry) => [entry.key, entry.value]));
  const keys = [...new Set([...expectedMap.keys(), ...actualMap.keys()])].sort();
  const differences = [];
  for (const key of keys) {
    const before = expectedMap.get(key);
    const after = actualMap.get(key);
    if (before === undefined) differences.push({ kind: 'unexpected', key, actual: after });
    else if (after === undefined) differences.push({ kind: 'missing', key, expected: before });
    else if (JSON.stringify(before) !== JSON.stringify(after)) {
      differences.push({ kind: 'changed', key, expected: before, actual: after });
    }
  }
  return differences;
}

export function formatManifestDiff(differences) {
  if (differences.length === 0) return 'Schemas match.';
  return differences.map((difference) => {
    if (difference.kind === 'missing') return `MISSING ${difference.key}: ${JSON.stringify(difference.expected)}`;
    if (difference.kind === 'unexpected') return `UNEXPECTED ${difference.key}: ${JSON.stringify(difference.actual)}`;
    return `CHANGED ${difference.key}:\n  expected ${JSON.stringify(difference.expected)}\n  actual   ${JSON.stringify(difference.actual)}`;
  }).join('\n');
}

export async function loadExpectedManifest(path = DEFAULT_EXPECTED_PATH) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function parseArgs(args) {
  const result = { expectedPath: DEFAULT_EXPECTED_PATH, printManifest: false, printFingerprint: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--expected') result.expectedPath = args[++index];
    else if (arg === '--print-manifest') result.printManifest = true;
    else if (arg === '--print-fingerprint') result.printFingerprint = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

export async function inspectDatabaseUrl(databaseUrl) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const identity = await client.query('SELECT current_database() AS database_name');
    const manifest = await inspectSchema(client);
    await client.query('COMMIT');
    return { databaseName: identity.rows[0].database_name, manifest, fingerprint: fingerprintManifest(manifest) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await inspectDatabaseUrl(process.env.DATABASE_URL);
  if (args.printManifest) {
    process.stdout.write(canonicalManifestJson(result.manifest));
    return;
  }
  if (args.printFingerprint) {
    console.log(`Database: ${result.databaseName}`);
    console.log(`Fingerprint: ${result.fingerprint}`);
    return;
  }
  const expected = await loadExpectedManifest(args.expectedPath);
  const expectedFingerprint = fingerprintManifest(expected);
  const differences = diffManifests(expected, result.manifest);
  console.log(`Database: ${result.databaseName}`);
  console.log(`Expected fingerprint: ${expectedFingerprint}`);
  console.log(`Actual fingerprint:   ${result.fingerprint}`);
  if (differences.length > 0) {
    console.error(formatManifestDiff(differences));
    process.exitCode = 1;
  } else {
    console.log('MATCH: schema is compatible with the canonical baseline.');
  }
}

const invokedPath = process.argv[1] === '-' || (process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false);
if (invokedPath) main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
