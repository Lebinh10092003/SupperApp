const EXPECTED_DATABASE = 'supperapp_staging';
const CONFIRMATION = 'RESET_STAGING_REVIEW_DATA';

export function stagingDatabaseName(databaseUrl) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL is not a valid PostgreSQL URL.');
  }
  return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
}

export function assertStagingReviewReset(databaseUrl, confirmation) {
  const database = stagingDatabaseName(databaseUrl);
  if (database !== EXPECTED_DATABASE) {
    throw new Error(`Refusing review-data reset: expected database ${EXPECTED_DATABASE}, received ${database || '(empty)'}.`);
  }
  if (confirmation !== CONFIRMATION) {
    throw new Error(`Refusing review-data reset: set CONFIRM_STAGING_REVIEW_RESET=${CONFIRMATION}.`);
  }
  return database;
}

export const STAGING_REVIEW_CONFIRMATION = CONFIRMATION;
