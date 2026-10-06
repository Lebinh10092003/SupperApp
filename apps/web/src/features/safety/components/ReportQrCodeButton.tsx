/**
 * ReportQrCodeButton.tsx — khôi phục lại tính năng "Tạo mã QR báo cáo" bị
 * mất khi chuyển sang shadcn/ui (Sin phát hiện 2026-10-05: "Mục QR bên app
 * cảnh báo an toàn bị mất rồi"). Bản gốc MUI còn nguyên ở
 * /Users/macbook/Projects/SupperApp/apps/web/src/features/safety/components/ReportQrCodeButton.tsx
 * — port lại giữ nguyên logic (sinh QR bằng gói `qrcode`, tải ảnh, sao
 * chép link), chỉ đổi lớp hiển thị sang Tailwind + shadcn/ui.
 */
import { useEffect, useState } from 'react';
import { Copy, Download, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const REPORT_PATH = '/safety/report';

export function ReportQrCodeButton() {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const reportUrl = `${window.location.origin}${REPORT_PATH}`;

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(reportUrl, { width: 480, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setDataUrl)
      .catch(() => setDataUrl(''));
  }, [open, reportUrl]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'ma-qr-bao-cao-an-toan.png';
    a.click();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <QrCode className="size-4" />
        Tạo mã QR báo cáo
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Mã QR — Trang báo cáo sự cố</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <p className="text-center text-sm text-slate-500">
              Quét mã này để mở thẳng trang báo cáo sự cố công khai — có thể in dán ở các khu vực trong trường (cổng, hành lang, phòng y
              tế...) để học sinh/phụ huynh/GV-NV báo tin nhanh.
            </p>
            <div className="flex size-65 items-center justify-center rounded-lg border border-slate-200 bg-white">
              {dataUrl ? (
                <img src={dataUrl} alt="Mã QR trang báo cáo sự cố" width={240} height={240} />
              ) : (
                <span className="text-xs text-slate-500">Đang tạo mã...</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <code className="rounded bg-slate-100 px-2 py-1 text-xs break-all">{reportUrl}</code>
              <Button variant="ghost" size="icon" className="size-7" onClick={handleCopy} title="Sao chép đường dẫn">
                <Copy className="size-3.5" />
              </Button>
            </div>
            {copied && <p className="text-xs text-emerald-600">Đã sao chép đường dẫn.</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Đóng
            </Button>
            <Button disabled={!dataUrl} onClick={handleDownload}>
              <Download className="size-4" />
              Tải ảnh QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
