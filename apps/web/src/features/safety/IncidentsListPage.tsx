import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
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
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineRounded';
import ListAltIcon from '@mui/icons-material/ListAltRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { useIncidents } from './hooks/useIncidents';
import { StatusChip } from './components/StatusChip';
import { PriorityChip } from './components/PriorityChip';
import { ConfidentialityBadge } from './components/ConfidentialityBadge';
import { CAMPUS_IDS, CAMPUS_LABEL, STATE_OPTIONS } from './constants';

const PRIORITY_OPTIONS = ['P0', 'P1', 'P2', 'P3'];
type SortKey = 'incidentId' | 'campusId' | 'priority' | 'state' | 'updatedAt';

export default function IncidentsListPage() {
  const navigate = useNavigate();
  const [campusFilter, setCampusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [categories, setCategories] = useState<{ code: string; label: string }[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    api.get<{ code: string; label: string }[]>('/api/safety/categories').then(setCategories).catch(() => setCategories([]));
  }, []);

  const { items, loading, error } = useIncidents({
    campusId: campusFilter || undefined,
    priorities: priorityFilter ? [priorityFilter] : undefined,
    states: stateFilter ? [stateFilter] : undefined,
    categoryCodes: categoryFilter ? [categoryFilter] : undefined,
    searchText: searchText || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined
  });

  // Sắp xếp cột — server đã lọc/giới hạn số bản ghi (limit mặc định 50),
  // sắp xếp theo cột do người dùng chọn làm ở client trên tập đã tải,
  // khớp đúng kiến trúc bản Firebase cũ (initSortableTableHead +
  // renderPagerBar — capped fetch rồi sort/page ở client).
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

  useEffect(() => {
    setPage(0);
  }, [campusFilter, priorityFilter, stateFilter, categoryFilter, searchText, fromDate, toDate]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ campusId: '', categoryCode: '', content: '', className: '', priority: '' });
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState('');

  const handleCreateDirect = async () => {
    setDialogError('');
    if (!form.campusId) return setDialogError('Vui lòng chọn cơ sở.');
    if (!form.categoryCode) return setDialogError('Vui lòng nhập mã nhóm sự cố.');
    setSubmitting(true);
    try {
      const res = await api.post<{ incidentId: string }>('/api/safety/incidents/direct', {
        campusId: form.campusId,
        categoryCode: form.categoryCode,
        content: form.content,
        className: form.className || undefined,
        priority: form.priority || undefined
      });
      setDialogOpen(false);
      setForm({ campusId: '', categoryCode: '', content: '', className: '', priority: '' });
      navigate(`/safety/incidents/${res.incidentId}`);
    } catch (e: any) {
      setDialogError(e.message || 'Tạo hồ sơ thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Hồ sơ sự cố"
        subtitle="Toàn bộ hồ sơ sự cố an toàn trường học đang/đã xử lý"
        icon={<ListAltIcon />}
        action={
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700 }}
          >
            Tạo hồ sơ trực tiếp
          </Button>
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <TextField
          label="Tìm theo nội dung/mã hồ sơ"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ minWidth: 240 }}
        />
        <TextField select label="Cơ sở" value={campusFilter} onChange={(e) => setCampusFilter(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {CAMPUS_IDS.map((c) => (
            <MenuItem key={c} value={c}>
              {CAMPUS_LABEL[c]}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Mức ưu tiên" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {PRIORITY_OPTIONS.map((p) => (
            <MenuItem key={p} value={p}>
              {p}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Trạng thái" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {STATE_OPTIONS.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
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

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel active={sortKey === 'incidentId'} direction={sortKey === 'incidentId' ? sortDir : 'asc'} onClick={() => handleSort('incidentId')}>
                  Mã hồ sơ
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'campusId'} direction={sortKey === 'campusId' ? sortDir : 'asc'} onClick={() => handleSort('campusId')}>
                  Cơ sở
                </TableSortLabel>
              </TableCell>
              <TableCell>Nhóm sự cố</TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'priority'} direction={sortKey === 'priority' ? sortDir : 'asc'} onClick={() => handleSort('priority')}>
                  Mức ưu tiên
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'state'} direction={sortKey === 'state' ? sortDir : 'asc'} onClick={() => handleSort('state')}>
                  Trạng thái
                </TableSortLabel>
              </TableCell>
              <TableCell>Bí mật</TableCell>
              <TableCell>Chỉ huy</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Không có hồ sơ nào.
                </TableCell>
              </TableRow>
            )}
            {paged.map((it) => (
              <TableRow key={it.incidentId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/safety/incidents/${it.incidentId}`)}>
                <TableCell>{it.incidentId}</TableCell>
                <TableCell>{CAMPUS_LABEL[it.campusId] || it.campusId}</TableCell>
                <TableCell>{it.redacted ? <em>—</em> : it.categoryLabel || it.categoryCode}</TableCell>
                <TableCell>
                  <PriorityChip priority={it.priority} />
                </TableCell>
                <TableCell>
                  <StatusChip state={it.state} />
                </TableCell>
                <TableCell>
                  <ConfidentialityBadge confidentiality={it.confidentiality} redacted={it.redacted} />
                </TableCell>
                <TableCell>{it.redacted ? '—' : it.commanderName || '—'}</TableCell>
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Tạo hồ sơ trực tiếp</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {dialogError && <Alert severity="error">{dialogError}</Alert>}
            <Typography variant="body2" color="text.secondary">
              Dùng khi bạn trực tiếp chứng kiến/xử lý sự việc, không cần có sẵn tin báo trước.
            </Typography>
            <TextField select label="Cơ sở *" value={form.campusId} onChange={(e) => setForm({ ...form, campusId: e.target.value })} fullWidth>
              {CAMPUS_IDS.map((c) => (
                <MenuItem key={c} value={c}>
                  {CAMPUS_LABEL[c]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Mã nhóm sự cố (categoryCode) *"
              value={form.categoryCode}
              onChange={(e) => setForm({ ...form, categoryCode: e.target.value })}
              placeholder="VD: fire_explosion"
              fullWidth
            />
            <TextField label="Lớp liên quan" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} fullWidth />
            <TextField
              label="Nội dung"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <TextField select label="Mức ưu tiên (tuỳ chọn)" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} fullWidth>
              <MenuItem value="">Tự động gợi ý</MenuItem>
              {PRIORITY_OPTIONS.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleCreateDirect} disabled={submitting}>
            Tạo hồ sơ
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
