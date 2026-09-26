import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { api } from '../../../services/api';
import { CAMPUS_IDS, CAMPUS_LABEL } from '../constants';

const PRIORITY_OPTIONS = ['P0', 'P1', 'P2', 'P3'];

/**
 * "Ghi nhận sự vụ trực tiếp" — dùng khi nhân viên nội bộ TRỰC TIẾP chứng
 * kiến/xử lý sự việc, không cần có sẵn tin báo trước (khác hẳn
 * `/safety/report`, form CÔNG KHAI cho học sinh/phụ huynh gửi tin ẩn
 * danh). Trích xuất từ CasesListPage.tsx (desktop) ra dùng chung — Sin
 * chỉ ra bản mobile trước đây nhầm nút "+" sang thẳng form công khai
 * thay vì mở đúng luồng nội bộ này.
 */
export function CreateIncidentDirectDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (incidentId: string) => void }) {
  const [form, setForm] = useState({ campusId: '', categoryCode: '', content: '', className: '', priority: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!form.campusId) return setError('Vui lòng chọn cơ sở.');
    if (!form.categoryCode) return setError('Vui lòng nhập mã nhóm sự cố.');
    setSubmitting(true);
    try {
      const res = await api.post<{ incidentId: string }>('/api/safety/incidents/direct', {
        campusId: form.campusId,
        categoryCode: form.categoryCode,
        content: form.content,
        className: form.className || undefined,
        priority: form.priority || undefined
      });
      setForm({ campusId: '', categoryCode: '', content: '', className: '', priority: '' });
      onCreated(res.incidentId);
    } catch (e: any) {
      setError(e.message || 'Tạo hồ sơ thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Ghi nhận sự vụ trực tiếp</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2" color="text.secondary">
            Dùng khi bạn trực tiếp chứng kiến/xử lý sự việc, không cần có sẵn tin báo trước.
          </Typography>
          <TextField select label="Cơ sở *" value={form.campusId} onChange={(e) => setForm({ ...form, campusId: e.target.value })} fullWidth>
            {CAMPUS_IDS.map((c) => (
              <MenuItem key={c} value={c}>
                {CAMPUS_LABEL[c]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Mã nhóm sự cố (categoryCode) *"
            value={form.categoryCode}
            onChange={(e) => setForm({ ...form, categoryCode: e.target.value })}
            placeholder="VD: fire_explosion"
            fullWidth
          />
          <TextField label="Lớp liên quan" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} fullWidth />
          <TextField label="Nội dung" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} multiline rows={3} fullWidth />
          <TextField select label="Mức ưu tiên (tuỳ chọn)" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} fullWidth>
            <MenuItem value="">Tự động gợi ý</MenuItem>
            {PRIORITY_OPTIONS.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Hủy</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          Tạo sự vụ
        </Button>
      </DialogActions>
    </Dialog>
  );
}
