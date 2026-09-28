/**
 * WeeklySheetPage.tsx — "Lịch công tác tuần" (bổ sung 2026-09-28). Mô
 * phỏng ĐÚNG bảng Google Sheet thầy Phương/thầy Sơn đang dùng hằng tuần
 * (Thứ/ngày | Thời gian | Nội dung công việc | Địa điểm | Người thực
 * hiện, sửa trực tiếp trên ô) — CỐ Ý KHÔNG dùng chung
 * ltc_events/ltc_tasks (module Sự kiện/Công việc có sẵn): phần đó có quy
 * trình duyệt + dò trùng lịch dành cho mô hình toàn trường, quá nặng so
 * với nhu cầu thật (Sin: "nếu app còn không đầy đủ bằng gg sheet thì 2
 * thầy còn không có nhu cầu chuyển sang dùng").
 *
 * XEM: mọi tài khoản đăng nhập được (server không chặn) — SỬA: chỉ email
 * trong `WEEKLY_SHEET_EDITOR_EMAILS` (server tự chặn, `isEditor` trong
 * response cho biết actor hiện tại có được sửa hay không).
 *
 * Nút "Kéo dữ liệu từ Google Sheet" (Sin yêu cầu, chưa làm ở bản này) —
 * cần link Google Sheet thật + xin thêm quyền đọc Sheets API, để làm đợt
 * sau khi có link thật.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, Typography, IconButton, Button, TextField, Tooltip, CircularProgress, Alert, Snackbar } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import TodayIcon from '@mui/icons-material/Today';
import { api } from '../../services/api';

interface WeeklySheetRow {
  id: string;
  rowDate: string;
  timeLabel: string;
  content: string;
  location: string;
  people: string;
  sortOrder: number;
}

interface WeekResponse {
  weekStart: string;
  weekEnd: string;
  rows: WeeklySheetRow[];
  isEditor: boolean;
}

const DAY_LABELS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mondayOfClient(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d!));
  const day = utc.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + diff);
  return toDateOnly(utc);
}

function addDaysClient(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d!));
  utc.setUTCDate(utc.getUTCDate() + days);
  return toDateOnly(utc);
}

function formatVi(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

type EditingCell = { rowId: string; field: 'timeLabel' | 'content' | 'location' | 'people' } | null;

const CELL_SX = { p: 1, fontSize: 13.5, lineHeight: 1.5, verticalAlign: 'top', border: '1px solid #e2e8f0', cursor: 'pointer' as const, minWidth: 0 };

export default function WeeklySheetPage() {
  const [weekStart, setWeekStart] = useState(() => mondayOfClient(toDateOnly(new Date())));
  const [data, setData] = useState<WeekResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback((ws: string) => {
    setLoading(true);
    setError('');
    api
      .get<WeekResponse>(`/api/work-schedule/weekly-sheet?weekStart=${ws}`)
      .then(setData)
      .catch((e: any) => setError(e.message || 'Không tải được lịch công tác tuần.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(weekStart);
  }, [weekStart, load]);

  const weekEnd = data?.weekEnd || addDaysClient(weekStart, 6);
  const isEditor = !!data?.isEditor;

  const rowsByDate = useMemo(() => {
    const map = new Map<string, WeeklySheetRow[]>();
    for (let i = 0; i < 7; i++) map.set(addDaysClient(weekStart, i), []);
    for (const r of data?.rows || []) {
      if (!map.has(r.rowDate)) map.set(r.rowDate, []);
      map.get(r.rowDate)!.push(r);
    }
    return map;
  }, [data, weekStart]);

  const startCellEdit = (row: WeeklySheetRow, field: NonNullable<EditingCell>['field']) => {
    if (!isEditor) return;
    setEditingCell({ rowId: row.id, field });
    setDraft(row[field]);
  };

  const commitCellEdit = async () => {
    if (!editingCell) return;
    const { rowId, field } = editingCell;
    setEditingCell(null);
    const row = (data?.rows || []).find((r) => r.id === rowId);
    if (!row || row[field] === draft) return;
    setSaving(true);
    try {
      const updated = await api.patch<WeeklySheetRow>(`/api/work-schedule/weekly-sheet/rows/${rowId}`, { [field]: draft });
      setData((prev) => (prev ? { ...prev, rows: prev.rows.map((r) => (r.id === rowId ? updated : r)) } : prev));
    } catch (e: any) {
      setToast(e.message || 'Lưu thất bại, thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const addRow = async (dateStr: string) => {
    const existing = rowsByDate.get(dateStr) || [];
    const nextOrder = existing.length ? Math.max(...existing.map((r) => r.sortOrder)) + 1 : 0;
    setSaving(true);
    try {
      const row = await api.post<WeeklySheetRow>('/api/work-schedule/weekly-sheet/rows', { rowDate: dateStr, sortOrder: nextOrder });
      setData((prev) => (prev ? { ...prev, rows: [...prev.rows, row] } : prev));
      setEditingCell({ rowId: row.id, field: 'content' });
      setDraft('');
    } catch (e: any) {
      setToast(e.message || 'Thêm dòng thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (row: WeeklySheetRow) => {
    if (!window.confirm('Xoá dòng này?')) return;
    setSaving(true);
    try {
      await api.delete(`/api/work-schedule/weekly-sheet/rows/${row.id}`);
      setData((prev) => (prev ? { ...prev, rows: prev.rows.filter((r) => r.id !== row.id) } : prev));
    } catch (e: any) {
      setToast(e.message || 'Xoá thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const copyFromPreviousWeek = async () => {
    const prevWeek = addDaysClient(weekStart, -7);
    if (!window.confirm(`Sao chép toàn bộ nội dung tuần ${formatVi(prevWeek)}-${formatVi(addDaysClient(prevWeek, 6))} sang tuần này?`)) return;
    setSaving(true);
    try {
      const result = await api.post<{ copied: number }>('/api/work-schedule/weekly-sheet/copy-week', { fromWeekStart: prevWeek, toWeekStart: weekStart });
      if (result.copied === 0) {
        setToast('Tuần trước chưa có dữ liệu để sao chép.');
      } else {
        load(weekStart);
        setToast(`Đã sao chép ${result.copied} dòng từ tuần trước.`);
      }
    } catch (e: any) {
      setToast(e.message || 'Sao chép thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const renderCell = (row: WeeklySheetRow, field: NonNullable<EditingCell>['field'], width?: string) => {
    const isEditing = editingCell?.rowId === row.id && editingCell.field === field;
    if (isEditing) {
      return (
        <Box component="td" sx={{ ...CELL_SX, p: 0.5, cursor: 'default' }} style={{ width }}>
          <TextField
            autoFocus
            multiline
            fullWidth
            size="small"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitCellEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                (e.target as HTMLElement).blur();
              }
              if (e.key === 'Escape') setEditingCell(null);
            }}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: 13.5, background: '#fffbeb' } }}
          />
        </Box>
      );
    }
    const value = row[field];
    return (
      <Box
        component="td"
        sx={{ ...CELL_SX, whiteSpace: 'pre-wrap', '&:hover': isEditor ? { background: '#fffbeb' } : undefined }}
        style={{ width }}
        onClick={() => startCellEdit(row, field)}
      >
        {value || (isEditor ? <span style={{ color: '#cbd5e1' }}>—</span> : '')}
      </Box>
    );
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Lịch công tác tuần
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatVi(weekStart)} – {formatVi(weekEnd)}
            {!isEditor && !loading && ' · Chỉ xem'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Tuần trước">
            <IconButton onClick={() => setWeekStart((w) => addDaysClient(w, -7))}>
              <ChevronLeftIcon />
            </IconButton>
          </Tooltip>
          <Button size="small" startIcon={<TodayIcon />} onClick={() => setWeekStart(mondayOfClient(toDateOnly(new Date())))} sx={{ textTransform: 'none' }}>
            Tuần này
          </Button>
          <Tooltip title="Tuần sau">
            <IconButton onClick={() => setWeekStart((w) => addDaysClient(w, 7))}>
              <ChevronRightIcon />
            </IconButton>
          </Tooltip>
          {isEditor && (
            <Button variant="outlined" size="small" startIcon={<ContentCopyIcon />} onClick={copyFromPreviousWeek} disabled={saving} sx={{ textTransform: 'none', ml: 1 }}>
              Sao chép từ tuần trước
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <Box component="thead">
              <Box component="tr" sx={{ background: '#fef9c3' }}>
                <Box component="th" sx={{ ...CELL_SX, cursor: 'default', fontWeight: 800, width: 110 }}>Thứ/ngày</Box>
                <Box component="th" sx={{ ...CELL_SX, cursor: 'default', fontWeight: 800, width: 90 }}>Thời gian</Box>
                <Box component="th" sx={{ ...CELL_SX, cursor: 'default', fontWeight: 800 }}>Nội dung công việc</Box>
                <Box component="th" sx={{ ...CELL_SX, cursor: 'default', fontWeight: 800, width: 160 }}>Địa điểm</Box>
                <Box component="th" sx={{ ...CELL_SX, cursor: 'default', fontWeight: 800, width: 200 }}>Người thực hiện</Box>
                {isEditor && <Box component="th" sx={{ ...CELL_SX, cursor: 'default', width: 40 }} />}
              </Box>
            </Box>
            <Box component="tbody">
              {Array.from({ length: 7 }, (_, i) => addDaysClient(weekStart, i)).map((dateStr, dayIdx) => {
                const rows = rowsByDate.get(dateStr) || [];
                const rowCount = Math.max(rows.length, 1);
                return (
                  <Box component="tr" key={dateStr} sx={{ display: 'contents' }}>
                    {rows.length === 0 ? (
                      <>
                        <Box component="tr" sx={{ display: 'table-row' }}>
                          <Box component="td" rowSpan={1} sx={{ ...CELL_SX, cursor: 'default', fontWeight: 700, background: '#f8fafc' }}>
                            {DAY_LABELS[dayIdx]}
                            <Typography variant="caption" display="block" color="text.secondary">
                              {formatVi(dateStr)}
                            </Typography>
                          </Box>
                          <Box component="td" colSpan={isEditor ? 4 : 3} sx={{ ...CELL_SX, cursor: 'default', color: '#94a3b8' }}>
                            {isEditor ? (
                              <Button size="small" startIcon={<AddIcon />} onClick={() => addRow(dateStr)} sx={{ textTransform: 'none' }}>
                                Thêm dòng
                              </Button>
                            ) : (
                              '— Chưa có lịch —'
                            )}
                          </Box>
                        </Box>
                      </>
                    ) : (
                      rows
                        .slice()
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((row, idx) => (
                          <Box component="tr" key={row.id} sx={{ display: 'table-row' }}>
                            {idx === 0 && (
                              <Box component="td" rowSpan={rowCount} sx={{ ...CELL_SX, cursor: 'default', fontWeight: 700, background: '#f8fafc' }}>
                                {DAY_LABELS[dayIdx]}
                                <Typography variant="caption" display="block" color="text.secondary">
                                  {formatVi(dateStr)}
                                </Typography>
                                {isEditor && (
                                  <Button size="small" startIcon={<AddIcon />} onClick={() => addRow(dateStr)} sx={{ textTransform: 'none', mt: 0.5, fontSize: 11 }}>
                                    Thêm dòng
                                  </Button>
                                )}
                              </Box>
                            )}
                            {renderCell(row, 'timeLabel')}
                            {renderCell(row, 'content')}
                            {renderCell(row, 'location')}
                            {renderCell(row, 'people')}
                            {isEditor && (
                              <Box component="td" sx={{ ...CELL_SX, cursor: 'default', textAlign: 'center' }}>
                                <IconButton size="small" onClick={() => deleteRow(row)}>
                                  <DeleteOutlineIcon fontSize="small" sx={{ color: '#dc2626' }} />
                                </IconButton>
                              </Box>
                            )}
                          </Box>
                        ))
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      )}

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast('')} message={toast} />
    </Box>
  );
}
