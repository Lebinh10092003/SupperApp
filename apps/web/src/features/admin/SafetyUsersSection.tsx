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
  MAIN_CAMPUS: 'Cơ sở chính',
  CAMPUS_1: 'Phân hiệu 1',
  CAMPUS_2: 'Phân hiệu 2'
};

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

  const load = () => {
    setLoading(true);
    api<{ users: SafetyUser[] }>('/api/admin/safety-users')
      .then((x) => setUsers(x.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
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
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            setToast({ text: msg, severity: 'success' });
            load();
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

function EditUserDialog({ user, onClose, onSaved }: { user: SafetyUser | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const isEdit = !!user;
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleId, setRoleId] = useState(user?.roleId || 'R.TEACHER');
  const [campusId, setCampusId] = useState(user?.campusId || '');
  const [domain, setDomain] = useState(user?.domain || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
      if (!password || password.length < 6) {
        setError('Mật khẩu tối thiểu 6 ký tự.');
        return;
      }
    }
    setSaving(true);
    try {
      if (isEdit && user!.uid) {
        await api.patch(`/api/admin/safety-users/${user!.uid}`, {
          displayName: displayName.trim(),
          roleId,
          oldRoleId: user!.roleId,
          campusId: campusId || null,
          domain: roleId === 'R.DEPT_HEAD' ? domain.trim() : null
        });
        onSaved(`Đã cập nhật ${displayName}.`);
      } else if (isEdit) {
        // Chưa từng đăng nhập -> không có uid, định danh bằng email (đã
        // có sẵn trong access_allowlist). Chưa có tài khoản Firebase thật
        // nên không sửa được ở đây — chỉ sửa vai trò/cơ sở/tổ.
        await api.patch(`/api/admin/safety-users/pending/${encodeURIComponent(user!.email)}`, {
          displayName: displayName.trim(),
          roleId,
          oldRoleId: user!.roleId,
          campusId: campusId || null,
          domain: roleId === 'R.DEPT_HEAD' ? domain.trim() : null
        });
        onSaved(`Đã gán vai trò cho ${displayName} (sẽ có hiệu lực ngay khi họ đăng nhập lần đầu).`);
      } else {
        await api.post('/api/admin/safety-users', {
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          roleId,
          campusId: campusId || null,
          domain: roleId === 'R.DEPT_HEAD' ? domain.trim() : null
        });
        onSaved(`Đã tạo tài khoản cho ${displayName}.`);
      }
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
          {!isEdit && (
            <TextField
              label="Mật khẩu tạm (tối thiểu 6 ký tự)"
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
