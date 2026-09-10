/**
 * seed-safety-demo-data.ts — nạp dữ liệu MẪU (không phải test tự động) cho
 * module An toàn: nhiều tin báo/hồ sơ sự cố đa dạng cơ sở/nhóm sự cố/mức ưu
 * tiên/trạng thái, để click-through thử UI không bị trống danh sách.
 *
 * KHÁC `seed-safety-dev-identities.ts` (tạo TÀI KHOẢN test, bắt buộc chạy
 * trước) — file này tạo NỘI DUNG demo, chạy sau khi đã seed identities.
 *
 * CHỈ dùng cho môi trường dev/local — KHÔNG chạy nhắm production. KHÔNG
 * idempotent (chạy lại sẽ tạo thêm dữ liệu mới, không đè lên dữ liệu cũ) —
 * nếu muốn làm sạch, tự drop/tạo lại database.
 *
 * Chạy: `cd apps/api && npx tsx scripts/seed-safety-demo-data.ts`
 * (đọc DATABASE_URL từ .env, cần đã chạy seed-safety-dev-identities.ts
 * trước đó vì dùng PER.SEED_PRINCIPAL làm actor thực hiện các thao tác).
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { submitReport, createIncidentFromReport } from '../src/modules/safety/report-flow.js';
import { transitionIncidentStatus, assignCommander } from '../src/modules/safety/incident-lifecycle.js';
import { loadActorContext } from '../src/modules/identity/actor-context.js';
import { STATE } from '../src/modules/safety/catalog.js';

const CAMPUSES = ['MAIN_CAMPUS', 'CAMPUS_1', 'CAMPUS_2'];

interface DemoReport {
  campusId: string;
  categoryCode: string;
  content: string;
  className?: string;
  stillDangerous?: boolean;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  /** Trạng thái muốn dừng lại sau khi tạo — bỏ qua nếu chỉ cần "Mới tiếp nhận"/"Khẩn cấp đang xử lý" mặc định. */
  advanceTo?: string;
  assignCommanderTo?: string;
  /** true = KHÔNG chuyển thành hồ sơ, để lại ở "Tin báo chờ xử lý". */
  keepAsPendingReport?: boolean;
}

