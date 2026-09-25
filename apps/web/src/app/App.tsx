import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { RoleRoute } from "../auth/RoleRoute";
import { AppShell } from "../layout/AppShell";
import { useAuth } from "../auth/AuthProvider";
import { isFermatTechAdminEmail } from "../config/adminAccess";
import { useIsMobileViewport } from "../hooks/useIsMobileViewport";
import LoginPage from "../features/login/LoginPage";
// Pilot UI di động (Ionic React) — Sin duyệt hướng 2026-09-25, xem nhánh
// git feature/ionic-mobile-pilot. CỐ Ý lazy-load (KHÔNG import tĩnh như
// các trang khác): @ionic/react kéo theo bộ CSS reset riêng, tách chunk
// để KHÔNG lẫn vào bundle chính — chỉ tải khi `Responsive` (dưới) thật sự
// chọn nhánh mobile, không ảnh hưởng bundle của bản desktop.
const MobileMyIncidentsPage = lazy(() => import("../mobile/MobileMyIncidentsPage"));
const MobileMyTasksPage = lazy(() => import("../mobile/MobileMyTasksPage"));
const MobileClassroomPage = lazy(() => import("../mobile/MobileClassroomPage"));
const MobileProfilePage = lazy(() => import("../mobile/MobileProfilePage"));
import DashboardPage from "../features/dashboard/DashboardPage";
import TodayPage from "../features/today/TodayPage";
import ClassesPage from "../features/classes/ClassesPage";
import ClassroomPage from "../features/classroom/ClassroomPage";
import SyncRunsPage from "../features/classroom/SyncRunsPage";
import MeetPage from "../features/meet/MeetPage";
import StudentsPage from "../features/people/StudentsPage";
import TeachersPage from "../features/people/TeachersPage";
import SchedulesPage from "../features/schedules/SchedulesPage";
import AttendancePage from "../features/attendance/AttendancePage";
import AlertsPage from "../features/alerts/AlertsPage";
import ReportsPage from "../features/reports/ReportsPage";
import DataQualityPage from "../features/data-quality/DataQualityPage";
import SystemPage from "../features/system/SystemPage";
import AdminPage from "../features/admin/AdminPage";

// Tuyến đường chuyên sâu mở rộng cho School Intelligence
import ExecutiveAnalyticsPage from "../features/executive/ExecutiveAnalyticsPage";
import Student360Page from "../features/students/Student360Page";
import ClassComparePage from "../features/classes/ClassComparePage";
import SubjectAnalyticsPage from "../features/subjects/SubjectAnalyticsPage";
import TeacherAnalyticsPage from "../features/teachers/TeacherAnalyticsPage";
import GoogleConnectionPage from "../features/connections/GoogleConnectionPage";
import CatalogMappingPage from "../features/catalog/CatalogMappingPage";
import ClassroomAuditPage from "../features/audit/ClassroomAuditPage";
import IncidentDetailPage from "../features/safety/IncidentDetailPage";
import EmergencyCockpitPage from "../features/safety/EmergencyCockpitPage";
import PublicReportPage from "../features/safety/PublicReportPage";
import PublicLookupPage from "../features/safety/PublicLookupPage";
import SafetyDashboardPage from "../features/safety/SafetyDashboardPage";
import CasesListPage from "../features/safety/CasesListPage";
import AuditLogPage from "../features/safety/AuditLogPage";
import AnalyticsPage from "../features/safety/AnalyticsPage";
import OverviewPage from "../features/work-schedule/OverviewPage";
import EventsListPage from "../features/work-schedule/EventsListPage";
import TasksListPage from "../features/work-schedule/TasksListPage";
import ApprovalCenterPage from "../features/work-schedule/ApprovalCenterPage";
import RemindersPage from "../features/work-schedule/RemindersPage";

// "/" (Bảng điều hành toàn trường) xoay quanh dữ liệu Google Classroom —
// giờ chỉ tài khoản FermatTech còn thấy mục này trong sidebar (Sin yêu cầu
// 2026-09-21), nên trang chủ CŨNG phải đổi theo: tài khoản khác vào "/" thì
// chuyển thẳng sang "/safety" (module đang hoạt động chính) thay vì vẫn lộ
// ra dashboard đầy số liệu Classroom mà sidebar đã cố tình giấu.
function HomeRoute() {
  const { profile } = useAuth();
  if (isFermatTechAdminEmail(profile?.email)) return <DashboardPage />;
  return <Navigate to="/safety" replace />;
}

