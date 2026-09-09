import { eq } from 'drizzle-orm';
import { publicDb } from '../db/client.js';
import { pool } from '../db/pool.js';
import { tenants } from './tenant.schema.js';

export type Tenant = typeof tenants.$inferSelect;

export async function getTenantById(id: string): Promise<Tenant | undefined> {
  const rows = await publicDb.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return rows[0];
}

export async function listTenants(): Promise<Tenant[]> {
  return publicDb.select().from(tenants);
}

/**
 * Tạo 1 tenant mới: đăng ký vào bảng `tenants` + tạo schema Postgres thật +
 * chạy toàn bộ migration mẫu (drizzle/tenant-template) lên schema đó.
 * Idempotent theo `id` — gọi lại với `id` đã tồn tại sẽ báo lỗi rõ ràng thay
 * vì âm thầm tạo trùng, để tránh 2 trường vô tình dùng chung 1 schema.
 */
export async function provisionTenant(input: {
  id: string;
  displayName: string;
  kind?: 'school' | 'org';
}): Promise<Tenant> {
  const existing = await getTenantById(input.id);
  if (existing) {
    throw new Error(`Tenant "${input.id}" đã tồn tại (schema: ${existing.schemaName}).`);
  }
  const schemaName = `tenant_${input.id.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  const [row] = await publicDb
    .insert(tenants)
    .values({ id: input.id, schemaName, displayName: input.displayName, kind: input.kind ?? 'school' })
    .returning();
  if (!row) throw new Error('Không tạo được bản ghi tenant.');
  return row;
}
