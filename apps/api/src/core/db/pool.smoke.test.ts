import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from './pool.js';

const skip = !process.env.DATABASE_URL;

test('pool kết nối được Postgres thật và chạy query đơn giản', { skip }, async () => {
  const result = await pool.query('SELECT 1 + 1 AS sum');
  assert.equal(result.rows[0].sum, 2);
});
