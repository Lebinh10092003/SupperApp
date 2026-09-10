import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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

export default function PendingReportsPage() {
  const [items, setItems] = useState<PendingReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

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

  const handleCreateIncident = async (reportId: string) => {
    setCreatingId(reportId);
    try {
      await api.post('/api/safety/incidents', { reportId });
      setToast('Đã chuyển tin báo thành hồ sơ sự cố.');
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
                    onClick={() => handleCreateIncident(it.reportId)}
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
    </Box>
  );
}
