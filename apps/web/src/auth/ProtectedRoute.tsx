import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { Button } from '@/components/ui/button';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const a = useAuth();
  if (a.loading) {
    return (
      <div className="grid h-screen place-items-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!a.user && !a.profile) return <Navigate to="/login" replace />;
  if (!a.profile) {
    return (
      <div className="grid h-screen place-items-center">
        <div className="rounded-xl border border-slate-200 p-8 text-center">
          <p className="mb-4 text-xl font-bold text-[#0f172a]">Tài khoản chưa được cấp quyền</p>
          <Button onClick={a.logout}>Đăng xuất</Button>
        </div>
      </div>
    );
  }
  return children;
}
