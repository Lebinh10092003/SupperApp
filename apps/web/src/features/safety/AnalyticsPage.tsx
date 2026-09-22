import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Typography
} from '@mui/material';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { CAMPUS_IDS, CAMPUS_LABEL } from './constants';

/**
 * Phân tích & thống kê — gộp lại các block đã có backend từ trước
 * (safety-stats.routes.ts: trend-alerts/campus-comparison/classes)
 * nhưng chưa có UI. Theo đúng mô tả gốc trong CLAUDE.md dự án: pill-tab
 * gộp nhiều khối vào 1 trang thay vì xếp chồng nhiều card riêng.
 *
 * Tab "Theo khu vực" (bản đồ Konva/bảng zone stats) đã bị BỎ HẲN theo
 * quyết định của Sin (10/09/2026) — không giữ lại khái niệm "khu vực"
 * trong app nữa, xem toàn bộ diff xoá zone ở TASKS.md.
 */

interface TrendAlert {
  campus_id: string;
  category_code: string;
  count: number;
  window_days: number;
  severity: 'critical' | 'warning';
}

function TrendAlertsPanel() {
  const [alerts, setAlerts] = useState<TrendAlert[]>([]);
  const [error, setError] = useState('');
  const [categoryLabel, setCategoryLabel] = useState<Record<string, string>>({});

  useEffect(() => {
    api
      .get<{ alerts: TrendAlert[] }>('/api/safety/stats/trend-alerts')
      .then((res) => setAlerts(res.alerts || []))
      .catch((e: any) => setError(e.message || 'Không tải được cảnh báo xu hướng.'));
    api
      .get<{ code: string; label: string }[]>('/api/safety/categories')
      .then((cats) => setCategoryLabel(Object.fromEntries((cats || []).map((c) => [c.code, c.label]))))
      .catch(() => setCategoryLabel({}));
  }, []);

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!error && alerts.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Không có cảnh báo xu hướng nào đang mở.
        </Typography>
      )}
      <Stack spacing={1.5}>
        {alerts.map((a, i) => (
          <Paper
            key={i}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: a.severity === 'critical' ? '#fecaca' : '#fde68a',
              bgcolor: a.severity === 'critical' ? '#fef2f2' : '#fffbeb'
            }}
          >
            <Typography variant="body2" fontWeight={700}>
              {CAMPUS_LABEL[a.campus_id] || a.campus_id} — {categoryLabel[a.category_code] || a.category_code}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {a.count} vụ trong {a.window_days} ngày gần đây — mức {a.severity === 'critical' ? 'nghiêm trọng' : 'cảnh báo'}
            </Typography>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}

