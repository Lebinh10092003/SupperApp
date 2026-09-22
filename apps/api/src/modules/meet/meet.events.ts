import type { Request } from 'express';
import { safeId } from '../../core/ids.js';
import { claimEvent, finishEvent } from '../events/idempotency.js';
import { refreshConference } from './meet.service.js';
import { rebuildDashboard } from '../dashboard/dashboard.service.js';

export async function handleMeetEvent(req: Request) {
  const m = req.body?.message || {};
  const id = 'meet_' + safeId(m.messageId || 'unknown');
  if (!(await claimEvent(id, 'MEET'))) return { duplicate: true };

  try {
    const attrs = m.attributes || {};
    const payload = JSON.parse(Buffer.from(m.data || '', 'base64').toString('utf8') || '{}');
    const type = attrs['ce-type'] || payload.type || '';
    const data = payload.data || payload;
    const raw = data.participantSession?.name || data.conferenceRecord?.name || data.name || '';
    const cn = String(raw).match(/conferenceRecords\/[^/]+/)?.[0] || null;

    if (cn) {
      // Ghi vào CÙNG 1 dòng meet_sessions (bảng hợp nhất LIVE/FINISHED theo
      // id) — chuyển status trực tiếp qua refreshConference, không cần bước
      // xoá riêng như bản Firestore cũ (2 collection tách biệt trước đây).
      await refreshConference(cn, type.endsWith('.ended'));
    }
    await rebuildDashboard();
    await finishEvent(id, 'DONE');
    return { ok: true, type, conferenceName: cn };
  } catch (e) {
    await finishEvent(id, 'ERROR', e);
    throw e;
  }
}
