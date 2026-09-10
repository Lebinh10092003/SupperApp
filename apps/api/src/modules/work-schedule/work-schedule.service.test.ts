import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../core/db/client.js';
import { ltcEvents, ltcTasks, ltcAuditLogs } from './work-schedule.schema.js';
import {
  createEvent,
  updateRevisionEvent,
  changeEventStatus,
  approveEvent,
  listEvents,
  createTask,
  changeTaskStatus,
  acceptOrReturnTask,
  listTasks,
  getAuditLogs,
  AppError
} from './work-schedule.service.js';

/**
 * Test thật với Postgres (không mock) — bỏ qua nếu không có DATABASE_URL.
 * Xác nhận state machine + luật duyệt port đúng từ lichCongTac.js/
 * authzLichCongTac.js gốc, không chỉ tin code compile được.
 */
const skip = !process.env.DATABASE_URL;

async function cleanup() {
  await db.delete(ltcAuditLogs);
  await db.delete(ltcTasks);
  await db.delete(ltcEvents);
}

test('work-schedule: state machine sự kiện + duyệt CAMPUS 1 bước', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const event = await createEvent(db, {
    title: 'Họp tổ chuyên môn',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-10-01T08:00:00+07:00'),
    endAt: new Date('2026-10-01T09:00:00+07:00'),
    chairPerId: 'per-a',
    createdByPerId: 'per-a'
  });
  assert.equal(event.status, 'DRAFT');

  await assert.rejects(
    () => createEvent(db, { title: '', campusId: 'CAMPUS_1', startAt: new Date(), endAt: new Date(), chairPerId: 'x', createdByPerId: 'x' }),
    (err: unknown) => err instanceof AppError && err.code === 'invalid_input'
  );

  const pending = await changeEventStatus(db, { eventId: event.id, nextStatus: 'PENDING_APPROVAL', actorPerId: 'per-a' });
  assert.equal(pending.status, 'PENDING_APPROVAL');

  // Không đủ quyền (không có assignment nào) -> bị từ chối.
  await assert.rejects(
    () => approveEvent(db, { eventId: event.id, actorPerId: 'per-b', actorAssignments: [] }),
    (err: unknown) => err instanceof AppError && err.code === 'forbidden'
  );

  // Hiệu phó cùng cơ sở -> duyệt xong ngay (scope=CAMPUS mặc định, 1 bước).
  const published = await approveEvent(db, {
    eventId: event.id,
    actorPerId: 'per-vp',
    actorAssignments: [{ roleId: 'R.VICE_PRINCIPAL', campusId: 'CAMPUS_1', domain: null }]
  });
  assert.equal(published.status, 'PUBLISHED');

  const auditRows = await db.select().from(ltcAuditLogs);
  assert.ok(auditRows.some((r) => r.action === 'event.published'));

  const listed = await listEvents(db, { campusId: 'CAMPUS_1', statuses: ['PUBLISHED'] });
  assert.equal(listed.length, 1);
  assert.equal(listed[0]!.id, event.id);
});

test('work-schedule: sự kiện SCHOOL_WIDE cần đúng 2 bước tuần tự (Hiệu phó rồi Hiệu trưởng)', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const event = await createEvent(db, {
    title: 'Lễ khai giảng toàn trường',
    campusId: 'MAIN_CAMPUS',
    scope: 'SCHOOL_WIDE',
    startAt: new Date('2026-09-05T07:00:00+07:00'),
    endAt: new Date('2026-09-05T09:00:00+07:00'),
    chairPerId: 'per-principal',
    createdByPerId: 'per-principal'
  });
  await changeEventStatus(db, { eventId: event.id, nextStatus: 'PENDING_APPROVAL', actorPerId: 'per-principal' });

  const vpAssignments = [{ roleId: 'R.VICE_PRINCIPAL', campusId: 'MAIN_CAMPUS', domain: null }];
  const afterVp = await approveEvent(db, { eventId: event.id, actorPerId: 'per-vp', actorAssignments: vpAssignments });
  assert.equal(afterVp.status, 'PENDING_APPROVAL', 'chưa PUBLISHED khi mới có chữ ký Hiệu phó');
  assert.equal(afterVp.approvals.length, 1);

  // Hiệu phó bấm duyệt lần 2 -> từ chối rõ lý do.
  await assert.rejects(
    () => approveEvent(db, { eventId: event.id, actorPerId: 'per-vp', actorAssignments: vpAssignments }),
    (err: unknown) => err instanceof AppError && /đã duyệt bước này rồi/.test(err.message)
  );

  const principalAssignments = [{ roleId: 'R.PRINCIPAL', campusId: null, domain: null }];
  const afterPrincipal = await approveEvent(db, { eventId: event.id, actorPerId: 'per-principal-actor', actorAssignments: principalAssignments });
  assert.equal(afterPrincipal.status, 'PUBLISHED');
  assert.equal(afterPrincipal.approvals.length, 2);
});

