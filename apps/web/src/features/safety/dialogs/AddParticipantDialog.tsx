/**
 * AddParticipantDialog.tsx — chỉ huy hồ sơ thêm người cùng tham gia xử lý,
 * `POST /api/safety/incidents/:id/participants` (`addIncidentParticipant`).
 * Chỉ hiện nút mở dialog này với người đang là chỉ huy hồ sơ HOẶC tài
 * khoản cấp cao (Hiệu trưởng/Phó Hiệu trưởng/Tổ trưởng, xem
 * `IncidentDetailPage.tsx`) — server cũng tự kiểm tra lại, KHÔNG tin client.
 */
import { useState } from 'react';
import { api } from '../../../services/api';
import { PersonPicker, type PersonOption } from '../PersonPicker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
    <Dialog open={Boolean(target)} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm người cùng xử lý</DialogTitle>
        </DialogHeader>
        {target && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-500">
              Hồ sơ <strong>{target.incidentId}</strong> — người được thêm sẽ xem được toàn bộ hồ sơ và nhận thông báo ngay.
            </p>
            {target.current && target.current.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-slate-500">Đang tham gia xử lý hồ sơ này:</p>
                <div className="flex flex-wrap gap-1.5">
                  {target.current.map((c) => (
                    <Badge key={c.perId} variant="outline" className="border-slate-300 text-slate-600">
                      {c.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {target.suggested && target.suggested.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-slate-500">Gợi ý theo lớp/nhóm sự cố này:</p>
                <div className="flex flex-wrap gap-1.5">
                  {target.suggested.map((s) => (
                    <button key={s.perId} type="button" onClick={() => setPerson({ perId: s.perId, name: s.label })}>
                      <Badge variant="outline" className="cursor-pointer border-transparent bg-secondary font-semibold text-[#1d4ed8]">
                        {s.label}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <PersonPicker label="Hoặc tìm người tham gia xử lý" value={person} onChange={setPerson} />
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} className="text-slate-500">
            Hủy
          </Button>
          <Button disabled={!person || submitting} onClick={handleSubmit} className="font-bold">
            {submitting ? 'Đang lưu...' : 'Thêm vào hồ sơ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
