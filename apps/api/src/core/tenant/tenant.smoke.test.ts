import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../db/pool.js';
import { withTenantSchema } from '../db/pool.js';
import { provisionTenant, listTenants } from './tenant.registry.js';

/**
 * Test "khói" chạy thật với Postgres (không mock) — bỏ qua nếu không có
 * DATABASE_URL trỏ tới 1 Postgres thật đang chạy (vd môi trường CI chưa
 * dựng service Postgres). Mục đích: chứng minh cách ly schema-per-tenant
 * THẬT hoạt động, không chỉ tin code compile được.
 */
const skip = !process.env.DATABASE_URL;

test('provisionTenant tạo schema riêng và cách ly dữ liệu giữa 2 trường', { skip }, async () => {
  const suffix = Date.now();
  const a = await provisionTenant({ id: `smoke-a-${suffix}`, displayName: 'Trường A (smoke test)' });
  const b = await provisionTenant({ id: `smoke-b-${suffix}`, displayName: 'Trường B (smoke test)' });

  assert.notEqual(a.schemaName, b.schemaName);

  // Tạo 1 bảng "riêng của module" trong đúng schema trường A, ghi 1 dòng.
  await withTenantSchema(a.schemaName, async (client) => {
    await client.query('CREATE TABLE IF NOT EXISTS smoke_items (id serial PRIMARY KEY, label text)');
    await client.query("INSERT INTO smoke_items (label) VALUES ('chỉ thuộc về trường A')");
  });

  // Trường B KHÔNG được thấy bảng/dữ liệu đó — kể cả khi dùng CHUNG 1 pool
  // connection (đây chính là rủi ro "quên filter" đã audit ở dự án Firebase,
  // giờ được chặn bằng ranh giới schema thay vì code nhớ filter đúng).
  await withTenantSchema(b.schemaName, async (client) => {
    const result = await client.query(
      "SELECT to_regclass('smoke_items') AS exists_in_b"
    );
    assert.equal(result.rows[0].exists_in_b, null, 'Bảng của trường A không được lộ sang schema trường B');
  });

  const all = await listTenants();
  assert.ok(all.some((t) => t.id === a.id));
  assert.ok(all.some((t) => t.id === b.id));

  // Dọn dẹp: xoá 2 schema smoke-test để không để rác lại DB.
  const client = await pool.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${a.schemaName}" CASCADE`);
    await client.query(`DROP SCHEMA IF EXISTS "${b.schemaName}" CASCADE`);
    await client.query('DELETE FROM tenants WHERE id = ANY($1)', [[a.id, b.id]]);
  } finally {
    client.release();
  }
});
