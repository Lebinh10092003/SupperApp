import { pgTable, text, integer, uuid, timestamp } from 'drizzle-orm/pg-core';

/** catalog_mappings — port từ Firestore collection `catalogMappings`. */
export const catalogMappings = pgTable('catalog_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  rawName: text('raw_name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  type: text('type').notNull().default('CLASS'),
  grade: integer('grade'),
  subject: text('subject'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
