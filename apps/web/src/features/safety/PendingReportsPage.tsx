import { useEffect, useMemo, useState } from 'react';
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
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography
} from '@mui/material';
import ReportProblemIcon from '@mui/icons-material/ReportProblemRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { CAMPUS_IDS, CAMPUS_LABEL } from './constants';

interface PendingReportItem {
  reportId: string;
  publicCode: string;
  campusId: string;
  categoryCode: string;
  categoryLabel: string;
  stillDangerous: boolean;
  content: string;
  className: string | null;
  redacted: boolean;
  occurredAt?: string;
}

const PRIORITY_OPTIONS = ['P0', 'P1', 'P2', 'P3'];
type SortKey = 'reportId' | 'campusId' | 'categoryLabel' | 'occurredAt';

export default function PendingReportsPage() {
  const [items, setItems] = useState<PendingReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [priorityTarget, setPriorityTarget] = useState<PendingReportItem | null>(null);
  const [priorityChoice, setPriorityChoice] = useState('');

  const [searchText, setSearchText] = useState('');
  const [campusFilter, setCampusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dangerFilter, setDangerFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [categories, setCategories] = useState<{ code: string; label: string }[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('occurredAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    api.get<{ code: string; label: string }[]>('/api/safety/categories').then(setCategories).catch(() => setCategories([]));
  }, []);

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (campusFilter) q.set('campusId', campusFilter);
    if (categoryFilter) q.set('categoryCodes', categoryFilter);
    if (searchText) q.set('searchText', searchText);
    if (dangerFilter) q.set('stillDangerous', dangerFilter);
    if (fromDate) q.set('fromDate', fromDate);
    if (toDate) q.set('toDate', toDate);
    const qs = q.toString();
    api
      .get<{ items: PendingReportItem[]; urgentCount: number }>(`/api/safety/reports/pending${qs ? `?${qs}` : ''}`)
      .then((d) => setItems(d.items || []))
      .catch((e: any) => setError(e.message || 'Không tải được danh sách tin báo.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusFilter, categoryFilter, searchText, dangerFilter, fromDate, toDate]);

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const av = String(a[sortKey] ?? '');
      const bv = String(b[sortKey] ?? '');
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [items, sortKey, sortDir]);

  const paged = useMemo(() => sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [sorted, page, rowsPerPage]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

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

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <TextField label="Tìm theo nội dung/mã" value={searchText} onChange={(e) => setSearchText(e.target.value)} sx={{ minWidth: 240 }} />
        <TextField select label="Cơ sở" value={campusFilter} onChange={(e) => setCampusFilter(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {CAMPUS_IDS.map((c) => (
            <MenuItem key={c} value={c}>
              {CAMPUS_LABEL[c]}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Nhóm sự cố" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} sx={{ minWidth: 200 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.code} value={c.code}>
              {c.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Khẩn cấp" value={dangerFilter} onChange={(e) => setDangerFilter(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">Tất cả</MenuItem>
          <MenuItem value="true">Còn nguy hiểm</MenuItem>
          <MenuItem value="false">Đã an toàn</MenuItem>
        </TextField>
        <TextField
          label="Từ ngày"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        />
        <TextField
          label="Đến ngày"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        />
      </Stack>

      <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel active={sortKey === 'reportId'} direction={sortKey === 'reportId' ? sortDir : 'asc'} onClick={() => handleSort('reportId')}>
                  Mã
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'campusId'} direction={sortKey === 'campusId' ? sortDir : 'asc'} onClick={() => handleSort('campusId')}>
                  Cơ sở
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'categoryLabel'} direction={sortKey === 'categoryLabel' ? sortDir : 'asc'} onClick={() => handleSort('categoryLabel')}>
                  Nhóm sự cố
                </TableSortLabel>
              </TableCell>
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
            {paged.map((it) => (
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
        <TablePagination
          component="div"
          count={sorted.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
          labelRowsPerPage="Số dòng/trang"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
        />
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
