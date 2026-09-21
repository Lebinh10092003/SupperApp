import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Tooltip,
  IconButton,
  Typography
} from '@mui/material';
import ReportProblemIcon from '@mui/icons-material/ReportProblemRounded';
import VisibilityIcon from '@mui/icons-material/VisibilityRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { CAMPUS_IDS, CAMPUS_LABEL } from './constants';
import { EvidenceGallery } from './EvidenceGallery';

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

interface ReportDetail {
  reportId: string;
  publicCode: string;
  campusId: string;
  categoryLabel: string;
  stillDangerous: boolean;
  reporterRole: string | null;
  confidentiality: string;
  content: string;
  occurredAt?: string;
  occurredFrom?: string | null;
  occurredTo?: string | null;
  channel: string;
  className: string | null;
  suggestedClassNames: string[];
  mergedIntoIncidentId: string | null;
  redacted: boolean;
  canViewEvidence: boolean;
  evidenceList: Array<{ evidenceId: string; fileType: string; sizeBytes: number; scanStatus: string }>;
}

const REPORTER_ROLE_LABEL: Record<string, string> = {
  victim: 'Người trực tiếp gặp sự cố',
  witness: 'Người chứng kiến',
  parent_on_behalf: 'Phụ huynh báo giúp con',
  staff: 'Giáo viên/nhân viên trường',
  other: 'Khác'
};

const CHANNEL_LABEL: Record<string, string> = {
  public_web: 'Website công khai'
};

const PRIORITY_OPTIONS = ['P0', 'P1', 'P2', 'P3'];
type SortKey = 'reportId' | 'campusId' | 'categoryLabel' | 'occurredAt';

