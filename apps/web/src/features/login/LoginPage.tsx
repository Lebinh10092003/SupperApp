import { useState } from 'react';
import { Box, Button, Card, CardContent, Typography, Stack, Chip, Divider, TextField } from '@mui/material';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import GoogleIcon from '@mui/icons-material/Google';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import { useAuth } from '../../auth/AuthProvider';
import { hasValidFirebaseConfig } from '../../config/firebase';

export default function LoginPage() {
  const { profile, login, loginDemo } = useAuth();
  const [customEmail, setCustomEmail] = useState('09.levanbinh2003@gmail.com');

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) return;
    loginDemo(
      'SYSTEM_SUPER_ADMIN',
      customEmail.split('@')[0] || 'Lê Văn Bình (Super Admin)',
      customEmail.trim()
    );
  };

  if (profile) {
    return <Navigate to="/" replace />;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% -10%, #dbeafe 0%, #eff6ff 40%, #f8fafc 100%)',
        p: 2
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 460 }}>
        {/* Brand Header */}
        <Box sx={{ textAlign: 'center', mb: 3.5 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              mb: 2,
              boxShadow: '0 6px 16px rgba(37, 99, 235, 0.3)'
            }}
          >
            <SchoolIcon sx={{ fontSize: 30 }} />
          </Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.03em',
              lineHeight: 1.2
            }}
          >
            THCS Giảng Võ
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              color: '#2563eb',
              mt: 0.5,
              fontSize: '1rem',
              letterSpacing: '-0.01em'
            }}
          >
            School Intelligence Portal
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: '#64748b',
              mt: 0.5,
              fontSize: '0.84rem'
            }}
          >
            Nền tảng quản trị điều hành lớp học số & phân tích sư phạm thông minh
          </Typography>
        </Box>

        {/* Card */}
        <Card
          sx={{
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 15px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
            bgcolor: '#ffffff',
            overflow: 'hidden'
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 3.5 } }}>
            <Stack spacing={2.5}>
              <Box>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}
                >
                  Đăng nhập tài khoản
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.84rem' }}>
                  Sử dụng tài khoản Google Workspace do nhà trường cấp (@thcsgiangvo.edu.vn)
                </Typography>
              </Box>

              {hasValidFirebaseConfig ? (
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => login()}
                  startIcon={<GoogleIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    py: 1.25,
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    textTransform: 'none',
                    borderRadius: 2,
                    bgcolor: '#2563eb',
                    color: '#ffffff',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                    '&:hover': { bgcolor: '#1d4ed8' }
                  }}
                >
                  Đăng nhập với Google Workspace
                </Button>
              ) : (
                <Box component="form" onSubmit={handleCustomLogin} sx={{ mt: 0.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Email tài khoản Google"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="09.levanbinh2003@gmail.com"
                    sx={{ mb: 1.25 }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    startIcon={<GoogleIcon sx={{ fontSize: 18 }} />}
                    sx={{
                      py: 1.1,
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      textTransform: 'none',
                      borderRadius: 2,
                      bgcolor: '#2563eb',
                      color: '#ffffff',
                      boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                      '&:hover': { bgcolor: '#1d4ed8' }
                    }}
                  >
                    Đăng nhập tài khoản Google
                  </Button>
                </Box>
              )}

              <Box sx={{ position: 'relative', my: 1 }}>
                <Divider sx={{ borderColor: '#e2e8f0' }} />
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    bgcolor: '#ffffff',
                    px: 1.5,
                    color: '#94a3b8',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  Hoặc trải nghiệm nhanh theo vai trò
                </Typography>
              </Box>

              <Stack spacing={1.25}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() =>
                    loginDemo(
                      'SYSTEM_SUPER_ADMIN',
                      'Lê Văn Bình (Super Admin)',
                      '09.levanbinh2003@gmail.com'
                    )
                  }
                  startIcon={<ShieldOutlinedIcon sx={{ fontSize: 19, color: '#2563eb' }} />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1.2,
                    px: 1.5,
                    border: '1px solid #e2e8f0',
                    bgcolor: '#ffffff',
                    borderRadius: 2,
                    textTransform: 'none',
                    transition: 'all 0.15s ease',
                    '&:hover': { bgcolor: '#eff6ff', borderColor: '#bfdbfe' }
                  }}
                >
                  <Box sx={{ textAlign: 'left', flex: 1, ml: 0.5 }}>
                    <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                      Lê Văn Bình (Super Admin)
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Toàn quyền cấu hình hệ thống & kết nối Google Classroom
                    </Typography>
                  </Box>
                  <Chip
                    label="SUPER_ADMIN"
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      bgcolor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe'
                    }}
                  />
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() =>
                    loginDemo(
                      'SCHOOL_ADMIN',
                      'Thầy Hiệu Trưởng — THCS Giảng Võ',
                      'hieutruong@thcs-giangvo.edu.vn'
                    )
                  }
                  startIcon={<AccountCircleOutlinedIcon sx={{ fontSize: 19, color: '#f59e0b' }} />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1.2,
                    px: 1.5,
                    border: '1px solid #e2e8f0',
                    bgcolor: '#ffffff',
                    borderRadius: 2,
                    textTransform: 'none',
                    transition: 'all 0.15s ease',
                    '&:hover': { bgcolor: '#fffbeb', borderColor: '#fde68a' }
                  }}
                >
                  <Box sx={{ textAlign: 'left', flex: 1, ml: 0.5 }}>
                    <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                      Ban Giám Hiệu (Hiệu Trưởng)
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Executive BI, cảnh báo điều hành & báo cáo tổng quan
                    </Typography>
                  </Box>
                  <Chip
                    label="HIỆU TRƯỞNG"
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      bgcolor: '#fffbeb',
                      color: '#b45309',
                      border: '1px solid #fde68a'
                    }}
                  />
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
                  startIcon={<AccountCircleOutlinedIcon sx={{ fontSize: 19, color: '#10b981' }} />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1.2,
                    px: 1.5,
                    border: '1px solid #e2e8f0',
                    bgcolor: '#ffffff',
                    borderRadius: 2,
                    textTransform: 'none',
                    transition: 'all 0.15s ease',
                    '&:hover': { bgcolor: '#ecfdf5', borderColor: '#a7f3d0' }
                  }}
                >
                  <Box sx={{ textAlign: 'left', flex: 1, ml: 0.5 }}>
                    <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                      Tổ Trưởng Chuyên Môn
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Quản lý môn học, giáo viên tổ bộ môn & chất lượng bài tập
                    </Typography>
                  </Box>
                  <Chip
                    label="TỔ TRƯỞNG"
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      bgcolor: '#ecfdf5',
                      color: '#047857',
                      border: '1px solid #a7f3d0'
                    }}
                  />
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
                  startIcon={<AccountCircleOutlinedIcon sx={{ fontSize: 19, color: '#0284c7' }} />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1.2,
                    px: 1.5,
                    border: '1px solid #e2e8f0',
                    bgcolor: '#ffffff',
                    borderRadius: 2,
                    textTransform: 'none',
                    transition: 'all 0.15s ease',
                    '&:hover': { bgcolor: '#f0f9ff', borderColor: '#bae6fd' }
                  }}
                >
                  <Box sx={{ textAlign: 'left', flex: 1, ml: 0.5 }}>
                    <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                      Giáo Viên Bộ Môn / GVCN
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Theo dõi lớp học số, tiến độ giao bài & hồ sơ học sinh
                    </Typography>
                  </Box>
                  <Chip
                    label="GIÁO VIÊN"
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      bgcolor: '#f0f9ff',
                      color: '#0369a1',
                      border: '1px solid #bae6fd'
                    }}
                  />
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Typography
          variant="body2"
          sx={{ textAlign: 'center', mt: 2.5 }}
        >
          <RouterLink
            to="/safety/report"
            style={{ color: '#dc2626', fontWeight: 700, textDecoration: 'none', fontSize: '0.84rem' }}
          >
            ← Quay lại báo cáo sự cố an toàn (không cần đăng nhập)
          </RouterLink>
        </Typography>

        {/* Footer */}
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 1.5,
            color: '#64748b',
            fontSize: '0.75rem'
          }}
        >
          Trường THCS Giảng Võ — Ba Đình, Hà Nội • School Intelligence System
        </Typography>
      </Box>
    </Box>
  );
}