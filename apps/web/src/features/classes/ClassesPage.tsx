import { Box, Chip } from '@mui/material';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function ClassesPage() {
  return (
    <ApiTablePage
      title="Danh sách lớp học"
      path="/api/classes"
      columns={[
        {
          key: 'className',
          label: 'Tên Lớp',
          render: (val) => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SchoolIcon sx={{ color: '#2563eb', fontSize: 20 }} />
              <strong style={{ color: '#0f172a' }}>{val}</strong>
            </Box>
          )
        },
        {
          key: 'grade',
          label: 'Khối',
          render: (val) => (
            <Chip
              label={val ? `Khối ${val}` : 'Chưa phân khối'}
              size="small"
              sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}
            />
          )
        },
        {
          key: 'expectedStudents',
          label: 'Sĩ số',
          render: (val) => (val !== undefined && val !== null ? `${val} học sinh` : 'Chưa đồng bộ')
        },
        {
          key: 'homeroomTeacher',
          label: 'Giáo viên Chủ nhiệm',
          render: (val) => val || 'Chưa phân công'
        }
      ]}
    />
  );
}