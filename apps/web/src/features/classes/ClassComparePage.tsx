import { Box, Chip } from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrowsRounded';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function ClassComparePage() {
  return (
    <ApiTablePage
      title="So Sánh Lớp Học Đối Đầu — Benchmark & Comparison"
      subtitle="So sánh tương quan giữa các lớp cùng khối về mức độ hoàn thành bài tập, chuyên cần và tiến độ"
      path="/api/classes"
      columns={[
        {
          key: 'className',
          label: 'Lớp học',
          render: (val: any) => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CompareArrowsIcon sx={{ color: '#2563eb', fontSize: 20 }} />
              <strong>{val || '—'}</strong>
            </Box>
          )
        },
        {
          key: 'grade',
          label: 'Khối',
          render: (val: any) => (
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
          render: (val: any) => (val != null && val !== '' ? `${val} học sinh` : '—')
        },
        {
          key: 'homeroomTeacher',
          label: 'Giáo viên Chủ nhiệm',
          render: (val: any) => val || 'Chưa phân công'
        }
      ]}
    />
  );
}

