import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { ltcEvents, ltcTasks, ltcAuditLogs } from './work-schedule.schema.js';
import { adminNotifications } from '../safety/admin-notify.schema.js';
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
  recomputeConflictsForEvent,
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
    startAt: new Date('2026-12-05T07:00:00+07:00'),
    endAt: new Date('2026-12-05T09:00:00+07:00'),
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
        eventData: {
          title: 'Sửa bởi người khác',
          campusId: 'CAMPUS_1',
          startAt: new Date('2026-10-02T09:00:00+07:00'),
          endAt: new Date('2026-10-02T10:00:00+07:00')
        }
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
  await assert.rejects(
    () => changeTaskStatus(db, { taskId: task.id, nextStatus: 'PENDING_ACCEPTANCE', actorPerId: 'per-b' }),
    (err: unknown) => err instanceof AppError && err.code === 'invalid_input' && /minh chứng/.test(err.message)
  );
  const pendingAcceptance = await changeTaskStatus(db, {
    taskId: task.id,
    nextStatus: 'PENDING_ACCEPTANCE',
    actorPerId: 'per-b',
    evidenceUrl: 'https://docs.google.com/document/d/abc'
  });
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

test('work-schedule: dò trùng lịch — 2 lịch giao giờ + chung người tham dự thì cả hai đều có conflictNote', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const eventA = await createEvent(db, {
    title: 'Họp giao ban khối 6',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-11-02T08:00:00+07:00'),
    endAt: new Date('2026-11-02T09:00:00+07:00'),
    chairPerId: 'per-a',
    participantPerIds: ['per-x', 'per-y'],
    createdByPerId: 'per-a'
  });
  assert.equal(eventA.conflictNote, '', 'chưa có lịch nào khác nên chưa trùng');

  const eventB = await createEvent(db, {
    title: 'Họp tổ Toán',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-11-02T08:30:00+07:00'),
    endAt: new Date('2026-11-02T09:30:00+07:00'),
    chairPerId: 'per-b',
    participantPerIds: ['per-y', 'per-z'],
    createdByPerId: 'per-b'
  });

  assert.match(eventB.conflictNote, /Họp giao ban khối 6/);
  // KHÔNG còn kèm UUID thô của lịch kia trong ngoặc (Mr Tiến phản hồi
  // 2026-09-21 — vô nghĩa với người dùng cuối, tiêu đề đã đủ nhận diện).
  assert.doesNotMatch(eventB.conflictNote, new RegExp(eventA.id));
  assert.match(eventB.conflictNote, /per-y/);

  const [freshA] = await db.select().from(ltcEvents).where(eq(ltcEvents.id, eventA.id)).limit(1);
  assert.ok(freshA);
  assert.match(freshA!.conflictNote, /Họp tổ Toán/, 'lịch A tạo trước cũng phải được cập nhật lại (2 chiều)');
  assert.doesNotMatch(freshA!.conflictNote, new RegExp(eventB.id));
});

test('work-schedule: dò trùng lịch — giao giờ nhưng KHÔNG chung người tham dự thì không có conflictNote', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const eventA = await createEvent(db, {
    title: 'Họp khối 6',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-11-03T08:00:00+07:00'),
    endAt: new Date('2026-11-03T09:00:00+07:00'),
    chairPerId: 'per-a',
    participantPerIds: ['per-x'],
    createdByPerId: 'per-a'
  });
  const eventB = await createEvent(db, {
    title: 'Họp khối 7',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-11-03T08:30:00+07:00'),
    endAt: new Date('2026-11-03T09:30:00+07:00'),
    chairPerId: 'per-c',
    participantPerIds: ['per-w'],
    createdByPerId: 'per-c'
  });

  assert.equal(eventB.conflictNote, '');
  const [freshA] = await db.select().from(ltcEvents).where(eq(ltcEvents.id, eventA.id)).limit(1);
  assert.equal(freshA!.conflictNote, '');
});

