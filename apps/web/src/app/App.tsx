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
