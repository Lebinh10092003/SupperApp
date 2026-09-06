import { Box, Button, Card, CardContent, Typography, Stack, Chip, Divider } from '@mui/material';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { hasValidFirebaseConfig } from '../../config/firebase';

export default function LoginPage() {
  const { profile, login, loginDemo } = useAuth();

  if (profile) {
    return <Navigate to="/" replace />;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        p: 2
      }}
    >
      <Card
        sx={{
          maxWidth: 480,
          width: '100%',
          borderRadius: 4,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(30, 41, 59, 0.95)',
          backdropFilter: 'blur(16px)',
          color: '#fff'
        }}
      >
        <Box
          sx={{
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
            p: 4,
            textAlign: 'center',
            color: '#fff'
          }}
        >
          <Box sx={{ fontSize: 44, mb: 1 }}>🏫</Box>
          <Typography variant="h5" fontWeight={800} letterSpacing="-0.02em">
            School Intelligence
          </Typography>
          <Typography variant="subtitle1" sx={{ opacity: 0.9, mt: 0.5, fontWeight: 500 }}>
            Trường THCS Giảng Võ
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.75, display: 'block', mt: 0.5 }}>
            Hệ thống điều hành lớp học số & phân tích tự động
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          <Stack spacing={2.5}>
            {hasValidFirebaseConfig ? (
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={() => login()}
                sx={{
                  py: 1.5,
                  fontWeight: 700,
                  fontSize: '1rem',
                  textTransform: 'none',
                  borderRadius: 2,
                  bgcolor: '#3b82f6',
                  '&:hover': { bgcolor: '#2563eb' }
                }}
              >
                🔐 Đăng nhập bằng Google Workspace
              </Button>
            ) : null}

            <Box sx={{ textAlign: 'center' }}>
              <Chip
                label="Chế độ Xem thử / Demo Mode"
                size="small"
                sx={{
                  bgcolor: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  fontWeight: 600,
                  mb: 1.5
                }}
              />
              <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
                Chọn vai trò để trải nghiệm toàn bộ tính năng và dashboard:
              </Typography>
            </Box>

            <Stack spacing={1.2}>
              <Button
                variant="contained"
                fullWidth
                onClick={() =>
                  loginDemo(
                    'SYSTEM_SUPER_ADMIN',
                    'Lê Văn Bình (Super Admin)',
                    '09.levanbinh2003@gmail.com'
                  )
                }
                sx={{
                  py: 1.1,
                  bgcolor: '#dc2626',
                  '&:hover': { bgcolor: '#b91c1c' },
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 2
                }}
              >
                👑 Đăng nhập: SYSTEM_SUPER_ADMIN (Toàn quyền hệ thống)
              </Button>

              <Button
                variant="contained"
                fullWidth
                onClick={() =>
                  loginDemo(
                    'SCHOOL_ADMIN',
                    'Thầy Hiệu Trưởng — THCS Giảng Võ',
                    'hieutruong@thcs-giangvo.edu.vn'
                  )
                }
                sx={{
                  py: 1.1,
                  bgcolor: '#2563eb',
                  '&:hover': { bgcolor: '#1d4ed8' },
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 2
                }}
              >
                🏫 Đăng nhập: Hiệu Trưởng (Executive BI & Điều hành)
              </Button>

              <Button
                variant="outlined"
                fullWidth
                onClick={() =>
                  loginDemo(
                    'VICE_PRINCIPAL',
                    'Cô Phó Hiệu Trưởng — Phụ trách Khối 6, 7',
                    'phohieutruong@thcs-giangvo.edu.vn'
                  )
                }
                sx={{
                  py: 1.0,
                  borderColor: 'rgba(255,255,255,0.25)',
                  color: '#e2e8f0',
                  '&:hover': { borderColor: '#60a5fa', bgcolor: 'rgba(96,165,250,0.1)' },
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: 2
                }}
              >
                📋 Đăng nhập: Phó Hiệu Trưởng (Khối chuyên môn)
              </Button>

              <Button
                variant="outlined"
                fullWidth
                onClick={() =>
                  loginDemo(
                    'DEPARTMENT_HEAD',
                    'Cô Tổ Trưởng Chuyên Môn Toán - Tin',
                    'totruong.toan@thcs-giangvo.edu.vn'
                  )
                }
                sx={{
                  py: 1.0,
                  borderColor: 'rgba(255,255,255,0.25)',
                  color: '#e2e8f0',
                  '&:hover': { borderColor: '#60a5fa', bgcolor: 'rgba(96,165,250,0.1)' },
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: 2
                }}
              >
                📐 Đăng nhập: Tổ Trưởng Chuyên Môn (Bộ môn & GV trong tổ)
              </Button>

              <Button
                variant="outlined"
                fullWidth
                onClick={() =>
                  loginDemo(
                    'TEACHER',
                    'Thầy Giáo Viên Toán (6A1, 6A2)',
                    'giaovien.toan@thcs-giangvo.edu.vn'
                  )
                }
                sx={{
                  py: 1.0,
                  borderColor: 'rgba(255,255,255,0.25)',
                  color: '#e2e8f0',
                  '&:hover': { borderColor: '#60a5fa', bgcolor: 'rgba(96,165,250,0.1)' },
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: 2
                }}
              >
                👨‍🏫 Đăng nhập: Giáo Viên (Lớp học & Học sinh của tôi)
              </Button>

              <Button
                variant="outlined"
                fullWidth
                onClick={() =>
                  loginDemo(
                    'DATA_VIEWER',
                    'Thành viên Hội đồng Trường',
                    'viewer@thcs-giangvo.edu.vn'
                  )
                }
                sx={{
                  py: 1.0,
                  borderColor: 'rgba(255,255,255,0.25)',
                  color: '#94a3b8',
                  '&:hover': { borderColor: '#94a3b8', bgcolor: 'rgba(148,163,184,0.1)' },
                  fontWeight: 500,
                  textTransform: 'none',
                  borderRadius: 2
                }}
              >
                👁️ Đăng nhập: Người Xem Báo Cáo (Chỉ đọc)
              </Button>
            </Stack>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 1 }} />

            <Typography variant="caption" sx={{ color: '#64748b', textAlign: 'center', display: 'block' }}>
              Phiên bản 1.0.0 • Kết nối Google Classroom, Google Meet & Directory
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}