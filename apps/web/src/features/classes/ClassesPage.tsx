import { Box, Chip, Typography, LinearProgress, Button, Stack } from '@mui/material';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import CompareArrowsIcon from '@mui/icons-material/CompareArrowsRounded';
import { useNavigate } from 'react-router-dom';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function ClassesPage() {
  const navigate = useNavigate();

  return (
    <Box>
      <ApiTablePage
        title="Danh Sách Lớp Học & Sĩ Số — THCS Giảng Võ"
        subtitle="Quản lý thông tin lớp hành chính, phân bổ khối lớp, giáo viên chủ nhiệm và tiến độ học tập toàn diện"
        path="/api/classes"
        action={
          <Button
            variant="contained"
            size="small"
            startIcon={<CompareArrowsIcon />}
            onClick={() => navigate('/classes/compare')}
            sx={{
              bgcolor: '#2563eb',
              '&:hover': { bgcolor: '#1d4ed8' },
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '8px',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
            }}
          >
            Mở Bảng So Sánh Đối Đầu
          </Button>
        }
        columns={[
          {
            key: 'className',
            label: 'Tên Lớp',
            render: (val, row) => (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box sx={{ p: 0.75, borderRadius: '8px', bgcolor: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
                  <SchoolIcon sx={{ fontSize: 18 }} />
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={800} color="#0f172a">
                    {val || row.id}
                  </Typography>
                  {row.room && (
                    <Typography variant="caption" color="#64748b">
                      {row.room}
                    </Typography>
                  )}
                </Box>
              </Box>
            )
          },
          {
            key: 'grade',
            label: 'Khối',
            render: (val) => (
              <Chip
                label={val ? `Khối ${val}` : 'Chưa phân khối'}
                size="small"
                sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '0.75rem' }}
              />
            )
          },
          {
            key: 'expectedStudents',
            label: 'Sĩ số',
            render: (val) => (
              <Typography variant="body2" fontWeight={700} color="#334155">
                {val != null ? `${val} học sinh` : '—'}
              </Typography>
            )
          },
          {
            key: 'homeroomTeacher',
            label: 'Giáo viên Chủ nhiệm',
            render: (val, row) => (
              <Box>
                <Typography variant="body2" fontWeight={600} color="#0f172a">
                  {val || 'Chưa phân công'}
                </Typography>
                {row.teacherEmail && (
                  <Typography variant="caption" color="#64748b">
                    {row.teacherEmail}
                  </Typography>
                )}
              </Box>
            )
          },
          {
            key: 'completionRate',
            label: 'Tỷ lệ nộp bài',
            render: (val) => {
              const num = Number(val) || 0;
              return (
                <Box sx={{ width: 140 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                    <Typography variant="caption" fontWeight={800} color={num >= 95 ? '#059669' : num >= 90 ? '#2563eb' : '#d97706'}>
                      {num}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={num}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: '#e2e8f0',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: num >= 95 ? '#10b981' : num >= 90 ? '#2563eb' : '#f59e0b'
                      }
                    }}
                  />
                </Box>
              );
            }
          },
          {
            key: 'averageScore',
            label: 'Điểm TB',
            render: (val) => (
              <Typography variant="body2" fontWeight={800} color="#d97706">
                {val != null ? `${val} / 10` : '—'}
              </Typography>
            )
          },
          {
            key: 'id',
            label: 'Thao tác',
            render: (_val, row) => (
              <Button
                size="small"
                variant="outlined"
                startIcon={<CompareArrowsIcon sx={{ fontSize: 16 }} />}
                onClick={() => navigate('/classes/compare')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  py: 0.25,
                  px: 1,
                  color: '#2563eb',
                  borderColor: '#bfdbfe',
                  '&:hover': { bgcolor: '#eff6ff' }
                }}
              >
                So sánh
              </Button>
            )
          }
        ]}
      />
    </Box>
  );
}