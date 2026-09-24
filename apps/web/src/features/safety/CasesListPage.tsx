/**
 * CasesListPage.tsx — danh sách SỰ VỤ gộp (2026-09-22, Sin chốt): thay hẳn
 * cho 2 trang cũ "Tin báo chờ xử lý" (PendingReportsPage.tsx, đã xoá) và
 * "Hồ sơ sự cố" (IncidentsListPage.tsx, đã xoá) — từ khi submitReport tự
 * tạo `incidents` row ngay lúc gửi tin (report-flow.ts), không còn khái
 * niệm "tin báo chưa phải hồ sơ" để tách thành 2 danh sách nữa.
 *
 * Sin chốt 2026-09-22: bỏ nút thao tác nhanh (Tiếp nhận/Bàn giao) ngay
 * trên dòng danh sách — cột "Người phụ trách" chỉ còn hiển thị tên/chip
 * "Chưa tiếp nhận", bấm vào cả dòng mới vào trang chi tiết để thao tác.
 * Cột "Nhóm sự cố" cũng chỉ hiện rút gọn (truncate + tooltip), giống cột
 * "Nội dung" — xem chi tiết đầy đủ phải bấm vào dòng.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
  Tooltip,
  Typography
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineRounded';
import ListAltIcon from '@mui/icons-material/ListAltRounded';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAddRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { useIncidents, type IncidentListItem } from './hooks/useIncidents';
import { StatusChip } from './components/StatusChip';
import { PriorityChip } from './components/PriorityChip';
import { CAMPUS_IDS, CAMPUS_LABEL, STATE_OPTIONS } from './constants';

const PRIORITY_OPTIONS = ['P0', 'P1', 'P2', 'P3'];
type SortKey = 'incidentId' | 'campusId' | 'priority' | 'state' | 'updatedAt';
type OwnerFilter = '' | 'unclaimed' | 'claimed';

interface SavedFilterState {
  campusFilter: string;
  priorityFilter: string;
  stateFilter: string;
  categoryFilter: string;
  ownerFilter: OwnerFilter;
  searchText: string;
}

interface SavedFilterRow {
  id: string;
  name: string;
  filterJson: SavedFilterState;
}

export default function CasesListPage() {
  const navigate = useNavigate();
  // `?q=` đọc 1 LẦN lúc mount — dùng khi chuông thông báo điều hướng tới
  // đúng 1 sự vụ cụ thể (NotificationBell.tsx), không đồng bộ 2 chiều với URL sau đó.
  const [searchParams] = useSearchParams();
  const [campusFilter, setCampusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('');
  const [searchText, setSearchText] = useState(() => searchParams.get('q') || '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [categories, setCategories] = useState<{ code: string; label: string }[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const [savedFilters, setSavedFilters] = useState<SavedFilterRow[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');

  useEffect(() => {
    api.get<{ code: string; label: string }[]>('/api/safety/categories').then(setCategories).catch(() => setCategories([]));
    api.get<SavedFilterRow[]>('/api/safety/saved-filters').then(setSavedFilters).catch(() => setSavedFilters([]));
  }, []);

  const { items, loading, error, refetch } = useIncidents({
    campusId: campusFilter || undefined,
    priorities: priorityFilter ? [priorityFilter] : undefined,
    states: stateFilter ? [stateFilter] : undefined,
    categoryCodes: categoryFilter ? [categoryFilter] : undefined,
    searchText: searchText || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    limit: 500
  });

  const filteredByOwner = useMemo(() => {
    if (!ownerFilter) return items;
    return items.filter((it) => (ownerFilter === 'unclaimed' ? !it.commanderPerId : !!it.commanderPerId));
  }, [items, ownerFilter]);

  const sorted = useMemo(() => {
    const copy = [...filteredByOwner];
    copy.sort((a, b) => {
      const av = String(a[sortKey] ?? '');
      const bv = String(b[sortKey] ?? '');
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filteredByOwner, sortKey, sortDir]);

  const paged = useMemo(() => sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [sorted, page, rowsPerPage]);

  useEffect(() => {
    setPage(0);
  }, [campusFilter, priorityFilter, stateFilter, categoryFilter, ownerFilter, searchText, fromDate, toDate]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const applySavedFilter = (row: SavedFilterRow) => {
    const f = row.filterJson;
    setCampusFilter(f.campusFilter || '');
    setPriorityFilter(f.priorityFilter || '');
    setStateFilter(f.stateFilter || '');
    setCategoryFilter(f.categoryFilter || '');
    setOwnerFilter(f.ownerFilter || '');
    setSearchText(f.searchText || '');
  };

  const handleSaveFilter = async () => {
    if (!saveFilterName.trim()) return;
    const filterJson: SavedFilterState = { campusFilter, priorityFilter, stateFilter, categoryFilter, ownerFilter, searchText };
    try {
      const row = await api.post<SavedFilterRow>('/api/safety/saved-filters', { name: saveFilterName.trim(), filterJson });
      setSavedFilters((prev) => [row, ...prev]);
      setSaveDialogOpen(false);
      setSaveFilterName('');
      setToast({ message: `Đã lưu bộ lọc "${row.name}".`, severity: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, severity: 'error' });
    }
  };

  const handleDeleteSavedFilter = async (id: string) => {
    try {
      await api.delete(`/api/safety/saved-filters/${id}`);
      setSavedFilters((prev) => prev.filter((f) => f.id !== id));
    } catch (e: any) {
      setToast({ message: e.message, severity: 'error' });
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
    <>
      <PageHeader
        title="Sự vụ"
        icon={<ListAltIcon />}
        action={
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700 }}
          >
            Ghi nhận sự vụ trực tiếp
          </Button>
        }
      />

      {toast && (
        <Alert severity={toast.severity} onClose={() => setToast(null)} sx={{ mb: 2 }}>
          {toast.message}
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {savedFilters.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap' }} useFlexGap>
          {savedFilters.map((f) => (
            <Chip
              key={f.id}
              label={f.name}
              onClick={() => applySavedFilter(f)}
              onDelete={() => handleDeleteSavedFilter(f.id)}
              deleteIcon={<DeleteOutlineIcon fontSize="small" />}
              sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}
            />
          ))}
        </Stack>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
        <TextField
          label="Tìm theo nội dung/mã sự vụ"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        <TextField select label="Cơ sở" value={campusFilter} onChange={(e) => setCampusFilter(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {CAMPUS_IDS.map((c) => (
            <MenuItem key={c} value={c}>
              {CAMPUS_LABEL[c]}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Mức ưu tiên" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {PRIORITY_OPTIONS.map((p) => (
            <MenuItem key={p} value={p}>
              {p}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Trạng thái" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {STATE_OPTIONS.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Nhóm sự cố" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.code} value={c.code}>
              {c.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Người phụ trách" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value as OwnerFilter)} sx={{ minWidth: 180 }}>
          <MenuItem value="">Tất cả</MenuItem>
          <MenuItem value="unclaimed">Chưa có người phụ trách</MenuItem>
          <MenuItem value="claimed">Đã có người phụ trách</MenuItem>
        </TextField>
        <TextField
          label="Từ ngày"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 150 }}
        />
        <TextField
          label="Đến ngày"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 150 }}
        />
        <Tooltip title="Lưu bộ lọc hiện tại">
          <IconButton onClick={() => setSaveDialogOpen(true)} sx={{ color: '#2563eb' }}>
            <BookmarkAddIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel active={sortKey === 'updatedAt'} direction={sortKey === 'updatedAt' ? sortDir : 'desc'} onClick={() => handleSort('updatedAt')}>
                  Cập nhật
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'incidentId'} direction={sortKey === 'incidentId' ? sortDir : 'asc'} onClick={() => handleSort('incidentId')}>
                  Mã sự vụ
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'campusId'} direction={sortKey === 'campusId' ? sortDir : 'asc'} onClick={() => handleSort('campusId')}>
                  Cơ sở
                </TableSortLabel>
              </TableCell>
              <TableCell>Nhóm sự cố</TableCell>
              <TableCell>Nội dung</TableCell>
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
              <TableCell>Người phụ trách</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && paged.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Không có sự vụ nào.
                </TableCell>
              </TableRow>
            )}
            {paged.map((it) => (
              <TableRow key={it.incidentId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/safety/incidents/${it.incidentId}`)}>
                <TableCell>{it.updatedAt ? new Date(it.updatedAt).toLocaleString('vi-VN') : '—'}</TableCell>
                <TableCell>{it.incidentId}</TableCell>
                <TableCell>{CAMPUS_LABEL[it.campusId] || it.campusId}</TableCell>
                <TableCell sx={{ maxWidth: 180 }}>
                  <Typography variant="body2" noWrap title={it.categoryLabel || it.categoryCode || ''}>
                    {it.categoryLabel || it.categoryCode}
                  </Typography>
                </TableCell>
                <TableCell sx={{ maxWidth: 260 }}>
                  <Typography variant="body2" noWrap title={it.contentPreview || ''}>
                    {it.contentPreview || <em>(không có nội dung)</em>}
                  </Typography>
                </TableCell>
                <TableCell>
                  <PriorityChip priority={it.priority} compact />
                </TableCell>
                <TableCell>
                  <StatusChip state={it.state} />
                </TableCell>
                <TableCell>
                  {it.commanderName || <Chip label="Chưa tiếp nhận" size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 600 }} />}
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
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="Số dòng/trang"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
        />
      </TableContainer>

      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Lưu bộ lọc hiện tại</DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus
            label="Tên bộ lọc"
            value={saveFilterName}
            onChange={(e) => setSaveFilterName(e.target.value)}
            placeholder="VD: Sự vụ cơ sở vật chất của tôi"
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleSaveFilter} disabled={!saveFilterName.trim()}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Ghi nhận sự vụ trực tiếp</DialogTitle>
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
            Tạo sự vụ
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
