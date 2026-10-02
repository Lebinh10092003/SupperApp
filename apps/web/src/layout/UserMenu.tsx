import { useState } from 'react';
import { ChevronDown, Eye, EyeOff, Key, LogOut, User } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const roleLabelMap: Record<string, string> = {
  SYSTEM_SUPER_ADMIN: 'Quản trị viên cấp cao nhất',
  SCHOOL_ADMIN: 'Hiệu trưởng',
  SYSTEM_ADMIN: 'Quản trị hệ thống',
  PRINCIPAL: 'Hiệu trưởng',
  VICE_PRINCIPAL: 'Phó Hiệu trưởng',
  DEPARTMENT_HEAD: 'Tổ trưởng chuyên môn',
  HOMEROOM: 'GV Chủ nhiệm',
  TEACHER: 'Giáo viên',
  DATA_VIEWER: 'Người xem dữ liệu',
  VIEWER: 'Người xem dữ liệu'
};

/** Avatar + menu tài khoản + 2 dialog (sửa thông tin cá nhân, đổi mật khẩu)
 * — y hệt phần "User Session Footer" + 2 Dialog cuối `drawerContent` cũ
 * trong AppShell.tsx (bản MUI). Tách component riêng vì đây là khối state
 * độc lập (không phụ thuộc gì từ Sidebar/AppShell ngoài useAuth()). */
export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { profile, user, logout, changePassword, updateDisplayName } = useAuth();
  const hasPasswordProvider = !!user?.providerData?.some((p) => p.providerId === 'password');

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [pwdOpen, setPwdOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);

  const closePwdDialog = () => {
    setPwdOpen(false);
    setCurrentPwd('');
    setNewPwd('');
    setShowCurrentPwd(false);
    setShowNewPwd(false);
    setPwdError('');
    setPwdSuccess(false);
  };

  const handleChangePassword = async () => {
    if (!currentPwd || newPwd.length < 6) return;
    setPwdError('');
    setPwdSaving(true);
    try {
      await changePassword(currentPwd, newPwd);
      setPwdSuccess(true);
      setCurrentPwd('');
      setNewPwd('');
    } catch (e: any) {
      const code = e?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPwdError('Mật khẩu hiện tại không đúng.');
      } else if (code === 'auth/weak-password') {
        setPwdError('Mật khẩu mới quá ngắn — cần tối thiểu 6 ký tự.');
      } else {
        setPwdError('Đổi mật khẩu không thành công. Vui lòng thử lại.');
      }
    } finally {
      setPwdSaving(false);
    }
  };

  const openProfileDialog = () => {
    setProfileName(profile?.displayName || '');
    setProfileError('');
    setProfileSuccess(false);
    setProfileOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) return;
    setProfileError('');
    setProfileSaving(true);
    try {
      await updateDisplayName(profileName.trim());
      setProfileSuccess(true);
    } catch {
      setProfileError('Cập nhật không thành công. Vui lòng thử lại.');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <>
      <div className="border-t border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-900">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800',
                collapsed && 'justify-center px-0'
              )}
            >
              <Avatar className="size-[34px] shrink-0 shadow-[0_2px_5px_rgba(37,99,235,0.25)]">
                <AvatarFallback className="bg-gradient-to-br from-primary to-[#1d4ed8] font-bold text-white">
                  {profile?.displayName?.[0] || 'G'}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1 overflow-hidden text-left">
                    <p className="truncate text-sm font-bold text-[#0f172a] dark:text-slate-100">{profile?.displayName || 'Người dùng'}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{roleLabelMap[profile?.role || ''] || profile?.role || 'Hệ thống'}</p>
                  </div>
                  <ChevronDown className="size-5 shrink-0 text-slate-400 dark:text-slate-500" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="w-56">
            <DropdownMenuItem onClick={openProfileDialog}>
              <User className="size-4" />
              Sửa thông tin cá nhân
            </DropdownMenuItem>
            {hasPasswordProvider && (
              <DropdownMenuItem onClick={() => setPwdOpen(true)}>
                <Key className="size-4" />
                Đổi mật khẩu
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => logout()} className="text-red-500 focus:text-red-500">
              <LogOut className="size-4 text-red-500" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Sửa thông tin cá nhân</DialogTitle>
          </DialogHeader>
          {profileSuccess ? (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">Đã cập nhật thông tin cá nhân.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {profileError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">{profileError}</p>}
              <Label htmlFor="profile-name">Tên hiển thị</Label>
              <Input id="profile-name" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)}>
              {profileSuccess ? 'Đóng' : 'Huỷ'}
            </Button>
            {!profileSuccess && (
              <Button onClick={handleSaveProfile} disabled={profileSaving || !profileName.trim()}>
                {profileSaving && <Loader2 className="size-4 animate-spin" />}
                {profileSaving ? 'Đang lưu...' : 'Lưu'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pwdOpen} onOpenChange={(open) => (open ? setPwdOpen(true) : closePwdDialog())}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Đổi mật khẩu</DialogTitle>
          </DialogHeader>
          {pwdSuccess ? (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">Đã đổi mật khẩu thành công.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {pwdError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">{pwdError}</p>}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="current-pwd">Mật khẩu hiện tại</Label>
                <div className="relative">
                  <Input
                    id="current-pwd"
                    type={showCurrentPwd ? 'text' : 'password'}
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    autoComplete="current-password"
                    className="pr-9"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowCurrentPwd((v) => !v)}
                    className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    {showCurrentPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-pwd">Mật khẩu mới</Label>
                <div className="relative">
                  <Input
                    id="new-pwd"
                    type={showNewPwd ? 'text' : 'password'}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    autoComplete="new-password"
                    className="pr-9"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowNewPwd((v) => !v)}
                    className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    {showNewPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Tối thiểu 6 ký tự</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closePwdDialog}>
              {pwdSuccess ? 'Đóng' : 'Huỷ'}
            </Button>
            {!pwdSuccess && (
              <Button onClick={handleChangePassword} disabled={pwdSaving || !currentPwd || newPwd.length < 6}>
                {pwdSaving && <Loader2 className="size-4 animate-spin" />}
                {pwdSaving ? 'Đang xử lý...' : 'Đổi mật khẩu'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