const DEMO_REPORTS: DemoReport[] = [
  {
    campusId: 'MAIN_CAMPUS',
    categoryCode: 'violence_bullying',
    content: 'Hai học sinh lớp 8A2 xô xát tại sân trường giờ ra chơi, đã được bảo vệ can thiệp.',
    className: '8A2',
    priority: 'P1',
    advanceTo: STATE.ASSIGNED
  },
  {
    campusId: 'MAIN_CAMPUS',
    categoryCode: 'fire_explosion',
    content: 'Phát hiện mùi khét bất thường từ phòng kỹ thuật tầng 3, đang kiểm tra nguồn gốc.',
    stillDangerous: true,
    priority: 'P0',
    assignCommanderTo: 'PER.SEED_DUTY_OFFICER'
  },
  {
    campusId: 'CAMPUS_1',
    categoryCode: 'medical_minor',
    content: 'Học sinh lớp 6B1 bị sốt nhẹ trong giờ học, đã đưa xuống phòng y tế theo dõi.',
    className: '6B1',
    priority: 'P3',
    advanceTo: STATE.MONITORING
  },
  {
    campusId: 'CAMPUS_1',
    categoryCode: 'facility_hygiene',
    content: 'Nhà vệ sinh tầng 2 khu B bị tắc nghẽn, mùi khó chịu ảnh hưởng lớp học lân cận.',
    priority: 'P3',
    advanceTo: STATE.IN_PROGRESS
  },
  {
    campusId: 'CAMPUS_2',
    categoryCode: 'traffic_gate',
    content: 'Ùn tắc trước cổng trường giờ tan học, phụ huynh đỗ xe lấn chiếm lòng đường.',
    priority: 'P2',
    advanceTo: STATE.ASSIGNED
  },
  {
    campusId: 'MAIN_CAMPUS',
    categoryCode: 'cyberbullying',
    content: 'Nghi ngờ 1 học sinh lớp 9A1 bị bạn cùng lớp đăng tin xúc phạm trên nhóm mạng xã hội.',
    className: '9A1',
    priority: 'P1',
    advanceTo: STATE.CLASSIFYING
  },
  {
    campusId: 'CAMPUS_2',
    categoryCode: 'facility_general',
    content: 'Bàn ghế phòng học 7C3 bị hỏng chân, cần sửa chữa trước tuần sau.',
    className: '7C3',
    priority: 'P3',
    keepAsPendingReport: true
  },
  {
    campusId: 'MAIN_CAMPUS',
    categoryCode: 'food_safety',
    content: 'Một số học sinh bán trú phản ánh cơm trưa hôm nay có mùi lạ, đã dừng phát suất ăn còn lại để kiểm tra.',
    stillDangerous: true,
    priority: 'P0',
    keepAsPendingReport: true
  },
  {
    campusId: 'CAMPUS_1',
    categoryCode: 'security_intrusion',
    content: 'Bảo vệ phát hiện người lạ trong khuôn viên trường ngoài giờ, đã mời ra khỏi cổng.',
    priority: 'P2',
    keepAsPendingReport: true
  }
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  const principal = await loadActorContext(db, 'dev-user-seed_principal_thcsgiangvo_edu_vn');

  let created = 0;
  let pending = 0;

  for (const demo of DEMO_REPORTS) {
    const { reportId } = await submitReport(
      db,
      {
        campusId: demo.campusId,
        categoryCode: demo.categoryCode,
        content: demo.content,
        className: demo.className,
        stillDangerous: demo.stillDangerous,
        channel: 'public_web',
        email: `phu-huynh-demo-${Math.random().toString(36).slice(2, 8)}@example.com`
      },
      {}
    );

    if (demo.keepAsPendingReport) {
      pending++;
      console.log(`Tin báo chờ xử lý: ${reportId} — ${demo.content.slice(0, 40)}...`);
      continue;
    }

    const { incidentId } = await createIncidentFromReport(db, { reportId, priority: demo.priority, className: demo.className }, {});
    created++;
    console.log(`Hồ sơ: ${incidentId} (${demo.priority}, ${demo.campusId}) — ${demo.content.slice(0, 40)}...`);

    if (demo.assignCommanderTo) {
      await assignCommander(db, { actor: principal, incidentId, commanderPerId: demo.assignCommanderTo, reason: 'Phân công demo' }, {});
    }

    if (demo.advanceTo) {
      // Chuyển tuần tự qua các bước hợp lệ tới trạng thái mong muốn thay vì
      // nhảy thẳng — ALLOWED_TRANSITIONS không cho phép nhảy cách.
      const path: Record<string, string[]> = {
        [STATE.CLASSIFYING]: [STATE.CLASSIFYING],
        [STATE.ASSIGNED]: [STATE.CLASSIFYING, STATE.ASSIGNED],
        [STATE.IN_PROGRESS]: [STATE.CLASSIFYING, STATE.ASSIGNED, STATE.IN_PROGRESS],
        [STATE.MONITORING]: [STATE.CLASSIFYING, STATE.ASSIGNED, STATE.IN_PROGRESS, STATE.MONITORING]
      };
      const steps = path[demo.advanceTo] || [];
      for (const toState of steps) {
        await transitionIncidentStatus(db, { actor: principal, incidentId, toState }, {}).catch((e) => {
          console.warn(`  (bỏ qua bước "${toState}" cho ${incidentId}: ${e instanceof Error ? e.message : e})`);
        });
      }
    }
  }

  await pool.end();
  console.log(`\nXong: ${created} hồ sơ sự cố + ${pending} tin báo chờ xử lý (${CAMPUSES.length} cơ sở, đủ mức P0-P3).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
