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
          color: '#ef4444',
          bgcolor: '#fef2f2',
          border: '1px solid #fecaca',
          label: 'Khẩn cấp'
        };
      case 'HIGH':
        return {
          icon: <ErrorOutlineIcon fontSize="small" />,
          color: '#f97316',
          bgcolor: '#fff7ed',
          border: '1px solid #fed7aa',
          label: 'Mức cao'
        };
      case 'WARNING':
        return {
          icon: <WarningAmberIcon fontSize="small" />,
          color: '#f59e0b',
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
              sx={{ fontWeight: 600, fontSize: '0.8125rem', borderRadius: 2 }}
            >
              Chạy quét cảnh báo
            </Button>
            <Button
              variant="contained"
              startIcon={<TuneIcon />}
              onClick={() => setRulesOpen(true)}
              sx={{ bgcolor: '#2563eb', color: '#fff', '&:hover': { bgcolor: '#1d4ed8' }, fontWeight: 700, fontSize: '0.8125rem', borderRadius: 2 }}
            >
              Cấu hình quy tắc động
            </Button>
          </Box>
        }
      />

      {toast && (
        <Alert severity="success" onClose={() => setToast('')} sx={{ mb: 2.5, borderRadius: 2 }}>
          {toast}
        </Alert>
      )}

      {/* Segmented Tabs */}
      <Box
        sx={{
          display: 'inline-flex',
          bgcolor: '#f1f5f9',
          p: '4px',
          borderRadius: 2,
          border: '1px solid #e2e8f0',
          mb: 3
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          TabIndicatorProps={{ style: { display: 'none' } }}
          sx={{
            minHeight: 34,
            '& .MuiTab-root': {
              minHeight: 34,
              py: 0.5,
              px: 2,
              borderRadius: 1.5,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8125rem',
              color: '#64748b',
              transition: 'all 0.15s ease',
              '&.Mui-selected': {
                bgcolor: '#ffffff',
                color: '#2563eb',
                fontWeight: 700,
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)'
              }
            }
          }}
        >
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>Cần xử lý</span>
                {openCount > 0 && (
                  <Chip
                    size="small"
                    label={openCount}
                    sx={{ height: 18, bgcolor: '#ef4444', color: '#fff', fontWeight: 700, fontSize: '0.65rem' }}
                  />
                )}
              </Box>
            }
          />
          <Tab label="Đã giải quyết" />
          <Tab label="Tất cả cảnh báo" />
        </Tabs>
      </Box>

      {/* Alert List */}
      <Stack spacing={2}>
        {filtered.length === 0 ? (
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none', bgcolor: '#ffffff' }}>
            <CardContent sx={{ py: 6, textAlign: 'center' }}>
              <CheckCircleOutlineIcon sx={{ fontSize: '3.2rem', color: '#10b981', mb: 1 }} />
              <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a' }}>
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
                  borderLeft: `4px solid ${sp.color}`,
                  borderRadius: 3,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)',
                  bgcolor: '#ffffff'
                }}
              >
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        icon={sp.icon}
                        label={sp.label}
                        size="small"
                        sx={{
                          bgcolor: sp.bgcolor,
                          color: sp.color,
                          border: sp.border,
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          height: 24
                        }}
                      />
                      <Chip
                        label={x.targetName || x.targetId || 'Lớp học'}
                        size="small"
                        sx={{
                          bgcolor: '#f8fafc',
                          color: '#334155',
                          border: '1px solid #e2e8f0',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          height: 24
                        }}
                      />
                      <Typography variant="subtitle2" fontWeight={700} color="#0f172a">
                        {x.targetType === 'STUDENT' ? 'Cảnh báo học sinh' : x.targetType === 'CLASS' ? 'Cảnh báo tập thể lớp' : 'Cảnh báo Classroom'}
                      </Typography>
                    </Box>

                    {!x.resolved ? (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<DoneAllIcon sx={{ fontSize: 16 }} />}
                        onClick={() => {
                          setResolveTarget(x);
                          setResolutionText('Đã chỉ đạo giáo viên bộ môn và chủ nhiệm đôn đốc');
                        }}
                        sx={{
                          bgcolor: '#2563eb',
                          color: '#ffffff',
                          '&:hover': { bgcolor: '#1d4ed8' },
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          borderRadius: 2,
                          textTransform: 'none',
                          py: 0.6,
                          px: 1.75
                        }}
                      >
                        Tiếp nhận & Xử lý
                      </Button>
                    ) : (
                      <Chip
                        icon={<CheckCircleOutlineIcon sx={{ fontSize: '14px !important' }} />}
                        label="Đã giải quyết"
                        size="small"
                        sx={{
                          bgcolor: '#ecfdf5',
                          color: '#059669',
                          border: '1px solid #a7f3d0',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          height: 24
                        }}
                      />
                    )}
                  </Box>

                  {/* Lý do cảnh báo */}
                  <Typography variant="body2" fontWeight={600} color="#0f172a" sx={{ mb: 1.5 }}>
                    {x.reason || x.message}
                  </Typography>

                  {/* Bằng chứng & Số liệu chứng minh */}
                  {x.evidence && (
                    <Box sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: 2, border: '1px solid #e2e8f0', mb: 1.5 }}>
                      <Typography variant="caption" fontWeight={700} color="#64748b" sx={{ display: 'block', mb: 0.75, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        Số liệu chứng minh (Evidence)
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6, sm: 3 }}>
                          <Typography variant="caption" color="text.secondary">Chỉ số đo lường:</Typography>
                          <Typography variant="body2" fontWeight={600} color="#0f172a">{x.evidence.metricName}</Typography>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                          <Typography variant="caption" color="text.secondary">Giá trị thực tế:</Typography>
                          <Typography variant="body2" fontWeight={700} color="error.main">{x.evidence.actualValue}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="caption" color="text.secondary">Chi tiết:</Typography>
                          <Typography variant="body2" color="#334155">{x.evidence.details}</Typography>
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
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.125rem' }}>Xử Lý & Đóng Cảnh Báo Điều Hành</DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
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
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setResolveTarget(null)} sx={{ textTransform: 'none', color: '#64748b' }}>Hủy</Button>
          <Button variant="contained" onClick={handleResolve} sx={{ bgcolor: '#2563eb', color: '#ffffff', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
            Lưu & Đóng cảnh báo
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Cấu hình Dynamic Rules */}
      <Dialog open={rulesOpen} onClose={() => setRulesOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.125rem' }}>Cấu Hình Quy Tắc Cảnh Báo Sớm (Dynamic Rules)</DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Ban Giám hiệu có thể điều chỉnh ngưỡng phát hiện tự động để cảnh báo phù hợp với quy mô và tiêu chuẩn thực tế của trường:
          </Typography>

          <Stack spacing={2.5}>
            {rules.map((rule) => (
              <Box key={rule.id} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#f8fafc' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700} color="#0f172a">
                    {rule.name}
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={rule.enabled}
                        onChange={(e) => handleUpdateRule(rule.id, rule.threshold, e.target.checked)}
                        color="primary"
                      />
                    }
                    label={<Typography sx={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>{rule.enabled ? 'Đang bật' : 'Tạm tắt'}</Typography>}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  {rule.description}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ minWidth: 140, color: '#0f172a' }}>
                    Ngưỡng: {rule.threshold} {rule.unit}
                  </Typography>
                  <Slider
                    value={rule.threshold}
                    min={1}
                    max={rule.unit === '%' ? 100 : 30}
                    disabled={!rule.enabled}
                    onChange={(_, v) => handleUpdateRule(rule.id, v as number, rule.enabled)}
                    sx={{ color: '#2563eb' }}
                  />
                </Box>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button variant="contained" onClick={() => setRulesOpen(false)} sx={{ bgcolor: '#2563eb', color: '#ffffff', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
            Hoàn tất cấu hình
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}