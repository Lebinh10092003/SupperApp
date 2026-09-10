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
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import PendingActionsIcon from '@mui/icons-material/PendingActionsRounded';
import ListAltIcon from '@mui/icons-material/ListAltRounded';
import WarningAmberIcon from '@mui/icons-material/WarningAmberRounded';

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
  },
  {
    groupTitle: 'AN TOÀN TRƯỜNG HỌC',
    items: [
      {
        path: '/safety',
        label: 'Tổng quan An toàn',
        icon: <ShieldOutlinedIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      },
      {
        path: '/safety/reports/pending',
        label: 'Tin báo chờ xử lý',
        icon: <PendingActionsIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      },
      {
        path: '/safety/incidents',
        label: 'Hồ sơ sự cố',
        icon: <ListAltIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      },
      {
        path: '/safety/cockpit',
        label: 'Cần xử lý ngay',
        icon: <WarningAmberIcon fontSize="small" />,
        badge: 'P0/P1',
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
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

  const allNavItems = navGroups.flatMap((g) => g.items);
  const currentNav = allNavItems.find((it) => it.path === location.pathname);
  const currentPageTitle = currentNav ? currentNav.label : 'Trang chủ';

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#ffffff', color: '#0f172a' }}>
      {/* Brand Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid #f1f5f9'
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}
        >
          <SchoolIcon sx={{ color: '#ffffff', fontSize: 22 }} />
        </Box>
        <Box sx={{ overflow: 'hidden' }}>
          <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            THCS Giảng Võ
          </Typography>
          <Typography
            component="span"
            variant="caption"
            sx={{
              display: 'inline-block',
              mt: 0.25,
              fontSize: '0.68rem',
              fontWeight: 700,
              color: '#2563eb',
              bgcolor: '#eff6ff',
              px: 0.85,
              py: 0.15,
              borderRadius: 1,
              letterSpacing: '0.02em'
            }}
            noWrap
          >
            School Intelligence
          </Typography>
        </Box>
      </Box>

      {/* Quick Search Trigger */}
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 2,
            px: 1.5,
            py: 0.85,
            color: '#64748b',
            fontSize: '0.78rem',
            cursor: 'default',
            transition: 'border-color 0.15s ease',
            '&:hover': {
              borderColor: '#cbd5e1'
            }
          }}
        >
          <span>Tìm kiếm điều hành...</span>
          <Chip label="⌘K" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#ffffff', color: '#64748b', border: '1px solid #cbd5e1', fontWeight: 600 }} />
        </Box>
      </Box>

      {/* Navigation List */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5 }}>
        <List disablePadding>
          {visibleGroups.map((group) => (
            <Box key={group.groupTitle} sx={{ mb: 2 }}>
              <ListSubheader
                disableSticky
                sx={{
                  bgcolor: 'transparent',
                  color: '#94a3b8',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  px: 1.25,
                  py: 0.5,
                  lineHeight: '1.25rem',
                  textTransform: 'uppercase'
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
                      borderRadius: '8px',
                      mb: 0.5,
                      py: 0.85,
                      px: 1.25,
                      color: isSelected ? '#1d4ed8' : '#334155',
                      bgcolor: isSelected ? '#eff6ff !important' : 'transparent',
                      border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                      boxShadow: isSelected ? '0 1px 2px rgba(37, 99, 235, 0.05)' : 'none',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        bgcolor: isSelected ? '#eff6ff' : '#f1f5f9',
                        color: isSelected ? '#1d4ed8' : '#0f172a'
                      }
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 28,
                        color: isSelected ? '#2563eb' : '#64748b'
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: '0.8125rem',
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
                          fontWeight: 700,
                          bgcolor: item.badge === 'LIVE' ? '#fef2f2' : '#eff6ff',
                          color: item.badge === 'LIVE' ? '#dc2626' : '#2563eb',
                          border: '1px solid',
                          borderColor: item.badge === 'LIVE' ? '#fecaca' : '#bfdbfe',
                          px: 0.25
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
          p: 1.75,
          borderTop: '1px solid #e2e8f0',
          bgcolor: '#f8fafc'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <Avatar
              sx={{
                width: 34,
                height: 34,
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                boxShadow: '0 2px 5px rgba(37, 99, 235, 0.25)',
                fontSize: '0.82rem',
                fontWeight: 700,
                flexShrink: 0
              }}
            >
              {profile?.displayName?.[0] || 'G'}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a', fontSize: '0.8125rem' }} noWrap>
                {profile?.displayName || 'Người dùng'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }} noWrap>
                {roleLabelMap[profile?.role || ''] || profile?.role || 'Hệ thống'}
              </Typography>
            </Box>
          </Box>
          <Tooltip title="Đăng xuất">
            <IconButton
              size="small"
              onClick={logout}
              sx={{ color: '#64748b', flexShrink: 0, '&:hover': { color: '#ef4444', bgcolor: '#fef2f2' } }}
            >
              <LogoutIcon sx={{ fontSize: 18 }} />
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
          bgcolor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          color: '#0f172a',
          borderBottom: '1px solid #e2e8f0',
          zIndex: (t) => t.zIndex.drawer + 1,
          ml: { md: `${DRAWER_WIDTH}px` },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', minHeight: { xs: 54, md: 58 }, px: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { md: 'none' }, mr: 0.5 }}
            >
              <MenuIcon fontSize="small" />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" fontWeight={600} sx={{ color: '#2563eb' }}>
                Giảng Võ Intelligence
              </Typography>
              <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                /
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a' }}>
                {currentPageTitle}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
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
                  px: 1.25,
                  py: 0.45,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    borderColor: syncStatus?.isSynced ? '#10b981' : '#f59e0b',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
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
                      ? '0 0 0 2px rgba(16, 185, 129, 0.25)'
                      : '0 0 0 2px rgba(245, 158, 11, 0.25)'
                  }}
                />
                <Typography variant="caption" fontWeight={700} sx={{ color: syncStatus?.isSynced ? '#065f46' : '#92400e', fontSize: '0.75rem' }}>
                  {syncStatus?.isSynced ? `Classroom: ${syncStatus.courseCount} lớp` : 'Chờ đồng bộ Classroom'}
                </Typography>
              </Box>
            </Tooltip>

            {/* Quick Sync Button */}
            <Button
              size="small"
              variant="contained"
              onClick={handleSyncNow}
              disabled={isSyncing}
              startIcon={isSyncing ? <CircularProgress size={13} color="inherit" /> : <SyncIcon sx={{ fontSize: 15 }} />}
              sx={{
                display: { xs: 'none', md: 'flex' },
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.75rem',
                bgcolor: '#2563eb',
                color: '#ffffff',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                '&:hover': { bgcolor: '#1d4ed8' }
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
                bgcolor: '#eff6ff',
                border: '1px solid #bfdbfe',
                px: 1.25,
                py: 0.45,
                borderRadius: 1.5
              }}
            >
              <Typography variant="caption" fontWeight={700} sx={{ color: '#1d4ed8', fontSize: '0.75rem' }}>
                Học kỳ II • 2025–2026
              </Typography>
            </Box>

            <Chip
              size="small"
              label={roleLabelMap[profile?.role || ''] || profile?.role || 'Khách'}
              sx={{
                bgcolor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #e2e8f0',
                fontWeight: 700,
                fontSize: '0.75rem'
              }}
            />

            <Tooltip title="Đăng xuất">
              <IconButton onClick={logout} size="small" sx={{ color: '#64748b', '&:hover': { color: '#ef4444', bgcolor: '#fef2f2' } }}>
                <LogoutIcon sx={{ fontSize: 18 }} />
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
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', borderRight: '1px solid #e2e8f0' }
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
              borderRight: '1px solid #e2e8f0'
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
          mt: { xs: '54px', md: '58px' },
          minHeight: 'calc(100vh - 58px)',
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