/**
 * adminAccess.ts — nguồn DUY NHẤT cho biết "tài khoản FermatTech (quản trị
 * cấp cao nhất)" là ai, dùng ở cả AppShell.tsx (ẩn/hiện mục sidebar) và
 * App.tsx (điều hướng trang chủ) — Sin yêu cầu 2026-09-21: các mục liên
 * quan Google Classroom/lớp học số chỉ tài khoản này còn thấy.
 */
export const FERMATTECH_ADMIN_EMAIL = 'admin@badinhedu.vn';

export function isFermatTechAdminEmail(email: string | null | undefined): boolean {
  return (email || '').toLowerCase() === FERMATTECH_ADMIN_EMAIL;
}
