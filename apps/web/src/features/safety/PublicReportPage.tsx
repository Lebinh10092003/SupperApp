import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, signOut, type User } from 'firebase/auth';
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
import ContentCopyIcon from '@mui/icons-material/ContentCopyRounded';
import CheckIcon from '@mui/icons-material/CheckRounded';
import GoogleIcon from '@mui/icons-material/Google';
import { PublicLayout } from './PublicLayout';
import { CAMPUS_IDS, CAMPUS_LABEL, REPORTER_ROLE_OPTIONS } from './constants';
import { env } from '../../config/env';
import { auth, googleProvider } from '../../config/firebase';

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
        <Card sx={{ borderRadius: 3, border: '1px solid #bbf7d0', bgcolor: '#f0fdf4' }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={700} color="#166534" gutterBottom>
              Cảm ơn bạn đã gửi tin báo
            </Typography>
            <Typography variant="body2" color="#166534" sx={{ mb: 2 }}>
              Vui lòng lưu lại mã tra cứu dưới đây để theo dõi tiến độ xử lý:
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
              <Chip
                label={publicCode}
                sx={{ fontSize: '1.1rem', fontWeight: 800, height: 44, px: 2, bgcolor: '#ffffff', border: '1px solid #86efac', color: '#166534' }}
              />
              <Button
                onClick={copyPublicCode}
                startIcon={codeCopied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                sx={{
                  height: 44,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  color: '#166534',
                  border: '1px solid #86efac',
                  bgcolor: '#ffffff',
                  '&:hover': { bgcolor: '#f0fdf4', borderColor: '#4ade80' }
                }}
              >
                {codeCopied ? 'Đã sao chép' : 'Sao chép mã'}
              </Button>
            </Stack>
            <Typography variant="caption" display="block" sx={{ mt: 2, color: '#166534' }}>
              Lưu lại mã này để theo dõi tình trạng xử lý.
            </Typography>

            {/* Trước đây chỉ có dòng chữ nhắc "xem tab Tra cứu" (không bấm
                được, không nổi bật) — Sin phản hồi 2026-09-11: "nút điều
                hướng đang hơi khó để ý". Thêm 2 nút bấm được, cùng mức nổi
                bật, đưa thẳng sang tra cứu (tự điền sẵn mã) hoặc gửi tiếp. */}
            <Stack spacing={1.25} sx={{ mt: 3 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate(`/safety/lookup?code=${encodeURIComponent(publicCode)}`)}
                sx={{ bgcolor: '#166534', '&:hover': { bgcolor: '#14532d' }, fontWeight: 700, borderRadius: 2, py: 1.1 }}
              >
                Tra cứu / bổ sung tin báo này
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => setPublicCode('')}
                sx={{ borderColor: '#86efac', color: '#166534', fontWeight: 700, borderRadius: 2, py: 1.1, '&:hover': { borderColor: '#4ade80', bgcolor: '#f0fdf4' } }}
              >
                Gửi tin báo khác
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout title="Cảnh báo an toàn và xử lý sự cố">
      <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 4px 15px -1px rgba(15, 23, 42, 0.06)' }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Stack spacing={1.25}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField select size="small" label="Cơ sở xảy ra sự việc *" value={campusId} onChange={(e) => setCampusId(e.target.value)} fullWidth>
              {CAMPUS_IDS.map((c) => (
                <MenuItem key={c} value={c}>
                  {CAMPUS_LABEL[c]}
                </MenuItem>
              ))}
            </TextField>

            <TextField select size="small" label="Nhóm sự cố *" value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)} fullWidth>
              {categories.map((c) => (
                <MenuItem key={c.code} value={c.code}>
                  {c.label}
                </MenuItem>
              ))}
            </TextField>

            <FormControlLabel
              sx={{ ml: 0 }}
              control={<Checkbox size="small" checked={stillDangerous} onChange={(e) => setStillDangerous(e.target.checked)} color="error" />}
              label={<Typography variant="body2">Sự việc vẫn đang tiếp diễn / nguy hiểm ngay lúc này</Typography>}
            />

            <TextField
              size="small"
              label="Nội dung sự việc *"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              multiline
              rows={3}
              fullWidth
              placeholder="Mô tả những gì đã xảy ra, thời gian, những ai liên quan..."
            />

            {signInError && <Alert severity="warning">{signInError}</Alert>}
            {!googleUser ? (
              <Stack spacing={0.5}>
                <Button
                  variant="outlined"
                  startIcon={signingIn ? <CircularProgress size={16} /> : <GoogleIcon />}
                  onClick={handleGoogleSignIn}
                  disabled={signingIn}
                  sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                >
                  {signingIn ? 'Đang đăng nhập...' : 'Đăng nhập nhanh bằng Google'}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Cần đăng nhập bằng 1 tài khoản Google thật để nhà trường liên hệ lại khi cần xác nhận — không cần dùng email/tài khoản của trường.
                </Typography>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2, px: 1.5, py: 1 }}>
                <CheckIcon fontSize="small" sx={{ color: '#166534' }} />
                <Typography variant="body2" sx={{ color: '#166534', flex: 1 }}>
                  Đã đăng nhập: <strong>{googleUser.email}</strong>
                </Typography>
                <Button size="small" onClick={handleGoogleSignOut} sx={{ textTransform: 'none', color: '#64748b' }}>
                  Đổi tài khoản
                </Button>
              </Stack>
            )}

            <Button variant="text" size="small" onClick={() => setShowMore((v) => !v)} sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
              {showMore ? '− Thu gọn' : '+ Thêm chi tiết (lớp, thời gian, minh chứng)'}
            </Button>
            {showMore && (
              <Stack spacing={1.25}>
                <TextField size="small" label="Lớp liên quan (nếu có)" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="VD: 8A3" fullWidth />

                <TextField select size="small" label="Bạn là ai trong sự việc này" value={reporterRole} onChange={(e) => setReporterRole(e.target.value)} fullWidth>
                  {REPORTER_ROLE_OPTIONS.map((r) => (
                    <MenuItem key={r.value} value={r.value}>
                      {r.label}
                    </MenuItem>
                  ))}
                </TextField>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                  <TextField
                    size="small"
                    label="Xảy ra từ"
                    type="datetime-local"
                    value={occurredFrom}
                    onChange={(e) => setOccurredFrom(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Đến"
                    type="datetime-local"
                    value={occurredTo}
                    onChange={(e) => setOccurredTo(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                  />
                </Stack>

                <Stack spacing={0.75}>
                  <Button
                    component="label"
                    variant="outlined"
                    size="small"
                    startIcon={<UploadFileIcon />}
                    disabled={files.length >= MAX_EVIDENCE_FILES}
                    sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
                  >
                    {files.length === 0
                      ? 'Đính kèm ảnh/video minh chứng (tuỳ chọn)'
                      : `Thêm file (${files.length}/${MAX_EVIDENCE_FILES})`}
                    <input
                      type="file"
                      hidden
                      multiple
                      accept="image/*,video/*,audio/*"
                      onChange={(e) => {
                        const picked = Array.from(e.target.files || []);
                        setFiles((prev) => [...prev, ...picked].slice(0, MAX_EVIDENCE_FILES));
                        e.target.value = '';
                      }}
                    />
                  </Button>
                  {files.length > 0 && (
                    <Stack spacing={0.5}>
                      {files.map((f, i) => (
                        <Stack key={`${f.name}-${f.lastModified}-${i}`} direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.name}
                          </Typography>
                          <Button size="small" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} sx={{ textTransform: 'none', color: '#64748b' }}>
                            Bỏ
                          </Button>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                  {files.length >= MAX_EVIDENCE_FILES && (
                    <Typography variant="caption" color="text.secondary">
                      Tối đa {MAX_EVIDENCE_FILES} file mỗi tin báo.
                    </Typography>
                  )}
                </Stack>
              </Stack>
            )}

            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting || !googleUser}
              sx={{
                bgcolor: '#dc2626',
                '&:hover': { bgcolor: '#b91c1c' },
                fontWeight: 700,
                borderRadius: 2,
                py: 0.85,
                position: { xs: 'sticky', sm: 'static' },
                bottom: { xs: 0 }
              }}
            >
              {submitting ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Gửi tin báo'}
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