export default function PendingReportsPage() {
  // Đọc `?q=` từ URL để lọc sẵn xuống đúng 1 tin báo cụ thể — dùng khi
  // chuông thông báo nội bộ (NotificationBell.tsx) điều hướng tới đây (chưa
  // có trang chi tiết riêng cho tin báo, bảng lọc này là điểm đến gần nhất
  // có thể "trỏ tới đúng mục" thay vì chỉ mở trang danh sách trống thông
  // tin). Chỉ đọc 1 LẦN lúc mount — không đồng bộ 2 chiều với URL sau đó.
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<PendingReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [priorityTarget, setPriorityTarget] = useState<PendingReportItem | null>(null);
  const [priorityChoice, setPriorityChoice] = useState('');
  const [detailItem, setDetailItem] = useState<ReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [searchText, setSearchText] = useState(() => searchParams.get('q') || '');
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
    setError('');
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

  const openDetail = (item: PendingReportItem) => {
    setDetailError('');
    setDetailLoading(true);
    setDetailItem(null);
    api
      .get<ReportDetail>(`/api/safety/reports/${item.reportId}`)
      .then(setDetailItem)
      .catch((e: any) => setDetailError(e.message || 'Không tải được chi tiết tin báo.'))
      .finally(() => setDetailLoading(false));
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
    <>
      <PageHeader title="Tin báo chờ xử lý" icon={<ReportProblemIcon />} />

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
              {/* Cột ngày/giờ đưa lên ĐẦU bảng — Sin yêu cầu 2026-09-21, áp
                  dụng đồng loạt cả 2 module (An toàn + Lịch công tác). */}
              <TableCell>
                <TableSortLabel active={sortKey === 'occurredAt'} direction={sortKey === 'occurredAt' ? sortDir : 'desc'} onClick={() => handleSort('occurredAt')}>
                  Thời gian
                </TableSortLabel>
              </TableCell>
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
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                Hành động
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Không có tin báo nào đang chờ xử lý.
                </TableCell>
              </TableRow>
            )}
            {paged.map((it) => (
              <TableRow key={it.reportId} hover>
                <TableCell>{it.occurredAt ? new Date(it.occurredAt).toLocaleString('vi-VN') : '—'}</TableCell>
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
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                    <Tooltip title="Xem chi tiết">
                      <IconButton
                        size="small"
                        onClick={() => openDetail(it)}
                        sx={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 2,
                          color: '#475569',
                          '&:hover': { bgcolor: '#f1f5f9', borderColor: '#cbd5e1' }
                        }}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={creatingId === it.reportId}
                      onClick={() => openPriorityDialog(it)}
                      sx={{ bgcolor: '#2563eb', whiteSpace: 'nowrap', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none' }}
                    >
                      Chuyển thành hồ sơ
                    </Button>
                  </Stack>
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

      <Dialog open={Boolean(detailItem) || detailLoading || Boolean(detailError)} onClose={() => { setDetailItem(null); setDetailError(''); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Chi tiết tin báo {detailItem?.publicCode}</DialogTitle>
        <DialogContent dividers>
          {detailLoading && <Typography color="text.secondary">Đang tải...</Typography>}
          {detailError && <Alert severity="error">{detailError}</Alert>}
          {detailItem && (
            <Stack spacing={1.5}>
              {detailItem.redacted && (
                <Alert severity="warning">Bạn không đủ quyền xem đầy đủ chi tiết tin báo này (mức bí mật vượt trần của vai trò bạn) — chỉ hiện thông tin rút gọn.</Alert>
              )}
              {detailItem.mergedIntoIncidentId && (
                <Alert severity="info">Tin báo này đã được gộp vào hồ sơ <b>{detailItem.mergedIntoIncidentId}</b> — không còn ở trạng thái chờ xử lý.</Alert>
              )}
              <Box>
                <Typography variant="caption" color="text.secondary">Cơ sở</Typography>
                <Typography>{CAMPUS_LABEL[detailItem.campusId] || detailItem.campusId}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Nhóm sự cố</Typography>
                <Typography>{detailItem.categoryLabel}{detailItem.stillDangerous && <Chip size="small" label="Còn nguy hiểm" sx={{ ml: 1, bgcolor: '#fef2f2', color: '#dc2626', fontWeight: 700 }} />}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Nội dung sự việc</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{detailItem.content || <em>(không có nội dung)</em>}</Typography>
              </Box>
              <Stack direction="row" spacing={4}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Lớp liên quan</Typography>
                  <Typography>{detailItem.className || '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Người báo tin là</Typography>
                  <Typography>{detailItem.reporterRole ? REPORTER_ROLE_LABEL[detailItem.reporterRole] || detailItem.reporterRole : '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Kênh gửi</Typography>
                  <Typography>{CHANNEL_LABEL[detailItem.channel] || detailItem.channel}</Typography>
                </Box>
              </Stack>
              {detailItem.suggestedClassNames?.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Lớp gợi ý thêm</Typography>
                  <Typography>{detailItem.suggestedClassNames.join(', ')}</Typography>
                </Box>
              )}
              <Stack direction="row" spacing={4}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Xảy ra từ</Typography>
                  <Typography>{detailItem.occurredFrom ? new Date(detailItem.occurredFrom).toLocaleString('vi-VN') : '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Đến</Typography>
                  <Typography>{detailItem.occurredTo ? new Date(detailItem.occurredTo).toLocaleString('vi-VN') : '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Thời điểm gửi</Typography>
                  <Typography>{detailItem.occurredAt ? new Date(detailItem.occurredAt).toLocaleString('vi-VN') : '—'}</Typography>
                </Box>
              </Stack>
              <EvidenceGallery evidenceList={detailItem.evidenceList} canView={detailItem.canViewEvidence} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDetailItem(null); setDetailError(''); }}>Đóng</Button>
          {detailItem && !detailItem.mergedIntoIncidentId && (
            <Button
              variant="contained"
              onClick={() => {
                openPriorityDialog({
                  reportId: detailItem.reportId,
                  publicCode: detailItem.publicCode,
                  campusId: detailItem.campusId,
                  categoryCode: '',
                  categoryLabel: detailItem.categoryLabel,
                  stillDangerous: detailItem.stillDangerous,
                  content: detailItem.content,
                  className: detailItem.className,
                  redacted: detailItem.redacted
                });
                setDetailItem(null);
              }}
            >
              Chuyển thành hồ sơ
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
