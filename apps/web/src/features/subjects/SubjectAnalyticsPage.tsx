import { Box, Chip, Typography } from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBookRounded';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function SubjectAnalyticsPage() {
  return (
    <ApiTablePage
      title="Phân Tích Khóa Học & Môn Học — Subject Performance BI"
      subtitle="Thống kê bài tập, sĩ số và tỷ lệ hoàn thành từ Google Classroom theo từng môn học"
      path="/api/classroom"
      columns={[
        {
          key: 'name',
          label: 'Tên Khóa Học / Bộ Môn',
          render: (val: any, row: any) => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <MenuBookIcon sx={{ color: '#2563eb', fontSize: 22 }} />
              <Box>
                <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a' }}>
                  {val || '—'}
                </Typography>
                {row.id && (
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    ID: {row.id}
                  </Typography>
                )}
              </Box>
            </Box>
          )
        },
        {
          key: 'section',
          label: 'Lớp / Phân ban',
          render: (val: any, row: any) => {
            const cls = row.className || val;
            return cls ? (
              <Chip
                label={cls}
                size="small"
                sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">—</Typography>
            );
          }
        },
        {
          key: 'grade',
          label: 'Khối',
          render: (val: any) => (val ? `Khối ${val}` : '—')
        },
        {
          key: 'roster',
          label: 'Sĩ số',
          render: (val: any) => (val?.students != null ? `${val.students} học sinh` : '—')
        },
        {
          key: 'content',
          label: 'Bài tập đã giao',
          render: (val: any) => {
            const total = val?.coursework ?? val?.courseWorkTotal ?? 0;
            return (
              <Chip
                label={`${total} bài`}
                size="small"
                variant="outlined"
                sx={{ borderColor: '#cbd5e1', fontWeight: 600 }}
              />
            );
          }
        },
        {
          key: 'courseState',
          label: 'Trạng thái',
          render: (val: any) => (
            <Chip
              label={val === 'ACTIVE' ? 'Đang hoạt động' : (val || '—')}
              size="small"
              color={val === 'ACTIVE' ? 'success' : 'default'}
              sx={{ fontWeight: 700 }}
            />
          )
        }
      ]}
    />
  );
}

