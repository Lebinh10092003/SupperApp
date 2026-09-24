/**
 * check-sla-overdue.ts — job định kỳ quét đồng hồ SLA đã quá hạn và ĐẨY
 * CHUÔNG cho người phụ trách + lãnh đạo/trực ban đúng cơ sở. Xử lý 2 loại
 * đồng hồ, phân biệt bằng tiền tố objectId:
 *   - `SC.xxx` (hồ sơ, ID_PREFIX.INCIDENT): đồng hồ ack/assign đăng ký lúc
 *     tạo hồ sơ (createIncidentFromReport) — người nhận gồm chỉ huy/được
 *     giao + lãnh đạo/trực ban.
 *   - `TB.xxx` (tin báo, ID_PREFIX.REPORT): đồng hồ "ack" đăng ký NGAY lúc
 *     gửi tin báo (submitReport) — bổ sung 2026-09-22, Sin hỏi "tin báo mãi
 *     không ai chuyển thành hồ sơ thì sao": trước đó tin báo hoàn toàn
 *     không có hạn/cảnh báo nào cho tới khi được chuyển thành hồ sơ. Dùng
 *     lại ĐÚNG hạn P0-P3 hiện có; người nhận chỉ có lãnh đạo/trực ban (tin
 *     báo chưa có chỉ huy/người được giao). Đồng hồ này bị XOÁ ngay khi tin
 *     báo được chuyển thành hồ sơ (report-flow.ts), nên job không bao giờ
 *     thấy đồng hồ tin báo VÀ đồng hồ hồ sơ cùng tồn tại cho cùng 1 vụ việc.
 *
 * Bổ sung 2026-09-21 — Sin phát hiện qua thao tác thật: quá hạn ack/assign
 * của HỒ SƠ trước đây KHÔNG có bất kỳ hậu quả nào (không đổi hiển thị,
 * không báo ai). `isOverdue()` (sla.ts) đã có sẵn từ trước nhưng KHÔNG nơi
 * nào trong toàn bộ backend gọi tới — job này là nơi đầu tiên dùng tới hàm
 * đó cho mục đích thật (hiển thị live đã sửa riêng ở safety-query.routes.ts,
 * không qua job này).
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
import { reports } from '../modules/safety/reports.schema.js';
import { isOverdue } from '../modules/safety/sla.js';
import { isTerminal, ID_PREFIX, type IncidentState } from '../modules/safety/catalog.js';
import { getEscalationRecipients } from '../modules/safety/escalation-recipients.js';
import { pushAdminNotifications } from '../modules/safety/admin-notify.js';
import * as notify from '../modules/safety/notify.js';
import { notifyRequests } from '../modules/safety/dispatch.schema.js';
import { notifyRequestToRow } from '../modules/safety/shared.js';
import { makeDispatchHook } from '../modules/safety/notify-hooks.js';
import { PRIORITY_LABEL, type Priority } from '../modules/safety/catalog.js';

// Bổ sung 2026-09-24 — cùng lý do check-unclaimed-incidents.ts: job này
// trước đây chỉ đẩy chuông trong app, chưa hề gửi email/push dù đã có
// adapter thật. Nối thêm dispatch thật song song với chuông.
const dispatch = makeDispatchHook();

const CLOCK_LABEL_VI: Record<string, string> = { ack: 'xác nhận tiếp nhận', assign: 'phân công' };

async function markEscalated(objectId: string, clockLabel: string, now: Date) {
  await db.update(slaClocks).set({ escalatedAt: now }).where(and(eq(slaClocks.objectId, objectId), eq(slaClocks.clockLabel, clockLabel)));
}

async function run() {
  const now = new Date();
  const clockRows = await db.select().from(slaClocks).where(and(eq(slaClocks.paused, false), isNull(slaClocks.escalatedAt), or(eq(slaClocks.status, 'running'), eq(slaClocks.status, 'overdue'))));

  let checked = 0;
  let escalated = 0;
  for (const clock of clockRows) {
    checked += 1;
    if (!isOverdue({ paused: clock.paused, deadline_at: clock.deadlineAt }, now)) continue;

    if (clock.objectId.startsWith(ID_PREFIX.REPORT + '.')) {
      const [report] = await db.select().from(reports).where(eq(reports.reportId, clock.objectId)).limit(1);
      if (!report || report.mergedIntoIncidentId) continue; // đã chuyển thành hồ sơ hoặc không còn tồn tại — không cần báo nữa.

      const recipients = await getEscalationRecipients(db, { campusId: report.campusId }, { now });
      const perIds = Array.from(new Set([...recipients.leadershipPerIds, ...recipients.onDutyPerIds]));
      if (perIds.length === 0) continue;

      await pushAdminNotifications(
        db,
        {
          recipients: perIds,
          title: `Tin báo chưa chuyển thành hồ sơ — ${report.publicCode}`,
          message: `Tin báo ${report.publicCode} (mức ${clock.priority}) đã QUÁ HẠN xác nhận tiếp nhận lúc ${clock.deadlineAt.toLocaleString('vi-VN')} mà CHƯA được chuyển thành hồ sơ — cần xử lý ngay.`,
          eventType: 'safety.report.overdue',
          objectId: clock.objectId,
          actorPerId: null,
          meta: { deadline_at: clock.deadlineAt.toISOString(), priority: clock.priority }
        },
        { now }
      );
      {
        const request = notify.buildNotifyRequest({
          recipients: perIds,
          priority: clock.priority,
          objectId: clock.objectId,
          objectCode: report.publicCode,
          levelLabel: PRIORITY_LABEL[clock.priority as Priority] ?? clock.priority,
          actionNeeded: `Đã QUÁ HẠN xác nhận tiếp nhận lúc ${clock.deadlineAt.toLocaleString('vi-VN')} mà CHƯA được chuyển thành hồ sơ — cần xử lý ngay`,
          deepLink: '/safety/cases?q=' + encodeURIComponent(clock.objectId),
          eventType: 'safety.report.overdue'
        });
        const [savedRequest] = await db.insert(notifyRequests).values({ ...notifyRequestToRow(request), createdAt: now }).returning();
        if (savedRequest) await dispatch(db, savedRequest, { now });
      }
      await markEscalated(clock.objectId, clock.clockLabel, now);
      escalated += 1;
      continue;
    }

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
    {
      const request = notify.buildNotifyRequest({
        recipients: perIds,
        priority: incident.priority || clock.priority,
        objectId: incident.incidentId,
        objectCode: incident.incidentId,
        levelLabel: incident.priority ? (PRIORITY_LABEL[incident.priority as Priority] ?? incident.priority) : 'Chưa phân loại',
        actionNeeded: `Đã QUÁ HẠN ${CLOCK_LABEL_VI[clock.clockLabel] || clock.clockLabel} lúc ${clock.deadlineAt.toLocaleString('vi-VN')} — cần xử lý ngay`,
        deepLink: '/safety/incidents/' + incident.incidentId,
        eventType: 'safety.sla.overdue'
      });
      const [savedRequest] = await db.insert(notifyRequests).values({ ...notifyRequestToRow(request), createdAt: now }).returning();
      if (savedRequest) await dispatch(db, savedRequest, { now });
    }
    await markEscalated(clock.objectId, clock.clockLabel, now);
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
