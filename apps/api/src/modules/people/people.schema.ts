import { pgTable, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

/**
 * people — port từ Firestore collection `people` (classroom.service.ts
 * ghi khi đồng bộ Classroom, doc id = Google userId). `personType` giữ
 * dạng text tự do (không dùng Postgres enum) vì dữ liệu cũ có cả biến thể
 * 'TEACHER'/'GIAO_VIEN' — isTeacher/isStudent (people.shared.ts) tự chuẩn
 * hoá khi đọc, KHÔNG siết cứng ở tầng schema.
 */
export const people = pgTable('people', {
  personId: text('person_id').primaryKey(),
  email: text('email'),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  personType: text('person_type').notNull(),
  orgUnitPath: text('org_unit_path'),
  className: text('class_name'),
  classId: text('class_id'),
  courses: jsonb('courses').$type<string[]>().default([]),
  suspended: boolean('suspended').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
