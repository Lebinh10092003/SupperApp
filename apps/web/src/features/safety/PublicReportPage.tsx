import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFileRounded';
import { PublicLayout } from './PublicLayout';
import { CAMPUS_IDS, CAMPUS_LABEL, REPORTER_ROLE_OPTIONS } from './constants';
import { env } from '../../config/env';

interface CategoryOption {
  code: string;
  label: string;
  group: string;
  groupLabel: string;
}

interface ZoneOption {
  zoneId: string;
  campusId: string;
  label: string;
  order: number;
}

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
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [campusId, setCampusId] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [className, setClassName] = useState('');
  const [reporterRole, setReporterRole] = useState('');
  const [stillDangerous, setStillDangerous] = useState(false);
  const [content, setContent] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [occurredFrom, setOccurredFrom] = useState('');
  const [occurredTo, setOccurredTo] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [publicCode, setPublicCode] = useState('');

  useEffect(() => {
    const baseUrl = (env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    fetch(`${baseUrl}/api/safety/categories`).then((r) => r.json()).then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!campusId) {
      setZones([]);
      return;
    }
    const baseUrl = (env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
    fetch(`${baseUrl}/api/safety/campus-zones?campusId=${encodeURIComponent(campusId)}`)
      .then((r) => r.json())
      .then(setZones)
      .catch(() => setZones([]));
  }, [campusId]);

  const handleSubmit = async () => {
    setError('');
    if (!campusId) return setError('Vui lòng chọn cơ sở.');
    if (!categoryCode) return setError('Vui lòng chọn nhóm sự cố.');
    if (!email.trim() && !phone.trim()) return setError('Cần để lại ít nhất 1 email hoặc số điện thoại để nhà trường liên hệ lại khi cần xác nhận.');

    setSubmitting(true);
    try {
      let evidenceIds: string[] = [];
      if (file) {
        const evidenceId = await uploadOneEvidence(file);
        // Tải minh chứng thất bại (mạng lỗi, file bị từ chối, quét virus...) —
        // DỪNG LẠI và báo rõ, không được âm thầm gửi tin báo thiếu minh chứng
        // rồi vẫn báo "thành công" như không có gì xảy ra.
        if (!evidenceId) {
          setError('Không tải lên được minh chứng đính kèm. Vui lòng thử lại, hoặc bấm "Bỏ file này" để gửi tin báo không kèm minh chứng.');
          setSubmitting(false);
          return;
        }
        evidenceIds = [evidenceId];
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
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          zoneIds,
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
        <Card sx={{ borderRadius: 3, border: '1px solid #bbf7d0', bgcolor: '#f0fdf4' }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={700} color="#166534" gutterBottom>
              Cảm ơn bạn đã gửi tin báo
            </Typography>
            <Typography variant="body2" color="#166534" sx={{ mb: 2 }}>
              Vui lòng lưu lại mã tra cứu dưới đây để theo dõi tiến độ xử lý:
            </Typography>
            <Chip
              label={publicCode}
              sx={{ fontSize: '1.1rem', fontWeight: 800, height: 44, px: 2, bgcolor: '#ffffff', border: '1px solid #86efac', color: '#166534' }}
            />
            <Typography variant="caption" display="block" sx={{ mt: 2, color: '#166534' }}>
              Truy cập trang "Tra cứu tin báo" và nhập mã này để xem trạng thái xử lý.
            </Typography>
          </CardContent>
        </Card>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout title="Báo cáo sự cố an toàn trường học" subtitle="Mọi thông tin được bảo mật, chỉ người có thẩm quyền mới được xem">
      <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 4px 15px -1px rgba(15, 23, 42, 0.06)' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField select label="Cơ sở xảy ra sự việc *" value={campusId} onChange={(e) => setCampusId(e.target.value)} fullWidth>
              {CAMPUS_IDS.map((c) => (
                <MenuItem key={c} value={c}>
                  {CAMPUS_LABEL[c]}
                </MenuItem>
              ))}
            </TextField>

            <TextField select label="Nhóm sự cố *" value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)} fullWidth>
              {categories.map((c) => (
                <MenuItem key={c.code} value={c.code}>
                  {c.label}
                </MenuItem>
              ))}
            </TextField>

            <FormControlLabel
              control={<Checkbox checked={stillDangerous} onChange={(e) => setStillDangerous(e.target.checked)} color="error" />}
              label="Sự việc vẫn đang tiếp diễn / nguy hiểm ngay lúc này"
            />

            <TextField
              label="Nội dung sự việc *"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              multiline
              rows={4}
              fullWidth
              placeholder="Mô tả những gì đã xảy ra, thời gian, những ai liên quan..."
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Email liên hệ" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
              <TextField label="Số điện thoại liên hệ" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Cần để lại ít nhất 1 trong 2 kênh trên để nhà trường liên hệ lại khi cần xác nhận.
            </Typography>

            {!showMore ? (
              <Button variant="text" onClick={() => setShowMore(true)} sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
                + Thêm chi tiết (lớp, khu vực, thời gian, minh chứng)
              </Button>
            ) : (
              <Stack spacing={2.5}>
                <TextField label="Lớp liên quan (nếu có)" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="VD: 8A3" fullWidth />

                <TextField select label="Bạn là ai trong sự việc này" value={reporterRole} onChange={(e) => setReporterRole(e.target.value)} fullWidth>
                  {REPORTER_ROLE_OPTIONS.map((r) => (
                    <MenuItem key={r.value} value={r.value}>
                      {r.label}
                    </MenuItem>
                  ))}
                </TextField>

                {zones.length > 0 && (
                  <TextField
                    select
                    label="Khu vực xảy ra sự việc"
                    value={zoneIds}
                    onChange={(e) => setZoneIds(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as unknown as string[]))}
                    fullWidth
                    slotProps={{ select: { multiple: true } }}
                  >
                    {zones.map((z) => (
                      <MenuItem key={z.zoneId} value={z.zoneId}>
                        {z.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Xảy ra từ"
                    type="datetime-local"
                    value={occurredFrom}
                    onChange={(e) => setOccurredFrom(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                  />
                  <TextField
                    label="Đến"
                    type="datetime-local"
                    value={occurredTo}
                    onChange={(e) => setOccurredTo(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                  />
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                  <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
                    {file ? file.name : 'Đính kèm ảnh/video minh chứng (tuỳ chọn)'}
                    <input
                      type="file"
                      hidden
                      accept="image/*,video/*,audio/*"
                      capture="environment"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </Button>
                  {file && (
                    <Button size="small" onClick={() => setFile(null)} sx={{ textTransform: 'none', color: '#64748b' }}>
                      Bỏ file này
                    </Button>
                  )}
                </Stack>
              </Stack>
            )}

            <Button
              variant="contained"
              size="large"
              onClick={handleSubmit}
              disabled={submitting}
              sx={{
                bgcolor: '#dc2626',
                '&:hover': { bgcolor: '#b91c1c' },
                fontWeight: 700,
                borderRadius: 2,
                py: 1.25,
                position: { xs: 'sticky', sm: 'static' },
                bottom: { xs: 0 }
              }}
            >
              {submitting ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Gửi tin báo'}
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Đã gửi tin báo trước đó?{' '}
                <a href="/safety/lookup" style={{ color: '#2563eb', fontWeight: 600 }}>
                  Tra cứu trạng thái
                </a>
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </PublicLayout>
  );
}
