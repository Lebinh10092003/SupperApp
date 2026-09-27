/**
 * MobileCreateIncidentSheet.tsx — bản antd-mobile của "Ghi nhận sự vụ
 * trực tiếp" (Popup đáy màn hình, Selector/Input/TextArea antd-mobile),
 * thay cho việc nhúng thẳng CreateIncidentDirectDialog.tsx (Dialog MUI,
 * label nổi trong ô — kiểu web) vào các trang mobile. Sin: "cái form
 * mobile cũng chưa chuẩn phù hợp với kiểu mobile app lắm" — dùng chung
 * logic qua useCreateIncidentDirectForm, chỉ đổi lớp hiển thị.
 */
import { Popup, List, Selector, Input, TextArea, Button as AntButton } from 'antd-mobile';
import { Box, Typography } from '@mui/material';
import { CAMPUS_IDS, CAMPUS_LABEL } from '../features/safety/constants';
import { useCreateIncidentDirectForm } from '../features/safety/hooks/useCreateIncidentDirectForm';

const PRIORITY_OPTIONS = ['P0', 'P1', 'P2', 'P3'];

export function MobileCreateIncidentSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (incidentId: string) => void }) {
  const { form, setForm, submitting, error, handleSubmit, reset } = useCreateIncidentDirectForm(onCreated);

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '88vh', overflowY: 'auto' }}
    >
      <Box sx={{ p: 2, pb: 3 }}>
        <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5 }}>
          Ghi nhận sự vụ trực tiếp
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
          Dùng khi bạn trực tiếp chứng kiến/xử lý sự việc, không cần có sẵn tin báo trước.
        </Typography>

        {error && (
          <Box sx={{ background: '#fef2f2', color: '#b91c1c', fontSize: 13, fontWeight: 600, px: 1.5, py: 1, borderRadius: 2, mb: 1.5 }}>
            {error}
          </Box>
        )}

        <List header="Cơ sở *">
          <List.Item>
            <Selector
              columns={3}
              options={CAMPUS_IDS.map((c) => ({ label: CAMPUS_LABEL[c], value: c }))}
              value={form.campusId ? [form.campusId] : []}
              onChange={(v) => setForm({ ...form, campusId: (v[0] as string) || '' })}
            />
          </List.Item>
        </List>

        <List header="Mã nhóm sự cố (categoryCode) *">
          <List.Item>
            <Input placeholder="VD: fire_explosion" value={form.categoryCode} onChange={(v) => setForm({ ...form, categoryCode: v })} />
          </List.Item>
        </List>

        <List header="Lớp liên quan">
          <List.Item>
            <Input value={form.className} onChange={(v) => setForm({ ...form, className: v })} />
          </List.Item>
        </List>

        <List header="Nội dung">
          <List.Item>
            <TextArea rows={3} value={form.content} onChange={(v) => setForm({ ...form, content: v })} />
          </List.Item>
        </List>

        <List header="Mức ưu tiên (tuỳ chọn)">
          <List.Item>
            <Selector
              columns={4}
              options={PRIORITY_OPTIONS.map((p) => ({ label: p, value: p }))}
              value={form.priority ? [form.priority] : []}
              onChange={(v) => setForm({ ...form, priority: (v[0] as string) || '' })}
            />
          </List.Item>
        </List>

        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <AntButton
            block
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Hủy
          </AntButton>
          <AntButton block color="primary" loading={submitting} onClick={handleSubmit}>
            Tạo sự vụ
          </AntButton>
        </Box>
      </Box>
    </Popup>
  );
}
