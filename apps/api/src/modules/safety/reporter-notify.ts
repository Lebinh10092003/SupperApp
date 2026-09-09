/**
 * reporter-notify.ts — Gửi email cho CHÍNH người báo tin (không phải nhân
 * viên/perId trong `people_directory`), port 1-1 từ `reporterNotify.js`.
 * TÁCH BIỆT HOÀN TOÀN khỏi `notify.ts` (thông báo NỘI BỘ cho nhân viên):
 * nội dung ở đây BẮT BUỘC chỉ dùng MÃ TRA CỨU CÔNG KHAI (`public_code`,
 * tiền tố "GV-"), KHÔNG được chứa report_id/incident_id nội bộ, KHÔNG chứa
 * tên người xử lý, KHÔNG mô tả nội dung/mức bí mật — đúng nguyên tắc "hai
 * không gian mã công khai/nội bộ tách biệt" và tính ẩn danh của người báo
 * tin là yêu cầu bảo mật cốt lõi của dự án.
 */

import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { reports, reportIdentities } from './reports.schema.js';
import { incidents } from './incidents.schema.js';
import type { DispatchAdapter } from './dispatch.js';

export const REPORTER_EVENT = {
  RECEIVED: 'reporter.notified.received',
  CLOSED: 'reporter.notified.closed',
  // Quyết định họp 07/09/2026: người gửi tin báo là người XÁC NHẬN đóng hồ
  // sơ (thay hẳn phê duyệt Hiệu trưởng/Phó HT cũ, áp dụng mọi mức ưu tiên).
  CONFIRM_CLOSE_REQUESTED: 'reporter.confirm_close_requested'
} as const;

export function renderReporterMessage(eventType: string, publicCode: string): string {
  if (eventType === REPORTER_EVENT.RECEIVED) {
    return 'Tin báo của bạn (mã tra cứu: ' + publicCode + ') đã được nhà trường tiếp nhận và đang xử lý. Bạn có thể tra cứu trạng thái bất cứ lúc nào tại cổng thông tin bằng mã này.';
  }
  if (eventType === REPORTER_EVENT.CONFIRM_CLOSE_REQUESTED) {
    return 'Nhà trường báo đã xử lý xong sự việc bạn báo (mã tra cứu: ' + publicCode + '). Vui lòng vào cổng tra cứu, nhập đúng mã này và bấm "Xác nhận đã xử lý xong" để đóng hồ sơ. Nếu sự việc vẫn còn tiếp diễn hoặc chưa ổn, xin bổ sung thông tin thay vì xác nhận — nhà trường sẽ tiếp tục xử lý.';
  }
  if (eventType === REPORTER_EVENT.CLOSED) {
    return 'Sự việc bạn báo (mã tra cứu: ' + publicCode + ') đã được đóng. Cảm ơn bạn đã báo cáo để giúp trường an toàn hơn. Nếu vấn đề vẫn còn tiếp diễn, vui lòng bổ sung thông tin qua cổng tra cứu bằng đúng mã này.';
  }
  throw new Error('reporterNotify.renderReporterMessage: eventType không hợp lệ: ' + eventType);
}

export interface ReporterNotifyResult {
  sent: boolean;
  reason?: string;
  status?: string;
  previewUrl?: string;
  error?: string;
}

/**
 * notifyReporterForReport — gửi email cho người báo tin của ĐÚNG 1 report.
 * KHÔNG gửi khi: không có email khai báo, hoặc không truyền adapter email.
 * KHÔNG throw ra ngoài khi gửi lỗi — trả `{ sent: false, reason }` để tầng
 * gọi tự quyết định có ghi audit log hay không (giống nguyên tắc "không
 * chặn luồng nghiệp vụ chính" của dispatch/pushBell).
 */
export async function notifyReporterForReport(
  db: NodePgDatabase<Record<string, never>>,
  input: { reportId: string; eventType: string },
  opts?: { emailAdapter?: DispatchAdapter; now?: Date }
): Promise<ReporterNotifyResult> {
  const [report] = await db.select().from(reports).where(eq(reports.reportId, input.reportId)).limit(1);
  if (!report) return { sent: false, reason: 'report_not_found' };

  const [identity] = await db.select().from(reportIdentities).where(eq(reportIdentities.reportId, input.reportId)).limit(1);
  const email = identity?.email;
  if (!email) return { sent: false, reason: 'no_email' };
  if (!opts?.emailAdapter) return { sent: false, reason: 'no_adapter_configured' };

  const message = renderReporterMessage(input.eventType, report.publicCode);
  try {
    const result = await opts.emailAdapter.send({ to: email, subject: 'Cập nhật về tin báo của bạn', text: message });
    return { sent: true, status: result?.status || 'sent', previewUrl: result?.previewUrl };
  } catch (e) {
    return { sent: false, reason: 'send_error', error: e instanceof Error ? e.message : String(e) };
  }
}

/** notifyReporterForIncident — 1 hồ sơ có thể gộp NHIỀU tin báo — gửi tới người báo tin của TỪNG report đã gộp. */
export async function notifyReporterForIncident(
  db: NodePgDatabase<Record<string, never>>,
  input: { incidentId: string; eventType: string },
  opts?: { emailAdapter?: DispatchAdapter; now?: Date }
): Promise<Array<ReporterNotifyResult & { reportId: string }>> {
  const [incident] = await db.select().from(incidents).where(eq(incidents.incidentId, input.incidentId)).limit(1);
  if (!incident) return [];
  const reportIds = incident.reportIds || [];
  const results: Array<ReporterNotifyResult & { reportId: string }> = [];
  for (const reportId of reportIds) {
    results.push({ reportId, ...(await notifyReporterForReport(db, { reportId, eventType: input.eventType }, opts)) });
  }
  return results;
}
