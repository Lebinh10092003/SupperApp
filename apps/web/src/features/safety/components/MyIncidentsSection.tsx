/**
 * MyIncidentsSection.tsx — "Sự vụ của tôi" trên tab Tổng quan an toàn
 * (bổ sung 2026-09-24, Sin chốt): danh sách MỌI hồ sơ actor hiện đang là
 * chỉ huy HOẶC đang là người tham gia — kể cả hồ sơ đã đóng (vẫn tính là
 * "đã từng làm"). Tái dùng thẳng filter `onlyMine` đã có sẵn ở
 * GET /api/safety/incidents (`useIncidents` hook, `filterIncidentItems`
 * ở server lọc theo `assignedTaskPerIds.includes(perId)`).
 *
 * Không cần bảng lịch sử riêng: `assignedTaskPerIds` chỉ mất phần tử qua
 * đúng 2 đường — tự rời sự vụ (`leave`) hoặc chỉ huy được duyệt huỷ tiếp
 * nhận (`approveCancelAcknowledgment`, xoá cả chỉ huy lẫn participant của
 * người đó) — cả 2 đúng là 2 trường hợp Sin yêu cầu KHÔNG tính. Đóng hồ sơ
 * KHÔNG xoá `assignedTaskPerIds`, nên hồ sơ đã đóng vẫn tự nhiên nằm trong
 * danh sách này — không cần xử lý gì thêm cho "đã từng làm".
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  MenuItem,
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
import { useIncidents, type IncidentListItem } from '../hooks/useIncidents';
import { useActor } from '../hooks/useActor';
import { PriorityChip } from './PriorityChip';
import { StatusChip } from './StatusChip';
import { TERMINAL_STATES } from '../constants';

type SortKey = 'updatedAt' | 'priority' | 'state';

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </Typography>
        <Typography variant="h3" fontWeight={800} sx={{ color, mt: 0.5 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function formatDateTime(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function MyIncidentsSection() {
  const navigate = useNavigate();
  const { actor } = useActor();
  const { items, loading, error } = useIncidents({ onlyMine: true, limit: 500 });

  const [priorityFilter, setPriorityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Thống kê tính trên TOÀN BỘ "của tôi", KHÔNG bị bộ lọc bên dưới ảnh
  // hưởng — lọc chỉ để thu hẹp bảng hiển thị, không đổi ý nghĩa 2 con số này.
  const openCount = useMemo(() => items.filter((it) => !TERMINAL_STATES.includes(it.state)).length, [items]);
  const totalCount = items.length;

  const filtered = useMemo(() => {
    let out = items;
    if (priorityFilter) out = out.filter((it) => it.priority === priorityFilter);
    if (stateFilter) out = out.filter((it) => it.state === stateFilter);
    if (searchText.trim()) {
      const s = searchText.toLowerCase();
      out = out.filter(
        (it) => it.incidentId.toLowerCase().includes(s) || (it.className || '').toLowerCase().includes(s) || (it.categoryLabel || '').toLowerCase().includes(s)
      );
    }
    return out;
  }, [items, priorityFilter, stateFilter, searchText]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const priorityRank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'priority') {
        cmp = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
      } else if (sortKey === 'state') {
        cmp = (a.state || '').localeCompare(b.state || '');
      } else {
        cmp = new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const paged = useMemo(() => sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [sorted, page, rowsPerPage]);

  useEffect(() => {
    setPage(0);
  }, [priorityFilter, stateFilter, searchText]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'priority' ? 'asc' : 'desc');
    }
  };

  const roleLabel = (it: IncidentListItem): string => {
    if (actor?.perId && it.commanderPerId === actor.perId) return 'Chỉ huy';
    return 'Tham gia';
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
        Sự vụ của tôi
      </Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Đang mở (của tôi)" value={loading ? '—' : openCount} color="#2563eb" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Tổng số đã/đang làm" value={loading ? '—' : totalCount} color="#15803d" />
        </Grid>
      </Grid>

      <Stack direction="row" spacing={1.5} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
        <TextField
          select
          size="small"
          label="Mức ưu tiên"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">Tất cả</MenuItem>
          <MenuItem value="P0">P0</MenuItem>
          <MenuItem value="P1">P1</MenuItem>
          <MenuItem value="P2">P2</MenuItem>
          <MenuItem value="P3">P3</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Trạng thái"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Tất cả</MenuItem>
          {Array.from(new Set(items.map((it) => it.state))).map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Tìm mã hồ sơ / lớp / nhóm sự cố"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ minWidth: 240, flexGrow: 1 }}
        />
      </Stack>

      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 1.5 }}>
          {error}
        </Typography>
      )}

      <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell>Mã hồ sơ</TableCell>
              <TableCell>Nhóm sự cố</TableCell>
              <TableCell sortDirection={sortKey === 'priority' ? sortDir : false}>
                <TableSortLabel active={sortKey === 'priority'} direction={sortKey === 'priority' ? sortDir : 'asc'} onClick={() => handleSort('priority')}>
                  Mức ưu tiên
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sortKey === 'state' ? sortDir : false}>
                <TableSortLabel active={sortKey === 'state'} direction={sortKey === 'state' ? sortDir : 'asc'} onClick={() => handleSort('state')}>
                  Trạng thái
                </TableSortLabel>
              </TableCell>
              <TableCell>Vai trò của tôi</TableCell>
              <TableCell sortDirection={sortKey === 'updatedAt' ? sortDir : false}>
                <TableSortLabel active={sortKey === 'updatedAt'} direction={sortKey === 'updatedAt' ? sortDir : 'desc'} onClick={() => handleSort('updatedAt')}>
                  Cập nhật lúc
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    Bạn chưa từng tiếp nhận hoặc tham gia sự vụ nào khớp bộ lọc này.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {paged.map((it) => (
              <TableRow key={it.incidentId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/safety/incidents/${it.incidentId}`)}>
                <TableCell sx={{ fontWeight: 600 }}>{it.incidentId}</TableCell>
                <TableCell>{it.categoryLabel || it.categoryCode || '—'}</TableCell>
                <TableCell>
                  <PriorityChip priority={it.priority} compact />
                </TableCell>
                <TableCell>
                  <StatusChip state={it.state} />
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={roleLabel(it)}
                    sx={{
                      fontWeight: 700,
                      height: 24,
                      bgcolor: roleLabel(it) === 'Chỉ huy' ? '#eff6ff' : '#f8fafc',
                      color: roleLabel(it) === 'Chỉ huy' ? '#2563eb' : '#475569',
                      border: '1px solid #e2e8f0'
                    }}
                  />
                </TableCell>
                <TableCell>{formatDateTime(it.updatedAt)}</TableCell>
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
    </Box>
  );
}
