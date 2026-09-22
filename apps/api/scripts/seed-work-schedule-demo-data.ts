/**
 * seed-work-schedule-demo-data.ts — nạp dữ liệu MẪU cho module Lịch công
 * tác/Giao việc (Postgres, `ltc_events`/`ltc_tasks`) — module này hoàn
 * toàn Postgres-backed (không phải Firestore mock) nhưng CHƯA từng có seed
 * script nào, nên DB trống trơn trên máy mới (3 trang Lịch công tác/Giao
 * việc/Nhắc nhở đều rỗng dù backend hoạt động đúng).
 *
 * Dùng đúng `perId` đã có sẵn từ seed-safety-dev-identities.ts
 * (PER.SEED_PRINCIPAL/PER.SEED_VICE_PRINCIPAL/PER.SEED_DUTY_OFFICER/
 * PER.SEED_TEACHER) — CẦN chạy script đó trước, vì module Lịch công tác
 * dùng chung hệ định danh `perId` với module An toàn (không bắt buộc có
 * assignment R.* nào, chỉ cần identity tồn tại để tên/actor hợp lý).
 *
 * Chèn TRỰC TIẾP qua Drizzle (không gọi qua createEvent/createTask) để có
 * thể set `status` khác DRAFT/ASSIGNED ngay từ đầu — khớp đúng lưu ý trong
 * TASKS.md rằng createEvent/createTask luôn ép status mặc định.
 *
 * CHỈ dùng cho môi trường dev/local. KHÔNG idempotent (chạy lại tạo thêm
 * bản ghi mới) — muốn làm sạch thì tự xoá qua psql hoặc drop/tạo lại DB.
 *
 * Chạy: `cd apps/api && npx tsx scripts/seed-work-schedule-demo-data.ts`
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { ltcEvents, ltcTasks } from '../src/modules/work-schedule/work-schedule.schema.js';

const PRINCIPAL = 'PER.SEED_PRINCIPAL';
const VICE_PRINCIPAL = 'PER.SEED_VICE_PRINCIPAL';
const DUTY_OFFICER = 'PER.SEED_DUTY_OFFICER';
const TEACHER = 'PER.SEED_TEACHER';

function hoursFromNow(h: number): Date {
  return new Date(Date.now() + h * 3600_000);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  const events = await db
    .insert(ltcEvents)
    .values([
      {
        title: 'Họp giao ban tuần',
        description: 'Rà soát tiến độ các tổ chuyên môn, kế hoạch tuần tới.',
        type: 'MEETING',
        priority: 'NORMAL',
        campusId: 'MAIN_CAMPUS',
        scope: 'CAMPUS',
        startAt: hoursFromNow(24),
        endAt: hoursFromNow(26),
        location: 'Phòng họp A1',
        chairPerId: PRINCIPAL,
        participantPerIds: [VICE_PRINCIPAL, DUTY_OFFICER, TEACHER],
        status: 'PUBLISHED',
        createdByPerId: PRINCIPAL
      },
      {
        title: 'Tập huấn phòng cháy chữa cháy',
        description: 'Diễn tập PCCC định kỳ học kỳ I, toàn thể cán bộ giáo viên.',
        type: 'TRAINING',
        priority: 'HIGH',
        campusId: 'MAIN_CAMPUS',
        scope: 'SCHOOL_WIDE',
        startAt: hoursFromNow(72),
        endAt: hoursFromNow(76),
        location: 'Sân trường cơ sở chính',
        chairPerId: VICE_PRINCIPAL,
        participantPerIds: [PRINCIPAL, DUTY_OFFICER, TEACHER],
        status: 'PENDING_APPROVAL',
        approvals: [{ role: 'R.VICE_PRINCIPAL', perId: VICE_PRINCIPAL, at: new Date().toISOString() }],
        createdByPerId: VICE_PRINCIPAL
      },
      {
        title: 'Họp phụ huynh đầu năm khối 6',
        description: 'Phổ biến kế hoạch năm học, nội quy, các khoản thu đầu năm.',
        type: 'MEETING',
        priority: 'NORMAL',
        campusId: 'CAMPUS_1',
        scope: 'CAMPUS',
        startAt: hoursFromNow(-48),
        endAt: hoursFromNow(-46),
        location: 'Hội trường cơ sở 1',
        chairPerId: PRINCIPAL,
        participantPerIds: [TEACHER],
        status: 'DRAFT',
        createdByPerId: TEACHER
      },
      {
        title: 'Kiểm tra cơ sở vật chất định kỳ',
        description: 'Kiểm tra hệ thống điện, PCCC, sân chơi trước khi vào năm học.',
        type: 'INSPECTION',
        priority: 'NORMAL',
        campusId: 'CAMPUS_2',
        scope: 'CAMPUS',
        startAt: hoursFromNow(-24),
        endAt: hoursFromNow(-22),
        location: 'Cơ sở 2',
        chairPerId: DUTY_OFFICER,
        participantPerIds: [PRINCIPAL],
        status: 'REVISION_REQUIRED',
        revisionNote: 'Cần bổ sung thành phần tham dự từ tổ cơ sở vật chất.',
        createdByPerId: DUTY_OFFICER
      }
    ])
    .returning({ id: ltcEvents.id, title: ltcEvents.title });

  console.log(`Seeded ${events.length} lịch công tác:`);
  for (const e of events) console.log(`  - ${e.id}: ${e.title}`);

  const linkedEventId = events[0]!.id;

  const tasks = await db
    .insert(ltcTasks)
    .values([
      {
        eventId: linkedEventId,
        title: 'Chuẩn bị biên bản họp giao ban',
        description: 'Ghi chép và tổng hợp biên bản cuộc họp giao ban tuần.',
        priority: 'NORMAL',
        campusId: 'MAIN_CAMPUS',
        assigneePerId: TEACHER,
        dueAt: hoursFromNow(28),
        status: 'ASSIGNED',
        createdByPerId: PRINCIPAL
      },
      {
        title: 'Rà soát danh sách học sinh vắng bất thường tuần này',
        description: 'Đối chiếu điểm danh, báo cáo GVCN các trường hợp vắng liên tục.',
        priority: 'HIGH',
        campusId: 'MAIN_CAMPUS',
        assigneePerId: DUTY_OFFICER,
        collaboratorPerIds: [TEACHER],
        dueAt: hoursFromNow(-2),
        status: 'PENDING_ACCEPTANCE',
        evidenceUrl: '',
        acceptanceNote: '',
        createdByPerId: PRINCIPAL
      },
      {
        title: 'Cập nhật sổ tay an toàn trường học',
        description: 'Bổ sung quy trình mới sau đợt tập huấn PCCC.',
        priority: 'NORMAL',
        campusId: 'MAIN_CAMPUS',
        assigneePerId: VICE_PRINCIPAL,
        dueAt: hoursFromNow(96),
        status: 'IN_PROGRESS',
        createdByPerId: VICE_PRINCIPAL
      },
      {
        title: 'Sửa vòi nước khu vệ sinh tầng 2',
        description: 'Học sinh phản ánh vòi nước bị rò rỉ.',
        priority: 'LOW',
        campusId: 'CAMPUS_1',
        assigneePerId: TEACHER,
        dueAt: hoursFromNow(-72),
        status: 'COMPLETED',
        acceptanceNote: 'Đã sửa xong, xác nhận hoạt động bình thường.',
        createdByPerId: TEACHER
      }
    ])
    .returning({ id: ltcTasks.id, title: ltcTasks.title, status: ltcTasks.status });

  console.log(`\nSeeded ${tasks.length} công việc:`);
  for (const t of tasks) console.log(`  - ${t.id}: ${t.title} [${t.status}]`);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
