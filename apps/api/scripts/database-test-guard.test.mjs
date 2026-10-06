import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDisposableTestDatabase } from './database-test-guard.mjs';

test('database test guard rejects missing, invalid, and non-test targets', () => {
  assert.equal(validateDisposableTestDatabase('', 'true').ok, false);
  assert.equal(validateDisposableTestDatabase('not a URL', 'true').ok, false);
  assert.equal(validateDisposableTestDatabase('mysql://localhost/supperapp_test', 'true').ok, false);
  assert.equal(validateDisposableTestDatabase('postgres://localhost/supperapp_production', 'true').ok, false);
  assert.equal(validateDisposableTestDatabase('postgres://localhost/contest', 'true').ok, false);
});

test('database test guard requires a separate confirmation flag', () => {
  const url = 'postgres://localhost/supperapp_test_isolated';
  assert.equal(validateDisposableTestDatabase(url, undefined).ok, false);
  assert.equal(validateDisposableTestDatabase(url, 'false').ok, false);
  assert.deepEqual(validateDisposableTestDatabase(url, 'true'), {
    ok: true,
    databaseName: 'supperapp_test_isolated'
  });
});

test('database test guard accepts both PostgreSQL URL schemes', () => {
  assert.equal(validateDisposableTestDatabase('postgres://localhost/test_ci', 'true').ok, true);
  assert.equal(validateDisposableTestDatabase('postgresql://localhost/ci-test-db', 'true').ok, true);
});
