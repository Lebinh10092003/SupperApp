import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
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
import ReportProblemIcon from '@mui/icons-material/ReportProblemRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { CAMPUS_LABEL } from './constants';

interface PendingReportItem {
  reportId: string;
  publicCode: string;
  campusId: string;
  categoryLabel: string;
  stillDangerous: boolean;
  content: string;
  className: string | null;
  redacted: boolean;
}

const PRIORITY_OPTIONS = ['P0', 'P1', 'P2', 'P3'];

export default function PendingReportsPage() {
  const [items, setItems] = useState<PendingReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [priorityTarget, setPriorityTarget] = useState<PendingReportItem | null>(null);
  const [priorityChoice, setPriorityChoice] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get<{ items: PendingReportItem[]; urgentCount: number }>('/api/safety/reports/pending')
      .then((d) => setItems(d.items || []))
      .catch((e: any) => setError(e.message || 'Không tải được danh sách tin báo.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // POST /api/safety/incidents BẮT BUỘC có `priority` khi tạo hồ sơ mới
  // (không phải nhánh gộp vào hồ sơ có sẵn) — xem report-flow.ts
  // `createIncidentFromReport`. Mở dialog chọn mức thay vì đoán/hardcode.
  const openPriorityDialog = (item: PendingReportItem) => {
    setPriorityTarget(item);
    setPriorityChoice(item.stillDangerous ? 'P0' : '');
  };

  const handleCreateIncident = async () => {
    if (!priorityTarget || !priorityChoice) return;
    setCreatingId(priorityTarget.reportId);
    try {
      await api.post('/api/safety/incidents', { reportId: priorityTarget.reportId, priority: priorityChoice });
      setToast('Đã chuyển tin báo thành hồ sơ sự cố.');
      setPriorityTarget(null);
      load();
    } catch (e: any) {
      setError(e.message || 'Chuyển thành hồ sơ thất bại.');
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader title="Tin báo chờ xử lý" subtitle="Tin báo mới nhận, chưa chuyển thành hồ sơ sự cố" icon={<ReportProblemIcon />} />

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {toast && <Alert severity="success" onClose={() => setToast('')} sx={{ mb: 2 }}>{toast}</Alert>}

      <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Mã</TableCell>
              <TableCell>Cơ sở</TableCell>
              <TableCell>Nhóm sự cố</TableCell>
              <TableCell>Lớp</TableCell>
              <TableCell>Nội dung</TableCell>
              <TableCell>Khẩn cấp</TableCell>
              <TableCell align="right">Hành động</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Không có tin báo nào đang chờ xử lý.
                </TableCell>
              </TableRow>
            )}
            {items.map((it) => (
              <TableRow key={it.reportId} hover>
                <TableCell>{it.publicCode}</TableCell>
                <TableCell>{CAMPUS_LABEL[it.campusId] || it.campusId}</TableCell>
                <TableCell>{it.categoryLabel}</TableCell>
                <TableCell>{it.className || '—'}</TableCell>
                <TableCell sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.redacted ? <em>Nội dung bị hạn chế</em> : it.content}
                </TableCell>
                <TableCell>
                  {it.stillDangerous && <Chip size="small" label="Khẩn cấp" sx={{ bgcolor: '#fef2f2', color: '#dc2626', fontWeight: 700 }} />}
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="contained"
                    disabled={creatingId === it.reportId}
                    onClick={() => openPriorityDialog(it)}
                    sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none' }}
                  >
                    Chuyển thành hồ sơ
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(priorityTarget)} onClose={() => setPriorityTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Chuyển thành hồ sơ sự cố</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Chọn mức ưu tiên xử lý cho hồ sơ mới ({priorityTarget?.publicCode}):
            </Typography>
            <TextField select label="Mức ưu tiên *" value={priorityChoice} onChange={(e) => setPriorityChoice(e.target.value)} fullWidth>
              {PRIORITY_OPTIONS.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPriorityTarget(null)}>Hủy</Button>
          <Button variant="contained" onClick={handleCreateIncident} disabled={!priorityChoice || creatingId === priorityTarget?.reportId}>
            Tạo hồ sơ
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