function CampusComparisonPanel() {
  // Backend (`safety-stats.routes.ts` /stats/campus-comparison) đã nhận
  // sẵn `fromMonth`/`toMonth` từ đầu — trước đây chỉ CHƯA nối vào UI (Sin
  // phản hồi 2026-09-11: "thống kê cảnh báo an toàn... có sort và check
  // theo thời gian được không, đó là thông tin quan trọng").
  const [fromMonth, setFromMonth] = useState('');
  const [toMonth, setToMonth] = useState('');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const load = () => {
    const qs = new URLSearchParams();
    if (fromMonth) qs.set('fromMonth', fromMonth);
    if (toMonth) qs.set('toMonth', toMonth);
    api
      .get(`/api/safety/stats/campus-comparison${qs.toString() ? `?${qs}` : ''}`)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e: any) => setError(e.message || 'Không tải được so sánh cơ sở.'));
  };

  useEffect(load, []);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ sm: 'flex-end' }}>
        <TextField
          label="Từ tháng"
          type="month"
          size="small"
          value={fromMonth}
          onChange={(e) => setFromMonth(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        />
        <TextField
          label="Đến tháng"
          type="month"
          size="small"
          value={toMonth}
          onChange={(e) => setToMonth(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        />
        <Button variant="outlined" size="small" onClick={load} sx={{ height: 40 }}>
          Xem
        </Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!data && !error ? null : (
        <CampusComparisonTable data={data} />
      )}
    </Box>
  );
}

function CampusComparisonTable({ data }: { data: any }) {
  if (!data) return null;
  const campusIds = Object.keys(data.campuses || {});

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        {data.from_month} → {data.to_month} · {data.disclaimer}
      </Typography>
      <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Cơ sở</TableCell>
              <TableCell>Tổng số vụ</TableCell>
              <TableCell>Tỷ lệ P0/P1</TableCell>
              <TableCell>So với tháng trước</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {campusIds.map((cid) => {
              const entry = data.campuses[cid];
              return (
                <TableRow key={cid}>
                  <TableCell>
                    {CAMPUS_LABEL[cid] || cid}
                    {data.ranking?.highest_p0_p1_rate_campus === cid && (
                      <Chip size="small" label="Cao nhất P0/P1" sx={{ ml: 1, bgcolor: '#fef2f2', color: '#dc2626' }} />
                    )}
                  </TableCell>
                  <TableCell>{entry.total_count}</TableCell>
                  <TableCell>{entry.p0_p1_rate != null ? `${(entry.p0_p1_rate * 100).toFixed(0)}%` : '—'}</TableCell>
                  <TableCell>
                    {entry.compare_to_previous_month ? (
                      <Chip
                        size="small"
                        label={`${entry.compare_to_previous_month.delta > 0 ? '+' : ''}${entry.compare_to_previous_month.delta}`}
                        sx={{
                          bgcolor: entry.compare_to_previous_month.direction === 'worsened' ? '#fef2f2' : '#f0fdf4',
                          color: entry.compare_to_previous_month.direction === 'worsened' ? '#dc2626' : '#15803d'
                        }}
                      />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}


// value rỗng '' cho "Toàn bộ thời gian" khiến MUI Select không hiện được
// nhãn đã chọn (coi "" là "chưa chọn gì") — dùng sentinel 'all' thay vì
// rỗng, chỉ bỏ qua khi build query string.
const RANGE_DAYS_OPTIONS = [
  { value: '7', label: '7 ngày gần đây' },
  { value: '30', label: '30 ngày gần đây' },
  { value: '90', label: '90 ngày gần đây' },
  { value: '365', label: '365 ngày gần đây' },
  { value: 'all', label: 'Toàn bộ thời gian' }
];

function ClassStatsPanel() {
  const [campusId, setCampusId] = useState('MAIN_CAMPUS');
  const [reason, setReason] = useState('');
  // Backend (`/stats/classes`) đã nhận sẵn `rangeDays` từ đầu — trước đây
  // CHƯA nối vào UI (Sin phản hồi 2026-09-11: cần lọc/kiểm tra theo thời
  // gian ở phần thống kê).
  const [rangeDays, setRangeDays] = useState('30');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const load = () => {
    const qs = new URLSearchParams({ campusId });
    if (reason.trim()) qs.set('reason', reason.trim());
    if (rangeDays && rangeDays !== 'all') qs.set('rangeDays', rangeDays);
    api
      .get(`/api/safety/stats/classes?${qs}`)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e: any) => setError(e.message || 'Không tải được thống kê theo lớp.'));
  };

  useEffect(load, [campusId, rangeDays]);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ sm: 'flex-end' }}>
        <TextField select size="small" label="Cơ sở" value={campusId} onChange={(e) => setCampusId(e.target.value)} sx={{ minWidth: 200 }}>
          {CAMPUS_IDS.map((c) => (
            <MenuItem key={c} value={c}>
              {CAMPUS_LABEL[c]}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Khoảng thời gian" value={rangeDays} onChange={(e) => setRangeDays(e.target.value)} sx={{ minWidth: 190 }}>
          {RANGE_DAYS_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Lý do xem (bắt buộc với Trực ban/Tổ trưởng)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          sx={{ minWidth: 280, flex: 1 }}
        />
        <Button variant="outlined" size="small" onClick={load} sx={{ height: 40 }}>
          Xem
        </Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {data && (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Lớp</TableCell>
                <TableCell>Số vụ</TableCell>
                <TableCell>Cảnh báo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data.classes || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ color: 'text.secondary' }}>
                    Không có dữ liệu.
                  </TableCell>
                </TableRow>
              )}
              {(data.classes || []).map((c: any) => (
                <TableRow key={c.class_name}>
                  <TableCell>{c.class_name}</TableCell>
                  <TableCell>{c.total_count}</TableCell>
                  <TableCell>{c.severity_flag && <Chip size="small" label="Cần chú ý" sx={{ bgcolor: '#fef2f2', color: '#dc2626' }} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState(0);

  return (
    <>
      <PageHeader title="Phân tích & thống kê" icon={<InsightsRoundedIcon />} />

      <Paper sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none', p: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Đề xuất xử lý" />
          <Tab label="So sánh cơ sở" />
          <Tab label="Theo lớp học" />
        </Tabs>
        {tab === 0 && <TrendAlertsPanel />}
        {tab === 1 && <CampusComparisonPanel />}
        {tab === 2 && <ClassStatsPanel />}
      </Paper>
    </>
  );
}
