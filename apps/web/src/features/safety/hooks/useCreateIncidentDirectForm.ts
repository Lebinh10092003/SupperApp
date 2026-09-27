import { useState } from 'react';
import { api } from '../../../services/api';

export interface CreateIncidentDirectFormState {
  campusId: string;
  categoryCode: string;
  content: string;
  className: string;
  priority: string;
}

const EMPTY_FORM: CreateIncidentDirectFormState = { campusId: '', categoryCode: '', content: '', className: '', priority: '' };

/**
 * Logic dùng chung cho "Ghi nhận sự vụ trực tiếp" — trích từ
 * CreateIncidentDirectDialog.tsx (bản MUI, desktop) để MobileCreateIncidentSheet.tsx
 * (antd-mobile) dùng lại, không lặp code gọi API.
 */
export function useCreateIncidentDirectForm(onCreated: (incidentId: string) => void) {
  const [form, setForm] = useState<CreateIncidentDirectFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setForm(EMPTY_FORM);
    setError('');
  };

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
      setForm(EMPTY_FORM);
      onCreated(res.incidentId);
    } catch (e: any) {
      setError(e.message || 'Tạo hồ sơ thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return { form, setForm, submitting, error, handleSubmit, reset };
}
