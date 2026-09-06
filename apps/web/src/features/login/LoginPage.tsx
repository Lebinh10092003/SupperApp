import { Box, Button, Card, CardContent, Typography, Stack, Chip, Divider } from '@mui/material';
import { Navigate } from 'react-router-dom';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import GoogleIcon from '@mui/icons-material/Google';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#fafafa',
        p: 2
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        {/* Brand Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: '10px',
              bgcolor: '#18181b',
              color: '#ffffff',
              mb: 1.5,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <SchoolIcon sx={{ fontSize: 24 }} />
          </Box>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: '#09090b',
              letterSpacing: '-0.025em',
              lineHeight: 1.2
            }}
          >
            Giảng Võ School Intelligence
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: '#71717a',
              mt: 0.5,
              fontSize: '0.875rem'
            }}
          >
            Hệ thống điều hành lớp học số & phân tích tự động
          </Typography>
        </Box>

        {/* Card */}
        <Card
          sx={{
            borderRadius: '12px',
            border: '1px solid #e4e4e7',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
            bgcolor: '#ffffff',
            overflow: 'hidden'
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 3.5 } }}>
            <Stack spacing={2.5}>
              <Box>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, color: '#09090b', letterSpacing: '-0.01em' }}
                >
                  Đăng nhập tài khoản
                </Typography>
                <Typography variant="body2" sx={{ color: '#71717a', fontSize: '0.8125rem' }}>
                  Đăng nhập bằng tài khoản Google Workspace nhà trường
                </Typography>
              </Box>

              {hasValidFirebaseConfig ? (
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => login()}
                  startIcon={<GoogleIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    py: 1.2,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    textTransform: 'none',
                    borderRadius: '6px',
                    bgcolor: '#18181b',
                    color: '#ffffff',
                    '&:hover': { bgcolor: '#27272a' }
                  }}
                >
                  Đăng nhập với Google Workspace
                </Button>
              ) : null}

              <Box sx={{ position: 'relative', my: 1 }}>
                <Divider sx={{ borderColor: '#e4e4e7' }} />
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    bgcolor: '#ffffff',
                    px: 1.5,
                    color: '#a1a1aa',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  Hoặc chọn vai trò trải nghiệm
                </Typography>
              </Box>

              <Stack spacing={1}>
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
                  startIcon={<ShieldOutlinedIcon sx={{ fontSize: 18, color: '#09090b' }} />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1,
                    px: 1.5,
                    border: '1px solid #e4e4e7',
                    bgcolor: '#ffffff',
                    color: '#09090b',
                    borderRadius: '6px',
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.8125rem',
                    '&:hover': { bgcolor: '#f4f4f5', borderColor: '#d4d4d8' }
                  }}
                >
                  <Box sx={{ textAlign: 'left', flex: 1, ml: 0.5 }}>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#09090b' }}>
                      Lê Văn Bình (Super Admin)
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: '#71717a' }}>
                      Toàn quyền cấu hình hệ thống & kết nối
                    </Typography>
                  </Box>
                  <Chip
                    label="SUPER_ADMIN"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      bgcolor: '#f4f4f5',
                      color: '#18181b',
                      border: '1px solid #e4e4e7'
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
                  startIcon={<AccountCircleOutlinedIcon sx={{ fontSize: 18, color: '#09090b' }} />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1,
                    px: 1.5,
                    border: '1px solid #e4e4e7',
                    bgcolor: '#ffffff',
                    color: '#09090b',
                    borderRadius: '6px',
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.8125rem',
                    '&:hover': { bgcolor: '#f4f4f5', borderColor: '#d4d4d8' }
                  }}
                >
                  <Box sx={{ textAlign: 'left', flex: 1, ml: 0.5 }}>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#09090b' }}>
                      Ban Giám Hiệu (Hiệu Trưởng)
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: '#71717a' }}>
                      Executive BI, cảnh báo điều hành & báo cáo
                    </Typography>
                  </Box>
                  <Chip
                    label="HIỆU TRƯỞNG"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 600,
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
                      'DEPARTMENT_HEAD',
                      'Cô Tổ Trưởng Chuyên Môn Toán - Tin',
                      'totruong.toan@thcs-giangvo.edu.vn'
                    )
                  }
                  startIcon={<AccountCircleOutlinedIcon sx={{ fontSize: 18, color: '#09090b' }} />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1,
                    px: 1.5,
                    border: '1px solid #e4e4e7',
                    bgcolor: '#ffffff',
                    color: '#09090b',
                    borderRadius: '6px',
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.8125rem',
                    '&:hover': { bgcolor: '#f4f4f5', borderColor: '#d4d4d8' }
                  }}
                >
                  <Box sx={{ textAlign: 'left', flex: 1, ml: 0.5 }}>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#09090b' }}>
                      Tổ Trưởng Chuyên Môn
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: '#71717a' }}>
                      Quản lý môn học, giáo viên tổ bộ môn & lớp học
                    </Typography>
                  </Box>
                  <Chip
                    label="TỔ TRƯỞNG"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      bgcolor: '#f4f4f5',
                      color: '#3f3f46',
                      border: '1px solid #e4e4e7'
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
                  startIcon={<AccountCircleOutlinedIcon sx={{ fontSize: 18, color: '#09090b' }} />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1,
                    px: 1.5,
                    border: '1px solid #e4e4e7',
                    bgcolor: '#ffffff',
                    color: '#09090b',
                    borderRadius: '6px',
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.8125rem',
                    '&:hover': { bgcolor: '#f4f4f5', borderColor: '#d4d4d8' }
                  }}
                >
                  <Box sx={{ textAlign: 'left', flex: 1, ml: 0.5 }}>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#09090b' }}>
                      Giáo Viên Bộ Môn / GVCN
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: '#71717a' }}>
                      Theo dõi lớp học số, giao bài & học sinh
                    </Typography>
                  </Box>
                  <Chip
                    label="GIÁO VIÊN"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      bgcolor: '#f4f4f5',
                      color: '#3f3f46',
                      border: '1px solid #e4e4e7'
                    }}
                  />
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Footer */}
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 3,
            color: '#a1a1aa',
            fontSize: '0.75rem'
          }}
        >
          THCS Giảng Võ • Phiên bản 1.0.0 • shadcn/ui design
        </Typography>
      </Box>
    </Box>
  );
}