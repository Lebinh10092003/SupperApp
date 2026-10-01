import { useState } from 'react';
import { History } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AuditLogEntry {
  logId: string;
  occurredAt: string;
  actorPerId: string;
  actorLabel?: string;
  action: string;
  objectId: string;
  reason: string | null;
  before: unknown;
  after: unknown;
}

/**
 * Nhật ký kiểm toán (S9) — chỉ đọc, bất biến, port lại từ `readAuditLog`
 * (GET /api/safety/audit-logs). Server tự chặn theo action `audit.read`
 * nếu vai trò không đủ, không cần UI tự kiểm tra thêm.
 */
const PAGE_SIZE = 50;

/** Toàn bộ giá trị `action` thật ghi vào audit_logs — đối chiếu trực tiếp từng file backend (report-flow.ts/incident-lifecycle.ts/evidence.ts/safety-query.routes.ts/directory-assignments.ts), không suy đoán. */
const ACTION_LABEL: Record<string, string> = {
  'audit.read': 'Xem nhật ký kiểm toán',
  'catalog.edit': 'Sửa danh mục/danh bạ',
  'config.grade_supervisor_assignment_edited': 'Gán giáo viên phụ trách khối',
  'config.homeroom_assignment_edited': 'Gán giáo viên chủ nhiệm',
  'evidence.download_url_issued': 'Cấp link tải minh chứng',
  'evidence.scan_infected_deleted': 'Xoá minh chứng nhiễm mã độc',
  'incident.acknowledged': 'Tự tiếp nhận (trở thành chỉ huy)',
  'incident.participant_added': 'Thêm người tham gia xử lý',
  'incident.participant_joined': 'Tự tham gia sự vụ',
  'incident.participant_left': 'Rời khỏi sự vụ',
  'incident.merged_duplicate': 'Gộp sự vụ trùng nhau',
  'incident.cancel_acknowledgment_requested': 'Yêu cầu huỷ tiếp nhận',
  'incident.acknowledgment_cancelled': 'Đã duyệt huỷ tiếp nhận',
  'incident.cancel_acknowledgment_rejected': 'Từ chối yêu cầu huỷ tiếp nhận',
  'incident.assign_commander': 'Chỉ định chỉ huy hồ sơ',
  'incident.classification_corrected': 'Đã sửa phân loại hồ sơ',
  'incident.close': 'Đóng hồ sơ',
  'incident.close_confirmed_by_reporter': 'Người báo tin xác nhận đóng hồ sơ',
  'incident.correct_classification': 'Yêu cầu sửa phân loại hồ sơ',
  'incident.priority_changed': 'Đổi mức ưu tiên',
  'incident.reassign_commander': 'Đổi chỉ huy hồ sơ',
  'incident.reopen': 'Mở lại hồ sơ',
  'incident.state_changed': 'Đổi trạng thái hồ sơ',
  'incident.view': 'Xem hồ sơ',
  'incident.view_c1_c2': 'Xem hồ sơ (C1–C2)',
  'incident.view_c3': 'Xem hồ sơ (C3)',
  'incident.view_c4': 'Xem hồ sơ (C4)',
  'incident.view_campus_comparison': 'Xem so sánh cơ sở',
  'incident.view_class_stats': 'Xem thống kê theo lớp',
  'incident.view_evidence': 'Xem minh chứng',
  'incident.view_stats': 'Xem thống kê an toàn',
  'incident.view_trend_alerts': 'Xem cảnh báo xu hướng',
  'notify.acknowledged': 'Xác nhận đã nhận thông báo',
  read: 'Xem',
  'safety.incident.created': 'Tạo hồ sơ sự cố',
  'safety.incident.homeroom_notified': 'Đã báo giáo viên chủ nhiệm',
  'safety.incident.p0_activated': 'Kích hoạt khẩn cấp P0',
  'safety.incident.p1_escalation_notified': 'Leo thang thông báo P1',
  'safety.incident.p1_no_recipients': 'P1 không có người nhận thông báo',
  'safety.report.merged': 'Gộp tin báo vào hồ sơ',
  'safety.report.received': 'Tiếp nhận tin báo',
  'safety.report.reporter_notified': 'Đã báo người báo tin',
  'safety.report.urgent_no_recipients': 'Tin khẩn không có người nhận',
  'safety.report.urgent_notified': 'Đã báo tin khẩn',
  'safety.report.view': 'Xem tin báo'
};

