import { pgTable, text, timestamp, boolean, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Bảng registry DUY NHẤT nằm ở schema `public`, liệt kê mọi trường (tenant)
 * và schema Postgres tương ứng của trường đó. Đây là bảng CHUNG cho toàn bộ
 * Super App — cả module An toàn, Lịch công tác, Classroom Intelligence đều
 * tra cứu qua đúng 1 bảng này để đổi request sang đúng schema tenant.
 */
export const tenants = pgTable(
  'tenants',
  {
    id: text('id').primaryKey(), // vd "giang-vo", "fermat" — slug ổn định, dùng làm phần tên schema
    schemaName: text('schema_name').notNull(), // vd "tenant_giang_vo" — tên schema Postgres thật
    displayName: text('display_name').notNull(),
    // "school" = 1 trường học thật; "org" = tổ chức không phải trường (vd Fermat/FTWorkspace)
    // — để trống loại ("kind") tới khi có quyết định rõ ràng, xem ghi chú trong PLAN.
    kind: text('kind').notNull().default('school'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex('tenants_schema_name_idx').on(table.schemaName)]
);
