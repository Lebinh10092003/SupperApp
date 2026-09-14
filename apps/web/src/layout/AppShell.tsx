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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputBase,
  TextField,
  InputAdornment,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon as MenuItemIcon
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
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
import LinkIcon from '@mui/icons-material/LinkRounded';
import HistoryIcon from '@mui/icons-material/HistoryRounded';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHighRounded';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import PendingActionsIcon from '@mui/icons-material/PendingActionsRounded';
import ListAltIcon from '@mui/icons-material/ListAltRounded';
import WarningAmberIcon from '@mui/icons-material/WarningAmberRounded';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';

import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../services/api';
import { NotificationBell } from '../features/safety/components/NotificationBell';

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

// Sắp xếp lại 10/09/2026 theo yêu cầu Sin: nhóm nào dùng HÀNG NGÀY lên
// đầu, nhóm quản trị/ít dùng xuống cuối. 4 trang phân tích
// (Hồ sơ 360°/So sánh Lớp/Phân tích Môn học/Hoạt động Giáo viên) gắn badge
// "BETA" — audit code xác nhận cả 4 chỉ tái dùng đúng API của trang danh
// sách gốc (students/classes/classroom/teachers), CHƯA có phép tính
// so sánh/360°/phân tích thật nào — không phải bug, nhưng tên gọi hứa hẹn
// hơn thực tế nên cần gắn nhãn trung thực thay vì âm thầm xếp ngang hàng.
const navGroups: NavGroup[] = [
  {
    groupTitle: 'TỔNG QUAN',
    items: [
      { path: '/', label: 'Tổng quan điều hành', icon: <DashboardIcon fontSize="small" /> },
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
    groupTitle: 'CẢNH BÁO AN TOÀN VÀ XỬ LÝ SỰ CỐ',
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
      },
      {
        path: '/safety/audit-logs',
        label: 'Nhật ký kiểm toán',
        icon: <HistoryIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD']
      },
      {
        path: '/safety/analytics',
        label: 'Phân tích & thống kê',
        icon: <InsightsRoundedIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD']
      }
    ]
  },
  {
    groupTitle: 'LỊCH CÔNG TÁC',
    items: [
      {
        path: '/work-schedule',
        label: 'Lịch công tác',
        icon: <ScheduleIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      },
      {
        path: '/work-schedule/tasks',
        label: 'Giao việc',
        icon: <AttendanceIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      },
      {
        path: '/work-schedule/approvals',
        label: 'Trung tâm phê duyệt',
        icon: <FactCheckOutlinedIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD']
      },
      {
        path: '/work-schedule/reminders',
        label: 'Nhắc nhở',
        icon: <AlertsIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      }
    ]
  },
  {
    groupTitle: 'LỚP HỌC & HỌC SINH',
    items: [
      { path: '/classroom', label: 'Google Classroom', icon: <ClassroomIcon fontSize="small" /> },
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
    groupTitle: 'PHÂN TÍCH & BÁO CÁO',
    items: [
      {
        path: '/executive',
        label: 'Executive Analytics & Heatmap',
        icon: <GridViewIcon fontSize="small" />,
        badge: 'BI',
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']
      },
      { path: '/reports', label: 'Báo cáo số liệu', icon: <ReportsIcon fontSize="small" /> }
      // 4 mục BETA (Hồ sơ 360°/So sánh Lớp/Phân tích Môn học/Hoạt động Giáo
      // viên) tạm ẩn khỏi nav 2026-09-12 theo yêu cầu Sin — chỉ tái dùng
      // API trang danh sách gốc, chưa có phép tính phân tích/so sánh/360°
      // thật (xem comment ở đầu navGroups). Route trong App.tsx vẫn còn,
      // chỉ ẩn lối vào từ sidebar.
    ]
  },
  {
    groupTitle: 'QUẢN TRỊ HỆ THỐNG',
    items: [
      {
        path: '/connections',
        label: 'Kết nối Google Classroom',
        icon: <LinkIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']
      },
      {
        path: '/catalog/mapping',
        label: 'Chuẩn hóa Dữ liệu Trường',
        icon: <AutoFixHighIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']
      },
      {
        path: '/audit/classroom',
        label: 'Nhật ký kiểm toán Classroom',
        icon: <HistoryIcon fontSize="small" />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL']
      },
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
        // Khớp ROLES_USER_MANAGEMENT ở App.tsx / capability MANAGE_USERS
        // thật ở backend (roles.ts) — trước chỉ cho SUPER_ADMIN/SYSTEM_ADMIN
        // thấy, khiến Hiệu trưởng có quyền thật nhưng không thấy mục này.
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']
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
  const { profile, user, logout, changePassword, updateDisplayName } = useAuth();
  const [accountMenuAnchor, setAccountMenuAnchor] = useState<null | HTMLElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const hasPasswordProvider = !!user?.providerData?.some((p) => p.providerId === 'password');

  const closePwdDialog = () => {
    setPwdOpen(false);
    setCurrentPwd('');
    setNewPwd('');
    setShowCurrentPwd(false);
    setShowNewPwd(false);
    setPwdError('');
    setPwdSuccess(false);
  };

  const handleChangePassword = async () => {
    if (!currentPwd || newPwd.length < 6) return;
    setPwdError('');
    setPwdSaving(true);
    try {
      await changePassword(currentPwd, newPwd);
      setPwdSuccess(true);
      setCurrentPwd('');
      setNewPwd('');
    } catch (e: any) {
      const code = e?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPwdError('Mật khẩu hiện tại không đúng.');
      } else if (code === 'auth/weak-password') {
        setPwdError('Mật khẩu mới quá ngắn — cần tối thiểu 6 ký tự.');
      } else {
        setPwdError('Đổi mật khẩu không thành công. Vui lòng thử lại.');
      }
    } finally {
      setPwdSaving(false);
    }
  };

  const openProfileDialog = () => {
    setProfileName(profile?.displayName || '');
    setProfileError('');
    setProfileSuccess(false);
    setProfileOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) return;
    setProfileError('');
    setProfileSaving(true);
    try {
      await updateDisplayName(profileName.trim());
      setProfileSuccess(true);
    } catch {
      setProfileError('Cập nhật không thành công. Vui lòng thử lại.');
    } finally {
      setProfileSaving(false);
    }
  };

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

  // Tìm kiếm điều hành (⌘K/Ctrl+K) — trước đây chỉ là ô tĩnh không bấm
  // được, không có chức năng gì. Tìm trong đúng các mục nav thật ng dùng
  // này đang thấy (visibleGroups, đã lọc theo vai trò) — không lục thêm
  // nguồn nào khác.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);

  const normalizeSearch = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd');

  const searchableItems = visibleGroups.flatMap((g) => g.items.map((item) => ({ ...item, groupTitle: g.groupTitle })));
  const filteredSearchItems = searchQuery.trim()
    ? searchableItems.filter((item) => normalizeSearch(item.label).includes(normalizeSearch(searchQuery.trim())))
    : searchableItems;

  const openSearch = () => {
    setSearchOpen(true);
    setSearchQuery('');
    setSearchActiveIndex(0);
  };
  const closeSearch = () => setSearchOpen(false);

  const goToSearchItem = (path: string) => {
    navigate(path);
    setMobileOpen(false);
    closeSearch();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
      } else if (e.key === 'Escape' && searchOpen) {
        closeSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchOpen]);

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
          component="img"
          src="/logo-truong.jpg"
          alt="Logo trường"
          sx={{
            width: 'auto',
            height: 40,
            objectFit: 'contain',
            flexShrink: 0
          }}
        />
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
          onClick={openSearch}
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
            cursor: 'pointer',
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
                          bgcolor: item.badge === 'LIVE' ? '#fef2f2' : item.badge === 'BETA' ? '#fffbeb' : '#eff6ff',
                          color: item.badge === 'LIVE' ? '#dc2626' : item.badge === 'BETA' ? '#b45309' : '#2563eb',
                          border: '1px solid',
                          borderColor: item.badge === 'LIVE' ? '#fecaca' : item.badge === 'BETA' ? '#fde68a' : '#bfdbfe',
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
          p: 1,
          borderTop: '1px solid #e2e8f0',
          bgcolor: '#f8fafc'
        }}
      >
        <Box
          onClick={(e) => setAccountMenuAnchor(e.currentTarget)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            cursor: 'pointer',
            borderRadius: '8px',
            py: 0.85,
            px: 0.85,
            border: '1px solid transparent',
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: '#f1f5f9' }
          }}
        >
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
          <ExpandMoreRoundedIcon sx={{ fontSize: 20, color: '#94a3b8', flexShrink: 0 }} />
        </Box>
      </Box>

      <Menu
        anchorEl={accountMenuAnchor}
        open={!!accountMenuAnchor}
        onClose={() => setAccountMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MenuItem
          onClick={() => {
            setAccountMenuAnchor(null);
            openProfileDialog();
          }}
        >
          <MenuItemIcon>
            <PersonRoundedIcon fontSize="small" />
          </MenuItemIcon>
          Sửa thông tin cá nhân
        </MenuItem>
        {hasPasswordProvider && (
          <MenuItem
            onClick={() => {
              setAccountMenuAnchor(null);
              setPwdOpen(true);
            }}
          >
            <MenuItemIcon>
              <KeyRoundedIcon fontSize="small" />
            </MenuItemIcon>
            Đổi mật khẩu
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setAccountMenuAnchor(null);
            logout();
          }}
          sx={{ color: '#ef4444' }}
        >
          <MenuItemIcon>
            <LogoutIcon fontSize="small" sx={{ color: '#ef4444' }} />
          </MenuItemIcon>
          Đăng xuất
        </MenuItem>
      </Menu>

      <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Sửa thông tin cá nhân</DialogTitle>
        <DialogContent>
          {profileSuccess ? (
            <Alert severity="success" sx={{ mt: 1 }}>
              Đã cập nhật thông tin cá nhân.
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {profileError && <Alert severity="error">{profileError}</Alert>}
              <TextField
                fullWidth
                size="small"
                label="Tên hiển thị"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setProfileOpen(false)}>{profileSuccess ? 'Đóng' : 'Huỷ'}</Button>
          {!profileSuccess && (
            <Button
              variant="contained"
              onClick={handleSaveProfile}
              disabled={profileSaving || !profileName.trim()}
              startIcon={profileSaving ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {profileSaving ? 'Đang lưu...' : 'Lưu'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={pwdOpen} onClose={closePwdDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Đổi mật khẩu</DialogTitle>
        <DialogContent>
          {pwdSuccess ? (
            <Alert severity="success" sx={{ mt: 1 }}>
              Đã đổi mật khẩu thành công.
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {pwdError && <Alert severity="error">{pwdError}</Alert>}
              <TextField
                fullWidth
                size="small"
                label="Mật khẩu hiện tại"
                type={showCurrentPwd ? 'text' : 'password'}
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                autoComplete="current-password"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowCurrentPwd((v) => !v)} edge="end" tabIndex={-1}>
                          {showCurrentPwd ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                }}
              />
              <TextField
                fullWidth
                size="small"
                label="Mật khẩu mới"
                type={showNewPwd ? 'text' : 'password'}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                autoComplete="new-password"
                helperText="Tối thiểu 6 ký tự"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowNewPwd((v) => !v)} edge="end" tabIndex={-1}>
                          {showNewPwd ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={closePwdDialog}>{pwdSuccess ? 'Đóng' : 'Huỷ'}</Button>
          {!pwdSuccess && (
            <Button
              variant="contained"
              onClick={handleChangePassword}
              disabled={pwdSaving || !currentPwd || newPwd.length < 6}
              startIcon={pwdSaving ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {pwdSaving ? 'Đang xử lý...' : 'Đổi mật khẩu'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
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

            <NotificationBell />
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

      {/* Command palette tìm kiếm điều hành (⌘K/Ctrl+K) */}
      <Dialog
        open={searchOpen}
        onClose={closeSearch}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3, mt: '-20vh' } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, borderBottom: '1px solid #e2e8f0' }}>
          <SearchRoundedIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
          <InputBase
            autoFocus
            fullWidth
            placeholder="Tìm trang, chức năng..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSearchActiveIndex((i) => Math.min(i + 1, filteredSearchItems.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSearchActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                const item = filteredSearchItems[searchActiveIndex];
                if (item) goToSearchItem(item.path);
              }
            }}
            sx={{ fontSize: '0.9rem' }}
          />
          <Chip label="ESC" size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 600 }} />
        </Box>
        <List sx={{ maxHeight: 420, overflowY: 'auto', py: 1 }}>
          {filteredSearchItems.length === 0 && (
            <Typography variant="body2" sx={{ px: 2, py: 3, textAlign: 'center', color: '#94a3b8' }}>
              Không tìm thấy mục nào khớp "{searchQuery}".
            </Typography>
          )}
          {filteredSearchItems.map((item, i) => (
            <ListItemButton
              key={item.path}
              selected={i === searchActiveIndex}
              onMouseEnter={() => setSearchActiveIndex(i)}
              onClick={() => goToSearchItem(item.path)}
              sx={{
                mx: 1,
                borderRadius: 2,
                '&.Mui-selected': { bgcolor: '#eff6ff' },
                '&.Mui-selected:hover': { bgcolor: '#eff6ff' }
              }}
            >
              <ListItemIcon sx={{ minWidth: 32, color: '#64748b' }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                secondary={item.groupTitle}
                primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }}
                secondaryTypographyProps={{ fontSize: '0.7rem' }}
              />
            </ListItemButton>
          ))}
        </List>
      </Dialog>
    </Box>
  );
}