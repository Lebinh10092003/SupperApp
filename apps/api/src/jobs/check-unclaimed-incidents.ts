/**
 * check-unclaimed-incidents.ts — job định kỳ quét hồ sơ CHƯA có ai tiếp
 * nhận (`commanderPerId IS NULL`) và đẩy chuông theo đúng thang leo thang
 * Sin chốt 2026-09-22:
 *   - P2/P3: 24h báo Tổ trưởng, 48h báo lại Tổ trưởng + lãnh đạo (Phó HT/
 *     Hiệu trưởng), 72h báo tiếp lãnh đạo lần nữa (nhấn mạnh mức khẩn).
 *     CATEGORY_CATALOG (catalog.ts) hiện chưa có trường "lĩnh vực/tổ" để
 *     suy ra đúng Tổ trưởng theo nhóm sự cố — tạm báo MỌI Tổ trưởng của
 *     đúng cơ sở (an toàn hơn bỏ sót, xem escalation-recipients.ts).
 *   - P0/P1: KHÔNG dùng thang giờ cố định — bám theo đúng đồng hồ SLA
 *     "ack" theo mức ưu tiên đã có sẵn (nhanh hơn nhiều); khi đồng hồ đó
 *     quá hạn MÀ vẫn chưa có người tiếp nhận thì báo NGAY một lần cho cả
 *     Tổ trưởng + lãnh đạo (không leo thang từ từ vì đã khẩn cấp).
 *
 * Idempotent qua cột `incidents.unclaimed_escalation_tier` — mỗi mốc chỉ
 * báo 1 lần, không spam lặp lại mỗi 15 phút cho cùng 1 hồ sơ/mốc.
 */
import 'dotenv/config';
import { and, eq, isNull, notInArray } from 'drizzle-orm';
import { db } from '../core/db/client.js';
import { incidents } from '../modules/safety/incidents.schema.js';
import { slaClocks } from '../modules/safety/sla-clocks.schema.js';
import { isOverdue } from '../modules/safety/sla.js';
import { TERMINAL_STATES, PRIORITY_LABEL, type IncidentState, type Priority } from '../modules/safety/catalog.js';
import { findDeptHeadsForCampus, findLeadershipForCampus } from '../modules/safety/escalation-recipients.js';
import { pushAdminNotifications } from '../modules/safety/admin-notify.js';
import * as notify from '../modules/safety/notify.js';
import { notifyRequests } from '../modules/safety/dispatch.schema.js';
import { notifyRequestToRow } from '../modules/safety/shared.js';
import { makeDispatchHook } from '../modules/safety/notify-hooks.js';

// Bổ sung 2026-09-24 — job này TRƯỚC ĐÂY chỉ đẩy chuông trong app
// (pushAdminNotifications), KHÔNG hề gửi email/push ra ngoài dù đã có
// adapter thật (Sin phát hiện khi rà soát kênh thông báo cấp lãnh đạo) —
// cảnh báo "chưa ai tiếp nhận" quan trọng nhất lại chỉ nằm im trong app,
// không ai thấy nếu không đang mở. Giờ nối thêm dispatch thật song song
// với chuông, không thay thế.
const dispatch = makeDispatchHook();

const TIER_HOURS = [24, 48, 72]; // tier 1/2/3

function tierForElapsedHours(hours: number): number {
  let tier = 0;
  for (let i = 0; i < TIER_HOURS.length; i++) {
    if (hours >= TIER_HOURS[i]!) tier = i + 1;
  }
  return tier;
}

