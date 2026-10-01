import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, signOut, type User } from 'firebase/auth';
import { Upload, Copy, Check, Loader2 } from 'lucide-react';
import { PublicLayout } from './PublicLayout';
import { CAMPUS_IDS, CAMPUS_LABEL, REPORTER_ROLE_OPTIONS } from './constants';
import { env } from '../../config/env';
import { auth, googleProvider } from '../../config/firebase';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.5-5.9 7.6-11.3 7.6-6.8 0-12.3-5.5-12.3-12.3s5.5-12.3 12.3-12.3c3.1 0 5.9 1.2 8.1 3.1l5.4-5.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20.1-7.6 20.1-21 0-1.2-.1-2.4-.5-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 5.9 4.3C13.9 15.2 18.6 12 24 12c3.1 0 5.9 1.2 8.1 3.1l5.4-5.4C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-2.1 14.2-5.5l-6.5-5.5C29.7 34.8 27 35.8 24 35.8c-5.3 0-9.8-3.3-11.3-8l-6.1 4.7C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.2-2.2 4-3.9 5.3l6.5 5.5C40.5 36.3 44 30.7 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

interface CategoryOption {
  code: string;
  label: string;
  group: string;
  groupLabel: string;
}

// Khớp `catalog.EVIDENCE_LIMITS.MAX_FILES_PER_SUBMISSION` (backend) — trước
// đây form CHỈ cho chọn ĐÚNG 1 file (`useState<File | null>`, `files[0]`),
// dù backend đã hỗ trợ nhiều minh chứng/tin báo từ đầu (Sin phản hồi
// 2026-09-11: "có đính kèm được cả video và đính kèm nhiều mục một lúc
// không").
const MAX_EVIDENCE_FILES = 5;

async function uploadOneEvidence(file: File): Promise<string | null> {
  const baseUrl = (env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
  const form = new FormData();
  form.append('file', file);
  const r = await fetch(`${baseUrl}/api/safety/evidence/upload`, { method: 'POST', body: form });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.rejected) return null;
  return d.evidenceId || null;
}

