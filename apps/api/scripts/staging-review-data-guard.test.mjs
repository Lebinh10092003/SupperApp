import test from 'node:test';
import assert from 'node:assert/strict';
import { assertStagingReviewReset, stagingDatabaseName } from './staging-review-data-guard.mjs';

test('accepts only the exact staging database and explicit confirmation', () => {
  const url = 'postgres://app:secret@127.0.0.1:5432/supperapp_staging';
  assert.equal(stagingDatabaseName(url), 'supperapp_staging');
  assert.equal(assertStagingReviewReset(url, 'RESET_STAGING_REVIEW_DATA'), 'supperapp_staging');
  assert.throws(() => assertStagingReviewReset(url, ''), /CONFIRM_STAGING_REVIEW_RESET/);
});

test('refuses production and similarly named databases', () => {
  for (const name of ['supperapp', 'supperapp_production', 'supperapp_staging_copy', '']) {
    assert.throws(
      () => assertStagingReviewReset(`postgres://app:secret@db/${name}`, 'RESET_STAGING_REVIEW_DATA'),
      /Refusing review-data reset/
    );
  }
});
