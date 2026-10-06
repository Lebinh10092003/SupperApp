const TEST_DATABASE_NAME = /(?:^|[_-])test(?:[_-]|$)/i;

export function validateDisposableTestDatabase(rawUrl, explicitConfirmation) {
  if (!rawUrl || !rawUrl.trim()) {
    return { ok: false, reason: 'DATABASE_URL is required.' };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'DATABASE_URL is not a valid URL.' };
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    return { ok: false, reason: 'DATABASE_URL must use postgres:// or postgresql://.' };
  }

  let databaseName = '';
  try {
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  } catch {
    return { ok: false, reason: 'DATABASE_URL contains an invalid database name.' };
  }
  if (!databaseName || databaseName.includes('/') || !TEST_DATABASE_NAME.test(databaseName)) {
    return { ok: false, reason: 'Database name must contain a separate "test" marker.' };
  }

  if (explicitConfirmation !== 'true') {
    return { ok: false, reason: 'ALLOW_DESTRUCTIVE_DATABASE_TESTS must be exactly "true".' };
  }

  return { ok: true, databaseName };
}

export function assertDisposableTestDatabase(rawUrl, explicitConfirmation) {
  const result = validateDisposableTestDatabase(rawUrl, explicitConfirmation);
  if (!result.ok) {
    throw new Error(`[run-tests] Refusing database tests: ${result.reason}`);
  }
  return result;
}
