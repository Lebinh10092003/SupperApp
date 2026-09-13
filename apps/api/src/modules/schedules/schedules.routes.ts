import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute, HttpError } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { schedules, scheduleImports } from './schedules.schema.js';
import { classes } from '../classes/classes.schema.js';

const schema = z.object({
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  period: z.coerce.number().int().positive(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  classId: z.string().min(1),
  className: z.string().min(1),
  subject: z.string().min(1),
  teacherEmail: z.string().email(),
  courseId: z.string().nullable().optional(),
  meetingCode: z.string().nullable().optional(),
  spaceName: z.string().nullable().optional(),
  schoolYear: z.string().min(1),
  semester: z.string().min(1),
  expectedStudents: z.coerce.number().nullable().optional(),
  lateMinutes: z.coerce.number().int().min(0).max(60).default(10)
});

const parseRows = (rows: any[]) =>
  rows.map((x, i) => {
    const r = schema.safeParse({
      ...x,
      courseId: x.courseId || null,
      meetingCode: x.meetingCode || null,
      spaceName: x.spaceName || null,
      expectedStudents: x.expectedStudents === '' ? null : x.expectedStudents
    });
    return r.success
      ? { ok: true as const, data: r.data }
      : { ok: false as const, row: i + 2, error: r.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`) };
  });

export const schedulesRouter = Router();

schedulesRouter.get(
  '/',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_q, r) => {
    const items = await db.select().from(schedules);
    items.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.period - b.period);
    r.json({ items });
  })
);

schedulesRouter.post(
  '/',
  firebaseAuth,
  requireCapability('MANAGE_SCHEDULES'),
  asyncRoute(async (q, r) => {
    const x = schema.parse(q.body);
    const [row] = await db
      .insert(schedules)
      .values({ ...x, source: 'MANUAL' })
      .returning();
    if (!row) throw new Error('Không tạo được lịch học.');
    await db
      .insert(classes)
      .values({
        classId: x.classId,
        className: x.className,
        grade: Number(x.className.match(/^[6789]/)?.[0] || 0) || null,
        expectedStudents: x.expectedStudents ?? null
      })
      .onConflictDoUpdate({
        target: classes.classId,
        set: {
          className: x.className,
          grade: Number(x.className.match(/^[6789]/)?.[0] || 0) || null,
          expectedStudents: x.expectedStudents ?? null,
          updatedAt: new Date()
        }
      });
    r.status(201).json({ id: row.id });
  })
);

schedulesRouter.put(
  '/:id',
  firebaseAuth,
  requireCapability('MANAGE_SCHEDULES'),
  asyncRoute(async (q, r) => {
    const x = schema.parse(q.body);
    await db
      .update(schedules)
      .set({ ...x, updatedAt: new Date() })
      .where(eq(schedules.id, String(q.params.id)));
    r.json({ ok: true });
  })
);

schedulesRouter.delete(
  '/:id',
  firebaseAuth,
  requireCapability('MANAGE_SCHEDULES'),
  asyncRoute(async (q, r) => {
    await db.delete(schedules).where(eq(schedules.id, String(q.params.id)));
    r.json({ ok: true });
  })
);

schedulesRouter.post(
  '/import/preview',
  firebaseAuth,
  requireCapability('MANAGE_SCHEDULES'),
  asyncRoute(async (q, r) => {
    const rows = z.array(z.record(z.unknown())).max(5000).parse(q.body?.rows);
    const results = parseRows(rows);
    const errors = results.filter((x) => !x.ok);
    r.json({
      total: rows.length,
      valid: rows.length - errors.length,
      invalid: errors.length,
      errors: errors.slice(0, 100),
      sample: results
        .filter((x): x is { ok: true; data: z.infer<typeof schema> } => x.ok)
        .slice(0, 20)
        .map((x) => x.data)
    });
  })
);

schedulesRouter.post(
  '/import',
  firebaseAuth,
  requireCapability('MANAGE_SCHEDULES'),
  asyncRoute(async (q, r) => {
    const rows = z.array(z.record(z.unknown())).max(5000).parse(q.body?.rows);
    const results = parseRows(rows);
    const errors = results.filter((x) => !x.ok);
    if (errors.length) throw new HttpError(400, `Có ${errors.length} dòng không hợp lệ`, 'DATA_ERROR', errors.slice(0, 100));

    const valid = results.filter((x): x is { ok: true; data: z.infer<typeof schema> } => x.ok);
    const [importRow] = await db
      .insert(scheduleImports)
      .values({ imported: rows.length, status: 'IMPORTED' })
      .returning();
    if (!importRow) throw new Error('Không tạo được nhật ký import.');

    if (valid.length > 0) {
      await db.insert(schedules).values(
        valid.map((x) => ({ ...x.data, source: 'CSV_IMPORT' as const, importBatchId: importRow.id }))
      );
    }
    r.json({ imported: rows.length, importBatchId: importRow.id });
  })
);

schedulesRouter.delete(
  '/import/:id',
  firebaseAuth,
  requireCapability('MANAGE_SCHEDULES'),
  asyncRoute(async (q, r) => {
    const importId = String(q.params.id);
    const deleted = await db.delete(schedules).where(eq(schedules.importBatchId, importId)).returning();
    await db
      .update(scheduleImports)
      .set({ status: 'ROLLED_BACK', rolledBack: deleted.length, rolledBackAt: new Date() })
      .where(eq(scheduleImports.id, importId));
    r.json({ ok: true, rolledBack: deleted.length });
  })
);
