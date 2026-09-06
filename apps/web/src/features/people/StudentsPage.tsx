import { Box, Avatar, Typography, Chip } from '@mui/material';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function StudentsPage() {
  return (
    <ApiTablePage
      title="Danh bạ Học sinh — THCS Giảng Võ"
      subtitle="Đồng bộ tự động từ Google Workspace & Google Classroom theo đơn vị tổ chức (Org Unit)"
      path="/api/people/students"
      columns={[
        {
          key: 'displayName',
          label: 'Họ và tên Học sinh',
          render: (val, row) => {
            const name = val || row.displayName || row.name || row.email || 'Chưa cập nhật';
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar
                  src={row.photoUrl}
                  sx={{ width: 34, height: 34, fontSize: '0.85rem', bgcolor: '#3b82f6', fontWeight: 700 }}
                >
                  {String(name)[0]?.toUpperCase()}
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
          label: 'Email Google Workspace',
          render: (val) => (
            <Typography variant="body2" sx={{ color: '#2563eb', fontWeight: 500 }}>
              {val || '—'}
            </Typography>
          )
        },
        {
          key: 'orgUnitPath',
          label: 'Đơn vị Tổ chức (Org Unit)',
          render: (val) => (
            <Chip
              label={val || 'Chưa phân đơn vị'}
              size="small"
              sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 600 }}
            />
          )
        },
        {
          key: 'courses',
          label: 'Lớp tham gia',
          render: (val) => (
            <Chip
              label={`${Array.isArray(val) ? val.length : 0} lớp`}
              size="small"
              variant="outlined"
              sx={{ borderColor: '#cbd5e1', fontWeight: 600 }}
            />
          )
        }
      ]}
    />
  );
}