import { useEffect, useState, useMemo } from 'react';
import {
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
  Box,
  Chip,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Grid,
  Slider,
  Switch,
  FormControlLabel
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActiveRounded';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DoneAllIcon from '@mui/icons-material/DoneAllRounded';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineRounded';
import WarningAmberIcon from '@mui/icons-material/WarningAmberRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TuneIcon from '@mui/icons-material/TuneRounded';
import PlayArrowIcon from '@mui/icons-material/PlayArrowRounded';

import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

export default function AlertsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState(0);
  const [resolveTarget, setResolveTarget] = useState<any>(null);
  const [resolutionText, setResolutionText] = useState('Đã kiểm tra và xử lý cùng GVCN');
  const [toast, setToast] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rules, setRules] = useState<any[]>([]);
  const [evaluating, setEvaluating] = useState(false);

  const load = () => {
    api<{ items: any[] }>('/api/alerts')
      .then((x) => {
        setItems(x.items || []);
      })
      .catch(() => setItems([]));

    api<{ rules: any[] }>('/api/alerts/rules')
      .then((x) => {
        if (x.rules) setRules(x.rules);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const handleResolve = async () => {
    if (!resolveTarget) return;
    try {
      await api(`/api/alerts/${resolveTarget.id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolution: resolutionText.trim(), notes: resolutionText.trim() })
      });
      setItems((prev) =>
        prev.map((item) =>
          item.id === resolveTarget.id
            ? { ...item, resolved: true, status: 'RESOLVED', resolution: resolutionText, resolvedBy: 'Ban Giám Hiệu' }
            : item
        )
      );
      setToast('Đã đánh dấu xử lý cảnh báo thành công!');
      setResolveTarget(null);
    } catch (e: any) {
      setToast(`Lỗi: ${e.message}`);
    }
  };

  const handleTriggerEvaluate = async () => {
    setEvaluating(true);
    try {
      const res = await api.post('/api/alerts/evaluate');
      setToast(`Quét cảnh báo hoàn tất! Đã quét ${res.scannedCourses || 0} lớp học.`);
      load();
    } catch (e: any) {
      setToast(`Lỗi: ${e.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  const handleUpdateRule = async (ruleId: string, threshold: number, enabled: boolean) => {
    try {
      await api.patch(`/api/alerts/rules/${ruleId}`, { threshold, enabled });
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, threshold, enabled } : r))
      );
    } catch (e: any) {
      alert(`Lỗi cập nhật quy tắc: ${e.message}`);
    }
  };

  const filtered = useMemo(() => {
    if (tab === 0) return items.filter((x) => !x.resolved);
    if (tab === 1) return items.filter((x) => x.resolved);
    return items;
  }, [items, tab]);

  const severityProps = (s: string) => {
    switch (s?.toUpperCase()) {
      case 'CRITICAL':
        return {
          icon: <ErrorOutlineIcon fontSize="small" />,
          color: '#dc2626',
          bgcolor: '#fef2f2',
          border: '1px solid #fecaca',
          label: 'Khẩn cấp'
        };
      case 'HIGH':
        return {
          icon: <ErrorOutlineIcon fontSize="small" />,
          color: '#ea580c',
          bgcolor: '#fff7ed',
          border: '1px solid #ffedd5',
          label: 'Mức cao'
        };
      case 'WARNING':
        return {
          icon: <WarningAmberIcon fontSize="small" />,
          color: '#d97706',
          bgcolor: '#fffbeb',
          border: '1px solid #fde68a',
          label: 'Cảnh báo'
        };
      default:
        return {
          icon: <InfoOutlinedIcon fontSize="small" />,
          color: '#2563eb',
          bgcolor: '#eff6ff',
          border: '1px solid #bfdbfe',
          label: 'Thông tin'
        };
    }
  };

  const openCount = items.filter((x) => !x.resolved).length;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Trung Tâm Cảnh Báo Sớm — Ban Giám Hiệu"
        subtitle="Hệ thống tự động phát hiện và cảnh báo theo các quy tắc động về nguy cơ học tập, tỷ lệ nộp bài và lớp học ngủ đông"
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<PlayArrowIcon />}
              onClick={handleTriggerEvaluate}
              disabled={evaluating}
            >
              {evaluating ? 'Đang quét...' : 'Quét cảnh báo ngay'}
            </Button>
            <Button
              variant="contained"
              startIcon={<TuneIcon />}
              onClick={() => setRulesOpen(true)}
            >
              Cấu hình quy tắc động
            </Button>
          </Box>
        }
      />

      {toast && (
        <Alert severity="success" onClose={() => setToast('')} sx={{ mb: 2 }}>
          {toast}
        </Alert>
      )}

      {/* Tabs */}
      <Card sx={{ mb: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>Cần xử lý</span>
                  {openCount > 0 && (
                    <Chip
                      size="small"
                      label={openCount}
                      sx={{ height: 20, bgcolor: '#ef4444', color: '#fff', fontWeight: 800, fontSize: '0.7rem' }}
                    />
                  )}
                </Box>
              }
            />
            <Tab label="Đã giải quyết" />
            <Tab label="Tất cả cảnh báo" />
          </Tabs>
        </CardContent>
      </Card>

      {/* Alert List */}
      <Stack spacing={2}>
        {filtered.length === 0 ? (
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <CardContent sx={{ py: 6, textAlign: 'center' }}>
              <CheckCircleOutlineIcon sx={{ fontSize: '3.5rem', color: '#10b981', mb: 1 }} />
              <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a' }}>
                Không có cảnh báo nào đang mở
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Toàn bộ lớp học số, tiến độ giao nộp bài và chuyên cần của trường đang ở ngưỡng an toàn
              </Typography>
            </CardContent>
          </Card>
        ) : (
          filtered.map((x) => {
            const sp = severityProps(x.severity);
            return (
              <Card
                key={x.id}
                sx={{
                  borderLeft: `6px solid ${sp.color}`,
                  borderRadius: 3,
                  border: '1px solid #e2e8f0'
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      justifyContent: 'space-between',
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      gap: 1.5,
                      mb: 1.5
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
                      <Chip
                        icon={sp.icon}
                        label={sp.label}
                        size="small"
                        sx={{
                          bgcolor: sp.bgcolor,
                          color: sp.color,
                          border: sp.border,
                          fontWeight: 800
                        }}
                      />
                      <Chip
                        label={x.targetName || x.targetId || 'Lớp học'}
                        size="small"
                        color="primary"
                        sx={{ fontWeight: 700 }}
                      />
                      <Typography variant="subtitle1" fontWeight={800} color="#0f172a">
                        {x.targetType === 'STUDENT' ? 'Cảnh báo học sinh' : x.targetType === 'CLASS' ? 'Cảnh báo tập thể lớp' : 'Cảnh báo Classroom'}
                      </Typography>
                    </Box>

                    {!x.resolved ? (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<DoneAllIcon />}
                        onClick={() => {
                          setResolveTarget(x);
                          setResolutionText('Đã chỉ đạo giáo viên bộ môn và chủ nhiệm đôn đốc');
                        }}
                        sx={{ bgcolor: '#2563eb', fontWeight: 700 }}
                      >
                        Tiếp nhận & Xử lý
                      </Button>
                    ) : (
                      <Chip
                        icon={<CheckCircleOutlineIcon />}
                        label="Đã giải quyết"
                        size="small"
                        color="success"
                        sx={{ fontWeight: 800 }}
                      />
                    )}
                  </Box>

                  {/* Lý do cảnh báo */}
                  <Typography variant="body1" fontWeight={600} color="#1e293b" sx={{ mb: 1.5 }}>
                    {x.reason || x.message}
                  </Typography>

                  {/* Bằng chứng & Số liệu chứng minh */}
                  {x.evidence && (
                    <Box sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: 2, border: '1px solid #e2e8f0', mb: 1.5 }}>
                      <Typography variant="caption" fontWeight={800} color="#475569" sx={{ display: 'block', mb: 0.5 }}>
                        SỐ LIỆU CHỨNG MINH (EVIDENCE):
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6, sm: 3 }}>
                          <Typography variant="caption" color="text.secondary">Chỉ số đo lường:</Typography>
                          <Typography variant="body2" fontWeight={700}>{x.evidence.metricName}</Typography>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                          <Typography variant="caption" color="text.secondary">Giá trị thực tế:</Typography>
                          <Typography variant="body2" fontWeight={800} color="error.main">{x.evidence.actualValue}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="caption" color="text.secondary">Chi tiết:</Typography>
                          <Typography variant="body2">{x.evidence.details}</Typography>
                        </Grid>
                      </Grid>

                    </Box>
                  )}

                  {x.principalNotes && (
                    <Box sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
                      <Typography variant="caption" color="#166534">
                        <strong>Ghi chú Ban Giám hiệu:</strong> {x.principalNotes} ({x.resolvedBy || 'Hiệu trưởng'})
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </Stack>

      {/* Dialog Xử lý Cảnh báo */}
      <Dialog open={Boolean(resolveTarget)} onClose={() => setResolveTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Xử Lý & Đóng Cảnh Báo Điều Hành</DialogTitle>
        <DialogContent dividers>
          {resolveTarget && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2">
                Đối tượng: <strong>{resolveTarget.targetName}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Nguyên nhân: {resolveTarget.reason}
              </Typography>
              <TextField
                label="Biện pháp xử lý / Ghi chú của Ban Giám hiệu"
                multiline
                rows={3}
                fullWidth
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setResolveTarget(null)}>Hủy</Button>
          <Button variant="contained" onClick={handleResolve} color="success">
            Lưu & Đóng cảnh báo
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Cấu hình Dynamic Rules */}
      <Dialog open={rulesOpen} onClose={() => setRulesOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Cấu Hình Quy Tắc Cảnh Báo Sớm (Dynamic Rules)</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Ban Giám hiệu có thể điều chỉnh ngưỡng phát hiện tự động để cảnh báo phù hợp với quy mô và tiêu chuẩn thực tế của trường:
          </Typography>

          <Stack spacing={3}>
            {rules.map((rule) => (
              <Box key={rule.id} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2.5, bgcolor: '#f8fafc' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                    {rule.name}
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={rule.enabled}
                        onChange={(e) => handleUpdateRule(rule.id, rule.threshold, e.target.checked)}
                      />
                    }
                    label={rule.enabled ? 'Đang bật' : 'Tạm tắt'}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  {rule.description}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ minWidth: 140 }}>
                    Ngưỡng: {rule.threshold} {rule.unit}
                  </Typography>
                  <Slider
                    value={rule.threshold}
                    min={1}
                    max={rule.unit === '%' ? 100 : 30}
                    disabled={!rule.enabled}
                    onChange={(_, v) => handleUpdateRule(rule.id, v as number, rule.enabled)}
                  />
                </Box>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="contained" onClick={() => setRulesOpen(false)}>
            Hoàn tất cấu hình
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}