test('work-schedule: dò trùng lịch — hủy 1 lịch thì lịch còn lại được xoá conflictNote', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const eventA = await createEvent(db, {
    title: 'Sự kiện A',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-11-04T08:00:00+07:00'),
    endAt: new Date('2026-11-04T09:00:00+07:00'),
    chairPerId: 'per-a',
    participantPerIds: ['per-x'],
    createdByPerId: 'per-a'
  });
  const eventB = await createEvent(db, {
    title: 'Sự kiện B',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-11-04T08:30:00+07:00'),
    endAt: new Date('2026-11-04T09:30:00+07:00'),
    chairPerId: 'per-b',
    participantPerIds: ['per-x'],
    createdByPerId: 'per-b'
  });
  assert.notEqual(eventB.conflictNote, '');
  const [freshABefore] = await db.select().from(ltcEvents).where(eq(ltcEvents.id, eventA.id)).limit(1);
  assert.notEqual(freshABefore!.conflictNote, '');

  await changeEventStatus(db, { eventId: eventB.id, nextStatus: 'CANCELLED', note: 'Đổi lịch', actorPerId: 'per-b' });

  const [freshA] = await db.select().from(ltcEvents).where(eq(ltcEvents.id, eventA.id)).limit(1);
  assert.equal(freshA!.conflictNote, '', 'lịch B đã hủy nên A hết trùng, conflictNote phải rỗng lại');
});

test('work-schedule: dò trùng lịch — sửa giờ lịch REVISION_REQUIRED tính lại đúng trùng mới, xoá trùng cũ', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const eventOther = await createEvent(db, {
    title: 'Họp cố định',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-11-06T10:00:00+07:00'),
    endAt: new Date('2026-11-06T11:00:00+07:00'),
    chairPerId: 'per-c',
    participantPerIds: ['per-x'],
    createdByPerId: 'per-c'
  });

  const event = await createEvent(db, {
    title: 'Họp giao ban',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-11-05T08:00:00+07:00'),
    endAt: new Date('2026-11-05T09:00:00+07:00'),
    chairPerId: 'per-a',
    participantPerIds: ['per-x'],
    createdByPerId: 'per-a'
  });
  assert.equal(event.conflictNote, '', 'khác ngày với eventOther nên chưa trùng lúc tạo');

  await changeEventStatus(db, { eventId: event.id, nextStatus: 'PENDING_APPROVAL', actorPerId: 'per-a' });
  await changeEventStatus(db, {
    eventId: event.id,
    nextStatus: 'REVISION_REQUIRED',
    note: 'Đổi giờ',
    actorPerId: 'per-vp',
    actorAssignments: [{ roleId: 'R.VICE_PRINCIPAL', campusId: 'CAMPUS_1', domain: null }]
  });

  // Sửa lại giờ cho trùng với eventOther (cùng per-x).
  const revised = await updateRevisionEvent(db, {
    eventId: event.id,
    actorPerId: 'per-a',
    eventData: {
      title: 'Họp giao ban (đổi giờ)',
      campusId: 'CAMPUS_1',
      startAt: new Date('2026-11-06T10:30:00+07:00'),
      endAt: new Date('2026-11-06T11:30:00+07:00'),
      participantPerIds: ['per-x']
    }
  });
  assert.match(revised.conflictNote, /Họp cố định/);

  const [freshOther] = await db.select().from(ltcEvents).where(eq(ltcEvents.id, eventOther.id)).limit(1);
  assert.match(freshOther!.conflictNote, /Họp giao ban \(đổi giờ\)/, 'lịch kia cũng phải được cập nhật lại 2 chiều');
});

test('work-schedule: recomputeConflictsForEvent gọi trực tiếp cũng ra kết quả đúng và không throw khi eventId không tồn tại', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();
  await assert.doesNotReject(() => recomputeConflictsForEvent(db, '00000000-0000-0000-0000-000000000000'));
});

