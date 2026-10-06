import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDisposableTestDatabase } from './database-test-guard.mjs';
import { canonicalManifestJson, fingerprintManifest, inspectDatabaseUrl } from './schema-fingerprint.mjs';

if (!process.argv.includes('--write-canonical-manifest')) {
  throw new Error('Refusing: --write-canonical-manifest is required.');
}
assertDisposableTestDatabase(process.env.DATABASE_URL, process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS);

const outputPath = fileURLToPath(new URL('../schema/canonical-schema.json', import.meta.url));
const result = await inspectDatabaseUrl(process.env.DATABASE_URL);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, canonicalManifestJson(result.manifest));
console.log(`Wrote canonical schema manifest for ${result.databaseName}.`);
console.log(`Fingerprint: ${fingerprintManifest(result.manifest)}`);
