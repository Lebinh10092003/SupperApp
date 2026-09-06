import { Box, Chip, Avatar, Typography } from '@mui/material';
import BadgeIcon from '@mui/icons-material/BadgeRounded';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function TeacherAnalyticsPage() {
  return (
    <ApiTablePage
      title="Hoạt Động Giảng Dạy Của Giáo Viên — Teacher Analytics"
      subtitle="Theo dõi phân công giảng dạy, số lượng lớp phụ trách và tình hình tương tác trên Google Classroom"
      path="/api/people/teachers"
      columns={[
        {
          key: 'displayName',
          label: 'Họ và Tên Giáo Viên',
          render: (val: any, row: any) => {
            const name = val || row.displayName || row.name || row.email || 'Chưa cập nhật họ tên';
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar
                  src={row.photoUrl}
                  sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: '#2563eb', fontWeight: 700 }}
                >
                  <BadgeIcon sx={{ fontSize: 18 }} />
                </Avatar>
                <Box>
                  <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a' }}>
                    {name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    {row.email}
                  </Typography>
                </Box>
              </Box>
            );
          }
        },
        {
          key: 'email',
          label: 'Email Giảng dạy',
          render: (val: any) => (
            <Typography variant="body2" sx={{ color: '#2563eb', fontWeight: 500 }}>
              {val || '—'}
            </Typography>
          )
        },
        {
          key: 'orgUnitPath',
          label: 'Tổ Chuyên Môn',
          render: (val: any) => (
            <Chip
              label={val || 'Chưa phân tổ'}
              size="small"
              sx={{ bgcolor: '#ecfdf5', color: '#059669', fontWeight: 700 }}
            />
          )
        },
        {
          key: 'courses',
          label: 'Số lớp phụ trách',
          render: (val: any) => (
            <Chip
              label={`${Array.isArray(val) ? val.length : 0} khóa học`}
              size="small"
              sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}
            />
          )
        }
      ]}
    />
  );
}

