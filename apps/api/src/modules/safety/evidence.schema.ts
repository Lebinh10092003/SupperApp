import { pgTable, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core';

/**
 * Kho minh chứng (S8) — port 1-1 field từ Firestore collection `evidence`
 * (project An toàn). Khoá chính là mã ngẫu nhiên `MC.xxxxxxxxxxxxxxxx` do
 * `ids.allocateRandomEvidenceId()` cấp SẴN trước khi insert (không dùng
 * cơ chế sinh id tự động của Postgres) — giữ đúng nguyên tắc "mã ngẫu
 * nhiên, không đoán được, cấp từ dịch vụ trung tâm".
 *
 * Chống lộ danh tính (xem `evidence.ts`): bảng này CỐ TÌNH không có cột
 * uid/ip/user_agent/original_filename nào.
 */
export const evidence = pgTable('evidence', {
  evidenceId: text('evidence_id').primaryKey(),
  reportId: text('report_id'),
  storagePath: text('storage_path').notNull(),
  fileType: text('file_type').notNull(),
  mimeType: text('mime_type').notNull(),
  extension: text('extension').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  scanStatus: text('scan_status').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull(),
  linkedAt: timestamp('linked_at', { withTimezone: true }),
  expiresUnlinkedAt: timestamp('expires_unlinked_at', { withTimezone: true }),
  deleted: boolean('deleted').notNull().default(false)
});
