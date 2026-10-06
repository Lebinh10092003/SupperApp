import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { ltcEvents, ltcTasks, ltcAuditLogs } from './work-schedule.schema.js';
import { adminNotifications } from '../safety/admin-notify.schema.js';
import {
  createEvent as createEventService,
  updateRevisionEvent as updateRevisionEventService,
  changeEventStatus,
  approveEvent,
  listEvents,
  createTask as createTaskService,
  updateTask as updateTaskService,
  changeTaskStatus,
  listTasks,
  attachSubtaskInfo,
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

// Keep fixed-date fixtures deterministic as real time advances. Individual
// validation tests can still override `now` through the service options.
function createEvent(...args: Parameters<typeof createEventService>) {
  const [database, input, options] = args;
  return createEventService(database, input, {
    now: new Date('2026-09-01T00:00:00+07:00'),
    ...options
  });
}

function updateRevisionEvent(...args: Parameters<typeof updateRevisionEventService>) {
  const [database, input, options] = args;
  return updateRevisionEventService(database, input, {
    now: new Date('2026-09-01T00:00:00+07:00'),
    ...options
  });
}

function createTask(...args: Parameters<typeof createTaskService>) {
  const [database, input, options] = args;
  return createTaskService(database, input, {
    now: new Date('2026-09-01T00:00:00+07:00'),
    ...options
  });
}

function updateTask(...args: Parameters<typeof updateTaskService>) {
  const [database, input, options] = args;
  return updateTaskService(database, input, {
    now: new Date('2026-09-01T00:00:00+07:00'),
    ...options
  });
}

async function cleanup() {
  await db.delete(ltcAuditLogs);
  await db.delete(ltcTasks);
  await db.delete(ltcEvents);
}

/**
 * 2026-09-29 (Sin — Phó Hiệu trưởng — yêu cầu bỏ gate duyệt, xem ghi chú
 * ở createEvent trong work-schedule.service.ts): `createEvent` giờ LUÔN
 * trả PUBLISHED ngay, không còn đường nào tạo ra DRAFT nữa. Các hàm
 * `changeEventStatus`/`approveEvent`/`evaluateEventApproval` CỐ Ý GIỮ
 * NGUYÊN (không xoá) — chỉ không còn nơi nào trong app THẬT gọi tới nữa.
 * Helper này ép NGƯỢC 1 event vừa tạo về DRAFT bằng update thẳng DB, CHỈ
 * để giữ được test coverage cho state machine duyệt cũ (phòng khi cần
 * dùng lại) — KHÔNG PHẢI cách nào trong code thật (route/service) làm
 * vậy, không dùng ngoài test. */
async function createDraftEvent(input: Parameters<typeof createEvent>[1]) {
  const event = await createEvent(db, input);
  const [row] = await db.update(ltcEvents).set({ status: 'DRAFT' }).where(eq(ltcEvents.id, event.id)).returning();
  return row!;
}

test('work-schedule: state machine sự kiện + duyệt CAMPUS 1 bước', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  // createEvent() thật giờ trả PUBLISHED ngay (xem test riêng cuối file)
  // — dùng createDraftEvent() (ép ngược về DRAFT qua DB) để vẫn kiểm tra
  // được state machine duyệt cũ, GIỮ NGUYÊN không xoá dù không còn đường
  // nào trong app thật dẫn tới đây nữa.
  const event = await createDraftEvent({
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

test('work-schedule: 2026-10-05 lịch SCHOOL_WIDE tạo ra PENDING_APPROVAL, chỉ 1 bước duyệt (Hiệu trưởng HOẶC Hiệu phó Điểm trường chính)', { skip }, async (t) => {
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
  assert.equal(event.status, 'PENDING_APPROVAL', 'lịch toàn trường không ban hành thẳng nữa, phải chờ duyệt');

  // Hiệu phó CAMPUS_1 (không phải Điểm trường chính) không được duyệt.
  await assert.rejects(
    () => approveEvent(db, { eventId: event.id, actorPerId: 'per-vp1', actorAssignments: [{ roleId: 'R.VICE_PRINCIPAL', campusId: 'CAMPUS_1', domain: null }] }),
    (err: unknown) => err instanceof AppError && err.code === 'forbidden'
  );

  // Hiệu phó Điểm trường chính duyệt -> ban hành ngay (1 bước, không cần ai duyệt thêm).
  const published = await approveEvent(db, {
    eventId: event.id,
    actorPerId: 'per-vp-main',
    actorAssignments: [{ roleId: 'R.VICE_PRINCIPAL', campusId: 'MAIN_CAMPUS', domain: null }]
  });
  assert.equal(published.status, 'PUBLISHED');
  assert.equal(published.approvals.length, 1);

  // Duyệt lại lần nữa (đã PUBLISHED, không còn PENDING_APPROVAL) -> lỗi.
  await assert.rejects(
    () => approveEvent(db, { eventId: event.id, actorPerId: 'per-principal-actor', actorAssignments: [{ roleId: 'R.PRINCIPAL', campusId: null, domain: null }] }),
    (err: unknown) => err instanceof AppError && err.code === 'invalid_transition'
  );
});

test('work-schedule: sửa lịch — 2026-09-29 nới ra người tạo HOẶC chủ trì, mọi trạng thái trừ CANCELLED', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  // Sự kiện thật (createEvent) giờ PUBLISHED ngay — kiểm tra sửa được
  // luôn ở PUBLISHED (khác hẳn bản cũ chỉ sửa được DRAFT/REVISION_REQUIRED).
  const event = await createEvent(db, {
    title: 'Họp giao ban',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-10-02T08:00:00+07:00'),
    endAt: new Date('2026-10-02T09:00:00+07:00'),
    chairPerId: 'per-chair',
    createdByPerId: 'per-a'
  });
  assert.equal(event.status, 'PUBLISHED');

  // Không phải người tạo, không phải chủ trì -> vẫn bị từ chối.
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

  // Người tạo sửa được, dù đã PUBLISHED.
  const fixedByCreator = await updateRevisionEvent(db, {
    eventId: event.id,
    actorPerId: 'per-a',
    eventData: {
      title: 'Họp giao ban (đã sửa giờ)',
      campusId: 'CAMPUS_1',
      startAt: new Date('2026-10-02T09:00:00+07:00'),
      endAt: new Date('2026-10-02T10:00:00+07:00')
    }
  });
  assert.equal(fixedByCreator.title, 'Họp giao ban (đã sửa giờ)');
  assert.equal(fixedByCreator.status, 'PUBLISHED', 'vẫn PUBLISHED, không còn bị đẩy về trạng thái nào khác khi sửa');

  // Chủ trì (không phải người tạo) CŨNG sửa được — quy tắc mới.
  const fixedByChair = await updateRevisionEvent(db, {
    eventId: event.id,
    actorPerId: 'per-chair',
    eventData: {
      title: 'Họp giao ban (chủ trì tự sửa lại)',
      campusId: 'CAMPUS_1',
      startAt: new Date('2026-10-02T09:00:00+07:00'),
      endAt: new Date('2026-10-02T10:00:00+07:00')
    }
  });
  assert.equal(fixedByChair.title, 'Họp giao ban (chủ trì tự sửa lại)');

  // SỬA 2026-09-29 #2 (Sin: "lịch đã huỷ thì vẫn cho edit như thường thôi")
  // — đã CANCELLED vẫn sửa được nội dung (không tự khôi phục trạng thái).
  await changeEventStatus(db, { eventId: event.id, nextStatus: 'CANCELLED', note: 'Test huỷ', actorPerId: 'per-a' });
  const fixedAfterCancel = await updateRevisionEvent(db, {
    eventId: event.id,
    actorPerId: 'per-a',
    eventData: { title: 'Sửa lịch đã huỷ', campusId: 'CAMPUS_1', startAt: new Date('2026-10-02T09:00:00+07:00'), endAt: new Date('2026-10-02T10:00:00+07:00') }
  });
  assert.equal(fixedAfterCancel.title, 'Sửa lịch đã huỷ');
  assert.equal(fixedAfterCancel.status, 'CANCELLED', 'sửa nội dung không tự khôi phục trạng thái');

  // Khôi phục CANCELLED -> PUBLISHED.
  const restored = await changeEventStatus(db, { eventId: event.id, nextStatus: 'PUBLISHED', actorPerId: 'per-a' });
  assert.equal(restored.status, 'PUBLISHED');
});

test('work-schedule: sửa lịch — 2026-09-30 (Sin: "phó hiệu trưởng nhờ giáo viên tạo hộ lịch") — đổi được chairPerId, giữ nguyên nếu không truyền', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const event = await createEvent(db, {
    title: 'Lễ chào cờ',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-10-05T07:00:00+07:00'),
    endAt: new Date('2026-10-05T08:00:00+07:00'),
    chairPerId: 'PER_pho_hieu_truong',
    createdByPerId: 'PER_giao_vien_tao_ho'
  });
  assert.equal(event.chairPerId, 'PER_pho_hieu_truong');

  // Sửa nội dung khác mà KHÔNG truyền chairPerId — chủ trì cũ PHẢI giữ
  // nguyên (trước đây route/service không hề nhận field này, âm thầm bỏ
  // qua — nhưng ít nhất không được VÔ TÌNH xoá/đổi chủ trì khi sửa việc
  // khác không liên quan).
  const editedOther = await updateRevisionEvent(db, {
    eventId: event.id,
    actorPerId: 'PER_giao_vien_tao_ho',
    eventData: { title: 'Lễ chào cờ (đổi giờ)', campusId: 'CAMPUS_1', startAt: new Date('2026-10-05T07:30:00+07:00'), endAt: new Date('2026-10-05T08:30:00+07:00') }
  });
  assert.equal(editedOther.chairPerId, 'PER_pho_hieu_truong', 'không truyền chairPerId thì giữ nguyên, không bị xoá mất');

  // Đổi hẳn sang người khác — phải áp dụng đúng.
  const editedChair = await updateRevisionEvent(db, {
    eventId: event.id,
    actorPerId: 'PER_giao_vien_tao_ho',
    eventData: {
      title: 'Lễ chào cờ',
      campusId: 'CAMPUS_1',
      startAt: new Date('2026-10-05T07:30:00+07:00'),
      endAt: new Date('2026-10-05T08:30:00+07:00'),
      chairPerId: 'PER_thay_the_khac'
    }
  });
  assert.equal(editedChair.chairPerId, 'PER_thay_the_khac');
});

test('work-schedule: state machine công việc — 2027-10-05 chỉ 2 trạng thái, chỉ chủ trì (assignee) được chuyển', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const task = await createTask(db, {
    title: 'Chuẩn bị phòng họp',
    campusId: 'CAMPUS_1',
    assigneePerId: 'per-b',
    dueAt: new Date('2027-10-01T07:30:00+07:00'),
    createdByPerId: 'per-a'
  });
  assert.equal(task.status, 'ASSIGNED');

  // Người giao (per-a) KHÔNG được tự chuyển trạng thái — chỉ chủ trì (per-b).
  await assert.rejects(
    () => changeTaskStatus(db, { taskId: task.id, nextStatus: 'COMPLETED', actorPerId: 'per-a' }),
    (err: unknown) => err instanceof AppError && err.code === 'forbidden'
  );
  await assert.rejects(
    () => changeTaskStatus(db, { taskId: task.id, nextStatus: 'COMPLETED', actorPerId: 'per-other' }),
    (err: unknown) => err instanceof AppError && err.code === 'forbidden'
  );

  const completed = await changeTaskStatus(db, { taskId: task.id, nextStatus: 'COMPLETED', actorPerId: 'per-b' });
  assert.equal(completed.status, 'COMPLETED');

  // Lùi lại ASSIGNED nếu đánh dấu nhầm — vẫn chỉ chủ trì được làm.
  const reverted = await changeTaskStatus(db, { taskId: task.id, nextStatus: 'ASSIGNED', actorPerId: 'per-b' });
  assert.equal(reverted.status, 'ASSIGNED');

  const tasksOfB = await listTasks(db, { assigneePerId: 'per-b' });
  assert.equal(tasksOfB.length, 1);
});

test('work-schedule: sửa việc nhỏ — 2026-09-29 người giao HOẶC người được giao sửa được, có location + nhiều người cùng làm, chặn khi CANCELLED và chặn người ngoài', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const task = await createTask(db, {
    title: 'Chuẩn bị phòng họp',
    campusId: 'CAMPUS_1',
    assigneePerId: 'per-b',
    dueAt: new Date('2027-10-01T07:30:00+07:00'),
    createdByPerId: 'per-a'
  });

  // Người ngoài (không phải người giao/người được giao) bị chặn.
  await assert.rejects(
    () =>
      updateTask(db, {
        taskId: task.id,
        actorPerId: 'per-other',
        taskData: { title: 'Sửa trái phép', campusId: 'CAMPUS_1', assigneePerId: 'per-b', dueAt: new Date('2027-10-02T07:30:00+07:00') }
      }),
    (err: unknown) => err instanceof AppError && err.code === 'forbidden'
  );

  // Người giao (per-a, không phải assignee) sửa được — thêm địa điểm +
  // người cùng làm (per-c).
  const afterCreatorEdit = await updateTask(db, {
    taskId: task.id,
    actorPerId: 'per-a',
    taskData: {
      title: 'Chuẩn bị phòng họp (đã sửa)',
      campusId: 'CAMPUS_1',
      assigneePerId: 'per-b',
      collaboratorPerIds: ['per-c'],
      location: 'Phòng họp tầng 2',
      dueAt: new Date('2027-10-02T07:30:00+07:00')
    }
  });
  assert.equal(afterCreatorEdit.title, 'Chuẩn bị phòng họp (đã sửa)');
  assert.equal(afterCreatorEdit.location, 'Phòng họp tầng 2');
  assert.deepEqual(afterCreatorEdit.collaboratorPerIds, ['per-c']);
  assert.equal(afterCreatorEdit.status, 'ASSIGNED', 'sửa nội dung không đổi trạng thái');

  // Người được giao (per-b) cũng sửa được, kể cả đổi người được giao mới.
  const afterAssigneeEdit = await updateTask(db, {
    taskId: task.id,
    actorPerId: 'per-b',
    taskData: {
      title: 'Chuẩn bị phòng họp (đổi người)',
      campusId: 'CAMPUS_1',
      assigneePerId: 'per-d',
      dueAt: new Date('2027-10-03T07:30:00+07:00')
    }
  });
  assert.equal(afterAssigneeEdit.assigneePerId, 'per-d');

  const logs = await getAuditLogs(db, { entityType: 'task', entityId: task.id });
  assert.ok(logs.some((l) => l.action === 'task.updated'));
});

