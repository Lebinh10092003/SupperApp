import { Box, Chip, Typography } from '@mui/material';
import VideocamIcon from '@mui/icons-material/VideocamRounded';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function MeetPage() {
  return (
    <ApiTablePage
      title="Google Meet — THCS Giảng Võ"
      subtitle="Giám sát phiên phòng học trực tuyến, thời lượng tham gia và nhật ký chuyên cần tự động"
      path="/api/meet/sessions"
      columns={[
        {
          key: 'date',
          label: 'Ngày học',
          render: (val) => <strong>{val || '—'}</strong>
        },
        {
          key: 'className',
          label: 'Lớp học',
          render: (val) => (
            <Chip
              label={val || '—'}
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
          label: 'Online',
          render: (val, row) => (
            <Typography
              variant="body2"
              fontWeight={700}
              sx={{ color: row?.status === 'LIVE' ? '#dc2626' : '#64748b' }}
            >
              {val !== undefined && val !== null ? `${val} HS` : '0 HS'}
            </Typography>
          )
        },
        {
          key: 'attendanceRate',
          label: 'Chuyên cần %',
          render: (val) => (
            <Chip
              label={val !== undefined && val !== null ? `${val}%` : '—'}
              size="small"
              sx={{ bgcolor: '#ecfdf5', color: '#059669', fontWeight: 800 }}
            />
          )
        },
        {
          key: 'status',
          label: 'Trạng thái',
          render: (val) => {
            const isLive = String(val).toUpperCase() === 'LIVE';
            return (
              <Chip
                icon={<VideocamIcon sx={{ fontSize: '14px !important' }} />}
                label={isLive ? 'Đang diễn ra' : 'Đã kết thúc'}
                size="small"
                sx={{
                  bgcolor: isLive ? '#fee2e2' : '#f1f5f9',
                  color: isLive ? '#dc2626' : '#64748b',
                  fontWeight: 800
                }}
              />
            );
          }
        }
      ]}
    />
  );
}