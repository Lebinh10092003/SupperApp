import { Box, Chip } from '@mui/material';
import HistoryEduIcon from '@mui/icons-material/HistoryEduRounded';
import { ApiTablePage } from '../../components/ApiTablePage';

/** Toàn bộ giá trị `action` thật từng ghi vào general_audit_logs (xem admin.routes.ts + connections.routes.ts) — không có giá trị nào khác. */
const ACTION_LABEL: Record<string, string> = {
  UPDATE_USER_ACCESS: 'Cập nhật quyền truy cập',
  REVOKE_USER_ACCESS: 'Thu hồi quyền truy cập',
  CREATE_SAFETY_USER: 'Tạo người dùng mới',
  UPDATE_SAFETY_USER: 'Cập nhật người dùng',
  RESET_SAFETY_USER_PASSWORD: 'Đặt lại mật khẩu',
  DISABLE_SAFETY_USER: 'Khoá tài khoản',
  ENABLE_SAFETY_USER: 'Mở khoá tài khoản',
  'classroom.sync_run': 'Đồng bộ Google Classroom',
  'alert.created': 'Tạo cảnh báo'
};

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: 'Thành công',
  ERROR: 'Lỗi',
  UNKNOWN: 'Không xác định'
};

export default function ClassroomAuditPage() {
  return (
    <ApiTablePage
      title="Nhật ký thao tác & kiểm toán Classroom"
      path="/api/audit"
      columns={[
        {
          key: 'action',
          label: 'Hành động',
          render: (val: any) => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryEduIcon sx={{ color: '#2563eb', fontSize: 20 }} />
              <strong>{(val && ACTION_LABEL[val]) || val || '—'}</strong>
            </Box>
          )
        },
        {
          key: 'actor',
          label: 'Người thực hiện',
          render: (val: any) => val || '—'
        },
        {
          key: 'status',
          label: 'Trạng thái',
          render: (val: any) => (
            <Chip
              label={STATUS_LABEL[val] || val || STATUS_LABEL.UNKNOWN}
              size="small"
              color={val === 'ERROR' ? 'error' : val === 'SUCCESS' ? 'success' : 'default'}
              sx={{ fontWeight: 700 }}
            />
          )
        },
        {
          key: 'timestamp',
          label: 'Thời gian',
          render: (val: any) => (val ? new Date(val).toLocaleString('vi-VN') : '—')
        }
      ]}
    />
  );
}
