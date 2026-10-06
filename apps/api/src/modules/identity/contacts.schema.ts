import { foreignKey, pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';

/**
 * Sổ danh bạ nội bộ (bổ sung 2026-10-02, Sin: "danh bạ lấy dữ liệu người
 * có sẵn trong hệ thống thôi... nhóm liên hệ bao gồm cả cá nhân tự tạo
 * lẫn nhóm mặc định (nhóm mặc định thì được tk cấp cao chọn và có thể
 * hiển thị cho toàn trường)"). Thành viên nhóm LUÔN trỏ tới một
 * `accounts.perId` có sẵn — không lưu người ngoài hệ thống, không lưu lại
 * tên/SĐT (những thứ đó đọc trực tiếp từ `accounts`/`people_directory`
 * lúc hiển thị, xem contacts.routes.ts).
 *
 * `ownerPerId` NULL = nhóm mặc định toàn trường (do BGH tạo, ai cũng xem
 * được — gate tạo/sửa/xoá là capability MANAGE_USERS, xem contacts.routes.ts),
 * có giá trị = nhóm cá nhân (chỉ chủ nhóm xem/sửa/xoá được).
 */
export const contactGroups = pgTable('contact_groups', {
  groupId: text('group_id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerPerId: text('owner_per_id'),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const contactGroupMembers = pgTable(
  'contact_group_members',
  {
    groupId: text('group_id').notNull(),
    perId: text('per_id').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    primaryKey({ name: 'contact_group_members_pkey', columns: [t.groupId, t.perId] }),
    foreignKey({
      name: 'contact_group_members_group_id_fkey',
      columns: [t.groupId],
      foreignColumns: [contactGroups.groupId]
    }).onDelete('cascade')
  ]
);
