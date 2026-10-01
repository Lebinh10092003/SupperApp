import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function StudentsPage() {
  return (
    <ApiTablePage
      title="Danh bạ học sinh"
      path="/api/people/students"
      columns={[
        {
          key: 'displayName',
          label: 'Họ và tên Học sinh',
          render: (val, row) => {
            const name = val || row.displayName || row.name || row.email || 'Chưa cập nhật';
            return (
              <div className="flex items-center gap-2.5">
                <Avatar className="size-[34px] bg-blue-500 text-[0.85rem] font-bold text-white">
                  <AvatarImage src={row.photoUrl} />
                  <AvatarFallback className="bg-blue-500 text-white">{String(name)[0]?.toUpperCase()}</AvatarFallback>
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
          label: 'Email Google Workspace',
          render: (val) => <span className="font-medium text-primary">{val || '—'}</span>
        },
        {
          key: 'orgUnitPath',
          label: 'Đơn vị Tổ chức (Org Unit)',
          render: (val) => (
            <Badge variant="outline" className="border-transparent bg-slate-100 font-semibold text-slate-600">
              {val || 'Chưa phân đơn vị'}
            </Badge>
          )
        },
        {
          key: 'courses',
          label: 'Lớp tham gia',
          render: (val) => (
            <Badge variant="outline" className="font-semibold text-slate-600">
              {Array.isArray(val) ? val.length : 0} lớp
            </Badge>
          )
        }
      ]}
    />
  );
}
