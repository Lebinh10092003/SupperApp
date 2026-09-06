/**
 * Single Source of Truth định nghĩa phân loại Giáo viên / Học sinh
 * Đảm bảo 100% nhất quán giữa Dashboard, Analytics, People API và Directory
 */

export function isTeacher(data: any): boolean {
  if (!data) return false;
  const p = String(data.personType || data.role || '').toUpperCase();
  return p === 'TEACHER' || p === 'GIAO_VIEN';
}

export function isStudent(data: any): boolean {
  if (!data) return false;
  const p = String(data.personType || data.role || '').toUpperCase();
  return p === 'STUDENT' || p === 'HOC_SINH';
}
