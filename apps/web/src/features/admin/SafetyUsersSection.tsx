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
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Alert,
  CircularProgress,
  Pagination,
  InputAdornment
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAddRounded';
import EditIcon from '@mui/icons-material/EditRounded';
import LockResetIcon from '@mui/icons-material/LockResetRounded';
import BlockIcon from '@mui/icons-material/BlockRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { api } from '../../services/api';

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

  return (
    <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(15,23,42,0.04)', bgcolor: '#ffffff' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1.5 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#0f172a', letterSpacing: '-0.01em' }}>
              Danh sách người dùng
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
              1 vai trò dùng chung cho toàn hệ thống (Tổ trưởng/Trực ban/Y tế/Giáo viên...) — áp dụng cho cả module An toàn lẫn Lịch công tác, không cần cấp riêng. Tạo tài khoản mới, reset mật khẩu, khoá/mở khoá tại đây.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon sx={{ fontSize: 18 }} />}
            onClick={() => setEditing('new')}
            sx={{ bgcolor: '#2563eb', color: '#fff', '&:hover': { bgcolor: '#1d4ed8' }, fontWeight: 700, fontSize: '0.8125rem', textTransform: 'none', borderRadius: 2 }}
          >
            Thêm người dùng
          </Button>
        </Box>

        {toast && (
          <Alert severity={toast.severity} onClose={() => setToast(null)} sx={{ mb: 2, borderRadius: 2 }}>
            {toast.text}
          </Alert>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder="Tìm tên hoặc email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            sx={{ flex: 1 }}
          />
          <TextField
            select
            size="small"
            label="Vai trò"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Tất cả vai trò</MenuItem>
            {ASSIGNABLE_ROLES.map((r) => (
              <MenuItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Trạng thái"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="active">Đang hoạt động</MenuItem>
            <MenuItem value="disabled">Đã khoá</MenuItem>
            <MenuItem value="unmanaged">Chưa cấp vai trò</MenuItem>
            <MenuItem value="pending">Chưa đăng nhập</MenuItem>
          </TextField>
        </Stack>

        <TableContainer sx={{ maxHeight: 520 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel active={sortKey === 'name'} direction={sortDir === 1 ? 'asc' : 'desc'} onClick={() => toggleSort('name')}>
                    Tài khoản
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel active={sortKey === 'role'} direction={sortDir === 1 ? 'asc' : 'desc'} onClick={() => toggleSort('role')}>
                    Vai trò
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Cơ sở / Tổ</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Trạng thái</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Hành động
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 4, textAlign: 'center' }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 4, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Không có người dùng khớp bộ lọc.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((u) => (
                  <TableRow key={u.uid || u.perId || u.email} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#2563eb', color: '#fff', fontWeight: 700 }}>
                          {(u.displayName || u.email)?.[0]?.toUpperCase() || 'U'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a' }}>
                            {u.displayName || '(chưa đặt tên)'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {u.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {u.roleId ? (
                        <Chip label={ROLE_LABEL[u.roleId] || u.roleId} size="small" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 700, fontSize: '0.7rem' }} />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          — chưa cấp
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {u.campusId ? CAMPUS_LABEL[u.campusId] || u.campusId : '—'}
                        {u.domain ? ` · ${u.domain}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {!u.loggedInBefore ? (
                        <Chip
                          label="Chưa đăng nhập"
                          size="small"
                          sx={{ bgcolor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontWeight: 700, fontSize: '0.7rem' }}
                        />
                      ) : (
                        <Chip
                          label={u.disabled ? 'Đã khoá' : 'Đang hoạt động'}
                          size="small"
                          sx={{
                            bgcolor: u.disabled ? '#f8fafc' : '#ecfdf5',
                            color: u.disabled ? '#64748b' : '#059669',
                            border: u.disabled ? '1px solid #e2e8f0' : '1px solid #a7f3d0',
                            fontWeight: 700,
                            fontSize: '0.7rem'
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Sửa vai trò/cơ sở">
                        <IconButton size="small" onClick={() => setEditing(u)}>
                          <EditIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      {u.loggedInBefore && (
                        <>
                          <Tooltip title="Reset mật khẩu">
                            <IconButton size="small" onClick={() => setResetTarget(u)}>
                              <LockResetIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={u.disabled ? 'Mở khoá' : 'Khoá tài khoản'}>
                            <IconButton size="small" onClick={() => handleToggleDisable(u)} sx={{ color: u.disabled ? '#059669' : '#dc2626' }}>
                              {u.disabled ? <CheckCircleIcon sx={{ fontSize: 18 }} /> : <BlockIcon sx={{ fontSize: 18 }} />}
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Pagination count={totalPages} page={page} onChange={(_e, p) => setPage(p)} size="small" />
          </Box>
        )}
      </CardContent>

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
    </Card>
  );
}

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
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{isEdit ? 'Sửa người dùng' : 'Thêm người dùng'}</DialogTitle>
      <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Tên hiển thị" size="small" fullWidth value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <TextField label="Email" size="small" fullWidth value={email} disabled={isEdit} onChange={(e) => setEmail(e.target.value)} />
          <TextField
            label="Số điện thoại (tuỳ chọn — để gọi/nhắn khi gấp)"
            size="small"
            fullWidth
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {!isEdit && (
            <TextField
              label="Mật khẩu tạm (bỏ trống nếu email đã từng đăng nhập Google)"
              size="small"
              fullWidth
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPassword((v) => !v)} edge="end" tabIndex={-1}>
                        {showPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
            />
          )}
          <TextField select label="Vai trò" size="small" fullWidth value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {ASSIGNABLE_ROLES.map((r) => (
              <MenuItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Cơ sở" size="small" fullWidth value={campusId} onChange={(e) => setCampusId(e.target.value)}>
            <MenuItem value="">— Không gắn cơ sở —</MenuItem>
            {Object.entries(CAMPUS_LABEL).map(([id, label]) => (
              <MenuItem key={id} value={id}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          {roleId === 'R.DEPT_HEAD' && (
            <TextField
              label="Lĩnh vực/Tổ"
              size="small"
              fullWidth
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="VD: Tổ Toán, Tổ Văn phòng..."
              helperText="Các Tổ trưởng cùng tổ phải nhập giống hệt nhau."
            />
          )}
          {roleId === 'R.TEACHER' && (
            <>
              <TextField
                select
                label="Lớp chủ nhiệm (GVCN)"
                size="small"
                fullWidth
                value={homeroomClassName}
                onChange={(e) => setHomeroomClassName(e.target.value)}
                disabled={homeroomDisabled}
                helperText={
                  homeroomDisabled
                    ? 'Cần tài khoản đã có mã định danh (đã đăng nhập lần đầu) mới gán được lớp chủ nhiệm.'
                    : 'Danh sách lấy từ lớp đã đồng bộ Google Classroom.'
                }
              >
                <MenuItem value="">— Không chủ nhiệm —</MenuItem>
                {classOptions.map((c) => (
                  <MenuItem key={c.classId} value={c.className}>
                    {c.className}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Khối phụ trách"
                size="small"
                fullWidth
                value={supervisorGrade}
                onChange={(e) => setSupervisorGrade(e.target.value)}
                disabled={homeroomDisabled}
              >
                <MenuItem value="">— Không phụ trách khối —</MenuItem>
                {gradeOptions.map((g) => (
                  <MenuItem key={g} value={String(g)}>
                    Khối {g}
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: '#64748b' }}>
          Huỷ
        </Button>
        <Button
          variant="contained"
          disabled={saving}
          onClick={handleSave}
          sx={{ bgcolor: '#2563eb', color: '#fff', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
        >
          {saving ? 'Đang lưu...' : isEdit ? 'Lưu' : 'Tạo tài khoản'}
        </Button>
      </DialogActions>
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
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Reset mật khẩu — {user.displayName}</DialogTitle>
      <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Mật khẩu mới (tối thiểu 6 ký tự)"
            size="small"
            fullWidth
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPassword((v) => !v)} edge="end" tabIndex={-1}>
                      {showPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                )
              }
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: '#64748b' }}>
          Huỷ
        </Button>
        <Button
          variant="contained"
          disabled={saving}
          onClick={handleSave}
          sx={{ bgcolor: '#2563eb', color: '#fff', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
        >
          {saving ? 'Đang đổi...' : 'Đổi mật khẩu'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
