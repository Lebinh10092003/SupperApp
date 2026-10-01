import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PublicLayout } from './PublicLayout';
import { env } from '../../config/env';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface LookupResult {
  publicCode: string;
  state: string;
  updatedAt: string;
  canConfirmClose: boolean;
}

function baseUrl() {
  return (env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
}

export default function PublicLookupPage() {
  // Đọc `?code=` từ URL để tự điền sẵn mã tra cứu — dùng khi
  // PublicReportPage điều hướng sang đây ngay sau khi gửi tin báo thành
  // công (Sin phản hồi 2026-09-11: nút quay lại trước đây khó nhận ra,
  // và người dùng phải chép tay lại mã vừa nhận).
  const [searchParams] = useSearchParams();
  const [codeInput, setCodeInput] = useState(() => searchParams.get('code') || '');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [supplementText, setSupplementText] = useState('');
  const [supplementSubmitting, setSupplementSubmitting] = useState(false);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  const handleLookup = async () => {
    const code = codeInput.trim();
    if (!code) return;
    setError('');
    setToast('');
    setLoading(true);
    try {
      const r = await fetch(`${baseUrl()}/api/safety/reports/lookup?publicCode=${encodeURIComponent(code)}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || 'Không tìm thấy mã tra cứu này.');
      setResult(d);
    } catch (e: any) {
      setResult(null);
      setError(e.message || 'Không tìm thấy mã tra cứu này.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('code')) handleLookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSupplement = async () => {
    if (!result || !supplementText.trim()) return;
    setSupplementSubmitting(true);
    try {
      const r = await fetch(`${baseUrl()}/api/safety/reports/supplement`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ publicCode: result.publicCode, content: supplementText.trim() })
      });
      if (!r.ok) throw new Error('Bổ sung thông tin thất bại, vui lòng thử lại.');
      setSupplementText('');
      setToast('Đã gửi thông tin bổ sung thành công.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSupplementSubmitting(false);
    }
  };

  const handleConfirmClose = async () => {
    if (!result) return;
    setConfirmSubmitting(true);
    try {
      const r = await fetch(`${baseUrl()}/api/safety/reports/confirm-close`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ publicCode: result.publicCode })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || 'Xác nhận thất bại.');
      setToast('Đã xác nhận đóng hồ sơ, cảm ơn bạn.');
      setResult({ ...result, state: d.state, canConfirmClose: false });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setConfirmSubmitting(false);
    }
  };

  return (
    <PublicLayout title="Tra cứu trạng thái tin báo">
      <div className="rounded-xl border border-slate-200 shadow-[0_4px_15px_-1px_rgba(15,23,42,0.06)]">
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-4">
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}
            {toast && (
              <Alert className="border-emerald-200 bg-emerald-50">
                <AlertDescription className="text-emerald-700">{toast}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="lookup-code" className="mb-1.5 block">
                  Mã tra cứu
                </Label>
                <Input
                  id="lookup-code"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  placeholder="VD: GV.2609.0001"
                />
              </div>
              <Button onClick={handleLookup} disabled={loading} className="whitespace-nowrap font-bold">
                {loading ? <Loader2 className="size-4 animate-spin" /> : 'Tra cứu'}
              </Button>
            </div>

            {result && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs text-slate-500">Mã: {result.publicCode}</p>
                <p className="mt-1 text-lg font-bold text-[#0f172a]">{result.state}</p>

                {result.canConfirmClose && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm">Nhà trường đề nghị đóng hồ sơ này. Bạn xác nhận đã được xử lý thoả đáng?</p>
                    <Button onClick={handleConfirmClose} disabled={confirmSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
                      Xác nhận đóng hồ sơ
                    </Button>
                  </div>
                )}

                <div className="mt-5">
                  <Label htmlFor="lookup-supplement" className="mb-1.5 block">
                    Bổ sung thông tin
                  </Label>
                  <Textarea
                    id="lookup-supplement"
                    rows={2}
                    value={supplementText}
                    onChange={(e) => setSupplementText(e.target.value)}
                    placeholder="Có thêm chi tiết gì muốn báo thêm cho nhà trường?"
                  />
                  <Button variant="outline" onClick={handleSupplement} disabled={supplementSubmitting || !supplementText.trim()} className="mt-2">
                    Gửi bổ sung
                  </Button>
                </div>
              </div>
            )}

            {/* Trước đây trang này KHÔNG có đường nào quay lại trang gửi
                tin báo — chỉ có 1 chiều (PublicReportPage -> đây), không có
                chiều ngược lại (Sin phản hồi 2026-09-11: "bấm vào tra cứu
                tin báo thì nó không back về được trang đăng tin báo"). */}
            <div className="text-center">
              <p className="text-xs text-slate-500">
                Cần báo sự việc khác?{' '}
                <a href="/safety/report" className="font-semibold text-primary">
                  Gửi tin báo mới
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
