import { Box, Chip } from '@mui/material';
import HistoryEduIcon from '@mui/icons-material/HistoryEduRounded';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function ClassroomAuditPage() {
  return (
    <ApiTablePage
      title="Nhật Ký Thao Tác & Kiểm Toán Lớp Học (Classroom Audit Logs)"
      subtitle="Theo dõi và tra cứu toàn bộ hoạt động giao bài, cập nhật điểm và truy cập hệ thống theo thời gian thực"
      path="/api/audit"
      columns={[
        {
          key: 'action',
          label: 'Hành động',
          render: (val: any) => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryEduIcon sx={{ color: '#2563eb', fontSize: 20 }} />
              <strong>{val || '—'}</strong>
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
              label={val || 'UNKNOWN'}
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
