import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Typography,
  Box,
  Stack,
  Alert,
  Button,
  Skeleton
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/VerifiedRounded';
import CloudSyncIcon from '@mui/icons-material/CloudSyncRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

export default function DataQualityPage() {
  const navigate = useNavigate();
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    api<any>('/api/data-quality')
      .then((res) => {
        setD(res || null);
      })
      .catch(() => {
        setD(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const score = d?.score ?? 0;
  const components = d?.components || {};
  const issues = d?.issues || [];

  const getScoreColor = (sc: number) => {
    if (sc >= 85) return '#10b981';
    if (sc >= 60) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <>
      <PageHeader
        title="Chất lượng Dữ liệu — THCS Giảng Võ"
        subtitle="Đánh giá độ đầy đủ, tính toàn vẹn và mức độ chuẩn hóa dữ liệu thực tế từ Google Classroom"
        icon={<VerifiedIcon />}
        action={
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            sx={{ bgcolor: '#fff', borderColor: '#cbd5e1', color: '#475569', fontWeight: 600 }}
          >
            Làm mới
          </Button>
        }
      />

      {score === 0 && !loading && (
        <Alert
          severity="info"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button
              color="primary"
              variant="contained"
              size="small"
              onClick={() => navigate('/connections')}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Đồng Bộ Classroom
            </Button>
          }
        >
          <strong>Dữ liệu thực:</strong> Điểm chất lượng được tính tự động dựa trên mức độ hoàn thiện của danh bạ, danh sách lớp và liên kết khóa học Google Classroom. Hiện tại chưa có dữ liệu đồng bộ.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Overall Score Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%', borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Chỉ số chất lượng toàn diện
              </Typography>
              <Box sx={{ my: 3 }}>
                {loading ? (
                  <Skeleton variant="circular" width={80} height={80} sx={{ mx: 'auto' }} />
                ) : (
                  <>
                    <Typography sx={{ fontSize: '3.5rem', fontWeight: 800, color: getScoreColor(score), lineHeight: 1, letterSpacing: '-0.03em' }}>
                      {score}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#71717a', mt: 0.5 }}>
                      / 100 Điểm
                    </Typography>
                  </>
                )}
              </Box>
              <LinearProgress
                variant="determinate"
                value={score}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: '#e4e4e7',
                  '& .MuiLinearProgress-bar': { bgcolor: getScoreColor(score) }
                }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontSize: '0.8125rem' }}>
                {score >= 85
                  ? 'Dữ liệu trường học đạt chuẩn độ chính xác cao'
                  : score > 0
                  ? 'Dữ liệu đang được đồng bộ và cần bổ sung ánh xạ'
                  : 'Chưa có dữ liệu để đánh giá chất lượng'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Component Metrics Card */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: '100%', borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#09090b', mb: 2.5, letterSpacing: '-0.01em' }}>
                Phân tích thành phần chất lượng thực tế
              </Typography>
              <Stack spacing={2.5}>
                {[
                  { label: 'Độ đầy đủ Danh sách Học viên (Roster Completeness)', key: 'completeness' },
                  { label: 'Tỷ lệ Ánh xạ Lớp học Hành chính (Class Mapping)', key: 'coverage' },
                  { label: 'Đồng bộ Danh bạ Người dùng (Directory Users)', key: 'directory' },
                  { label: 'Tính nhất quán và Tính toàn vẹn (Data Consistency)', key: 'consistency' }
                ].map(({ label, key }) => {
                  const val = Number(components[key] || 0);
                  return (
                    <Box key={key}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                        <Typography variant="body2" fontWeight={500} sx={{ color: '#09090b', fontSize: '0.8125rem' }}>
                          {label}
                        </Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ color: val >= 80 ? '#10b981' : '#71717a', fontSize: '0.8125rem' }}>
                          {val}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={val}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: '#e4e4e7',
                          '& .MuiLinearProgress-bar': { bgcolor: val >= 80 ? '#10b981' : '#18181b' }
                        }}
                      />
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Issues List */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#09090b', mb: 2, letterSpacing: '-0.01em' }}>
                Các điểm cần chuẩn hóa dữ liệu ({issues.length})
              </Typography>
              {issues.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Không có vấn đề bất thường nào về chất lượng dữ liệu.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={2}>
                  {issues.map((iss: any, i: number) => (
                    <Alert
                      key={iss.id || i}
                      severity={iss.severity === 'CRITICAL' ? 'error' : iss.severity === 'WARNING' ? 'warning' : 'info'}
                      sx={{ borderRadius: '6px' }}
                    >
                      <Typography variant="subtitle2" fontWeight={600}>
                        {iss.message || iss.type}
                      </Typography>
                      {iss.entity && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#71717a' }}>
                          Khóa học / Thực thể: {iss.entity}
                        </Typography>
                      )}
                    </Alert>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}