export default function AuditLogPage() {
  const [objectId, setObjectId] = useState('');
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<AuditLogEntry | null>(null);
  const [searched, setSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    const qs = objectId.trim() ? `?objectId=${encodeURIComponent(objectId.trim())}&limit=${PAGE_SIZE}` : `?limit=${PAGE_SIZE}`;
    api
      .get<{ items: AuditLogEntry[]; hasMore: boolean }>(`/api/safety/audit-logs${qs}`)
      .then((res) => {
        setItems(res.items || []);
        setHasMore(!!res.hasMore);
        setSearched(true);
      })
      .catch((e: any) => setError(e.message || 'Không tải được nhật ký kiểm toán (có thể vai trò của bạn không đủ quyền xem).'))
      .finally(() => setLoading(false));
  };

  // "Tải thêm" — con trỏ (cursor) là occurredAt của bản ghi cuối trang
  // hiện tại, KHÔNG dùng offset số vì nhật ký liên tục có bản ghi mới
  // chèn vào đầu danh sách (offset sẽ lệch/trùng nếu vừa tải vừa ghi mới).
  const loadMore = () => {
    const last = items[items.length - 1];
    if (!last) return;
    setLoadingMore(true);
    const params = new URLSearchParams();
    if (objectId.trim()) params.set('objectId', objectId.trim());
    params.set('limit', String(PAGE_SIZE));
    params.set('before', last.occurredAt);
    api
      .get<{ items: AuditLogEntry[]; hasMore: boolean }>(`/api/safety/audit-logs?${params.toString()}`)
      .then((res) => {
        setItems((prev) => [...prev, ...(res.items || [])]);
        setHasMore(!!res.hasMore);
      })
      .catch((e: any) => setError(e.message || 'Không tải thêm được.'))
      .finally(() => setLoadingMore(false));
  };

  return (
    <>
      <PageHeader title="Nhật ký kiểm toán" icon={<History />} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-80">
          <Label htmlFor="audit-object-id" className="mb-1.5 block">
            Mã hồ sơ/đối tượng (objectId, tuỳ chọn)
          </Label>
          <Input
            id="audit-object-id"
            value={objectId}
            onChange={(e) => setObjectId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="VD: SC.2609.0001 — để trống xem gần đây nhất"
          />
        </div>
        <Button onClick={load} disabled={loading}>
          Tra cứu
        </Button>
      </div>

      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {searched && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Người thực hiện</TableHead>
                <TableHead>Hành động</TableHead>
                <TableHead>Đối tượng</TableHead>
                <TableHead>Lý do</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                    Không có bản ghi nào.
                  </TableCell>
                </TableRow>
              )}
              {items.map((it) => (
                <TableRow key={it.logId} className="cursor-pointer" onClick={() => setDetail(it)}>
                  <TableCell>{new Date(it.occurredAt).toLocaleString('vi-VN')}</TableCell>
                  <TableCell>{it.actorLabel || it.actorPerId}</TableCell>
                  <TableCell>{ACTION_LABEL[it.action] || it.action}</TableCell>
                  <TableCell>{it.objectId}</TableCell>
                  <TableCell>{it.reason || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {searched && hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Đang tải...' : 'Tải thêm'}
          </Button>
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chi tiết bản ghi kiểm toán</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="flex flex-col gap-2.5">
              <p className="text-sm">Thời gian: {new Date(detail.occurredAt).toLocaleString('vi-VN')}</p>
              <p className="text-sm">Người thực hiện: {detail.actorLabel || detail.actorPerId}</p>
              <p className="text-sm">Hành động: {ACTION_LABEL[detail.action] || detail.action}</p>
              <p className="text-sm">Đối tượng: {detail.objectId}</p>
              {detail.reason && <p className="text-sm">Lý do: {detail.reason}</p>}
              {detail.before != null && (
                <div>
                  <p className="text-xs font-bold">Trước:</p>
                  <pre className="max-h-[200px] overflow-auto rounded-md bg-slate-50 p-3 text-xs">{JSON.stringify(detail.before, null, 2)}</pre>
                </div>
              )}
              {detail.after != null && (
                <div>
                  <p className="text-xs font-bold">Sau:</p>
                  <pre className="max-h-[200px] overflow-auto rounded-md bg-slate-50 p-3 text-xs">{JSON.stringify(detail.after, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDetail(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
