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
export default function AuditLogPage() {
  const [objectId, setObjectId] = useState('');
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<AuditLogEntry | null>(null);
  const [searched, setSearched] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    const qs = objectId.trim() ? `?objectId=${encodeURIComponent(objectId.trim())}&limit=100` : '?limit=100';
    api
      .get<{ items: AuditLogEntry[] }>(`/api/safety/audit-logs${qs}`)
      .then((res) => {
        setItems(res.items || []);
        setSearched(true);
      })
      .catch((e: any) => setError(e.message || 'Không tải được nhật ký kiểm toán (có thể vai trò của bạn không đủ quyền xem).'))
      .finally(() => setLoading(false));
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Nhật ký kiểm toán"
        subtitle="Ghi lại mọi thao tác quan trọng — chỉ đọc, không thể sửa/xoá"
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
                  <TableCell>{it.actorPerId}</TableCell>
                  <TableCell>
                    <code>{it.action}</code>
                  </TableCell>
                  <TableCell>{it.objectId}</TableCell>
                  <TableCell>{it.reason || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Chi tiết bản ghi kiểm toán</DialogTitle>
        <DialogContent dividers>
          {detail && (
            <Stack spacing={1.5}>
              <Typography variant="body2">Thời gian: {new Date(detail.occurredAt).toLocaleString('vi-VN')}</Typography>
              <Typography variant="body2">Người thực hiện: {detail.actorPerId}</Typography>
              <Typography variant="body2">Hành động: <code>{detail.action}</code></Typography>
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
    </Box>
  );
}
