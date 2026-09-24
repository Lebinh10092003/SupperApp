/**
 * AddParticipantDialog.tsx — chỉ huy hồ sơ thêm người cùng tham gia xử lý,
 * `POST /api/safety/incidents/:id/participants` (`addIncidentParticipant`).
 * Chỉ hiện nút mở dialog này với người đang là chỉ huy hồ sơ HOẶC tài
 * khoản cấp cao (Hiệu trưởng/Phó Hiệu trưởng/Tổ trưởng, xem
 * `IncidentDetailPage.tsx`) — server cũng tự kiểm tra lại, KHÔNG tin client.
 */
import { useState } from 'react';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { api } from '../../../services/api';
import { PersonPicker, type PersonOption } from '../PersonPicker';

export interface AddParticipantTarget {
  incidentId: string;
  suggested?: Array<{ perId: string; label: string }>;
  /** Chỉ huy + người đang tham gia hiện tại — hiện trong modal để dễ phân biệt, tránh thêm trùng (Sin phản hồi 2026-09-24). */
  current?: Array<{ perId: string; label: string }>;
}

export function AddParticipantDialog({
  target,
  onClose,
  onChanged
}: {
  target: AddParticipantTarget | null;
  onClose: () => void;
  onChanged: (result: { incidentId: string; personName: string }) => void;
}) {
  const [person, setPerson] = useState<PersonOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setPerson(null);
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!target || !person) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post<{ incidentId: string; assignedTaskPerIds: string[] }>(`/api/safety/incidents/${target.incidentId}/participants`, {
        perId: person.perId
      });
      onChanged({ incidentId: target.incidentId, personName: person.name });
      handleClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={Boolean(target)} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Thêm người cùng xử lý</DialogTitle>
      <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
        {target && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Hồ sơ <strong>{target.incidentId}</strong> — người được thêm sẽ xem được toàn bộ hồ sơ và nhận thông báo ngay.
            </Typography>
            {target.current && target.current.length > 0 && (
              <Stack spacing={0.75}>
                <Typography variant="caption" color="text.secondary">
                  Đang tham gia xử lý hồ sơ này:
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
                  {target.current.map((c) => (
                    <Chip key={c.perId} label={c.label} size="small" variant="outlined" sx={{ borderColor: '#cbd5e1', color: '#475569' }} />
                  ))}
                </Stack>
              </Stack>
            )}
            {target.suggested && target.suggested.length > 0 && (
              <Stack spacing={0.75}>
                <Typography variant="caption" color="text.secondary">
                  Gợi ý theo lớp/nhóm sự cố này:
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
                  {target.suggested.map((s) => (
                    <Chip
                      key={s.perId}
                      label={s.label}
                      onClick={() => setPerson({ perId: s.perId, name: s.label })}
                      sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}
                    />
                  ))}
                </Stack>
              </Stack>
            )}
            <PersonPicker label="Hoặc tìm người tham gia xử lý" value={person} onChange={setPerson} />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={handleClose} sx={{ textTransform: 'none', color: '#64748b' }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          disabled={!person || submitting}
          onClick={handleSubmit}
          sx={{ bgcolor: '#2563eb', color: '#fff', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
        >
          {submitting ? 'Đang lưu...' : 'Thêm vào hồ sơ'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