test('work-schedule: 2026-10-05 chỉ 2 trạng thái — task luôn khởi tạo ASSIGNED kể cả tự giao cho mình', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const task = await createTask(db, {
    title: 'Tự làm báo cáo tuần',
    campusId: 'MAIN_CAMPUS',
    assigneePerId: 'per-a',
    dueAt: new Date('2027-10-03T17:00:00+07:00'),
    createdByPerId: 'per-a'
  });
  assert.equal(task.status, 'ASSIGNED');
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
  await changeEventStatus(db, { eventId: event.id, nextStatus: 'CANCELLED', note: 'Đổi lịch', actorPerId: 'per-a' });

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

  const event = await createDraftEvent({
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

  const event = await createDraftEvent({
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

  const event = await createDraftEvent({
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

test('work-schedule: giao việc -> người được giao nhận chuông; chủ trì đánh dấu hoàn thành -> người giao nhận chuông', { skip }, async (t) => {
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

  await changeTaskStatus(db, { taskId: task.id, nextStatus: 'COMPLETED', actorPerId: 'WSBELL_assignee' });
  const taskBells1 = await db.select().from(adminNotifications).where(eq(adminNotifications.objectId, task.id));
  const statusBells = taskBells1.filter((b) => b.eventType === 'work_schedule.task.status_changed');
  assert.deepEqual(statusBells.map((b) => b.recipientPerId), ['WSBELL_creator']);
});

test('work-schedule: listEvents gắn đúng taskCount/taskCompletedCount/taskProgressPercent (Sin yêu cầu 2026-09-28, "việc lớn hiện tiến độ %")', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const eventNoTasks = await createEvent(db, {
    title: 'Lịch chưa có việc nhỏ',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-10-05T08:00:00+07:00'),
    endAt: new Date('2026-10-05T09:00:00+07:00'),
    chairPerId: 'PER_progress_chair',
    createdByPerId: 'PER_progress_chair'
  });
  const eventWithTasks = await createEvent(db, {
    title: 'Lịch có 2 việc nhỏ, 1 xong',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-10-06T08:00:00+07:00'),
    endAt: new Date('2026-10-06T09:00:00+07:00'),
    chairPerId: 'PER_progress_chair',
    createdByPerId: 'PER_progress_chair'
  });

  const taskA = await createTask(db, {
    eventId: eventWithTasks.id,
    title: 'Việc nhỏ A — sẽ hoàn thành',
    campusId: 'CAMPUS_1',
    assigneePerId: 'PER_progress_assignee',
    dueAt: new Date('2026-10-06T08:00:00+07:00'),
    createdByPerId: 'PER_progress_chair'
  });
  await createTask(db, {
    eventId: eventWithTasks.id,
    title: 'Việc nhỏ B — vẫn đang làm',
    campusId: 'CAMPUS_1',
    assigneePerId: 'PER_progress_assignee',
    dueAt: new Date('2026-10-06T08:00:00+07:00'),
    createdByPerId: 'PER_progress_chair'
  });
  await changeTaskStatus(db, { taskId: taskA.id, nextStatus: 'COMPLETED', actorPerId: 'PER_progress_assignee' });

  const events = await listEvents(db, { campusId: 'CAMPUS_1' });
  const noTasksRow = events.find((e) => e.id === eventNoTasks.id)!;
  const withTasksRow = events.find((e) => e.id === eventWithTasks.id)!;

  assert.equal(noTasksRow.taskCount, 0);
  assert.equal(noTasksRow.taskProgressPercent, null, 'chưa có việc nhỏ nào -> null, KHÔNG phải 0%');

  assert.equal(withTasksRow.taskCount, 2);
  assert.equal(withTasksRow.taskCompletedCount, 1);
  assert.equal(withTasksRow.taskProgressPercent, 50);
});

test('work-schedule: listTasks lọc theo eventId — "bấm vào việc lớn xem đúng các việc nhỏ của nó"', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const eventOne = await createEvent(db, {
    title: 'Sự kiện 1',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-10-07T08:00:00+07:00'),
    endAt: new Date('2026-10-07T09:00:00+07:00'),
    chairPerId: 'PER_evfilter_chair',
    createdByPerId: 'PER_evfilter_chair'
  });
  const eventTwo = await createEvent(db, {
    title: 'Sự kiện 2',
    campusId: 'CAMPUS_1',
    startAt: new Date('2026-10-08T08:00:00+07:00'),
    endAt: new Date('2026-10-08T09:00:00+07:00'),
    chairPerId: 'PER_evfilter_chair',
    createdByPerId: 'PER_evfilter_chair'
  });

  const taskForOne = await createTask(db, {
    eventId: eventOne.id,
    title: 'Việc của sự kiện 1',
    campusId: 'CAMPUS_1',
    assigneePerId: 'PER_evfilter_assignee',
    dueAt: new Date('2026-10-07T08:00:00+07:00'),
    createdByPerId: 'PER_evfilter_chair'
  });
  await createTask(db, {
    eventId: eventTwo.id,
    title: 'Việc của sự kiện 2',
    campusId: 'CAMPUS_1',
    assigneePerId: 'PER_evfilter_assignee',
    dueAt: new Date('2026-10-08T08:00:00+07:00'),
    createdByPerId: 'PER_evfilter_chair'
  });
  await createTask(db, {
    title: 'Việc không gắn sự kiện nào',
    campusId: 'CAMPUS_1',
    assigneePerId: 'PER_evfilter_assignee',
    dueAt: new Date('2026-10-09T08:00:00+07:00'),
    createdByPerId: 'PER_evfilter_chair'
  });

  const tasksForEventOne = await listTasks(db, { eventId: eventOne.id });
  assert.deepEqual(tasksForEventOne.map((t2) => t2.id), [taskForOne.id]);
});

test('work-schedule: "việc nhỏ" trong "việc lớn" — 2026-09-30 (Sin: "giao việc nhỏ ở đầu việc lớn trong tab giao việc") — chỉ chủ trì/người tạo việc lớn được thêm việc nhỏ, chỉ 2 cấp, listTasks(forPerId) hiện việc lớn read-only cho người phụ trách việc nhỏ', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const bigTask = await createTask(db, {
    title: 'Việc lớn: Chuẩn bị lễ khai giảng',
    campusId: 'CAMPUS_1',
    assigneePerId: 'PER_bigtask_chutri',
    dueAt: new Date('2026-10-10T08:00:00+07:00'),
    createdByPerId: 'PER_bigtask_creator'
  });

  // Người ngoài (không phải chủ trì/người tạo việc lớn) không được thêm việc nhỏ.
  await assert.rejects(
    () =>
      createTask(db, {
        parentTaskId: bigTask.id,
        title: 'Việc nhỏ trái phép',
        campusId: 'CAMPUS_1',
        assigneePerId: 'PER_bigtask_outsider',
        dueAt: new Date('2026-10-09T08:00:00+07:00'),
        createdByPerId: 'PER_bigtask_outsider'
      }),
    (e: any) => e instanceof AppError && e.code === 'forbidden'
  );

  // Chủ trì (assigneePerId) của việc lớn thêm được việc nhỏ, giao cho người khác.
  const subtaskA = await createTask(db, {
    parentTaskId: bigTask.id,
    title: 'Việc nhỏ A: Trang trí sân khấu',
    campusId: 'CAMPUS_1',
    assigneePerId: 'PER_bigtask_phutrach_a',
    dueAt: new Date('2026-10-09T08:00:00+07:00'),
    createdByPerId: 'PER_bigtask_chutri'
  });
  // Người tạo việc lớn (createdByPerId, khác chủ trì) cũng thêm được việc nhỏ.
  const subtaskB = await createTask(db, {
    parentTaskId: bigTask.id,
    title: 'Việc nhỏ B: Chuẩn bị âm thanh',
    campusId: 'CAMPUS_1',
    assigneePerId: 'PER_bigtask_phutrach_b',
    dueAt: new Date('2026-10-09T09:00:00+07:00'),
    createdByPerId: 'PER_bigtask_creator'
  });
  await changeTaskStatus(db, { taskId: subtaskA.id, nextStatus: 'COMPLETED', actorPerId: 'PER_bigtask_phutrach_a' });

  // Việc nhỏ không được có việc nhỏ của riêng nó (chỉ 2 cấp).
  await assert.rejects(
    () =>
      createTask(db, {
        parentTaskId: subtaskA.id,
        title: 'Việc nhỏ của việc nhỏ — không hợp lệ',
        campusId: 'CAMPUS_1',
        assigneePerId: 'PER_bigtask_phutrach_a',
        dueAt: new Date('2026-10-09T08:00:00+07:00'),
        createdByPerId: 'PER_bigtask_chutri'
      }),
    (e: any) => e instanceof AppError && e.code === 'invalid_input'
  );

  // listTasks(forPerId) — người phụ trách việc nhỏ A thấy ĐÚNG việc nhỏ
  // của mình + dòng việc lớn (ngữ cảnh, read-only) — KHÔNG thấy việc nhỏ B
  // (không liên quan tới họ).
  const forPhuTrachA = await listTasks(db, { forPerId: 'PER_bigtask_phutrach_a' });
  assert.deepEqual(new Set(forPhuTrachA.map((t2) => t2.id)), new Set([bigTask.id, subtaskA.id]));

  // Người tạo việc lớn (KHÔNG trực tiếp phụ trách/tạo việc nhỏ nào — chỉ
  // subtaskB do người này tạo) — listTasks mặc định thấy dòng việc lớn
  // (chủ trì trực tiếp/người tạo) VÀ subtaskB (chính họ tạo) — nhưng
  // KHÔNG tự động thấy subtaskA (không liên quan trực tiếp, không phải
  // người tạo/phụ trách subtaskA) — xem hết phải qua parentTaskId filter
  // riêng (route gate quyền chủ trì/người tạo việc lớn).
  const forParentCreator = await listTasks(db, { forPerId: 'PER_bigtask_creator' });
  assert.deepEqual(new Set(forParentCreator.map((t2) => t2.id)), new Set([bigTask.id, subtaskB.id]));

  // parentTaskId filter (không forPerId) — xem ĐỦ cả 2 việc nhỏ, dùng cho
  // dialog chi tiết việc lớn (route tự gate quyền chủ trì/người tạo).
  const allChildren = await listTasks(db, { parentTaskId: bigTask.id });
  assert.deepEqual(new Set(allChildren.map((t2) => t2.id)), new Set([subtaskA.id, subtaskB.id]));

  // attachSubtaskInfo — việc lớn gắn đúng subtaskCount/subtaskCompletedCount/%,
  // việc nhỏ gắn đúng parentTaskTitle.
  const [withInfo] = await attachSubtaskInfo(db, [bigTask]);
  assert.equal(withInfo!.subtaskCount, 2);
  assert.equal(withInfo!.subtaskCompletedCount, 1);
  assert.equal(withInfo!.subtaskProgressPercent, 50);
  const [subtaskAWithInfo] = await attachSubtaskInfo(db, [subtaskA]);
  assert.equal(subtaskAWithInfo!.parentTaskTitle, 'Việc lớn: Chuẩn bị lễ khai giảng');
});
