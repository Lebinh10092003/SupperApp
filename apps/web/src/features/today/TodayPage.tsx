import { Box, Chip, Typography } from '@mui/material';
import VideocamIcon from '@mui/icons-material/VideocamRounded';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function TodayPage() {
  return (
    <ApiTablePage
      title="Hoạt động Hôm nay — Live School Monitor"
      subtitle="Theo dõi thời gian thực các phiên Google Meet và điểm danh số trong ngày tại THCS Giảng Võ"
      path="/api/meet/live"
      columns={[
        {
          key: 'className',
          label: 'Lớp học',
          render: (val) => (
            <Chip
              label={val}
              size="small"
              sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}
            />
          )
        },
        {
          key: 'subject',
          label: 'Môn học',
          render: (val) => (
            <Typography variant="body2" fontWeight={600} sx={{ color: '#2563eb' }}>
              {val || 'Chưa phân môn'}
            </Typography>
          )
        },
        {
          key: 'teacherEmail',
          label: 'Giáo viên phụ trách',
          render: (val) => val || '—'
        },
        {
          key: 'onlineStudents',
          label: 'Học sinh Online',
          render: (val) => (
            <Typography variant="body2" fontWeight={700} sx={{ color: '#10b981' }}>
              {val !== undefined && val !== null ? `${val} học sinh` : '0 học sinh'}
            </Typography>
          )
        },
        {
          key: 'status',
          label: 'Trạng thái',
          render: (val) => (
            <Chip
              icon={<VideocamIcon sx={{ fontSize: '14px !important' }} />}
              label="ĐANG LIVE"
              size="small"
              sx={{
                bgcolor: '#fee2e2',
                color: '#dc2626',
                fontWeight: 800,
                boxShadow: '0 0 8px rgba(220, 38, 38, 0.2)'
              }}
            />
          )
        }
      ]}
    />
  );
}