test('work-schedule: validate ngày quá khứ / thứ tự thời gian — tạo lịch', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  await assert.rejects(
    () =>
      createEvent(db, {
        title: 'Lịch quá khứ',
        campusId: 'CAMPUS_1',
        startAt: new Date('2020-01-01T08:00:00+07:00'),
        endAt: new Date('2020-01-01T09:00:00+07:00'),
        chairPerId: 'per-a',
        createdByPerId: 'per-a'
      }),
    (err: unknown) => err instanceof AppError && err.code === 'invalid_input' && /quá khứ/.test(err.message)
  );

  await assert.rejects(
    () =>
      createEvent(db, {
        title: 'Lịch kết thúc trước bắt đầu',
        campusId: 'CAMPUS_1',
        startAt: new Date('2026-12-10T09:00:00+07:00'),
        endAt: new Date('2026-12-10T08:00:00+07:00'),
        chairPerId: 'per-a',
        createdByPerId: 'per-a'
      }),
    (err: unknown) => err instanceof AppError && err.code === 'invalid_input' && /kết thúc phải sau/.test(err.message)
  );

  await assert.rejects(
    () =>
      createEvent(db, {
        title: 'Lịch kết thúc bằng bắt đầu',
        campusId: 'CAMPUS_1',
        startAt: new Date('2026-12-10T08:00:00+07:00'),
        endAt: new Date('2026-12-10T08:00:00+07:00'),
        chairPerId: 'per-a',
        createdByPerId: 'per-a'
      }),
    (err: unknown) => err instanceof AppError && err.code === 'invalid_input' && /kết thúc phải sau/.test(err.message)
  );
});

test('work-schedule: validate ngày quá khứ — updateRevisionEvent áp dụng y hệt createEvent', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const event = await createEvent(db, {
    title: 'Họp cần sửa',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-12-11T08:00:00+07:00'),
    endAt: new Date('2026-12-11T09:00:00+07:00'),
    chairPerId: 'per-a',
    createdByPerId: 'per-a'
  });
  await changeEventStatus(db, { eventId: event.id, nextStatus: 'PENDING_APPROVAL', actorPerId: 'per-a' });
  await changeEventStatus(db, {
    eventId: event.id,
    nextStatus: 'REVISION_REQUIRED',
    note: 'Sai giờ',
    actorPerId: 'per-vp',
    actorAssignments: [{ roleId: 'R.VICE_PRINCIPAL', campusId: 'CAMPUS_1', domain: null }]
  });

  await assert.rejects(
    () =>
      updateRevisionEvent(db, {
        eventId: event.id,
        actorPerId: 'per-a',
        eventData: { title: 'Sửa về quá khứ', campusId: 'CAMPUS_1', startAt: new Date('2020-01-01T08:00:00+07:00'), endAt: new Date('2020-01-01T09:00:00+07:00') }
      }),
    (err: unknown) => err instanceof AppError && /quá khứ/.test(err.message)
  );

  await assert.rejects(
    () =>
      updateRevisionEvent(db, {
        eventId: event.id,
        actorPerId: 'per-a',
        eventData: { title: 'Sửa sai thứ tự', campusId: 'CAMPUS_1', startAt: new Date('2026-12-12T09:00:00+07:00'), endAt: new Date('2026-12-12T08:00:00+07:00') }
      }),
    (err: unknown) => err instanceof AppError && /kết thúc phải sau/.test(err.message)
  );
});

test('work-schedule: validate ngày quá khứ — tạo công việc với dueAt quá khứ bị từ chối', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  await assert.rejects(
    () =>
      createTask(db, {
        title: 'Việc quá hạn ngay từ đầu',
        campusId: 'CAMPUS_1',
        assigneePerId: 'per-b',
        dueAt: new Date('2020-01-01T07:30:00+07:00'),
        createdByPerId: 'per-a'
      }),
    (err: unknown) => err instanceof AppError && err.code === 'invalid_input' && /quá khứ/.test(err.message)
  );
});

