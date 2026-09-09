import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * Migration cho schema `public` (registry `tenants`) — chỉ chạy 1 lần cho cả
 * hệ thống, KHÔNG lặp lại theo từng trường. Ngược lại với
 * `drizzle.config.tenant-template.ts`.
 */
export default defineConfig({
  schema: './src/core/tenant/tenant.schema.ts',
  out: './drizzle/public',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/postgres' }
});