test('work-schedule: sửa lịch REVISION_REQUIRED chỉ cho đúng người tạo', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const event = await createEvent(db, {
    title: 'Họp giao ban',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-10-02T08:00:00+07:00'),
    endAt: new Date('2026-10-02T09:00:00+07:00'),
    chairPerId: 'per-a',
    createdByPerId: 'per-a'
  });
  await changeEventStatus(db, { eventId: event.id, nextStatus: 'PENDING_APPROVAL', actorPerId: 'per-a' });
  const revised = await changeEventStatus(db, {
    eventId: event.id,
    nextStatus: 'REVISION_REQUIRED',
    note: 'Sai giờ họp',
    actorPerId: 'per-vp',
    actorAssignments: [{ roleId: 'R.VICE_PRINCIPAL', campusId: 'CAMPUS_1', domain: null }]
  });
  assert.equal(revised.status, 'REVISION_REQUIRED');
  assert.equal(revised.revisionNote, 'Sai giờ họp');

  await assert.rejects(
    () =>
      updateRevisionEvent(db, {
        eventId: event.id,
        actorPerId: 'per-b',
        eventData: { title: 'Sửa bởi người khác', campusId: 'CAMPUS_1', startAt: new Date(), endAt: new Date() }
      }),
    (err: unknown) => err instanceof AppError && err.code === 'forbidden'
  );

  const fixed = await updateRevisionEvent(db, {
    eventId: event.id,
    actorPerId: 'per-a',
    eventData: {
      title: 'Họp giao ban (đã sửa giờ)',
      campusId: 'CAMPUS_1',
      startAt: new Date('2026-10-02T09:00:00+07:00'),
      endAt: new Date('2026-10-02T10:00:00+07:00')
    }
  });
  assert.equal(fixed.title, 'Họp giao ban (đã sửa giờ)');
  assert.equal(fixed.status, 'REVISION_REQUIRED', 'trạng thái giữ nguyên, chưa tự gửi duyệt lại');
  // version tăng dần theo từng lần ghi: create=1, PENDING_APPROVAL=2, REVISION_REQUIRED=3, sửa=4.
  assert.equal(fixed.version, 4);
});

test('work-schedule: state machine công việc + nghiệm thu chỉ do người giao xác nhận', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const task = await createTask(db, {
    title: 'Chuẩn bị phòng họp',
    campusId: 'CAMPUS_1',
    assigneePerId: 'per-b',
    dueAt: new Date('2026-10-01T07:30:00+07:00'),
    createdByPerId: 'per-a'
  });
  assert.equal(task.status, 'ASSIGNED');

  await assert.rejects(
    () => changeTaskStatus(db, { taskId: task.id, nextStatus: 'ACCEPTED', actorPerId: 'per-other' }),
    (err: unknown) => err instanceof AppError && err.code === 'forbidden'
  );

  await changeTaskStatus(db, { taskId: task.id, nextStatus: 'ACCEPTED', actorPerId: 'per-b' });
  await changeTaskStatus(db, { taskId: task.id, nextStatus: 'IN_PROGRESS', actorPerId: 'per-b' });
  const pendingAcceptance = await changeTaskStatus(db, { taskId: task.id, nextStatus: 'PENDING_ACCEPTANCE', actorPerId: 'per-b' });
  assert.equal(pendingAcceptance.status, 'PENDING_ACCEPTANCE');

  // Người được giao (per-b) không được tự nghiệm thu việc của mình.
  await assert.rejects(
    () => acceptOrReturnTask(db, { taskId: task.id, nextStatus: 'COMPLETED', actorPerId: 'per-b' }),
    (err: unknown) => err instanceof AppError && err.code === 'forbidden'
  );

  const completed = await acceptOrReturnTask(db, { taskId: task.id, nextStatus: 'COMPLETED', actorPerId: 'per-a' });
  assert.equal(completed.status, 'COMPLETED');

  const tasksOfB = await listTasks(db, { assigneePerId: 'per-b' });
  assert.equal(tasksOfB.length, 1);
});

test('work-schedule: người tạo == người được giao thì task tự ACCEPTED', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const task = await createTask(db, {
    title: 'Tự làm báo cáo tuần',
    campusId: 'MAIN_CAMPUS',
    assigneePerId: 'per-a',
    dueAt: new Date('2026-10-03T17:00:00+07:00'),
    createdByPerId: 'per-a'
  });
  assert.equal(task.status, 'ACCEPTED');
});

test('work-schedule: getAuditLogs đọc đúng nhật ký đã ghi, lọc theo entityType/entityId, mới nhất trước', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const event = await createEvent(db, {
    title: 'Họp giao ban',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-10-05T08:00:00+07:00'),
    endAt: new Date('2026-10-05T09:00:00+07:00'),
    chairPerId: 'per-a',
    createdByPerId: 'per-a'
  });
  await changeEventStatus(db, { eventId: event.id, nextStatus: 'PENDING_APPROVAL', actorPerId: 'per-a' });

  const task = await createTask(db, {
    title: 'Chuẩn bị phòng họp',
    campusId: 'CAMPUS_1',
    assigneePerId: 'per-b',
    dueAt: new Date('2026-10-05T07:30:00+07:00'),
    createdByPerId: 'per-a'
  });

  const eventLogs = await getAuditLogs(db, { entityType: 'event', entityId: event.id });
  assert.equal(eventLogs.length, 2);
  assert.equal(eventLogs[0]?.action, 'event.status_changed', 'mới nhất trước');
  assert.equal(eventLogs[1]?.action, 'event.created');

  const taskLogs = await getAuditLogs(db, { entityType: 'task', entityId: task.id });
  assert.equal(taskLogs.length, 1);
  assert.equal(taskLogs[0]?.action, 'task.created');

  const allLogs = await getAuditLogs(db, {});
  assert.equal(allLogs.length, 3, 'không lọc entity -> trả hết');

  const noMatch = await getAuditLogs(db, { entityType: 'event', entityId: 'khong-ton-tai' });
  assert.equal(noMatch.length, 0);
});
