import { Routes, Route } from "react-router-dom";
import type { ReactNode } from "react";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { RoleRoute } from "../auth/RoleRoute";
import { AppShell } from "../layout/AppShell";
import LoginPage from "../features/login/LoginPage";
import DashboardPage from "../features/dashboard/DashboardPage";
import TodayPage from "../features/today/TodayPage";
import ClassesPage from "../features/classes/ClassesPage";
import ClassroomPage from "../features/classroom/ClassroomPage";
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
import PendingReportsPage from "../features/safety/PendingReportsPage";
import IncidentsListPage from "../features/safety/IncidentsListPage";
import AuditLogPage from "../features/safety/AuditLogPage";
import AnalyticsPage from "../features/safety/AnalyticsPage";
import EventsListPage from "../features/work-schedule/EventsListPage";
import TasksListPage from "../features/work-schedule/TasksListPage";
import ApprovalCenterPage from "../features/work-schedule/ApprovalCenterPage";
import RemindersPage from "../features/work-schedule/RemindersPage";

const p = (x: ReactNode, allowedRoles?: string[]) => (
  <ProtectedRoute>
    <AppShell>
      <RoleRoute allowedRoles={allowedRoles}>{x}</RoleRoute>
    </AppShell>
  </ProtectedRoute>
);

const ROLES_SUPER = ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN'];
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
      <Route path="/" element={p(<DashboardPage />)} />
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
      <Route path="/safety" element={p(<SafetyDashboardPage />, ROLES_SAFETY_STAFF)} />
      <Route path="/safety/reports/pending" element={p(<PendingReportsPage />, ROLES_SAFETY_STAFF)} />
      <Route path="/safety/incidents" element={p(<IncidentsListPage />, ROLES_SAFETY_STAFF)} />
      <Route path="/safety/incidents/:id" element={p(<IncidentDetailPage />, ROLES_SAFETY_STAFF)} />
      <Route path="/safety/cockpit" element={p(<EmergencyCockpitPage />, ROLES_SAFETY_STAFF)} />
      <Route path="/safety/audit-logs" element={p(<AuditLogPage />, ROLES_SAFETY_STAFF)} />
      <Route path="/safety/analytics" element={p(<AnalyticsPage />, ROLES_SAFETY_STAFF)} />
      {/* Module Lịch công tác và Giao việc — hệ quyền R.* riêng
          (work-schedule.authz.ts), khớp thiết kế của Mr Tiến (nguyên văn
          trong TICH_HOP_MODULE_LICH_CONG_TAC.md). Gate advisory only. */}
      <Route path="/work-schedule" element={p(<EventsListPage />, ROLES_WORK_SCHEDULE_STAFF)} />
      <Route path="/work-schedule/tasks" element={p(<TasksListPage />, ROLES_WORK_SCHEDULE_STAFF)} />
      <Route path="/work-schedule/approvals" element={p(<ApprovalCenterPage />, ROLES_WORK_SCHEDULE_STAFF)} />
      <Route path="/work-schedule/reminders" element={p(<RemindersPage />, ROLES_WORK_SCHEDULE_STAFF)} />
      <Route path="/today" element={p(<TodayPage />)} />
      <Route path="/classes" element={p(<ClassesPage />)} />
      <Route path="/classroom" element={p(<ClassroomPage />)} />
      <Route path="/meet" element={p(<MeetPage />)} />
      <Route path="/students" element={p(<StudentsPage />)} />
      <Route path="/teachers" element={p(<TeachersPage />, ROLES_DEPARTMENT_PLUS)} />
      <Route path="/schedules" element={p(<SchedulesPage />)} />
      <Route path="/attendance" element={p(<AttendancePage />)} />
      <Route path="/alerts" element={p(<AlertsPage />, ROLES_DEPARTMENT_PLUS)} />
      <Route path="/reports" element={p(<ReportsPage />)} />
      <Route path="/data-quality" element={p(<DataQualityPage />, ROLES_LEADERSHIP)} />
      <Route path="/system" element={p(<SystemPage />, ROLES_SUPER)} />
      <Route path="/admin" element={p(<AdminPage />, ROLES_SUPER)} />
    </Routes>
  );
}
