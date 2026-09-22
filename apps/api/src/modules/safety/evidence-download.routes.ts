/**
 * evidence-download.routes.ts — cấp signed URL tạm thời để xem/tải 1 minh
 * chứng (S8), port 1-1 từ `index.js::exports.getEvidenceDownloadUrl`
 * (dòng 1001-1057). CHỈ dùng ở cổng nội bộ, đăng nhập bắt buộc — đây là
 * đường DUY NHẤT client được phép tải minh chứng, KHÔNG có URL public/
 * tĩnh nào tồn tại.
 *
 * Tách file riêng khỏi route upload (Hestia code song song, cùng thời
 * điểm, khác nhánh) — gộp lại lúc merge.
 *
 * Quyền kiểm qua đúng `evidence.canViewEvidence` (action
 * `incident.view_evidence`), tra hồ sơ sự cố đã gộp tin báo chứa evidence
 * này để có đủ resource cho `checkAuthorization`. Tin báo CHƯA được tạo
 * thành hồ sơ vẫn phải xem được minh chứng đã gửi kèm — dùng thẳng
 * `report` làm resource khi chưa có `incident` (report đã có sẵn field
 * campusId/confidentiality cùng tên với incident; report chưa có
 * commanderPerId/assignedTaskPerIds nên bước 7 của authz chỉ đơn giản
 * không áp dụng bypass, vẫn xét đúng trần bí mật ở bước 6 như bình
 * thường).
 */

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { firebaseAuth } from '../../auth/middleware.js';
import { asyncRoute, HttpError } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { getEvidenceBucket } from '../../core/firebase.js';
import { loadActorContext } from '../identity/actor-context.js';
import * as catalog from './catalog.js';
import { writeAuditLog, buildAuditRecord } from './audit.js';
import { evidence as evidenceTable } from './evidence.schema.js';
import { reports } from './reports.schema.js';
import { incidents } from './incidents.schema.js';
import { canViewEvidence, getSignedDownloadUrl, type EvidenceIncidentView } from './evidence.js';

export const evidenceDownloadRouter = Router();

// Port từ `exports.getEvidenceDownloadUrl`.
evidenceDownloadRouter.post(
  '/evidence/:id/download-url',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const evidenceId = String(req.params.id);

    const [ev] = await db.select().from(evidenceTable).where(eq(evidenceTable.evidenceId, evidenceId)).limit(1);
    if (!ev) throw new HttpError(404, 'Không tìm thấy minh chứng ' + evidenceId, 'NOT_FOUND');
    if (ev.deleted === true) throw new HttpError(404, 'Minh chứng này đã bị xoá.', 'NOT_FOUND');
    if (!ev.reportId) {
      throw new HttpError(400, 'Minh chứng chưa được liên kết với tin báo/hồ sơ nào.', 'INVALID_STATE');
    }

    const [report] = await db.select().from(reports).where(eq(reports.reportId, ev.reportId)).limit(1);
    if (!report) {
      throw new HttpError(400, 'Không tìm thấy tin báo liên quan tới minh chứng này.', 'INVALID_STATE');
    }

    let incident: EvidenceIncidentView | null = null;
    if (report.mergedIntoIncidentId) {
      const [incRow] = await db.select().from(incidents).where(eq(incidents.incidentId, report.mergedIntoIncidentId)).limit(1);
      if (incRow) {
        incident = { campus_id: incRow.campusId, confidentiality: incRow.confidentiality, commander_per_id: incRow.commanderPerId, assigned_task_per_ids: incRow.assignedTaskPerIds ?? [] };
      }
    }
    const evidenceResource: EvidenceIncidentView = incident || { campus_id: report.campusId, confidentiality: report.confidentiality };
    if (!canViewEvidence(actor, evidenceResource)) {
      throw new HttpError(403, 'Bạn không có quyền xem minh chứng của hồ sơ này.', 'PERMISSION_ERROR');
    }

    // Chặn tải xuống theo TRẠNG THÁI QUÉT — kiểm tra SAU bước quyền ở
    // trên. Chỉ minh chứng đã quét sạch (CLEAR) mới được cấp signed URL.
    if (ev.scanStatus !== catalog.EVIDENCE_SCAN_STATUS.CLEAR) {
      if (ev.scanStatus === catalog.EVIDENCE_SCAN_STATUS.PENDING_SCAN) {
        throw new HttpError(400, 'Minh chứng đang chờ quét an toàn, chưa thể tải xuống. Vui lòng thử lại sau.', 'PENDING_SCAN');
      }
      if (ev.scanStatus === catalog.EVIDENCE_SCAN_STATUS.INFECTED) {
        throw new HttpError(400, 'Minh chứng này đã bị phát hiện chứa mã độc và đã bị xoá, không thể tải xuống.', 'INFECTED');
      }
      throw new HttpError(400, 'Minh chứng chưa sẵn sàng để tải xuống.', 'NOT_READY');
    }

    await writeAuditLog(
      db,
      buildAuditRecord({
        actorPerId: actor.perId,
        action: 'evidence.download_url_issued',
        objectId: evidenceId,
        after: { report_id: ev.reportId, incident_id: report.mergedIntoIncidentId || null },
        now: new Date()
      })
    );

    const url = await getSignedDownloadUrl(getEvidenceBucket(), ev.storagePath, { now: new Date() });
    res.json({ url, fileType: ev.fileType, sizeBytes: ev.sizeBytes, scanStatus: ev.scanStatus });
  })
);
