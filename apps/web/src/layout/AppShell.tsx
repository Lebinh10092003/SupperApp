import { useState, useEffect, type ReactNode } from 'react';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Chip,
  ListSubheader,
  Tooltip,
  Divider,
  Button,
  CircularProgress
} from '@mui/material';
import SyncIcon from '@mui/icons-material/SyncRounded';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/LogoutRounded';
import DashboardIcon from '@mui/icons-material/DashboardRounded';
import TodayIcon from '@mui/icons-material/AccessTimeRounded';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import ClassroomIcon from '@mui/icons-material/AutoStoriesRounded';
import MeetIcon from '@mui/icons-material/VideocamRounded';
import StudentsIcon from '@mui/icons-material/PeopleAltRounded';
import TeachersIcon from '@mui/icons-material/BadgeRounded';
import ScheduleIcon from '@mui/icons-material/CalendarMonthRounded';
import AttendanceIcon from '@mui/icons-material/FactCheckRounded';
import AlertsIcon from '@mui/icons-material/NotificationsActiveRounded';
import ReportsIcon from '@mui/icons-material/AssessmentRounded';
import DataQualityIcon from '@mui/icons-material/VerifiedRounded';
import SystemIcon from '@mui/icons-material/DnsRounded';
import AdminIcon from '@mui/icons-material/AdminPanelSettingsRounded';

import GridViewIcon from '@mui/icons-material/GridViewRounded';
import PersonSearchIcon from '@mui/icons-material/PersonSearchRounded';
import CompareArrowsIcon from '@mui/icons-material/CompareArrowsRounded';
import LinkIcon from '@mui/icons-material/LinkRounded';
import HistoryIcon from '@mui/icons-material/HistoryRounded';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHighRounded';

import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../services/api';

const DRAWER_WIDTH = 270;

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  roles?: string[];
}

interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    groupTitle: 'ĐIỀU HÀNH & GIÁM SÁT',
    items: [
      { path: '/', label: 'Tổng quan điều hành', icon: <DashboardIcon fontSize="small" /> },
      {
        path: '/executive',
        label: 'Executive Analytics & Heatmap',
        icon: <GridViewIcon fontSize="small" />,
        badge: 'BI',
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']
      },
      { path: '/today', label: 'Hoạt động hôm nay', icon: <TodayIcon fontSize="small" />, badge: 'LIVE' },
      {
        path: '/alerts',
        label: 'Trung tâm Cảnh báo sớm',
        icon: <AlertsIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD']
      }
    ]
  },
  {
    groupTitle: 'PHÂN TÍCH & SO SÁNH',
    items: [
      {
        path: '/students/360',
        label: 'Hồ sơ 360° Học sinh',
        icon: <PersonSearchIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      },
      {
        path: '/classes/compare',
        label: 'So sánh Lớp đối đầu',
        icon: <CompareArrowsIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD']
      },
      {
        path: '/subjects/analytics',
        label: 'Phân tích Môn học',
        icon: <ClassroomIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD']
      },
      {
        path: '/teachers/analytics',
        label: 'Hoạt động Giáo viên',
        icon: <TeachersIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD']
      }
    ]
  },
  {
    groupTitle: 'LỚP HỌC SỐ & DANH MỤC',
    items: [
      { path: '/classroom', label: 'Google Classroom', icon: <ClassroomIcon fontSize="small" /> },
      {
        path: '/catalog/mapping',
        label: 'Chuẩn hóa Dữ liệu Trường',
        icon: <AutoFixHighIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']
      },
      { path: '/classes', label: 'Lớp học & Sĩ số', icon: <SchoolIcon fontSize="small" /> },
      { path: '/students', label: 'Danh sách Học sinh', icon: <StudentsIcon fontSize="small" /> },
      {
        path: '/teachers',
        label: 'Danh sách Giáo viên',
        icon: <TeachersIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD']
      },
      { path: '/schedules', label: 'Thời khóa biểu', icon: <ScheduleIcon fontSize="small" /> },
      {
        path: '/attendance',
        label: 'Điểm danh & Chuyên cần',
        icon: <AttendanceIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      }
    ]
  },
  {
    groupTitle: 'KẾT NỐI & QUẢN TRỊ',
    items: [
      {
        path: '/connections',
        label: 'Kết nối Google Classroom',
        icon: <LinkIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']
      },
      {
        path: '/audit/classroom',
        label: 'Classroom Audit (Reports)',
        icon: <HistoryIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL']
      },
      { path: '/reports', label: 'Báo cáo số liệu', icon: <ReportsIcon fontSize="small" /> },
      {
        path: '/data-quality',
        label: 'Chất lượng dữ liệu',
        icon: <DataQualityIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']
      },
      {
        path: '/admin',
        label: 'Phân quyền Quản trị',
        icon: <AdminIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN']
      },
      {
        path: '/system',
        label: 'Tình trạng hệ thống',
        icon: <SystemIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN']
      }
    ]
  }
];

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ connected: boolean; isSynced: boolean; courseCount: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, logout } = useAuth();

  const fetchStatus = () => {
    api<any>('/api/classroom/status')
      .then((res) => setSyncStatus(res))
      .catch(() => setSyncStatus(null));
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 45000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await api<any>('/api/classroom/sync', { method: 'POST' });
      fetchStatus();
    } catch {
      // User can view errors on /connections
    } finally {
      setIsSyncing(false);
    }
  };

  const roleLabelMap: Record<string, string> = {
    SYSTEM_SUPER_ADMIN: 'Quản trị viên cấp cao nhất',
    SCHOOL_ADMIN: 'Hiệu trưởng',
    SYSTEM_ADMIN: 'Quản trị hệ thống',
    PRINCIPAL: 'Hiệu trưởng',
    VICE_PRINCIPAL: 'Phó Hiệu trưởng',
    DEPARTMENT_HEAD: 'Tổ trưởng chuyên môn',
    HOMEROOM: 'GV Chủ nhiệm',
    TEACHER: 'Giáo viên',
    DATA_VIEWER: 'Người xem dữ liệu',
    VIEWER: 'Người xem dữ liệu'
  };


  const userRole = profile?.role || 'DATA_VIEWER';

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || item.roles.includes(userRole))
    }))
    .filter((group) => group.items.length > 0);

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0f172a', color: '#fff' }}>
      {/* Brand Header */}
      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0) 100%)'
        }}
      >
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: '12px',
            bgcolor: '#2563eb',
            display: 'grid',
            placeItems: 'center',
            fontSize: '1.4rem',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
            flexShrink: 0
          }}
        >
          🏫
        </Box>
        <Box sx={{ overflow: 'hidden' }}>
          <Typography variant="subtitle1" fontWeight={800} noWrap sx={{ color: '#ffffff', letterSpacing: '-0.01em' }}>
            School Intelligence
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', fontWeight: 500 }} noWrap>
            THCS Giảng Võ • Hà Nội
          </Typography>
        </Box>
      </Box>

      {/* Navigation List */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 2 }}>
        <List disablePadding>
          {visibleGroups.map((group) => (
            <Box key={group.groupTitle} sx={{ mb: 2 }}>
              <ListSubheader
                disableSticky
                sx={{
                  bgcolor: 'transparent',
                  color: '#64748b',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  px: 1.5,
                  py: 0.5,
                  lineHeight: '1.5rem'
                }}
              >
                {group.groupTitle}
              </ListSubheader>

              {group.items.map((item) => {
                const isSelected = location.pathname === item.path;
                return (
                  <ListItemButton
                    key={item.path}
                    selected={isSelected}
                    onClick={() => {
                      navigate(item.path);
                      setMobileOpen(false);
                    }}
                    sx={{
                      borderRadius: '10px',
                      mb: 0.5,
                      py: 1,
                      px: 1.5,
                      color: isSelected ? '#ffffff' : '#94a3b8',
                      bgcolor: isSelected ? '#2563eb !important' : 'transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        bgcolor: isSelected ? '#2563eb' : 'rgba(255, 255, 255, 0.05)',
                        color: '#ffffff'
                      }
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 32,
                        color: isSelected ? '#ffffff' : '#94a3b8'
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: '0.84rem',
                        fontWeight: isSelected ? 700 : 500
                      }}
                    />
                    {item.badge && (
                      <Chip
                        label={item.badge}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          bgcolor: '#ef4444',
                          color: '#fff',
                          px: 0.5
                        }}
                      />
                    )}
                  </ListItemButton>
                );
              })}
            </Box>
          ))}
        </List>
      </Box>

      {/* User Session Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          bgcolor: 'rgba(15, 23, 42, 0.6)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: '#3b82f6',
                fontSize: '0.875rem',
                fontWeight: 700,
                flexShrink: 0
              }}
            >
              {profile?.displayName?.[0] || 'G'}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#f8fafc' }} noWrap>
                {profile?.displayName || 'Người dùng'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }} noWrap>
                {roleLabelMap[profile?.role || ''] || profile?.role || 'Hệ thống'}
              </Typography>
            </Box>
          </Box>
          <Tooltip title="Đăng xuất">
            <IconButton
              size="small"
              onClick={logout}
              sx={{ color: '#94a3b8', flexShrink: 0, '&:hover': { color: '#ef4444', bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      {/* Top Header */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: '#ffffff',
          color: '#0f172a',
          borderBottom: '1px solid #e2e8f0',
          zIndex: (t) => t.zIndex.drawer + 1,
          ml: { md: `${DRAWER_WIDTH}px` },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', minHeight: { xs: 58, md: 64 }, px: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { md: 'none' }, mr: 0.5 }}
            >
              <MenuIcon />
            </IconButton>
            <Box>
              <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.2, color: '#0f172a' }}>
                Trường THCS Giảng Võ
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                Hệ thống điều hành trường học thông minh
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Live Classroom Sync Status Pill */}
            <Tooltip title={syncStatus?.isSynced ? `Đã đồng bộ ${syncStatus.courseCount} khóa học từ Google Classroom` : 'Chưa đồng bộ dữ liệu thật từ Google Classroom. Bấm để kết nối.'}>
              <Box
                onClick={() => navigate('/connections')}
                sx={{
                  display: { xs: 'none', sm: 'flex' },
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: syncStatus?.isSynced ? '#ecfdf5' : '#fffbeb',
                  border: '1px solid',
                  borderColor: syncStatus?.isSynced ? '#a7f3d0' : '#fde68a',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    borderColor: syncStatus?.isSynced ? '#10b981' : '#f59e0b',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                  }
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: syncStatus?.isSynced ? '#10b981' : '#f59e0b',
                    boxShadow: syncStatus?.isSynced
                      ? '0 0 0 2px rgba(16, 185, 129, 0.3)'
                      : '0 0 0 2px rgba(245, 158, 11, 0.3)'
                  }}
                />
                <Typography variant="caption" fontWeight={700} sx={{ color: syncStatus?.isSynced ? '#065f46' : '#92400e' }}>
                  {syncStatus?.isSynced ? `Classroom: ${syncStatus.courseCount} lớp` : 'Chờ đồng bộ Classroom'}
                </Typography>
              </Box>
            </Tooltip>

            {/* Quick Sync Button */}
            <Button
              size="small"
              variant="outlined"
              onClick={handleSyncNow}
              disabled={isSyncing}
              startIcon={isSyncing ? <CircularProgress size={14} color="inherit" /> : <SyncIcon fontSize="small" />}
              sx={{
                display: { xs: 'none', md: 'flex' },
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.75rem',
                borderColor: '#cbd5e1',
                color: '#334155',
                bgcolor: '#fff',
                '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' }
              }}
            >
              {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ'}
            </Button>

            {/* Academic Semester Badge */}
            <Box
              sx={{
                display: { xs: 'none', lg: 'flex' },
                alignItems: 'center',
                gap: 1,
                bgcolor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                px: 1.5,
                py: 0.5,
                borderRadius: 2
              }}
            >
              <Typography variant="caption" fontWeight={700} sx={{ color: '#475569' }}>
                Học kỳ II • 2025–2026
              </Typography>
            </Box>

            <Chip
              size="small"
              label={roleLabelMap[profile?.role || ''] || profile?.role || 'Khách'}
              sx={{
                bgcolor: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                fontWeight: 700,
                fontSize: '0.75rem'
              }}
            />

            <Tooltip title="Đăng xuất">
              <IconButton onClick={logout} sx={{ color: '#64748b', '&:hover': { color: '#ef4444' } }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Sidebar Area */}
      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
      >
        {/* Sidebar Mobile Temporary Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none' }
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Sidebar Desktop Permanent Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: '1px solid #1e293b'
            }
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3, md: 3.5 },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minWidth: 0,
          mt: { xs: '58px', md: '64px' },
          minHeight: 'calc(100vh - 64px)',
          boxSizing: 'border-box'
        }}
      >
        <Box sx={{ maxWidth: '1600px', mx: 'auto', width: '100%' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}