import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <span>{val || 'Chưa xác định'}</span>
            </div>
          )
        },
        {
          key: 'normalizedName',
          label: 'Định danh chuẩn',
          render: (val: any) => (
            <Badge variant="outline" className="border-transparent bg-secondary text-[#1d4ed8]">
              {val || 'Chưa chuẩn hóa'}
            </Badge>
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