export default function PublicReportPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [campusId, setCampusId] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [className, setClassName] = useState('');
  const [reporterRole, setReporterRole] = useState('');
  const [stillDangerous, setStillDangerous] = useState(false);
  const [content, setContent] = useState('');
  // Sin chốt 2026-09-25: "bỏ điền SĐT liên hệ, bắt đăng nhập nhanh bằng
  // Google" — trường yêu cầu để tránh học sinh dùng tài khoản vớ vẩn spam.
  // KHÔNG còn ô tự gõ email/SĐT — email lấy THẲNG từ tài khoản Google đã
  // đăng nhập (đã được Google xác minh), backend verify lại idToken thật,
  // không tin client tự gõ (xem safety.routes.ts POST /reports).
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [occurredFrom, setOccurredFrom] = useState('');
  const [occurredTo, setOccurredTo] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [publicCode, setPublicCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  const copyPublicCode = async () => {
    try {
      await navigator.clipboard.writeText(publicCode);
    } catch {
      // Clipboard API có thể bị chặn (HTTP không an toàn, trình duyệt cũ) —
      // vẫn báo đã copy là sai, nhưng im lặng bỏ qua còn tệ hơn: người dùng
      // tưởng đã copy được nhưng thực ra không — không set codeCopied ở đây.
      return;
    }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  useEffect(() => {
    const baseUrl = (env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    fetch(`${baseUrl}/api/safety/categories`).then((r) => r.json()).then(setCategories).catch(() => setCategories([]));
  }, []);

  const handleGoogleSignIn = async () => {
    setSignInError('');
    setSigningIn(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      setGoogleUser(cred.user);
    } catch (e: any) {
      if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') {
        setSignInError('Đăng nhập Google không thành công, vui lòng thử lại.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await signOut(auth).catch(() => {});
    setGoogleUser(null);
  };

  const handleSubmit = async () => {
    setError('');
    if (!campusId) return setError('Vui lòng chọn cơ sở.');
    if (!categoryCode) return setError('Vui lòng chọn nhóm sự cố.');
    if (!googleUser) return setError('Vui lòng đăng nhập nhanh bằng Google trước khi gửi tin báo.');

    setSubmitting(true);
    try {
      const idToken = await googleUser.getIdToken();
      // Tải LẦN LƯỢT từng file — backend chỉ nhận 1 file/request
      // (`evidence.routes.ts`: busboy `limits.files: 1`, cố ý theo thiết kế
      // gốc "1 file/request — client tự gọi"), không phải giới hạn thật sự
      // chỉ-1-file-mỗi-tin-báo (submitReport đã nhận `evidenceIds: string[]`
      // từ đầu). Dừng NGAY khi 1 file lỗi — không gửi tin báo thiếu minh
      // chứng mà vẫn báo "thành công" như không có gì xảy ra.
      const evidenceIds: string[] = [];
      for (const f of files) {
        const evidenceId = await uploadOneEvidence(f);
        if (!evidenceId) {
          setError(`Không tải lên được minh chứng "${f.name}". Vui lòng thử lại, hoặc bỏ file này rồi gửi lại.`);
          setSubmitting(false);
          return;
        }
        evidenceIds.push(evidenceId);
      }
      const baseUrl = (env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
      const r = await fetch(`${baseUrl}/api/safety/reports`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          campusId,
          categoryCode,
          className: className.trim() || undefined,
          reporterRole: reporterRole || undefined,
          stillDangerous,
          content: content.trim(),
          idToken,
          occurredFrom: occurredFrom || undefined,
          occurredTo: occurredTo || undefined,
          evidenceIds
        })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || d.error?.message || 'Gửi tin báo thất bại, vui lòng thử lại.');
      setPublicCode(d.publicCode);
    } catch (e: any) {
      setError(e.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (publicCode) {
    return (
      <PublicLayout title="Đã gửi tin báo thành công">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50">
          <div className="p-8 text-center">
            <p className="mb-1 text-lg font-bold text-emerald-800">Cảm ơn bạn đã gửi tin báo</p>
            <p className="mb-4 text-sm text-emerald-800">Vui lòng lưu lại mã tra cứu dưới đây để theo dõi tiến độ xử lý:</p>
            <div className="flex items-center justify-center gap-2">
              <Badge variant="outline" className="h-11 border-emerald-300 bg-white px-4 text-[1.1rem] font-extrabold text-emerald-800">
                {publicCode}
              </Badge>
              <Button
                onClick={copyPublicCode}
                variant="outline"
                className="h-11 border-emerald-300 bg-white font-bold text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50"
              >
                {codeCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {codeCopied ? 'Đã sao chép' : 'Sao chép mã'}
              </Button>
            </div>
            <p className="mt-4 text-xs text-emerald-800">Lưu lại mã này để theo dõi tình trạng xử lý.</p>

            {/* Trước đây chỉ có dòng chữ nhắc "xem tab Tra cứu" (không bấm
                được, không nổi bật) — Sin phản hồi 2026-09-11: "nút điều
                hướng đang hơi khó để ý". Thêm 2 nút bấm được, cùng mức nổi
                bật, đưa thẳng sang tra cứu (tự điền sẵn mã) hoặc gửi tiếp. */}
            <div className="mt-6 flex flex-col gap-2.5">
              <Button
                size="lg"
                onClick={() => navigate(`/safety/lookup?code=${encodeURIComponent(publicCode)}`)}
                className="bg-emerald-800 font-bold hover:bg-emerald-900"
              >
                Tra cứu / bổ sung tin báo này
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setPublicCode('')}
                className="border-emerald-300 font-bold text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50"
              >
                Gửi tin báo khác
              </Button>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout title="Cảnh báo an toàn và xử lý sự cố">
      <div className="rounded-xl border border-slate-200 shadow-[0_4px_15px_-1px_rgba(15,23,42,0.06)]">
        <div className="p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label className="mb-1.5 block">Cơ sở xảy ra sự việc *</Label>
              <Select value={campusId} onValueChange={setCampusId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn cơ sở" />
                </SelectTrigger>
                <SelectContent>
                  {CAMPUS_IDS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CAMPUS_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">Nhóm sự cố *</Label>
              <Select value={categoryCode} onValueChange={setCategoryCode}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn nhóm sự cố" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2">
              <Checkbox checked={stillDangerous} onCheckedChange={(v) => setStillDangerous(v === true)} />
              <span className="text-sm">Sự việc vẫn đang tiếp diễn / nguy hiểm ngay lúc này</span>
            </label>

            <div>
              <Label htmlFor="report-content" className="mb-1.5 block">
                Nội dung sự việc *
              </Label>
              <Textarea
                id="report-content"
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Mô tả những gì đã xảy ra, thời gian, những ai liên quan..."
              />
            </div>

            {signInError && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertDescription className="text-amber-800">{signInError}</AlertDescription>
              </Alert>
            )}
            {!googleUser ? (
              <div className="flex flex-col gap-1">
                <Button variant="outline" onClick={handleGoogleSignIn} disabled={signingIn} className="w-fit font-bold">
                  {signingIn ? <Loader2 className="size-4 animate-spin" /> : <GoogleLogo />}
                  {signingIn ? 'Đang đăng nhập...' : 'Đăng nhập nhanh bằng Google'}
                </Button>
                <p className="text-xs text-slate-500">
                  Cần đăng nhập bằng 1 tài khoản Google thật để nhà trường liên hệ lại khi cần xác nhận — không cần dùng email/tài khoản của trường.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <Check className="size-4 shrink-0 text-emerald-800" />
                <p className="flex-1 text-sm text-emerald-800">
                  Đã đăng nhập: <strong>{googleUser.email}</strong>
                </p>
                <Button size="sm" variant="ghost" onClick={handleGoogleSignOut} className="text-slate-500">
                  Đổi tài khoản
                </Button>
              </div>
            )}

            <Button variant="ghost" onClick={() => setShowMore((v) => !v)} className="w-fit text-primary">
              {showMore ? '− Thu gọn' : '+ Thêm chi tiết (lớp, thời gian, minh chứng)'}
            </Button>
            {showMore && (
              <div className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="report-class" className="mb-1.5 block">
                    Lớp liên quan (nếu có)
                  </Label>
                  <Input id="report-class" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="VD: 8A3" />
                </div>

                <div>
                  <Label className="mb-1.5 block">Bạn là ai trong sự việc này</Label>
                  <Select value={reporterRole} onValueChange={setReporterRole}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn vai trò" />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORTER_ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1">
                    <Label htmlFor="report-from" className="mb-1.5 block">
                      Xảy ra từ
                    </Label>
                    <Input id="report-from" type="datetime-local" value={occurredFrom} onChange={(e) => setOccurredFrom(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="report-to" className="mb-1.5 block">
                      Đến
                    </Label>
                    <Input id="report-to" type="datetime-local" value={occurredTo} onChange={(e) => setOccurredTo(e.target.value)} />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Button asChild variant="outline" className="relative w-fit font-semibold">
                    <label aria-disabled={files.length >= MAX_EVIDENCE_FILES}>
                      <Upload className="size-4" />
                      {files.length === 0 ? 'Đính kèm ảnh/video minh chứng (tuỳ chọn)' : `Thêm file (${files.length}/${MAX_EVIDENCE_FILES})`}
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*,audio/*"
                        disabled={files.length >= MAX_EVIDENCE_FILES}
                        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                        onChange={(e) => {
                          const picked = Array.from(e.target.files || []);
                          setFiles((prev) => [...prev, ...picked].slice(0, MAX_EVIDENCE_FILES));
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </Button>
                  {files.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {files.map((f, i) => (
                        <div key={`${f.name}-${f.lastModified}-${i}`} className="flex items-center gap-2">
                          <p className="flex-1 truncate text-sm">{f.name}</p>
                          <Button size="sm" variant="ghost" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-slate-500">
                            Bỏ
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {files.length >= MAX_EVIDENCE_FILES && <p className="text-xs text-slate-500">Tối đa {MAX_EVIDENCE_FILES} file mỗi tin báo.</p>}
                </div>
              </div>
            )}

            <Button onClick={handleSubmit} disabled={submitting || !googleUser} variant="destructive" className="sticky bottom-0 font-bold sm:static">
              {submitting ? <Loader2 className="size-5 animate-spin" /> : 'Gửi tin báo'}
            </Button>

            <div className="text-center">
              <p className="text-xs text-slate-500">
                Đã gửi tin báo trước đó?{' '}
                <a href="/safety/lookup" className="font-semibold text-primary">
                  Tra cứu trạng thái
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
