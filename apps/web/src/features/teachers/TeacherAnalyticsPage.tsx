import { IdCard } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function TeacherAnalyticsPage() {
  return (
    <ApiTablePage
      title="Hoạt động giảng dạy của giáo viên"
      path="/api/people/teachers"
      columns={[
        {
          key: 'displayName',
          label: 'Họ và Tên Giáo Viên',
          render: (val: any, row: any) => {
            const name = val || row.displayName || row.name || row.email || 'Chưa cập nhật họ tên';
            return (
              <div className="flex items-center gap-2.5">
                <Avatar className="size-8 bg-primary font-bold text-white">
                  <AvatarImage src={row.photoUrl} />
                  <AvatarFallback className="bg-primary text-white">
                    <IdCard className="size-[18px]" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-[#0f172a]">{name}</p>
                  <p className="text-xs text-slate-500">{row.email}</p>
                </div>
              </div>
            );
          }
        },
        {
          key: 'email',
          label: 'Email Giảng dạy',
          render: (val: any) => <span className="font-medium text-primary">{val || '—'}</span>
        },
        {
          key: 'orgUnitPath',
          label: 'Tổ Chuyên Môn',
          render: (val: any) => (
            <Badge variant="outline" className="border-transparent bg-emerald-50 text-emerald-600">
              {val || 'Chưa phân tổ'}
            </Badge>
          )
        },
        {
          key: 'courses',
          label: 'Số lớp phụ trách',
          render: (val: any) => (
            <Badge variant="outline" className="border-transparent bg-secondary text-[#1d4ed8]">
              {Array.isArray(val) ? val.length : 0} khóa học
            </Badge>
          )
        }
      ]}
    />
  );
}
