import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  diffManifests,
  fingerprintManifest,
  formatManifestDiff
} from './schema-fingerprint.mjs';

const expectedPath = fileURLToPath(new URL('../schema/canonical-schema.json', import.meta.url));
const expected = JSON.parse(await readFile(expectedPath, 'utf8'));
let input = '';
for await (const chunk of process.stdin) input += chunk;
const actual = JSON.parse(input);
const differences = diffManifests(expected, actual);

console.log(`Expected fingerprint: ${fingerprintManifest(expected)}`);
console.log(`Actual fingerprint:   ${fingerprintManifest(actual)}`);
if (differences.length > 0) {
  console.error(formatManifestDiff(differences));
  process.exitCode = 1;
} else {
  console.log('MATCH: schema is compatible with the canonical baseline.');
}
