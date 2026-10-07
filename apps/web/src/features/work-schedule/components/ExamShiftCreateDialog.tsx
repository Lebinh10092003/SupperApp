/**
 * ExamShiftCreateDialog.tsx — tạo THỦ CÔNG 1 ca trông thi (Sin yêu cầu
 * 2026-10-05: "bổ sung/hoàn thiện khả năng tạo lịch trông thi thủ công").
 * Backend `POST /api/work-schedule/exam-shifts` (createExamShift,
 * exam-schedule.service.ts) đã có sẵn từ trước — chỉ thiếu UI, không cần
 * sửa backend. Dùng đúng field `firstProctorPerId`/`secondProctorPerId`
 * (perId thật qua PersonPicker) khác với luồng import file (chỉ có tên chữ
 * tự do firstProctorName/secondProctorName — xem ghi chú trong
 * exam-schedule.routes.ts#withLabels).
 */
import { useState } from 'react';
import { api } from '../../../services/api';
import { PersonPicker, type PersonOption } from '../../safety/PersonPicker';
import { CAMPUS_IDS, CAMPUS_LABEL } from '../constants';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function ExamShiftCreateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [examDate, setExamDate] = useState('');
  const [campusId, setCampusId] = useState('');
  const [session, setSession] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [timeLabel, setTimeLabel] = useState('');
  const [subject, setSubject] = useState('');
  const [className, setClassName] = useState('');
  const [firstProctor, setFirstProctor] = useState<PersonOption | null>(null);
  const [secondProctor, setSecondProctor] = useState<PersonOption | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setExamDate('');
    setCampusId('');
    setSession('');
    setPeriodLabel('');
    setTimeLabel('');
    setSubject('');
    setClassName('');
    setFirstProctor(null);
    setSecondProctor(null);
    setNote('');
    setError('');
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!examDate) return setError('Vui lòng chọn Ngày.');
    if (!campusId) return setError('Vui lòng chọn Điểm trường.');
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/work-schedule/exam-shifts', {
        examDate,
        campusId,
        session,
        periodLabel,
        timeLabel,
        subject,
        className,
        firstProctorPerId: firstProctor?.perId || null,
        secondProctorPerId: secondProctor?.perId || null,
        note
      });
      onCreated();
      handleClose();
    } catch (e: any) {
      setError(e.message || 'Tạo ca trông thi thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tạo ca trông thi</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="exam-shift-date" className="mb-1.5 block">
                Ngày *
              </Label>
              <Input id="exam-shift-date" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Điểm trường *</Label>
              <Select value={campusId} onValueChange={setCampusId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn điểm trường" />
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
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="exam-shift-session" className="mb-1.5 block">
                Buổi
              </Label>
              <Input id="exam-shift-session" value={session} onChange={(e) => setSession(e.target.value)} placeholder="Sáng/Chiều" />
            </div>
            <div>
              <Label htmlFor="exam-shift-period" className="mb-1.5 block">
                Tiết KS
              </Label>
              <Input id="exam-shift-period" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="exam-shift-time" className="mb-1.5 block">
                Giờ
              </Label>
              <Input id="exam-shift-time" value={timeLabel} onChange={(e) => setTimeLabel(e.target.value)} placeholder="07:30" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="exam-shift-subject" className="mb-1.5 block">
                Môn khảo sát
              </Label>
              <Input id="exam-shift-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="exam-shift-class" className="mb-1.5 block">
                Lớp
              </Label>
              <Input id="exam-shift-class" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="8A1" />
            </div>
          </div>
          <PersonPicker label="GV tiết đầu" value={firstProctor} onChange={setFirstProctor} />
          <PersonPicker label="GV tiết sau" value={secondProctor} onChange={setSecondProctor} />
          <div>
            <Label htmlFor="exam-shift-note" className="mb-1.5 block">
              Ghi chú
            </Label>
            <Input id="exam-shift-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Đang tạo...' : 'Tạo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
