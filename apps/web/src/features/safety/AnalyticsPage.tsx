import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
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

  useEffect(() => {
    api
      .get<{ alerts: TrendAlert[] }>('/api/safety/stats/trend-alerts')
      .then((res) => setAlerts(res.alerts || []))
      .catch((e: any) => setError(e.message || 'Không tải được cảnh báo xu hướng.'));
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
              {CAMPUS_LABEL[a.campus_id] || a.campus_id} — {a.category_code}
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
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/api/safety/stats/campus-comparison')
      .then(setData)
      .catch((e: any) => setError(e.message || 'Không tải được so sánh cơ sở.'));
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
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


function ClassStatsPanel() {
  const [campusId, setCampusId] = useState('MAIN_CAMPUS');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/api/safety/stats/classes?campusId=${encodeURIComponent(campusId)}`)
      .then(setData)
      .catch((e: any) => setError(e.message || 'Không tải được thống kê theo lớp.'));
  }, [campusId]);

  return (
    <Box>
      <TextField select size="small" label="Cơ sở" value={campusId} onChange={(e) => setCampusId(e.target.value)} sx={{ minWidth: 200, mb: 2 }}>
        {CAMPUS_IDS.map((c) => (
          <MenuItem key={c} value={c}>
            {CAMPUS_LABEL[c]}
          </MenuItem>
        ))}
      </TextField>
      {error && <Alert severity="error">{error}</Alert>}
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
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader title="Phân tích & thống kê" subtitle="Xu hướng, so sánh cơ sở, thống kê theo lớp học" icon={<InsightsRoundedIcon />} />

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
    </Box>
  );
}