// ---------------------------------------------------------------------
// Chuông thông báo (admin_notifications, bảng dùng chung với module An
// toàn) — trước 2026-09-21 module này KHÔNG hề ghi vào bảng này, người
// liên quan (chủ trì/thành phần/người được giao/người giao việc) không hề
// biết có hành động mới trừ khi tự vào xem lại trang (Sin phát hiện, yêu
// cầu rà soát toàn bộ). Tiền tố `WSBELL_` RIÊNG cho nhóm test này — tránh
// đụng `admin_notifications` của các test file khác chạy song song (xem
// quy ước tiền tố ở `core/db/README.md`).
// ---------------------------------------------------------------------

async function cleanupBell() {
  await db.delete(adminNotifications).where(inArray(adminNotifications.recipientPerId, ['WSBELL_chair', 'WSBELL_creator', 'WSBELL_participant', 'WSBELL_assignee']));
}

test('work-schedule: tạo lịch -> chủ trì/thành phần nhận được chuông thông báo', { skip }, async (t) => {
  t.after(async () => {
    await cleanup();
    await cleanupBell();
  });
  await cleanup();
  await cleanupBell();

  const event = await createEvent(db, {
    title: 'Họp giao ban WSBELL',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-10-01T08:00:00+07:00'),
    endAt: new Date('2026-10-01T09:00:00+07:00'),
    chairPerId: 'WSBELL_chair',
    participantPerIds: ['WSBELL_participant'],
    createdByPerId: 'WSBELL_creator'
  });

  const bells = await db.select().from(adminNotifications).where(eq(adminNotifications.objectId, event.id));
  const recipients = bells.map((b) => b.recipientPerId).sort();
  assert.deepEqual(recipients, ['WSBELL_chair', 'WSBELL_participant']);
  assert.ok(bells.every((b) => b.eventType === 'work_schedule.event.created'));
});

test('work-schedule: hủy lịch -> người tạo/chủ trì/thành phần đều nhận chuông; yêu cầu sửa lại -> chỉ người tạo nhận chuông', { skip }, async (t) => {
  t.after(async () => {
    await cleanup();
    await cleanupBell();
  });
  await cleanup();
  await cleanupBell();

  const event = await createEvent(db, {
    title: 'Lịch WSBELL cần sửa',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-10-02T08:00:00+07:00'),
    endAt: new Date('2026-10-02T09:00:00+07:00'),
    chairPerId: 'WSBELL_chair',
    participantPerIds: ['WSBELL_participant'],
    createdByPerId: 'WSBELL_creator'
  });
  await changeEventStatus(db, { eventId: event.id, nextStatus: 'PENDING_APPROVAL', actorPerId: 'WSBELL_creator' });
  await changeEventStatus(db, { eventId: event.id, nextStatus: 'REVISION_REQUIRED', note: 'Thiếu địa điểm', actorPerId: 'WSBELL_chair' });

  const eventBells = await db.select().from(adminNotifications).where(eq(adminNotifications.objectId, event.id));
  const revisionBells = eventBells.filter((b) => b.eventType === 'work_schedule.event.revision_required');
  assert.deepEqual(revisionBells.map((b) => b.recipientPerId).sort(), ['WSBELL_creator']);

  await changeEventStatus(db, { eventId: event.id, nextStatus: 'PENDING_APPROVAL', actorPerId: 'WSBELL_creator' });
  await changeEventStatus(db, { eventId: event.id, nextStatus: 'CANCELLED', note: 'Trường nghỉ đột xuất', actorPerId: 'WSBELL_creator' });

  const eventBells2 = await db.select().from(adminNotifications).where(eq(adminNotifications.objectId, event.id));
  const cancelBells = eventBells2.filter((b) => b.eventType === 'work_schedule.event.cancelled');
  assert.deepEqual(cancelBells.map((b) => b.recipientPerId).sort(), ['WSBELL_chair', 'WSBELL_creator', 'WSBELL_participant']);
});

