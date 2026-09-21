/**
 * check-sla-overdue.ts — job định kỳ quét đồng hồ SLA (ack/assign) đã quá
 * hạn và ĐẨY CHUÔNG cho người phụ trách + lãnh đạo/trực ban đúng cơ sở.
 *
 * Bổ sung 2026-09-21 — Sin phát hiện qua thao tác thật: quá hạn xác nhận
 * tiếp nhận/phân công trước đây KHÔNG có bất kỳ hậu quả nào (không đổi
 * hiển thị, không báo ai). `isOverdue()` (sla.ts) đã có sẵn từ trước nhưng
 * KHÔNG nơi nào trong toàn bộ backend gọi tới — job này là nơi đầu tiên
 * dùng tới hàm đó cho mục đích thật (hiển thị live đã sửa riêng ở
 * safety-query.routes.ts, không qua job này).
 *
 * Idempotent qua cột `sla_clocks.escalated_at`: mỗi đồng hồ chỉ báo 1 LẦN
 * cho tới khi hạn được tính lại (đổi mức ưu tiên tự reset cột này về null,
 * xem incident-lifecycle.ts::saveSlaClock) — job chạy lại mỗi 15 phút
 * không spam chuông liên tục cho cùng 1 đồng hồ.
 */
import 'dotenv/config';
import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '../core/db/client.js';
import { slaClocks } from '../modules/safety/sla-clocks.schema.js';
import { incidents } from '../modules/safety/incidents.schema.js';
import { isOverdue } from '../modules/safety/sla.js';
import { isTerminal, type IncidentState } from '../modules/safety/catalog.js';
import { getEscalationRecipients } from '../modules/safety/escalation-recipients.js';
import { pushAdminNotifications } from '../modules/safety/admin-notify.js';

const CLOCK_LABEL_VI: Record<string, string> = { ack: 'xác nhận tiếp nhận', assign: 'phân công' };

async function run() {
  const now = new Date();
  const clockRows = await db.select().from(slaClocks).where(and(eq(slaClocks.paused, false), isNull(slaClocks.escalatedAt), or(eq(slaClocks.status, 'running'), eq(slaClocks.status, 'overdue'))));

  let checked = 0;
  let escalated = 0;
  for (const clock of clockRows) {
    checked += 1;
    if (!isOverdue({ paused: clock.paused, deadline_at: clock.deadlineAt }, now)) continue;

    const [incident] = await db.select().from(incidents).where(eq(incidents.incidentId, clock.objectId)).limit(1);
    if (!incident) continue; // đồng hồ mồ côi (hồ sơ đã bị xoá/không tồn tại) — bỏ qua, không báo.
    if (isTerminal(incident.state as IncidentState)) continue; // đã đóng/trùng/rác — không còn cần nhắc.

    const recipients = await getEscalationRecipients(db, { campusId: incident.campusId }, { now });
    const perIds = Array.from(
      new Set(
        [incident.commanderPerId, ...(incident.assignedTaskPerIds || []), ...recipients.leadershipPerIds, ...recipients.onDutyPerIds].filter(
          (v): v is string => !!v
        )
      )
    );
    if (perIds.length === 0) continue;

    await pushAdminNotifications(
      db,
      {
        recipients: perIds,
        title: `Quá hạn ${CLOCK_LABEL_VI[clock.clockLabel] || clock.clockLabel} — ${incident.incidentId}`,
        message: `Hồ sơ ${incident.incidentId} (mức ${incident.priority}) đã QUÁ HẠN ${CLOCK_LABEL_VI[clock.clockLabel] || clock.clockLabel} lúc ${clock.deadlineAt.toLocaleString('vi-VN')} — cần xử lý ngay.`,
        eventType: 'safety.sla.overdue',
        objectId: incident.incidentId,
        actorPerId: null,
        meta: { clock_label: clock.clockLabel, deadline_at: clock.deadlineAt.toISOString(), priority: incident.priority }
      },
      { now }
    );
    await db
      .update(slaClocks)
      .set({ escalatedAt: now })
      .where(and(eq(slaClocks.objectId, clock.objectId), eq(slaClocks.clockLabel, clock.clockLabel)));
    escalated += 1;
  }

  console.log('[check-sla-overdue] OK', JSON.stringify({ checked, escalated }));
}

try {
  await run();
} catch (e) {
  console.error('[check-sla-overdue] FAILED', e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
