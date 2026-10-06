import { can, type Role } from '../../auth/roles.js';
import { HttpError } from '../../core/http.js';

/**
 * Tách riêng khỏi contacts.routes.ts (không import db) để test được thuần
 * logic phân quyền mà không cần kết nối Postgres — xem contacts.test.ts.
 */
export function assertCanManageGroup(group: { ownerPerId: string | null }, actorPerId: string, role: Role) {
  if (group.ownerPerId === null) {
    if (!can(role, 'MANAGE_USERS')) {
      throw new HttpError(403, 'Chỉ Ban giám hiệu được sửa nhóm liên hệ mặc định toàn trường.', 'PERMISSION_ERROR');
    }
    return;
  }
  if (group.ownerPerId !== actorPerId) {
    throw new HttpError(403, 'Không được sửa nhóm liên hệ của người khác.', 'PERMISSION_ERROR');
  }
}
