import { useEffect, useState } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Stack, IconButton } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2Rounded';
import DownloadIcon from '@mui/icons-material/DownloadRounded';
import CloseIcon from '@mui/icons-material/CloseRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopyRounded';
import QRCode from 'qrcode';

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
      <Button variant="outlined" startIcon={<QrCode2Icon />} onClick={() => setOpen(true)}>
        Tạo mã QR báo cáo
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Mã QR — Trang báo cáo sự cố
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack alignItems="center" spacing={2}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Quét mã này để mở thẳng trang báo cáo sự cố công khai — có thể in dán ở các khu vực trong trường
              (cổng, hành lang, phòng y tế...) để học sinh/phụ huynh/GV-NV báo tin nhanh.
            </Typography>
            <Box
              sx={{
                width: 260,
                height: 260,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                bgcolor: '#fff'
              }}
            >
              {dataUrl ? (
                <img src={dataUrl} alt="Mã QR trang báo cáo sự cố" width={240} height={240} />
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Đang tạo mã...
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography
                variant="caption"
                sx={{
                  bgcolor: '#f1f5f9',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  wordBreak: 'break-all'
                }}
              >
                {reportUrl}
              </Typography>
              <IconButton size="small" onClick={handleCopy} title="Sao chép đường dẫn">
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Stack>
            {copied && (
              <Typography variant="caption" color="success.main">
                Đã sao chép đường dẫn.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Đóng</Button>
          <Button variant="contained" startIcon={<DownloadIcon />} disabled={!dataUrl} onClick={handleDownload}>
            Tải ảnh QR
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
