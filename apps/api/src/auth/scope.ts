import { and, eq } from 'drizzle-orm';
import { db } from '../core/db/client.js';
import { courses, courseMembers } from '../modules/classroom/classroom.schema.js';
import type { AppUser } from './middleware.js';

const UNRESTRICTED_ROLES = new Set(['SYSTEM_SUPER_ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']);

export interface EffectiveScope {
  classIds: Set<string>;
  grades: Set<number>;
}

/**
 * Phạm vi lớp/khối một GV được xem dữ liệu học sinh. `null` = không giới
 * hạn (vai trò quản lý toàn trường). Nếu admin đã gán tay `users.scope`
 * (qua trang quản trị) thì dùng đúng giá trị đó — admin luôn có quyền sửa
 * lại nếu suy luận tự động sai. Nếu chưa gán tay, tự suy từ vai trò GV
 * thật trong `course_members` (Google Classroom đã đồng bộ) — GV dạy lớp
 * nào thấy đúng lớp đó, không chờ admin gán tay từng người (quyết định
 * của Sin: "tự suy luận, admin sửa lại được nếu sai").
 */
export async function resolveEffectiveScope(user: AppUser): Promise<EffectiveScope | null> {
  if (UNRESTRICTED_ROLES.has(user.role)) return null;

  if (user.scope && ((user.scope.classIds?.length ?? 0) > 0 || (user.scope.grades?.length ?? 0) > 0)) {
    return {
      classIds: new Set(user.scope.classIds ?? []),
      grades: new Set(user.scope.grades ?? [])
    };
  }

  const rows = await db
    .select({ classId: courses.classId, grade: courses.grade })
    .from(courseMembers)
    .innerJoin(courses, eq(courses.id, courseMembers.courseId))
    .where(and(eq(courseMembers.role, 'TEACHER'), eq(courseMembers.email, user.email)));

  return {
    classIds: new Set(rows.map((r) => r.classId).filter((v): v is string => !!v)),
    grades: new Set(rows.map((r) => r.grade).filter((v): v is number => v != null))
  };
}

function gradeOfClassId(classId?: string | null): number | undefined {
  const m = classId ? classId.match(/^\d+/) : null;
  return m ? Number(m[0]) : undefined;
}

/** true nếu bản ghi (đã gắn classId) nằm trong phạm vi được xem. */
export function matchesScope(item: { classId?: string | null }, scope: EffectiveScope): boolean {
  if (scope.classIds.size === 0 && scope.grades.size === 0) return false;
  if (item.classId && scope.classIds.has(item.classId)) return true;
  const grade = gradeOfClassId(item.classId);
  return grade != null && scope.grades.has(grade);
}
