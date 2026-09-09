import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * 1 config migration duy nhất cho database Postgres của trường này —
 * KHÔNG còn tách "public"/"tenant-template" như bản multi-tenant cũ.
 * Mỗi module (`core/identity`, module An toàn, module Lịch công tác...)
 * định nghĩa bảng bằng Drizzle trong `src/`, gộp lại qua `schema` glob dưới.
 */
export default defineConfig({
  schema: './src/**/*.schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/postgres' }
});
