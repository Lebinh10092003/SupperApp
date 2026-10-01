import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';

export function RoleRoute({
  children,
  allowedRoles
}: {
  children: ReactNode;
  allowedRoles?: string[];
}) {
  const { profile } = useAuth();
  if (!allowedRoles || allowedRoles.length === 0) {
    return <>{children}</>;
  }
  const userRole = profile?.role;
  if (!userRole || !allowedRoles.includes(userRole)) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-8">
        <div className="max-w-[480px] rounded-xl border border-slate-200 p-8 text-center">
          <p className="mb-2 text-lg font-bold text-red-600">Truy cập bị từ chối</p>
          <p className="text-sm text-slate-500">
            Vai trò hiện tại ({userRole || 'Chưa xác định'}) không có quyền truy cập vào phân hệ này. Vui lòng liên hệ Quản trị viên để được cấp
            quyền.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
