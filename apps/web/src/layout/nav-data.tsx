import {
  LayoutDashboard,
  Clock,
  BellRing,
  ShieldAlert,
  ListChecks,
  TriangleAlert,
  History,
  LineChart,
  Calendar,
  ClipboardCheck,
  FileCheck2,
  BarChart3,
  Grid2x2,
  Link as LinkIconLucide,
  Wand2,
  Database,
  Server,
  ShieldCheck,
  School,
  BookOpen,
  Users,
  IdCard,
  ArrowLeftRight
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { isFermatTechAdminEmail } from '../config/adminAccess';
import { useAuth } from '../auth/AuthProvider';

/** Y hệt DRAWER_WIDTH cũ trong AppShell.tsx — giữ nguyên bề rộng sidebar
 * sau khi chuyển sang shadcn/ui (xem Sidebar.tsx). */
export const SIDEBAR_WIDTH = 270;
/** Bề rộng sidebar ở trạng thái thu gọn (chỉ icon) — nút rút gọn kiểu
 * template, xem AppShell.tsx/Sidebar.tsx. */
export const SIDEBAR_WIDTH_COLLAPSED = 68;

export interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  roles?: string[];
  /** Chỉ tài khoản FermatTech (quản trị cấp cao nhất) thấy — Sin yêu cầu
   * 2026-09-21: các mục liên quan Google Classroom/lớp học số không còn là
   * nghiệp vụ chính của trường, chỉ giữ lại để admin kỹ thuật dùng. */
  adminOnly?: boolean;
}

export interface NavGroup {
  groupTitle: string;
  items: NavItem[];
  /** Cả nhóm chỉ FermatTech thấy (xem NavItem.adminOnly). */
  adminOnly?: boolean;
}

/** Thứ tự hiển thị nhóm trên sidebar — Cảnh báo an toàn + Lịch công tác lên đầu, sau đó đến Điều hành Lớp học số. */
export const GROUP_DISPLAY_ORDER = [
  'CẢNH BÁO AN TOÀN VÀ XỬ LÝ SỰ CỐ',
  'LỊCH CÔNG TÁC',
  'ĐIỀU HÀNH LỚP HỌC SỐ',
  'QUẢN TRỊ HỆ THỐNG',
  'TỔNG QUAN',
  'PHÂN TÍCH & BÁO CÁO'
];

const ICON_SIZE = 'size-[18px]';

