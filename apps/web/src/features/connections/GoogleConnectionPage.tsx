import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CloudCheck,
  KeyRound,
  RefreshCw,
  RotateCw,
  GraduationCap,
  Copy,
  ExternalLink,
  CheckCircle2,
  Trash2,
  TriangleAlert,
  Settings,
  ChevronDown,
  PlayCircle,
  Loader2,
  X
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { useAuth } from '../../auth/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, formatDateTime } from '@/lib/utils';

const CLASSROOM_SCOPES_STRING = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'https://www.googleapis.com/auth/classroom.topics.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails'
].join(' ');

const MSG_STYLE: Record<'success' | 'error' | 'info', string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue-200 bg-secondary text-blue-800'
};

export default function GoogleConnectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedScopes, setCopiedScopes] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  // Mode A inputs
  const [customToken, setCustomToken] = useState('');
  const [customRefreshToken, setCustomRefreshToken] = useState('');
  const [tokenEmail, setTokenEmail] = useState('');

  // OAuth Credentials Configuration
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [savingOAuth, setSavingOAuth] = useState(false);

  // Mode B input
  const [saJson, setSaJson] = useState('');

  // Xoá dữ liệu Classroom (hành động phá huỷ — không thể hoàn tác)
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPreview, setResetPreview] = useState<{ courses: number; students: number; teachers: number; classesAffected: number } | null>(null);
  const [resetPreviewLoading, setResetPreviewLoading] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await api<any>('/api/connections/status');
      setStatus(res);
      if (res?.oauthConfig?.clientId) {
        setClientId(res.oauthConfig.clientId);
      }
    } catch {
      setStatus({
        modeA: { connected: false, email: null },
        modeB: { configured: false, domain: 'thcsgiangvo.edu.vn', serviceAccount: null },
        syncedCoursesCount: 0
      });
    } finally {
      setLoading(false);
    }
  };

  // 1. Kiểm tra tham số callback từ URL (oauth_success / oauth_error)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthSuccess = params.get('oauth_success');
    const oauthError = params.get('oauth_error');
    const emailParam = params.get('email');
    const countParam = params.get('count');

    if (oauthSuccess) {
      setMsg({
        text: `Đăng nhập Google OAuth thành công! Đã kết nối tài khoản ${emailParam || ''} và đồng bộ ${countParam || 0} khóa học từ Google Classroom.`,
        type: 'success'
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (oauthError) {
      setMsg({
        text: `Lỗi đăng nhập Google OAuth: ${decodeURIComponent(oauthError)}`,
        type: 'error'
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    loadStatus();
  }, [location.search]);

  // 2. Điền sẵn email người dùng nếu chưa nhập
  useEffect(() => {
    if (!tokenEmail) {
      setTokenEmail(profile?.email || '09.levanbinh2003@gmail.com');
    }
  }, [profile, tokenEmail]);

  const handleCopyScopes = () => {
    navigator.clipboard.writeText(CLASSROOM_SCOPES_STRING);
    setCopiedScopes(true);
    setTimeout(() => setCopiedScopes(false), 2500);
  };

  const handleCopyRedirect = () => {
    const redirectUrl = status?.oauthConfig?.redirectUri || 'http://localhost:8080/api/connections/oauth/callback';
    navigator.clipboard.writeText(redirectUrl);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2500);
  };

  const handleConnectOAuth = async () => {
    try {
      const res = await api<any>('/api/connections/oauth/url');
      if (res?.url) {
        window.location.href = res.url;
      } else {
        setMsg({ text: res?.message || 'Không thể lấy URL kết nối Google OAuth.', type: 'error' });
      }
    } catch (e: any) {
      setMsg({
        text: e.message || 'Chưa cấu hình Google OAuth Client ID. Bạn có thể mở mục "Cấu hình Google OAuth 2.0 Client ID" bên dưới hoặc Dán Access Token trực tiếp.',
        type: 'error'
      });
    }
  };

  const handleSaveOAuthCredentials = async () => {
    if (!clientId.trim()) {
      setMsg({ text: 'Vui lòng nhập Client ID hợp lệ từ Google Cloud Console', type: 'error' });
      return;
    }
    setSavingOAuth(true);
    try {
      const res = await api<any>('/api/connections/oauth-config', {
        method: 'POST',
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          redirectUri: status?.oauthConfig?.redirectUri || 'http://localhost:8080/api/connections/oauth/callback'
        })
      });
      setMsg({ text: res.message || 'Đã lưu cấu hình Google OAuth Credentials thành công!', type: 'success' });
      loadStatus();
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi lưu OAuth Credentials', type: 'error' });
    } finally {
      setSavingOAuth(false);
    }
  };

  const handleSaveDirectToken = async () => {
    if (!customToken.trim()) {
      setMsg({ text: 'Vui lòng dán Google Access Token hợp lệ (chuỗi bắt đầu bằng ya29...)', type: 'error' });
      return;
    }
    setSyncing(true);
    try {
      const res = await api<any>('/api/connections/token', {
        method: 'POST',
        body: JSON.stringify({
          token: customToken.trim(),
          refreshToken: customRefreshToken.trim() || undefined,
          email: tokenEmail.trim() || undefined
        })
      });
      setMsg({ text: res.message || 'Đã kết nối tài khoản và đồng bộ thành công dữ liệu từ Google Classroom!', type: 'success' });
      setCustomToken('');
      setCustomRefreshToken('');
      loadStatus();
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi xác thực hoặc đồng bộ qua Access Token', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshToken = async () => {
    setRefreshing(true);
    try {
      const res = await api<any>('/api/connections/refresh', { method: 'POST' });
      setMsg({ text: res.message || 'Đã làm mới token thành công!', type: 'success' });
      loadStatus();
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi làm mới token', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Bạn có chắc muốn ngắt kết nối tài khoản Google hiện tại không?')) return;
    try {
      await api('/api/connections/disconnect', { method: 'POST' });
      setMsg({ text: 'Đã ngắt kết nối tài khoản Google thành công.', type: 'info' });
      loadStatus();
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi ngắt kết nối', type: 'error' });
    }
  };

  const handleLoadDemoSeed = async () => {
    setSeedLoading(true);
    try {
      const res = await api<any>('/api/connections/demo-seed', { method: 'POST' });
      setMsg({ text: res.message || 'Đã nạp thành công bộ lớp học mẫu Trường THCS Giảng Võ!', type: 'success' });
      loadStatus();
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi nạp dữ liệu mẫu', type: 'error' });
    } finally {
      setSeedLoading(false);
    }
  };

  const handleSaveServiceAccount = async () => {
    if (!saJson.trim()) {
      setMsg({ text: 'Vui lòng dán nội dung file JSON của Service Account', type: 'error' });
      return;
    }
    setSyncing(true);
    try {
      const res = await api<any>('/api/connections/service-account', {
        method: 'POST',
        body: JSON.stringify({ jsonContent: saJson.trim() })
      });
      setMsg({ text: res.message || 'Đã lưu Service Account và đồng bộ dữ liệu!', type: 'success' });
      setSaJson('');
      loadStatus();
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi lưu Service Account JSON', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await api<any>('/api/classroom/sync', { method: 'POST' });
      setMsg({ text: res.message || `Đã đồng bộ thành công ${res.success || 0} khóa học!`, type: 'success' });
      loadStatus();
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi kích hoạt đồng bộ Google Classroom', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenResetDialog = async () => {
    setResetDialogOpen(true);
    setResetConfirmText('');
    setResetPreview(null);
    setResetPreviewLoading(true);
    try {
      const res = await api<any>('/api/connections/reset-classroom-data/preview');
      setResetPreview({
        courses: res.courses ?? 0,
        students: res.students ?? 0,
        teachers: res.teachers ?? 0,
        classesAffected: res.classesAffected ?? 0
      });
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi tải số liệu xem trước.', type: 'error' });
      setResetDialogOpen(false);
    } finally {
      setResetPreviewLoading(false);
    }
  };

  const handleCloseResetDialog = () => {
    setResetDialogOpen(false);
    setResetConfirmText('');
  };

  const handleConfirmResetClassroomData = async () => {
    setResetLoading(true);
    try {
      const res = await api<any>('/api/connections/reset-classroom-data', { method: 'POST' });
      setMsg({ text: res.message || 'Đã xoá dữ liệu Classroom thành công.', type: 'success' });
      setResetDialogOpen(false);
      setResetConfirmText('');
      loadStatus();
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi xoá dữ liệu Classroom.', type: 'error' });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Quản lý kết nối Google Classroom & dữ liệu thực tế"
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleManualSync} disabled={syncing}>
              {syncing ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
              {syncing ? 'Đang đồng bộ...' : 'Đồng bộ Classroom ngay'}
            </Button>
            <Button variant="outline" onClick={handleLoadDemoSeed} disabled={seedLoading}>
              {seedLoading ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
              Nạp lớp học mẫu Trường THCS Giảng Võ
            </Button>
            <Button variant="outline" onClick={loadStatus} disabled={loading}>
              <RefreshCw className="size-4" />
              Làm mới
            </Button>
            <Button
              variant="outline"
              onClick={handleOpenResetDialog}
              className="border-red-200 font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="size-4" />
              Xoá dữ liệu Classroom
            </Button>
          </div>
        }
      />

      {msg && (
        <div className={cn('my-5 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm', MSG_STYLE[msg.type])}>
          <span>{msg.text}</span>
          <button type="button" onClick={() => setMsg(null)} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Đóng">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Overview Card */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid place-items-center rounded-[10px] bg-gradient-to-br from-primary to-[#1d4ed8] p-3 text-white shadow-[0_4px_10px_rgba(37,99,235,0.25)]">
            <GraduationCap className="size-6" />
          </div>
          <div className="min-w-60 flex-1">
            <p className="font-bold tracking-tight text-[#0f172a]">
              Số lượng khóa học Google Classroom đã nạp vào CSDL: {status?.syncedCoursesCount ?? 0} lớp
            </p>
            <p className="text-sm text-slate-500">
              Tất cả dữ liệu điểm danh, bài tập, sĩ số học sinh và điểm số được đồng bộ trực tiếp từ máy chủ Google API theo chuẩn SSOT.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status?.syncedCoursesCount > 0 && (
              <Button size="sm" variant="outline" onClick={() => navigate('/classroom')} className="rounded-lg">
                Xem danh sách lớp học ({status.syncedCoursesCount})
              </Button>
            )}
            <Badge
              variant="outline"
              className={cn(
                'border-transparent font-semibold',
                status?.syncedCoursesCount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              )}
            >
              {status?.syncedCoursesCount > 0 ? 'Đã có dữ liệu lớp học' : 'Chưa có lớp học'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Mode A */}
        <div className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid place-items-center rounded-lg bg-secondary p-1.5 text-primary">
                <CloudCheck className="size-5" />
              </div>
              <p className="font-bold text-[#0f172a]">Chế Độ A: Google OAuth Cá Nhân</p>
            </div>
            {status?.modeA?.connected && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon-xs" variant="ghost" onClick={handleDisconnect} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ngắt kết nối tài khoản này</TooltipContent>
              </Tooltip>
            )}
          </div>

          <p className="mb-4 text-sm text-slate-500">
            Dành cho Ban Giám hiệu hoặc Giáo viên kết nối tài khoản Google để kéo các lớp học mà tài khoản đó tham gia hoặc giảng dạy.
          </p>

          {/* Status Badge */}
          <div
            className={cn(
              'mb-5 rounded-lg border p-3',
              status?.modeA?.connected ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
            )}
          >
            <p className="mb-1 text-xs font-medium text-slate-500">Trạng thái kết nối OAuth:</p>
            <Badge
              variant="outline"
              className={cn(
                'gap-1 border-transparent font-bold',
                status?.modeA?.connected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
              )}
            >
              {status?.modeA?.connected && <CheckCircle2 className="size-4" />}
              {status?.modeA?.connected
                ? status?.modeA?.hasRefreshToken
                  ? `ĐÃ KẾT NỐI VĨNH VIỄN (Refresh Token): ${status?.modeA?.email}`
                  : `ĐÃ KẾT NỐI: ${status?.modeA?.email}`
                : 'CHƯA KẾT NỐI OAUTH'}
            </Badge>
            {status?.modeA?.connected && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-green-700">
                  Cập nhật lần cuối: {formatDateTime(status.modeA.connectedAt || Date.now())}
                  {status.modeA.hasRefreshToken ? ' • Tự động gia hạn vĩnh viễn' : ' • Hạn Access Token 1 giờ'}
                </p>
                {status.modeA.hasRefreshToken && (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={handleRefreshToken}
                    disabled={refreshing}
                    className="border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                  >
                    {refreshing ? <Loader2 className="size-3 animate-spin" /> : <RotateCw className="size-3" />}
                    {refreshing ? 'Đang làm mới...' : 'Thử làm mới Token ngay'}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Button Login OAuth */}
          <Button
            onClick={handleConnectOAuth}
            disabled={loading}
            className="mb-5 w-full rounded-lg py-5 font-semibold shadow-[0_2px_8px_rgba(37,99,235,0.25)]"
          >
            🔐 Đăng nhập Google để cấp quyền Classroom
          </Button>

          {/* Collapsible: Quick Guide for OAuth Playground */}
          <Collapsible className="mb-5 rounded-lg border border-slate-200 bg-slate-50">
            <CollapsibleTrigger className="group flex w-full items-center justify-between p-3 text-left">
              <p className="text-sm font-bold text-slate-800">⚡ Cách lấy Access Token nhanh trong 30 giây (OAuth Playground)</p>
              <ChevronDown className="size-4 shrink-0 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pb-3">
              <p className="mb-3 text-sm text-slate-600">
                Nếu bạn chưa thiết lập Google Cloud OAuth Client ID, hãy dùng Google OAuth Playground để lấy Access Token dùng ngay:
              </p>
              <div className="flex flex-col gap-2 text-sm text-slate-700">
                <div>
                  <strong>Bước 1:</strong>{' '}
                  Mở trang{' '}
                  <a
                    href="https://developers.google.com/oauthplayground"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-primary"
                  >
                    Google OAuth 2.0 Playground <ExternalLink className="size-3" />
                  </a>
                </div>
                <div>
                  <strong>Bước 2:</strong> Bấm nút dưới để copy danh sách Scopes Google Classroom:
                  <div className="mt-1">
                    <Button size="xs" variant="outline" onClick={handleCopyScopes}>
                      <Copy className="size-3" />
                      {copiedScopes ? 'Đã sao chép Scopes!' : 'Sao chép Scopes Classroom'}
                    </Button>
                  </div>
                </div>
                <div>
                  <strong>Bước 3:</strong> Tại Playground, cuộn xuống mục <em>"Input your own scopes"</em> ở cột bên trái, dán scopes vào và bấm{' '}
                  <strong>Authorize APIs</strong>. Chọn tài khoản Google của bạn (<code>09.levanbinh2003@gmail.com</code>).
                </div>
                <div>
                  <strong>Bước 4:</strong> Bấm <strong>Exchange authorization code for tokens</strong>, copy dòng <strong>Access token</strong> (bắt
                  đầu bằng <code>ya29...</code>) rồi dán vào ô bên dưới.
                </div>
                <div className="rounded-md border border-blue-200 bg-secondary p-2.5 text-xs text-blue-800">
                  💡 <strong>Lưu ý về thời hạn:</strong> Access Token của Google mặc định có thời hạn <strong>1 giờ (3600 giây)</strong>. Để giữ kết
                  nối lâu dài / tự động làm mới vĩnh viễn, bạn hãy copy thêm ô <strong>Refresh token</strong> ở Bước 2 trên Playground và dán vào ô
                  bên dưới.
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="my-4 flex items-center gap-3 text-xs font-semibold text-slate-400">
            <Separator className="flex-1" />
            HOẶC DÁN ACCESS TOKEN TRỰC TIẾP
            <Separator className="flex-1" />
          </div>

          <div className="flex flex-col gap-3.5">
            <div>
              <Label htmlFor="token-email" className="mb-1.5 block">
                Email tài khoản Google
              </Label>
              <Input id="token-email" placeholder="09.levanbinh2003@gmail.com" value={tokenEmail} onChange={(e) => setTokenEmail(e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">Tài khoản Google chứa các lớp học cần đồng bộ</p>
            </div>
            <div>
              <Label htmlFor="token-access" className="mb-1.5 block">
                Google Access Token (Bearer)
              </Label>
              <Textarea
                id="token-access"
                placeholder="Dán token bắt đầu bằng ya29... vào đây (thời hạn 1 giờ)"
                value={customToken}
                onChange={(e) => setCustomToken(e.target.value)}
                rows={2}
              />
              <p className="mt-1 text-xs text-slate-500">Bắt buộc: Token được bảo mật và xác thực trực tiếp với Google API</p>
            </div>
            <div>
              <Label htmlFor="token-refresh" className="mb-1.5 block">
                Google Refresh Token (Tùy chọn — Tự động gia hạn vĩnh viễn)
              </Label>
              <Input
                id="token-refresh"
                placeholder="Dán Refresh token từ Bước 2 của Playground nếu muốn tự động làm mới mãi mãi"
                value={customRefreshToken}
                onChange={(e) => setCustomRefreshToken(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">Tùy chọn: Giúp hệ thống tự động làm mới token mỗi khi hết hạn mà không cần nhập lại</p>
            </div>
            <Button variant="outline" onClick={handleSaveDirectToken} disabled={syncing || !customToken.trim()} className="rounded-lg py-5">
              {syncing && <Loader2 className="size-3.5 animate-spin" />}
              {syncing ? 'Đang xác thực và đồng bộ...' : 'Xác nhận Token & Đồng bộ ngay'}
            </Button>
          </div>

          {/* Collapsible: OAuth Credentials Settings */}
          <Collapsible className="mt-6 rounded-lg border border-slate-200 bg-slate-50">
            <CollapsibleTrigger className="group flex w-full items-center justify-between p-3 text-left">
              <div className="flex items-center gap-1.5">
                <Settings className="size-4 text-slate-500" />
                <p className="text-xs font-medium text-slate-500">Cấu hình Google OAuth 2.0 Credentials (Tùy chọn)</p>
              </div>
              <ChevronDown className="size-4 shrink-0 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pb-3">
              <p className="mb-3 text-xs text-slate-500">
                Dán OAuth Client ID từ Google Cloud Console để bật tính năng bấm 1-click nút "Đăng nhập Google" không cần copy token thủ công.
              </p>
              <div className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="oauth-client-id" className="mb-1.5 block">
                    OAuth Client ID
                  </Label>
                  <Input id="oauth-client-id" placeholder="...apps.googleusercontent.com" value={clientId} onChange={(e) => setClientId(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="oauth-client-secret" className="mb-1.5 block">
                    OAuth Client Secret (Tùy chọn)
                  </Label>
                  <Input
                    id="oauth-client-secret"
                    type="password"
                    placeholder="GOCSPX-..."
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                  />
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-500">
                  <strong>Redirect URI hợp lệ:</strong> {status?.oauthConfig?.redirectUri || 'http://localhost:8080/api/connections/oauth/callback'}
                  <Button size="xs" variant="ghost" onClick={handleCopyRedirect} className="ml-1 h-auto p-0 text-xs">
                    {copiedRedirect ? 'Đã copy' : 'Copy'}
                  </Button>
                </div>
                <Button size="sm" onClick={handleSaveOAuthCredentials} disabled={savingOAuth || !clientId.trim()} className="w-fit">
                  {savingOAuth ? 'Đang lưu...' : 'Lưu cấu hình OAuth'}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Mode B */}
        <div className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="grid place-items-center rounded-lg bg-secondary p-1.5 text-primary">
              <KeyRound className="size-5" />
            </div>
            <p className="font-bold text-[#0f172a]">Chế Độ B: Google Workspace DWD Toàn Trường</p>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Sử dụng Service Account ủy quyền toàn miền (Domain-Wide Delegation) để đồng bộ tự động 100% lớp học của toàn bộ giáo viên và học sinh
            trên tên miền trường.
          </p>

          <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-1 text-xs font-medium text-slate-500">Trạng thái Service Account DWD:</p>
            <Badge
              variant="outline"
              className={cn(
                'border font-semibold',
                status?.modeB?.configured ? 'border-blue-200 bg-secondary text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-800'
              )}
            >
              {status?.modeB?.configured ? `ĐÃ CẤU HÌNH DWD (${status?.modeB?.serviceAccount})` : 'CHƯA CÓ FILE SERVICE-ACCOUNT.JSON'}
            </Badge>
            <p className="mt-2 text-xs text-slate-500">
              Tên miền Workspace: <strong className="text-[#0f172a]">{status?.modeB?.domain || 'thcsgiangvo.edu.vn'}</strong>
            </p>
          </div>

          <p className="mb-1.5 text-xs font-medium text-slate-500">Cung cấp nội dung file JSON Service Account:</p>
          <Textarea
            placeholder='Dán toàn bộ nội dung file service-account.json (chứa "private_key" và "client_email")...'
            value={saJson}
            onChange={(e) => setSaJson(e.target.value)}
            rows={4}
            className="mb-4"
          />
          <Button
            onClick={handleSaveServiceAccount}
            disabled={syncing || !saJson.trim()}
            className="w-full rounded-lg py-5 font-semibold shadow-[0_2px_8px_rgba(37,99,235,0.25)]"
          >
            Lưu Service Account & Đồng bộ toàn trường
          </Button>
        </div>
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={(open) => !open && !resetLoading && handleCloseResetDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <TriangleAlert className="size-5 text-red-600" />
              Xoá dữ liệu Classroom — hành động không thể hoàn tác
            </DialogTitle>
          </DialogHeader>
          {resetPreviewLoading ? (
            <div className="flex items-center gap-2.5 py-4">
              <Loader2 className="size-5 animate-spin text-slate-500" />
              <p className="text-sm text-slate-500">Đang tính số liệu sẽ bị xoá...</p>
            </div>
          ) : (
            <>
              <DialogDescription className="text-slate-700">
                Thao tác này sẽ xoá VĨNH VIỄN toàn bộ dữ liệu đã đồng bộ từ Google Classroom trong hệ thống, gồm:
              </DialogDescription>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-semibold text-red-800">
                  {resetPreview?.courses ?? 0} khóa học, {resetPreview?.students ?? 0} học sinh, {resetPreview?.teachers ?? 0} giáo viên,{' '}
                  {resetPreview?.classesAffected ?? 0} lớp đã đồng bộ.
                </p>
              </div>
              <DialogDescription className="text-slate-700">
                Kết nối Google (token) và dữ liệu module An toàn/Lịch công tác KHÔNG bị ảnh hưởng. Bạn KHÔNG thể hoàn tác thao tác này sau khi xác
                nhận.
              </DialogDescription>
              <DialogDescription className="text-slate-700">
                Để xác nhận, hãy gõ đúng từ <strong>XOÁ</strong> vào ô bên dưới:
              </DialogDescription>
              <Input
                autoFocus
                placeholder="Gõ XOÁ để xác nhận"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                disabled={resetLoading}
              />
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseResetDialog} disabled={resetLoading}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              disabled={resetLoading || resetPreviewLoading || resetConfirmText.trim() !== 'XOÁ'}
              onClick={handleConfirmResetClassroomData}
            >
              {resetLoading ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {resetLoading ? 'Đang xoá...' : 'Xoá vĩnh viễn'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
