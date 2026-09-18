import { Box, Chip } from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHighRounded';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function CatalogMappingPage() {
  return (
    <ApiTablePage
      title="Chuẩn hóa danh mục dữ liệu trường"
      path="/api/catalog"
      columns={[
        {
          key: 'rawName',
          label: 'Tên gốc trên Google Classroom',
          render: (val: any) => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoFixHighIcon sx={{ color: '#2563eb', fontSize: 20 }} />
              <span>{val || 'Chưa xác định'}</span>
            </Box>
          )
        },
        {
          key: 'normalizedName',
          label: 'Định danh chuẩn',
          render: (val: any) => (
            <Chip
              label={val || 'Chưa chuẩn hóa'}
              size="small"
              sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}
            />
          )
        },
        {
          key: 'grade',
          label: 'Khối lớp',
          render: (val: any) => (val ? `Khối ${val}` : 'Chưa phân khối')
        },
        {
          key: 'type',
          label: 'Loại danh mục',
          render: (val: any) => val || 'Chưa phân loại'
        }
      ]}
    />
  );
}