// Sắp xếp lại 10/09/2026 theo yêu cầu Sin: nhóm nào dùng HÀNG NGÀY lên
// đầu, nhóm quản trị/ít dùng xuống cuối. 4 trang phân tích
// (Hồ sơ 360°/So sánh Lớp/Phân tích Môn học/Hoạt động Giáo viên) gắn badge
// "BETA" — audit code xác nhận cả 4 chỉ tái dùng đúng API của trang danh
// sách gốc (students/classes/classroom/teachers), CHƯA có phép tính
// so sánh/360°/phân tích thật nào — không phải bug, nhưng tên gọi hứa hẹn
// hơn thực tế nên cần gắn nhãn trung thực thay vì âm thầm xếp ngang hàng.
export const navGroups: NavGroup[] = [
  {
    groupTitle: 'TỔNG QUAN',
    items: [
      { path: '/', label: 'Tổng quan điều hành', icon: <LayoutDashboard className={ICON_SIZE} /> },
      { path: '/today', label: 'Hoạt động hôm nay', icon: <Clock className={ICON_SIZE} />, badge: 'LIVE' },
      {
        path: '/alerts',
        label: 'Trung tâm Cảnh báo sớm',
        icon: <BellRing className={ICON_SIZE} />,
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
        icon: <ShieldCheck className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      },
      {
        path: '/safety/my-incidents',
        label: 'Sự vụ của tôi',
        icon: <ClipboardCheck className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      },
      {
        path: '/safety/cases',
        label: 'Sự vụ',
        icon: <ListChecks className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      },
      {
        path: '/safety/cockpit',
        label: 'Cần xử lý ngay',
        icon: <TriangleAlert className={ICON_SIZE} />,
        badge: 'P0/P1',
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      },
      {
        path: '/safety/audit-logs',
        label: 'Nhật ký kiểm toán',
        icon: <History className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD']
      },
      {
        path: '/safety/analytics',
        label: 'Phân tích & thống kê',
        icon: <LineChart className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD']
      }
    ]
  },
  {
    groupTitle: 'LỊCH CÔNG TÁC',
    items: [
      {
        path: '/work-schedule/dashboard',
        label: 'Tổng quan',
        icon: <BarChart3 className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      },
      {
        path: '/work-schedule',
        label: 'Lịch công tác',
        icon: <Calendar className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      },
      {
        path: '/work-schedule/tasks',
        label: 'Giao việc',
        icon: <ClipboardCheck className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      },
      {
        path: '/work-schedule/exam-schedule',
        label: 'Lịch trông thi',
        icon: <FileCheck2 className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      },
      {
        path: '/work-schedule/reminders',
        label: 'Nhắc nhở',
        icon: <BellRing className={ICON_SIZE} />,
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
        icon: <Grid2x2 className={ICON_SIZE} />,
        badge: 'BI',
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']
      },
      { path: '/reports', label: 'Báo cáo số liệu', icon: <BarChart3 className={ICON_SIZE} /> }
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
        icon: <LinkIconLucide className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']
      },
      {
        path: '/catalog/mapping',
        label: 'Chuẩn hóa Dữ liệu Trường',
        icon: <Wand2 className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']
      },
      {
        path: '/audit/classroom',
        label: 'Nhật ký kiểm toán Classroom',
        icon: <History className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL']
      },
      {
        path: '/data-quality',
        label: 'Chất lượng dữ liệu',
        icon: <Database className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']
      },
      {
        path: '/admin',
        label: 'Phân quyền Quản trị',
        icon: <ShieldCheck className={ICON_SIZE} />,
        // Khớp ROLES_USER_MANAGEMENT ở App.tsx / capability MANAGE_USERS
        // thật ở backend (roles.ts) — trước chỉ cho SUPER_ADMIN/SYSTEM_ADMIN
        // thấy, khiến Hiệu trưởng có quyền thật nhưng không thấy mục này.
        // Thêm VICE_PRINCIPAL 2026-09-25 (Sin chốt) — chỉ quản lý được
        // người trong đúng phân hiệu mình phụ trách, giới hạn nằm ở backend
        // (admin.routes.ts), không phải ở đây.
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL']
      },
      {
        path: '/system',
        label: 'Tình trạng hệ thống',
        icon: <Server className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN']
      }
    ]
  },
  // Nhóm Điều hành Lớp học số — Mr Bình tổ chức lại theo chuẩn Sư phạm &
  // Nghiệp vụ trường học (PR #31, 2026-09-25), đã sẵn KHÔNG còn adminOnly —
  // trùng đúng ý Sin cùng ngày ("mai bàn giao, đảm bảo module này dùng
  // được"), các trang cấu hình nhạy cảm (Kết nối/Chuẩn hóa Classroom) vẫn
  // nằm riêng ở nhóm QUẢN TRỊ HỆ THỐNG.
  {
    groupTitle: 'ĐIỀU HÀNH LỚP HỌC SỐ',
    items: [
      {
        path: '/classes',
        label: 'Lớp học Hành chính & Sĩ số',
        icon: <School className={ICON_SIZE} />
      },
      {
        path: '/classroom',
        label: 'Khóa học Bộ môn',
        icon: <BookOpen className={ICON_SIZE} />,
        badge: 'Classroom'
      },
      {
        path: '/classes/compare',
        label: 'Đối sánh Lớp học 1-vs-1',
        icon: <ArrowLeftRight className={ICON_SIZE} />,
        badge: 'MỚI',
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD']
      },
      {
        path: '/students',
        label: 'Học sinh & Hồ sơ 360°',
        icon: <Users className={ICON_SIZE} />
      },
      {
        // Sin yêu cầu 2026-09-25: "mở hiển lớp học 360 cho tk quản trị viên
        // cấp cao nhất" — CHỈ mở cho FermatTech (adminOnly), không mở rộng
        // cho trường: trang này CHỈ tái dùng đúng API danh sách học sinh
        // (`/api/people/students`, xem Student360Page.tsx), CHƯA có phép
        // tính hồ sơ 360° thật nào (lịch sử sự cố/điểm danh/học lực tổng
        // hợp) — gắn nhãn BETA để không hiểu nhầm ngay cả với admin.
        path: '/students/360',
        label: 'Hồ sơ 360° (xem trước)',
        icon: <LineChart className={ICON_SIZE} />,
        badge: 'BETA',
        adminOnly: true
      },
      {
        path: '/teachers',
        label: 'Đội ngũ Giáo viên',
        icon: <IdCard className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD']
      },
      {
        path: '/attendance',
        label: 'Điểm danh & Chuyên cần',
        icon: <ClipboardCheck className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM']
      },
      {
        path: '/schedules',
        label: 'Thời khóa biểu',
        icon: <Calendar className={ICON_SIZE} />
      },
      {
        path: '/classroom/sync-runs',
        label: 'Lịch sử Đồng bộ Classroom',
        icon: <History className={ICON_SIZE} />,
        roles: ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']
      }
    ]
  }
];

// Học kỳ I: tháng 9 năm N -> tháng 1 năm N+1 (năm học N-N+1).
// Học kỳ II: tháng 2 -> tháng 8 năm N+1 (cùng năm học N-N+1, gồm cả hè).
export function getCurrentSemesterLabel(now: Date = new Date()): string {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  if (month >= 9) {
    return `Học kỳ I • ${year}–${year + 1}`;
  }
  if (month === 1) {
    return `Học kỳ I • ${year - 1}–${year}`;
  }
  return `Học kỳ II • ${year - 1}–${year}`;
}

/** Lọc + sắp xếp navGroups theo đúng vai trò/quyền FermatTech-admin của
 * người dùng hiện tại — y hệt logic `visibleGroups` cũ trong AppShell.tsx,
 * tách ra thành hook dùng chung cho cả Sidebar (hiển thị) và CommandPalette
 * (tìm kiếm), tránh phải truyền prop xuyên nhiều lớp component. */
export function useVisibleNavGroups(): NavGroup[] {
  const { profile } = useAuth();
  const userRole = profile?.role || 'DATA_VIEWER';
  const isFermatTechAdmin = isFermatTechAdminEmail(profile?.email);

  return navGroups
    .filter((group) => !group.adminOnly || isFermatTechAdmin)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => (!item.roles || item.roles.includes(userRole)) && (!item.adminOnly || isFermatTechAdmin))
    }))
    .filter((group) => group.items.length > 0)
    .sort((a, b) => GROUP_DISPLAY_ORDER.indexOf(a.groupTitle) - GROUP_DISPLAY_ORDER.indexOf(b.groupTitle));
}

/** Tiêu đề trang hiện tại theo route — dùng ở Topbar (breadcrumb). */
export function useCurrentNavItem(): NavItem | undefined {
  const location = useLocation();
  const allNavItems = navGroups.flatMap((g) => g.items);
  return allNavItems.find((it) => it.path === location.pathname);
}
