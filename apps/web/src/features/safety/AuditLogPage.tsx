import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

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
      <PageHeader
        title="Nhật ký kiểm toán"
        icon={<HistoryRoundedIcon />}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="Mã hồ sơ/đối tượng (objectId, tuỳ chọn)"
          value={objectId}
          onChange={(e) => setObjectId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="VD: SC.2609.0001 — để trống xem gần đây nhất"
          sx={{ minWidth: 320 }}
        />
        <Button variant="contained" onClick={load} disabled={loading} sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}>
          Tra cứu
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {searched && (
        <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Thời gian</TableCell>
                <TableCell>Người thực hiện</TableCell>
                <TableCell>Hành động</TableCell>
                <TableCell>Đối tượng</TableCell>
                <TableCell>Lý do</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Không có bản ghi nào.
                  </TableCell>
                </TableRow>
              )}
              {items.map((it) => (
                <TableRow key={it.logId} hover sx={{ cursor: 'pointer' }} onClick={() => setDetail(it)}>
                  <TableCell>{new Date(it.occurredAt).toLocaleString('vi-VN')}</TableCell>
                  <TableCell>{it.actorLabel || it.actorPerId}</TableCell>
                  <TableCell>{ACTION_LABEL[it.action] || it.action}</TableCell>
                  <TableCell>{it.objectId}</TableCell>
                  <TableCell>{it.reason || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {searched && hasMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button variant="outlined" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Đang tải...' : 'Tải thêm'}
          </Button>
        </Box>
      )}

      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Chi tiết bản ghi kiểm toán</DialogTitle>
        <DialogContent dividers>
          {detail && (
            <Stack spacing={1.5}>
              <Typography variant="body2">Thời gian: {new Date(detail.occurredAt).toLocaleString('vi-VN')}</Typography>
              <Typography variant="body2">Người thực hiện: {detail.actorLabel || detail.actorPerId}</Typography>
              <Typography variant="body2">Hành động: {ACTION_LABEL[detail.action] || detail.action}</Typography>
              <Typography variant="body2">Đối tượng: {detail.objectId}</Typography>
              {detail.reason && <Typography variant="body2">Lý do: {detail.reason}</Typography>}
              {detail.before != null && (
                <Box>
                  <Typography variant="caption" fontWeight={700}>Trước:</Typography>
                  <Box component="pre" sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 1, fontSize: '0.75rem', overflow: 'auto', maxHeight: 200 }}>
                    {JSON.stringify(detail.before, null, 2)}
                  </Box>
                </Box>
              )}
              {detail.after != null && (
                <Box>
                  <Typography variant="caption" fontWeight={700}>Sau:</Typography>
                  <Box component="pre" sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 1, fontSize: '0.75rem', overflow: 'auto', maxHeight: 200 }}>
                    {JSON.stringify(detail.after, null, 2)}
                  </Box>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)}>Đóng</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
