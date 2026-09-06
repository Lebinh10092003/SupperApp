import { Box, Chip, Typography, Avatar } from '@mui/material';
import PersonIcon from '@mui/icons-material/PersonRounded';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function Student360Page() {
  return (
    <ApiTablePage
      title="Hồ Sơ Học Sinh 360° — Student Intelligence"
      subtitle="Theo dõi toàn diện danh sách học sinh từ Google Classroom & Google Workspace"
      path="/api/people/students"
      columns={[
        {
          key: 'displayName',
          label: 'Họ và Tên Học Sinh',
          render: (val: any, row: any) => {
            const name = val || row.displayName || row.name || row.email || 'Chưa cập nhật họ tên';
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar
                  src={row.photoUrl}
                  sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: '#3b82f6', fontWeight: 700 }}
                >
                  <PersonIcon sx={{ fontSize: 18 }} />
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
          label: 'Email Nhà trường',
          render: (val: any) => (
            <Typography variant="body2" sx={{ color: '#2563eb', fontWeight: 500 }}>
              {val || '—'}
            </Typography>
          )
        },
        {
          key: 'className',
          label: 'Lớp học',
          render: (val: any, row: any) => {
            const cls = val || row.classId || (row.orgUnitPath?.split('/').pop()) || '—';
            return (
              <Chip
                label={cls}
                size="small"
                sx={{ bgcolor: '#f1f5f9', color: '#334155', fontWeight: 700 }}
              />
            );
          }
        },
        {
          key: 'courses',
          label: 'Số lớp tham gia',
          render: (val: any) => (
            <Chip
              label={`${Array.isArray(val) ? val.length : 0} môn`}
              size="small"
              sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}
            />
          )
        },
        {
          key: 'suspended',
          label: 'Trạng thái',
          render: (val: any) => (
            <Chip
              label={val ? 'Tạm khóa' : 'Đang học tập'}
              size="small"
              color={val ? 'default' : 'success'}
              sx={{ fontWeight: 700 }}
            />
          )
        }
      ]}
    />
  );
}