const p = (x: ReactNode, allowedRoles?: string[]) => (
  <ProtectedRoute>
    <AppShell>
      <RoleRoute allowedRoles={allowedRoles}>{x}</RoleRoute>
    </AppShell>
  </ProtectedRoute>
);

// Sin phản hồi 2026-09-25 (lần 2): "/mobile-preview/..." bắt người dùng
// nhớ/đi một link RIÊNG mới thấy bản mobile — không đúng ý, phải TỰ ĐỘNG
// đổi giao diện ngay trên CÙNG một URL khi mở bằng điện thoại (màn hình
// hẹp), không đổi URL, không cần biết link nào khác. `Responsive` chọn
// nhánh theo bề rộng màn hình qua `useIsMobileViewport()` — người dùng xoay
// máy/resize cửa sổ được đổi giao diện ngay, không cần tải lại trang.
function Responsive({ desktop, mobile }: { desktop: ReactNode; mobile: ReactNode }) {
  const isMobile = useIsMobileViewport();
  return <>{isMobile ? mobile : desktop}</>;
}

const pResponsive = (desktopElement: ReactNode, mobileElement: ReactNode, allowedRoles?: string[]) => (
  <ProtectedRoute>
    <RoleRoute allowedRoles={allowedRoles}>
      <Responsive
        desktop={<AppShell>{desktopElement}</AppShell>}
        mobile={<Suspense fallback={null}>{mobileElement}</Suspense>}
      />
    </RoleRoute>
  </ProtectedRoute>
);