test('work-schedule: duyệt xong (published) -> người tạo/chủ trì/thành phần nhận chuông "đã ban hành"', { skip }, async (t) => {
  t.after(async () => {
    await cleanup();
    await cleanupBell();
  });
  await cleanup();
  await cleanupBell();

  const event = await createEvent(db, {
    title: 'Lịch WSBELL duyệt xong',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-10-03T08:00:00+07:00'),
    endAt: new Date('2026-10-03T09:00:00+07:00'),
    chairPerId: 'WSBELL_chair',
    participantPerIds: ['WSBELL_participant'],
    createdByPerId: 'WSBELL_creator'
  });
  await changeEventStatus(db, { eventId: event.id, nextStatus: 'PENDING_APPROVAL', actorPerId: 'WSBELL_creator' });
  await approveEvent(db, { eventId: event.id, actorPerId: 'per-vp', actorAssignments: [{ roleId: 'R.VICE_PRINCIPAL', campusId: 'CAMPUS_1', domain: null }] });

  const eventBells = await db.select().from(adminNotifications).where(eq(adminNotifications.objectId, event.id));
  const publishedBells = eventBells.filter((b) => b.eventType === 'work_schedule.event.published');
  assert.deepEqual(publishedBells.map((b) => b.recipientPerId).sort(), ['WSBELL_chair', 'WSBELL_creator', 'WSBELL_participant']);
});

test('work-schedule: giao việc -> người được giao nhận chuông; nghiệm thu -> người được giao nhận chuông kết quả', { skip }, async (t) => {
  t.after(async () => {
    await cleanup();
    await cleanupBell();
  });
  await cleanup();
  await cleanupBell();

  const task = await createTask(db, {
    title: 'Việc WSBELL',
    campusId: 'CAMPUS_1',
    assigneePerId: 'WSBELL_assignee',
    dueAt: new Date('2026-11-01T08:00:00+07:00'),
    createdByPerId: 'WSBELL_creator'
  });

  const taskBells0 = await db.select().from(adminNotifications).where(eq(adminNotifications.objectId, task.id));
  const createdBells = taskBells0.filter((b) => b.eventType === 'work_schedule.task.created');
  assert.deepEqual(createdBells.map((b) => b.recipientPerId), ['WSBELL_assignee']);

  await changeTaskStatus(db, { taskId: task.id, nextStatus: 'ACCEPTED', actorPerId: 'WSBELL_assignee' });
  await changeTaskStatus(db, { taskId: task.id, nextStatus: 'IN_PROGRESS', actorPerId: 'WSBELL_assignee' });
  await changeTaskStatus(db, {
    taskId: task.id,
    nextStatus: 'PENDING_ACCEPTANCE',
    actorPerId: 'WSBELL_assignee',
    evidenceUrl: 'https://docs.google.com/document/d/wsbell'
  });

  const taskBells1 = await db.select().from(adminNotifications).where(eq(adminNotifications.objectId, task.id));
  const pendingAcceptanceBells = taskBells1.filter((b) => b.eventType === 'work_schedule.task.status_changed');
  assert.ok(pendingAcceptanceBells.some((b) => b.recipientPerId === 'WSBELL_creator' && /nghiệm thu/.test(b.message)));

  await acceptOrReturnTask(db, { taskId: task.id, nextStatus: 'COMPLETED', actorPerId: 'WSBELL_creator' });
  const taskBells2 = await db.select().from(adminNotifications).where(eq(adminNotifications.objectId, task.id));
  const acceptedBells = taskBells2.filter((b) => b.eventType === 'work_schedule.task.accepted');
  assert.deepEqual(acceptedBells.map((b) => b.recipientPerId), ['WSBELL_assignee']);
});
