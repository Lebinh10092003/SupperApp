import { User } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function Student360Page() {
  return (
    <ApiTablePage
      title="Hồ sơ học sinh 360°"
      path="/api/people/students"
      columns={[
        {
          key: 'displayName',
          label: 'Họ và Tên Học Sinh',
          render: (val: any, row: any) => {
            const name = val || row.displayName || row.name || row.email || 'Chưa cập nhật họ tên';
            return (
              <div className="flex items-center gap-2.5">
                <Avatar className="size-8 bg-blue-500 font-bold text-white">
                  <AvatarImage src={row.photoUrl} />
                  <AvatarFallback className="bg-blue-500 text-white">
                    <User className="size-[18px]" />
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
          label: 'Email Nhà trường',
          render: (val: any) => <span className="font-medium text-primary">{val || '—'}</span>
        },
        {
          key: 'className',
          label: 'Lớp học',
          render: (val: any, row: any) => {
            const cls = val || row.classId || row.orgUnitPath?.split('/').pop() || '—';
            return (
              <Badge variant="outline" className="border-transparent bg-slate-100 font-bold text-slate-700">
                {cls}
              </Badge>
            );
          }
        },
        {
          key: 'courses',
          label: 'Số lớp tham gia',
          render: (val: any) => (
            <Badge variant="outline" className="border-transparent bg-secondary font-bold text-[#1d4ed8]">
              {Array.isArray(val) ? val.length : 0} môn
            </Badge>
          )
        },
        {
          key: 'suspended',
          label: 'Trạng thái',
          render: (val: any) => (
            <Badge
              variant="outline"
              className={cn('border-transparent font-bold', val ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-600')}
            >
              {val ? 'Tạm khóa' : 'Đang học tập'}
            </Badge>
          )
        }
      ]}
    />
  );
}
