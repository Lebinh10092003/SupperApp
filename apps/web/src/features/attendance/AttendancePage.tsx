import { Box, Chip, Typography } from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheckRounded';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function AttendancePage() {
  return (
    <ApiTablePage
      title="Điểm danh Chuyên cần — THCS Giảng Võ"
      subtitle="Thống kê chuyên cần tự động từ Google Meet, phân loại học sinh có mặt, đi muộn và vắng mặt"
      path="/api/attendance"
      columns={[
        {
          key: 'date',
          label: 'Ngày học',
          render: (val) => <strong>{val || '—'}</strong>
        },
        {
          key: 'className',
          label: 'Lớp',
          render: (val) => (
            <Chip
              label={val || '—'}
              size="small"
              sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}
            />
          )
        },
        {
          key: 'present',
          label: 'Có mặt',
          render: (val) => (
            <Typography variant="body2" fontWeight={700} sx={{ color: '#16a34a' }}>
              {val ?? 0} HS
            </Typography>
          )
        },
        {
          key: 'late',
          label: 'Đi muộn',
          render: (val) => (
            <Typography variant="body2" fontWeight={600} sx={{ color: Number(val) > 0 ? '#d97706' : '#64748b' }}>
              {val ?? 0} HS
            </Typography>
          )
        },
        {
          key: 'absent',
          label: 'Vắng mặt',
          render: (val) => (
            <Typography variant="body2" fontWeight={700} sx={{ color: Number(val) > 0 ? '#dc2626' : '#64748b' }}>
              {val ?? 0} HS
            </Typography>
          )
        },
        {
          key: 'attendanceRate',
          label: 'Tỷ lệ Chuyên cần',
          render: (val) => {
            if (val === undefined || val === null) {
              return <Typography variant="caption" color="text.secondary">—</Typography>;
            }
            const num = Number(val);
            return (
              <Chip
                label={`${num}%`}
                size="small"
                sx={{
                  bgcolor: num >= 95 ? '#ecfdf5' : '#fffbeb',
                  color: num >= 95 ? '#059669' : '#d97706',
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