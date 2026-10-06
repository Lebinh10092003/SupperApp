import test from 'node:test';
import assert from 'node:assert/strict';
import { diffManifests, fingerprintManifest, formatManifestDiff } from './schema-fingerprint.mjs';

const emptyManifest = {
  formatVersion: 1,
  schemas: [{ name: 'public' }],
  tables: [],
  columns: [],
  constraints: [],
  indexes: []
};

test('schema fingerprint is deterministic and detects catalog differences', () => {
  assert.equal(fingerprintManifest(emptyManifest), fingerprintManifest(structuredClone(emptyManifest)));

  const changed = structuredClone(emptyManifest);
  changed.tables.push({ schema: 'public', name: 'probe', type: 'table' });
  const differences = diffManifests(emptyManifest, changed);
  assert.deepEqual(differences.map((item) => [item.kind, item.key]), [
    ['unexpected', 'table:public.probe']
  ]);
  assert.match(formatManifestDiff(differences), /UNEXPECTED table:public\.probe/);
});