const ROLES_SUPER = ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN'];
// Khớp đúng danh sách vai trò có capability MANAGE_USERS ở backend
// (roles.ts) — trước đây /admin chỉ cho ROLES_SUPER vào, khiến Hiệu
// trưởng/SCHOOL_ADMIN (có quyền thật ở backend) không vào được trang quản
// trị người dùng (Sin phát hiện 13/09/2026: tạo xong 249 tài khoản module
// An toàn nhưng Hiệu trưởng không có chỗ tự quản lý).
const ROLES_USER_MANAGEMENT = ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];
const ROLES_LEADERSHIP = ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'];
const ROLES_ADMIN_PLUS = ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];
const ROLES_DEPARTMENT_PLUS = ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD'];
// "Ai plausibly là nhân viên" — advisory only, nav/route-level, KHÔNG phải
// lớp phân quyền (đó là authz.ts 9 bước ở server, hệ role R.* riêng biệt
// hoàn toàn với hệ role này — xem plan Phase 1 §0).
const ROLES_SAFETY_STAFF = ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM'];
// Cùng tinh thần ROLES_SAFETY_STAFF — module Lịch công tác cũng dùng hệ
// role R.* riêng (work-schedule.authz.ts), gate này chỉ advisory nav/route.
const ROLES_WORK_SCHEDULE_STAFF = ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'TEACHER', 'HOMEROOM'];

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={pResponsive(
          <HomeRoute />,
          <MobileMyIncidentsPage />
        )}
      />
      <Route path="/executive" element={p(<ExecutiveAnalyticsPage />, ROLES_LEADERSHIP)} />
      <Route path="/students/360" element={p(<Student360Page />)} />
      <Route path="/classes/compare" element={p(<ClassComparePage />, ROLES_DEPARTMENT_PLUS)} />
      <Route path="/subjects/analytics" element={p(<SubjectAnalyticsPage />, ROLES_DEPARTMENT_PLUS)} />
      <Route path="/teachers/analytics" element={p(<TeacherAnalyticsPage />, ROLES_DEPARTMENT_PLUS)} />
      <Route path="/connections" element={p(<GoogleConnectionPage />, ROLES_LEADERSHIP)} />
      <Route path="/catalog/mapping" element={p(<CatalogMappingPage />, ROLES_LEADERSHIP)} />
      <Route path="/audit/classroom" element={p(<ClassroomAuditPage />, ROLES_ADMIN_PLUS)} />
      {/* Module An toàn trường học — hệ quyền R.* (16 role) tách biệt hoàn
          toàn hệ role app-level dùng ở ROLES_SAFETY_STAFF/allowedRoles,
          nên gate này CHỈ advisory (ẩn/hiện nav+route); phân quyền thật
          luôn nằm ở authz.ts 9 bước (server) + GET /api/safety/me (ẩn/hiện
          nút hành động, không phải lớp chặn) — xem plan Phase 1 §0. 2 route
          công khai (report/lookup) KHÔNG qua p(), giống /login. */}
      <Route path="/safety/report" element={<PublicReportPage />} />
      <Route path="/safety/lookup" element={<PublicLookupPage />} />
      {/* "/safety" mở trên điện thoại tự đổi sang bản Ionic (tab An toàn) —
          xem ghi chú `pResponsive` ở trên, không còn "/mobile-preview/...". */}
      <Route
        path="/safety"
        element={pResponsive(<SafetyDashboardPage />, <MobileMyIncidentsPage />, ROLES_SAFETY_STAFF)}
      />
      {/* CasesListPage tự chuyển bảng -> card khi màn hình hẹp (component
          tự check useIsMobileViewport) — chỉ cần bỏ khung AppShell trên
          điện thoại như các trang mobile khác, không cần 2 component. */}
      <Route path="/safety/cases" element={pResponsive(<CasesListPage />, <CasesListPage />, ROLES_SAFETY_STAFF)} />
      {/* 2 route cũ giữ lại làm redirect — tránh vỡ link cũ đã lưu/đã gửi
          (bookmark, email, chuông thông báo lịch sử trước ngày gộp). */}
      <Route path="/safety/reports/pending" element={<Navigate to="/safety/cases" replace />} />
      <Route path="/safety/incidents" element={<Navigate to="/safety/cases" replace />} />
      {/* Trang chi tiết 1 sự vụ — điểm đến khi bấm vào 1 thẻ ở tab "An
          toàn" bản mobile, nên PHẢI tự đổi sang toàn màn hình (bỏ khung
          AppShell desktop) trên điện thoại như 4 tab kia — dùng lại NGUYÊN
          `IncidentDetailPage`, component này đã tự có nút "Quay lại danh
          sách" riêng, không phụ thuộc AppShell. */}
      <Route
        path="/safety/incidents/:id"
        element={pResponsive(<IncidentDetailPage />, <IncidentDetailPage />, ROLES_SAFETY_STAFF)}
      />
      <Route path="/safety/cockpit" element={p(<EmergencyCockpitPage />, ROLES_SAFETY_STAFF)} />
      <Route path="/safety/audit-logs" element={p(<AuditLogPage />, ROLES_SAFETY_STAFF)} />
      <Route path="/safety/analytics" element={p(<AnalyticsPage />, ROLES_SAFETY_STAFF)} />
      {/* Module Lịch công tác và Giao việc — hệ quyền R.* riêng
          (work-schedule.authz.ts), khớp thiết kế của Mr Tiến (nguyên văn
          trong TICH_HOP_MODULE_LICH_CONG_TAC.md). Gate advisory only. */}
      <Route path="/work-schedule/overview" element={p(<OverviewPage />, ROLES_WORK_SCHEDULE_STAFF)} />
      <Route
        path="/work-schedule"
        element={pResponsive(<EventsListPage />, <MobileMyTasksPage />, ROLES_WORK_SCHEDULE_STAFF)}
      />
      <Route
        path="/work-schedule/tasks"
        element={pResponsive(<TasksListPage />, <MobileMyTasksPage />, ROLES_WORK_SCHEDULE_STAFF)}
      />
      <Route path="/work-schedule/approvals" element={p(<ApprovalCenterPage />, ROLES_WORK_SCHEDULE_STAFF)} />
      <Route path="/work-schedule/reminders" element={p(<RemindersPage />, ROLES_WORK_SCHEDULE_STAFF)} />
      <Route path="/today" element={p(<TodayPage />)} />
      <Route path="/classes" element={p(<ClassesPage />)} />
      <Route path="/classroom" element={pResponsive(<ClassroomPage />, <MobileClassroomPage />)} />
      {/* Tab "Cá nhân" của app di động — trang mới, chưa có bản desktop
          tương đương nên không cần rẽ nhánh Responsive. */}
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <RoleRoute>
              <Suspense fallback={null}>
                <MobileProfilePage />
              </Suspense>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route path="/classroom/sync-runs" element={p(<SyncRunsPage />)} />
      <Route path="/meet" element={p(<MeetPage />)} />
      <Route path="/students" element={p(<StudentsPage />)} />
      <Route path="/teachers" element={p(<TeachersPage />, ROLES_DEPARTMENT_PLUS)} />
      <Route path="/schedules" element={p(<SchedulesPage />)} />
      <Route path="/attendance" element={p(<AttendancePage />)} />
      <Route path="/alerts" element={p(<AlertsPage />, ROLES_DEPARTMENT_PLUS)} />
      <Route path="/reports" element={p(<ReportsPage />)} />
      <Route path="/data-quality" element={p(<DataQualityPage />, ROLES_LEADERSHIP)} />
      <Route path="/system" element={p(<SystemPage />, ROLES_SUPER)} />
      <Route path="/admin" element={p(<AdminPage />, ROLES_USER_MANAGEMENT)} />
    </Routes>
  );
}
