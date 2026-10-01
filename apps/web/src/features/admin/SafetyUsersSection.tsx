/**
 * SafetyUsersSection.tsx — "Quản lý người dùng" DUY NHẤT cho toàn hệ thống
 * (port lại tính năng từng có ở Hub cũ, bị thiếu khi migrate sang
 * SuperApp). KHÔNG có khái niệm "vai trò module An toàn" tách biệt "vai
 * trò hệ thống" — chỉ 1 vai trò R.* mỗi người (dùng chung cho cả module An
 * toàn lẫn Lịch công tác, xem identity.schema.ts + admin.routes.ts), mỗi
 * module tự diễn giải vai trò đó theo đúng phân cấp của mình.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Ban,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  UserPlus
} from 'lucide-react';
import { api } from '../../services/api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const ROLE_LABEL: Record<string, string> = {
  'R.PRINCIPAL': 'Hiệu trưởng',
  'R.VICE_PRINCIPAL': 'Phó Hiệu trưởng',
  'R.DUTY_OFFICER': 'Trực ban',
  'R.DEPT_HEAD': 'Tổ trưởng',
  'R.OFFICE_ADMIN': 'Văn phòng',
  'R.TEACHER': 'Giáo viên',
  'R.HEALTH': 'Y tế trường học',
  'R.COUNSELOR': 'Tư vấn tâm lý',
  'R.SECURITY': 'Bảo vệ/An ninh',
  'R.FACILITY': 'Cơ sở vật chất',
  'R.SYS_ADMIN': 'Quản trị hệ thống',
  'R.AUDITOR': 'Kiểm toán',
  'R.EXTERNAL': 'Bên ngoài / Chỉ xem'
};
const ASSIGNABLE_ROLES = Object.keys(ROLE_LABEL);

const CAMPUS_LABEL: Record<string, string> = {
  MAIN_CAMPUS: 'Điểm trường chính',
  CAMPUS_1: 'Phân hiệu 1',
  CAMPUS_2: 'Phân hiệu 2'
};

interface ClassOption {
  classId: string;
  className: string;
  grade: number | null;
}

interface HomeroomAssignmentRow {
  className: string;
  perId: string;
  name: string | null;
}

interface GradeSupervisorAssignmentRow {
  grade: string;
  perId: string;
  name: string | null;
}

interface SafetyUser {
  // null = CHƯA từng đăng nhập (chỉ có sẵn trong access_allowlist +
  // (có thể) đã được admin gán vai trò trước qua perId) — không có tài
  // khoản Firebase thật nên không đổi mật khẩu/khoá được, chỉ sửa vai trò.
  uid: string | null;
  perId: string | null;
  displayName: string;
  email: string;
  phone: string | null;
  roleId: string | null;
  campusId: string | null;
  domain: string | null;
  disabled: boolean;
  loggedInBefore: boolean;
}

const PAGE_SIZE = 10;

const ALL_ROLES_VALUE = '__all_roles__';
const ALL_STATUS_VALUE = '__all_status__';

export function SafetyUsersSection() {
  const [users, setUsers] = useState<SafetyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'email' | 'role'>('name');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<SafetyUser | null | 'new'>(null);
  const [resetTarget, setResetTarget] = useState<SafetyUser | null>(null);

  // Lớp chủ nhiệm/khối phụ trách — tải 1 lần ở đây (không tải lại mỗi lần
  // mở dialog) để `EditUserDialog` hiện sẵn đúng lớp/khối hiện tại của
  // người đang sửa, và để dropdown chọn lớp lấy đúng danh sách lớp THẬT đã
  // đồng bộ Google Classroom (Sin yêu cầu 2026-09-21: gộp thẳng vào trang
  // Quản trị hiện có, dùng lớp thật thay vì gõ tay tự do).
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [homeroomRows, setHomeroomRows] = useState<HomeroomAssignmentRow[]>([]);
  const [supervisorRows, setSupervisorRows] = useState<GradeSupervisorAssignmentRow[]>([]);

  const loadClassAssignments = () => {
    api<{ total: number; items: ClassOption[] }>('/api/classes')
      .then((x) => setClassOptions(x.items || []))
      .catch(() => setClassOptions([]));
    api<{ items: HomeroomAssignmentRow[] }>('/api/admin/homeroom-assignments')
      .then((x) => setHomeroomRows(x.items || []))
      .catch(() => setHomeroomRows([]));
    api<{ items: GradeSupervisorAssignmentRow[] }>('/api/admin/grade-supervisor-assignments')
      .then((x) => setSupervisorRows(x.items || []))
      .catch(() => setSupervisorRows([]));
  };

  const load = () => {
    setLoading(true);
    api<{ users: SafetyUser[] }>('/api/admin/safety-users')
      .then((x) => setUsers(x.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    loadClassAssignments();
  }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    let rows = users.filter((u) => {
      if (s && !(u.displayName?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s))) return false;
      if (roleFilter && u.roleId !== roleFilter) return false;
      if (statusFilter === 'disabled' && !u.disabled) return false;
      if (statusFilter === 'active' && u.disabled) return false;
      if (statusFilter === 'unmanaged' && u.roleId) return false;
      if (statusFilter === 'pending' && u.loggedInBefore) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      const av = sortKey === 'name' ? a.displayName : sortKey === 'email' ? a.email : a.roleId || '';
      const bv = sortKey === 'name' ? b.displayName : sortKey === 'email' ? b.email : b.roleId || '';
      return av.localeCompare(bv) * sortDir;
    });
    return rows;
  }, [users, search, roleFilter, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key: 'name' | 'email' | 'role') => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const handleToggleDisable = async (u: SafetyUser) => {
    if (!u.uid) return; // chưa đăng nhập -> chưa có tài khoản Firebase thật để khoá
    try {
      await api.post(`/api/admin/safety-users/${u.uid}/toggle-disable`, { disabled: !u.disabled });
      setToast({ text: `Đã ${u.disabled ? 'mở khoá' : 'khoá'} tài khoản ${u.displayName}.`, severity: 'success' });
      load();
    } catch (e: any) {
      setToast({ text: `Lỗi: ${e.message}`, severity: 'error' });
    }
  };

  const SortHeader = ({ col, children }: { col: 'name' | 'email' | 'role'; children: React.ReactNode }) => (
    <button type="button" onClick={() => toggleSort(col)} className="flex items-center gap-1 font-bold">
      {children}
      {sortKey === col && (sortDir === 1 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />)}
    </button>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold tracking-tight text-[#0f172a]">Danh sách người dùng</p>
          <p className="text-sm text-slate-500">
            1 vai trò dùng chung cho toàn hệ thống (Tổ trưởng/Trực ban/Y tế/Giáo viên...) — áp dụng cho cả module An toàn lẫn Lịch công tác, không cần cấp
            riêng. Tạo tài khoản mới, reset mật khẩu, khoá/mở khoá tại đây.
          </p>
        </div>
        <Button onClick={() => setEditing('new')} className="rounded-lg">
          <UserPlus className="size-[18px]" />
          Thêm người dùng
        </Button>
      </div>

      {toast && (
        <div
          className={cn(
            'mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm',
            toast.severity === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
          )}
        >
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Đóng">
            ✕
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Tìm tên hoặc email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1"
        />
        <Select
          value={roleFilter || ALL_ROLES_VALUE}
          onValueChange={(v) => {
            setRoleFilter(v === ALL_ROLES_VALUE ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="min-w-[180px]">
            <SelectValue placeholder="Vai trò" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ROLES_VALUE}>Tất cả vai trò</SelectItem>
            {ASSIGNABLE_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter || ALL_STATUS_VALUE}
          onValueChange={(v) => {
            setStatusFilter(v === ALL_STATUS_VALUE ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="min-w-40">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUS_VALUE}>Tất cả</SelectItem>
            <SelectItem value="active">Đang hoạt động</SelectItem>
            <SelectItem value="disabled">Đã khoá</SelectItem>
            <SelectItem value="unmanaged">Chưa cấp vai trò</SelectItem>
            <SelectItem value="pending">Chưa đăng nhập</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-200">
        <Table>
          <TableHeader className="sticky top-0 bg-white">
            <TableRow>
              <TableHead>
                <SortHeader col="name">Tài khoản</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader col="role">Vai trò</SortHeader>
              </TableHead>
              <TableHead className="text-xs font-medium text-slate-500">Cơ sở / Tổ</TableHead>
              <TableHead className="text-xs font-medium text-slate-500">Trạng thái</TableHead>
              <TableHead className="text-right text-xs font-medium text-slate-500">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-8 text-center">
                  <div className="mx-auto size-6 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
                </TableCell>
              </TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                  Không có người dùng khớp bộ lọc.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((u) => (
                <TableRow key={u.uid || u.perId || u.email}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7 bg-primary text-xs font-bold text-white">
                        <AvatarFallback className="bg-primary text-xs text-white">{(u.displayName || u.email)?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-[#0f172a]">{u.displayName || '(chưa đặt tên)'}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.roleId ? (
                      <Badge variant="outline" className="bg-secondary text-xs text-[#1d4ed8]">
                        {ROLE_LABEL[u.roleId] || u.roleId}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-500">— chưa cấp</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-500">
                      {u.campusId ? CAMPUS_LABEL[u.campusId] || u.campusId : '—'}
                      {u.domain ? ` · ${u.domain}` : ''}
                    </span>
                  </TableCell>
                  <TableCell>
                    {!u.loggedInBefore ? (
                      <Badge variant="outline" className="bg-amber-50 text-xs text-amber-700">
                        Chưa đăng nhập
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs font-bold',
                          u.disabled ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-emerald-200 bg-emerald-50 text-emerald-600'
                        )}
                      >
                        {u.disabled ? 'Đã khoá' : 'Đang hoạt động'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(u)}>
                            <Pencil className="size-[18px]" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Sửa vai trò/cơ sở</TooltipContent>
                      </Tooltip>
                      {u.loggedInBefore && (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon-sm" onClick={() => setResetTarget(u)}>
                                <KeyRound className="size-[18px]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reset mật khẩu</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleToggleDisable(u)}
                                className={u.disabled ? 'text-emerald-600' : 'text-red-600'}
                              >
                                {u.disabled ? <CheckCircle className="size-[18px]" /> : <Ban className="size-[18px]" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{u.disabled ? 'Mở khoá' : 'Khoá tài khoản'}</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-slate-500">
            Trang {page}/{totalPages}
          </span>
          <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {editing !== null && (
        <EditUserDialog
          user={editing === 'new' ? null : editing}
          classOptions={classOptions}
          homeroomRows={homeroomRows}
          supervisorRows={supervisorRows}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            setToast({ text: msg, severity: 'success' });
            load();
            loadClassAssignments();
          }}
        />
      )}

      {resetTarget && (
        <ResetPasswordDialog
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={(msg) => {
            setResetTarget(null);
            setToast({ text: msg, severity: 'success' });
          }}
        />
      )}
    </div>
  );
}

const NONE_VALUE = '__none__';

function EditUserDialog({
  user,
  classOptions,
  homeroomRows,
  supervisorRows,
  onClose,
  onSaved
}: {
  user: SafetyUser | null;
  classOptions: ClassOption[];
  homeroomRows: HomeroomAssignmentRow[];
  supervisorRows: GradeSupervisorAssignmentRow[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEdit = !!user;
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleId, setRoleId] = useState(user?.roleId || 'R.TEACHER');
  const [campusId, setCampusId] = useState(user?.campusId || '');
  const [domain, setDomain] = useState(user?.domain || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Lớp chủ nhiệm/khối phụ trách — chỉ áp dụng cho vai trò Giáo viên. Hiện
  // sẵn giá trị hiện tại nếu người này đang sửa đã có trong 2 bảng gán.
  const [homeroomClassName, setHomeroomClassName] = useState(() => homeroomRows.find((r) => r.perId === user?.perId)?.className || '');
  const [supervisorGrade, setSupervisorGrade] = useState(() => supervisorRows.find((r) => r.perId === user?.perId)?.grade || '');
  // Chỉ khoá 2 trường này khi đang SỬA 1 người CHƯA từng đăng nhập/chưa
  // từng được gán vai trò nào (perId null thật) — người MỚI tạo sẽ có
  // perId ngay sau khi lưu (lấy từ response), không cần khoá.
  const homeroomDisabled = isEdit && !user?.perId;
  const gradeOptions = Array.from(new Set(classOptions.map((c) => c.grade).filter((g): g is number => g != null))).sort((a, b) => a - b);

  const handleSave = async () => {
    setError('');
    if (!displayName.trim()) {
      setError('Chưa nhập tên.');
      return;
    }
    if (roleId === 'R.DEPT_HEAD' && !domain.trim()) {
      setError('Vai trò Tổ trưởng bắt buộc nhập Lĩnh vực/Tổ.');
      return;
    }
    if (!isEdit) {
      if (!email.trim()) {
        setError('Chưa nhập email.');
        return;
      }
      // Không còn bắt buộc nhập mật khẩu — Sin phản hồi 2026-09-24: email đã
      // từng tự đăng nhập Google (Firebase Auth có sẵn user) nhưng chưa có
      // hồ sơ nội bộ thì để trống mật khẩu vẫn tạo được (backend tự dùng
      // lại uid Firebase có sẵn, không tạo user mới, xem admin.routes.ts).
      if (password && password.length < 6) {
        setError('Mật khẩu tối thiểu 6 ký tự (có thể để trống nếu email này đã từng đăng nhập Google trước đó).');
        return;
      }
    }
    setSaving(true);
    try {
      let perId: string | null = user?.perId || null;
      let msg: string;
      if (isEdit && user!.uid) {
        await api.patch(`/api/admin/safety-users/${user!.uid}`, {
          displayName: displayName.trim(),
          phone: phone.trim() || null,
          roleId,
          oldRoleId: user!.roleId,
          campusId: campusId || null,
          domain: roleId === 'R.DEPT_HEAD' ? domain.trim() : null
        });
        msg = `Đã cập nhật ${displayName}.`;
      } else if (isEdit) {
        // Chưa từng đăng nhập -> không có uid, định danh bằng email (đã
        // có sẵn trong access_allowlist). Chưa có tài khoản Firebase thật
        // nên không sửa được ở đây — chỉ sửa vai trò/cơ sở/tổ.
        const result = await api.patch<{ perId: string }>(`/api/admin/safety-users/pending/${encodeURIComponent(user!.email)}`, {
          displayName: displayName.trim(),
          phone: phone.trim() || null,
          roleId,
          oldRoleId: user!.roleId,
          campusId: campusId || null,
          domain: roleId === 'R.DEPT_HEAD' ? domain.trim() : null
        });
        perId = result.perId;
        msg = `Đã gán vai trò cho ${displayName} (sẽ có hiệu lực ngay khi họ đăng nhập lần đầu).`;
      } else {
        const result = await api.post<{ perId: string }>('/api/admin/safety-users', {
          displayName: displayName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          password: password.trim() || undefined,
          roleId,
          campusId: campusId || null,
          domain: roleId === 'R.DEPT_HEAD' ? domain.trim() : null
        });
        perId = result.perId;
        msg = `Đã tạo tài khoản cho ${displayName}.`;
      }

      // Lớp chủ nhiệm/khối phụ trách — chỉ ghi khi là Giáo viên và đã có
      // perId thật (luôn có tại đây trừ trường hợp bị khoá ở trên).
      if (roleId === 'R.TEACHER' && perId && !homeroomDisabled) {
        const notes: string[] = [];
        try {
          await api.patch(`/api/admin/homeroom-assignments/${encodeURIComponent(perId)}`, { className: homeroomClassName || null, name: displayName.trim() });
          if (homeroomClassName) notes.push(`chủ nhiệm lớp ${homeroomClassName}`);
        } catch (e: any) {
          notes.push(`LỖI gán lớp chủ nhiệm: ${e.message}`);
        }
        try {
          await api.patch(`/api/admin/grade-supervisor-assignments/${encodeURIComponent(perId)}`, { grade: supervisorGrade || null, name: displayName.trim() });
          if (supervisorGrade) notes.push(`phụ trách khối ${supervisorGrade}`);
        } catch (e: any) {
          notes.push(`LỖI gán khối phụ trách: ${e.message}`);
        }
        if (notes.length > 0) msg += ` Đã ${notes.join(', ')}.`;
      }

      onSaved(msg);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Sửa người dùng' : 'Thêm người dùng'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="su-name">Tên hiển thị</Label>
            <Input id="su-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="su-email">Email</Label>
            <Input id="su-email" value={email} disabled={isEdit} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="su-phone">Số điện thoại (tuỳ chọn — để gọi/nhắn khi gấp)</Label>
            <Input id="su-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {!isEdit && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="su-password">Mật khẩu tạm (bỏ trống nếu email đã từng đăng nhập Google)</Label>
              <div className="relative">
                <Input id="su-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-9" />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Vai trò</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Cơ sở</Label>
            <Select value={campusId || NONE_VALUE} onValueChange={(v) => setCampusId(v === NONE_VALUE ? '' : v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>— Không gắn cơ sở —</SelectItem>
                {Object.entries(CAMPUS_LABEL).map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {roleId === 'R.DEPT_HEAD' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="su-domain">Lĩnh vực/Tổ</Label>
              <Input id="su-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="VD: Tổ Toán, Tổ Văn phòng..." />
              <p className="text-xs text-muted-foreground">Các Tổ trưởng cùng tổ phải nhập giống hệt nhau.</p>
            </div>
          )}
          {roleId === 'R.TEACHER' && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Lớp chủ nhiệm (GVCN)</Label>
                <Select value={homeroomClassName || NONE_VALUE} onValueChange={(v) => setHomeroomClassName(v === NONE_VALUE ? '' : v)} disabled={homeroomDisabled}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>— Không chủ nhiệm —</SelectItem>
                    {classOptions.map((c) => (
                      <SelectItem key={c.classId} value={c.className}>
                        {c.className}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {homeroomDisabled
                    ? 'Cần tài khoản đã có mã định danh (đã đăng nhập lần đầu) mới gán được lớp chủ nhiệm.'
                    : 'Danh sách lấy từ lớp đã đồng bộ Google Classroom.'}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Khối phụ trách</Label>
                <Select value={supervisorGrade || NONE_VALUE} onValueChange={(v) => setSupervisorGrade(v === NONE_VALUE ? '' : v)} disabled={homeroomDisabled}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>— Không phụ trách khối —</SelectItem>
                    {gradeOptions.map((g) => (
                      <SelectItem key={g} value={String(g)}>
                        Khối {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? 'Đang lưu...' : isEdit ? 'Lưu' : 'Tạo tài khoản'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose, onDone }: { user: SafetyUser; onClose: () => void; onDone: (msg: string) => void }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!password || password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự.');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/api/admin/safety-users/${user.uid}/reset-password`, { newPassword: password });
      onDone(`Đã đặt mật khẩu mới cho ${user.displayName}.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Reset mật khẩu — {user.displayName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-pwd">Mật khẩu mới (tối thiểu 6 ký tự)</Label>
            <div className="relative">
              <Input
                id="reset-pwd"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="pr-9"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? 'Đang đổi...' : 'Đổi mật khẩu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
