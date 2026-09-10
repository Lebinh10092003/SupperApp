import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { PublicLayout } from './PublicLayout';
import { env } from '../../config/env';

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
  const [codeInput, setCodeInput] = useState('');
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
      <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 4px 15px -1px rgba(15, 23, 42, 0.06)' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Stack spacing={2.5}>
            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
            {toast && <Alert severity="success" onClose={() => setToast('')}>{toast}</Alert>}

            <Stack direction="row" spacing={1.5}>
              <TextField
                label="Mã tra cứu"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                fullWidth
                placeholder="VD: GV.2609.0001"
              />
              <Button variant="contained" onClick={handleLookup} disabled={loading} sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' }, whiteSpace: 'nowrap' }}>
                {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Tra cứu'}
              </Button>
            </Stack>

            {result && (
              <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" color="text.secondary">
                  Mã: {result.publicCode}
                </Typography>
                <Typography variant="h6" fontWeight={700} color="#0f172a" sx={{ mt: 0.5 }}>
                  {result.state}
                </Typography>

                {result.canConfirmClose && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Nhà trường đề nghị đóng hồ sơ này. Bạn xác nhận đã được xử lý thoả đáng?
                    </Typography>
                    <Button variant="contained" color="success" onClick={handleConfirmClose} disabled={confirmSubmitting}>
                      Xác nhận đóng hồ sơ
                    </Button>
                  </Box>
                )}

                <Box sx={{ mt: 2.5 }}>
                  <TextField
                    label="Bổ sung thông tin"
                    value={supplementText}
                    onChange={(e) => setSupplementText(e.target.value)}
                    multiline
                    rows={2}
                    fullWidth
                    placeholder="Có thêm chi tiết gì muốn báo thêm cho nhà trường?"
                  />
                  <Button
                    variant="outlined"
                    onClick={handleSupplement}
                    disabled={supplementSubmitting || !supplementText.trim()}
                    sx={{ mt: 1 }}
                  >
                    Gửi bổ sung
                  </Button>
                </Box>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>
    </PublicLayout>
  );
}