async function run() {
  const now = new Date();
  const rows = await db
    .select()
    .from(incidents)
    .where(and(isNull(incidents.commanderPerId), notInArray(incidents.state, TERMINAL_STATES)));

  let checked = 0;
  let escalated = 0;

  for (const incident of rows) {
    checked += 1;
    const deptHeads = await findDeptHeadsForCampus(db, incident.campusId, { now });
    const leadership = await findLeadershipForCampus(db, incident.campusId, { now });

    if (incident.priority === 'P0' || incident.priority === 'P1') {
      if (incident.unclaimedEscalationTier >= 1) continue;
      const [ackClock] = await db.select().from(slaClocks).where(and(eq(slaClocks.objectId, incident.incidentId), eq(slaClocks.clockLabel, 'ack')));
      if (!ackClock || !isOverdue({ paused: ackClock.paused, deadline_at: ackClock.deadlineAt }, now)) continue;

      const recipients = Array.from(new Set([...deptHeads, ...leadership]));
      if (recipients.length === 0) continue;
      await pushAdminNotifications(
        db,
        {
          recipients,
          title: `Sự vụ ${PRIORITY_LABEL[incident.priority as Priority]} chưa có người tiếp nhận — ${incident.incidentId}`,
          message: `Hồ sơ ${incident.incidentId} (mức ${incident.priority}) đã quá hạn xác nhận tiếp nhận mà CHƯA có ai tiếp nhận — cần bàn giao ngay cho người phụ trách phù hợp.`,
          eventType: 'safety.incident.unclaimed_urgent',
          objectId: incident.incidentId,
          actorPerId: null,
          meta: { priority: incident.priority, campus_id: incident.campusId }
        },
        { now }
      );
      {
        const request = notify.buildNotifyRequest({
          recipients,
          priority: incident.priority as Priority,
          objectId: incident.incidentId,
          objectCode: incident.incidentId,
          levelLabel: PRIORITY_LABEL[incident.priority as Priority],
          actionNeeded: 'Đã quá hạn xác nhận tiếp nhận mà CHƯA có ai tiếp nhận — cần bàn giao ngay',
          deepLink: '/safety/incidents/' + incident.incidentId,
          eventType: 'safety.incident.unclaimed_urgent'
        });
        const [savedRequest] = await db.insert(notifyRequests).values({ ...notifyRequestToRow(request), createdAt: now }).returning();
        if (savedRequest) await dispatch(db, savedRequest, { now });
      }
      await db.update(incidents).set({ unclaimedEscalationTier: 1 }).where(eq(incidents.incidentId, incident.incidentId));
      escalated += 1;
      continue;
    }

    // P2/P3 — thang 24h/48h/72h theo mốc createdAt.
    const hoursElapsed = (now.getTime() - incident.createdAt.getTime()) / (60 * 60 * 1000);
    const targetTier = tierForElapsedHours(hoursElapsed);
    if (targetTier <= incident.unclaimedEscalationTier) continue;

    for (let tier = incident.unclaimedEscalationTier + 1; tier <= targetTier; tier++) {
      const recipients = tier === 1 ? deptHeads : Array.from(new Set([...deptHeads, ...leadership]));
      if (recipients.length === 0) continue;
      await pushAdminNotifications(
        db,
        {
          recipients,
          title: `Sự vụ chưa có người tiếp nhận sau ${TIER_HOURS[tier - 1]}h — ${incident.incidentId}`,
          message: `Hồ sơ ${incident.incidentId} (mức ${incident.priority ?? 'Chưa phân loại'}) vẫn CHƯA có ai tiếp nhận sau ${TIER_HOURS[tier - 1]} giờ — cần bàn giao cho người phụ trách phù hợp.`,
          eventType: 'safety.incident.unclaimed_reminder',
          objectId: incident.incidentId,
          actorPerId: null,
          meta: { priority: incident.priority, campus_id: incident.campusId, tier }
        },
        { now }
      );
      {
        // Từ tier 2 (48h) trở đi mới có lãnh đạo trong danh sách nhận —
        // NÂNG khẩn lên HIGH (email+push) dù hồ sơ gốc chỉ P2/P3, vì bản
        // thân việc "vẫn chưa ai nhận sau 48-72h" LÀ tín hiệu khẩn cần
        // kênh mạnh hơn chuông thầm lặng. Tier 1 (chỉ Tổ trưởng) giữ
        // nguyên mức thường — đúng thiết kế channel ladder gốc.
        const request = notify.buildNotifyRequest({
          recipients,
          priority: incident.priority || 'P3',
          objectId: incident.incidentId,
          objectCode: incident.incidentId,
          levelLabel: incident.priority ? PRIORITY_LABEL[incident.priority as Priority] : 'Chưa phân loại',
          actionNeeded: `Vẫn CHƯA có ai tiếp nhận sau ${TIER_HOURS[tier - 1]} giờ — cần bàn giao cho người phụ trách phù hợp`,
          deepLink: '/safety/incidents/' + incident.incidentId,
          eventType: 'safety.incident.unclaimed_reminder',
          urgencyOverride: tier >= 2 ? notify.URGENCY.HIGH : undefined
        });
        const [savedRequest] = await db.insert(notifyRequests).values({ ...notifyRequestToRow(request), createdAt: now }).returning();
        if (savedRequest) await dispatch(db, savedRequest, { now });
      }
      escalated += 1;
    }
    await db.update(incidents).set({ unclaimedEscalationTier: targetTier }).where(eq(incidents.incidentId, incident.incidentId));
  }

  console.log('[check-unclaimed-incidents] OK', JSON.stringify({ checked, escalated }));
}

try {
  await run();
} catch (e) {
  console.error('[check-unclaimed-incidents] FAILED', e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
