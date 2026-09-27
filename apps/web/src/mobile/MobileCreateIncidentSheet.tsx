/**
 * MobileCreateIncidentSheet.tsx — bản antd-mobile của "Ghi nhận sự vụ
 * trực tiếp" (Popup đáy màn hình, Selector/Input/TextArea antd-mobile),
 * thay cho việc nhúng thẳng CreateIncidentDirectDialog.tsx (Dialog MUI,
 * label nổi trong ô — kiểu web) vào các trang mobile. Sin: "cái form
 * mobile cũng chưa chuẩn phù hợp với kiểu mobile app lắm" — dùng chung
 * logic qua useCreateIncidentDirectForm, chỉ đổi lớp hiển thị.
 */
import { Popup, Selector, Input, TextArea, Button as AntButton } from 'antd-mobile';
import { Box, Typography } from '@mui/material';
import { CAMPUS_IDS, CAMPUS_LABEL } from '../features/safety/constants';
import { useCreateIncidentDirectForm } from '../features/safety/hooks/useCreateIncidentDirectForm';

const PRIORITY_OPTIONS = ['P0', 'P1', 'P2', 'P3'];

const fieldLabelSx = { fontSize: 12.5, fontWeight: 700, color: '#475569', mb: 0.5 };
const inputBoxSx = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, px: 1.5, py: 1 };

export function MobileCreateIncidentSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (incidentId: string) => void }) {
  const { form, setForm, submitting, error, handleSubmit, reset } = useCreateIncidentDirectForm(onCreated);

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '92vh', overflowY: 'auto' }}
    >
      {/* Đường kẻ kéo (drag handle) — chỉ để báo hiệu đây là sheet có thể vuốt
          xuống đóng, đồng thời cho biết còn nội dung cuộn phía dưới. */}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
        <Box sx={{ width: 36, height: 4, borderRadius: 999, background: '#e2e8f0' }} />
      </Box>

      <Box sx={{ px: 2, pt: 1.5, pb: 'max(env(safe-area-inset-bottom), 16px)' }}>
        <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.25 }}>
          Ghi nhận sự vụ trực tiếp
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1.5 }}>
          Dùng khi bạn trực tiếp chứng kiến/xử lý sự việc, không cần có sẵn tin báo trước.
        </Typography>

        {error && (
          <Box sx={{ background: '#fef2f2', color: '#b91c1c', fontSize: 13, fontWeight: 600, px: 1.5, py: 1, borderRadius: 2, mb: 1.5 }}>
            {error}
          </Box>
        )}

        <Box sx={{ mb: 1.5 }}>
          <Typography sx={fieldLabelSx}>Cơ sở *</Typography>
          <Selector
            columns={3}
            options={CAMPUS_IDS.map((c) => ({ label: CAMPUS_LABEL[c], value: c }))}
            value={form.campusId ? [form.campusId] : []}
            onChange={(v) => setForm({ ...form, campusId: (v[0] as string) || '' })}
          />
        </Box>

        <Box sx={{ mb: 1.5 }}>
          <Typography sx={fieldLabelSx}>Mã nhóm sự cố (categoryCode) *</Typography>
          <Box sx={inputBoxSx}>
            <Input placeholder="VD: fire_explosion" value={form.categoryCode} onChange={(v) => setForm({ ...form, categoryCode: v })} />
          </Box>
        </Box>

        <Box sx={{ mb: 1.5 }}>
          <Typography sx={fieldLabelSx}>Lớp liên quan</Typography>
          <Box sx={inputBoxSx}>
            <Input value={form.className} onChange={(v) => setForm({ ...form, className: v })} />
          </Box>
        </Box>

        <Box sx={{ mb: 1.5 }}>
          <Typography sx={fieldLabelSx}>Nội dung</Typography>
          <Box sx={inputBoxSx}>
            <TextArea rows={2} value={form.content} onChange={(v) => setForm({ ...form, content: v })} />
          </Box>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography sx={fieldLabelSx}>Mức ưu tiên (tuỳ chọn)</Typography>
          <Selector
            columns={4}
            options={PRIORITY_OPTIONS.map((p) => ({ label: p, value: p }))}
            value={form.priority ? [form.priority] : []}
            onChange={(v) => setForm({ ...form, priority: (v[0] as string) || '' })}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
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
