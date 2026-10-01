import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function TeachersPage() {
  return (
    <ApiTablePage
      title="Danh bạ giáo viên"
      path="/api/people/teachers"
      columns={[
        {
          key: 'displayName',
          label: 'Họ và tên Giáo viên',
          render: (val, row) => {
            const name = val || row.displayName || row.name || row.email || 'Chưa cập nhật';
            return (
              <div className="flex items-center gap-2.5">
                <Avatar className="size-[34px] bg-emerald-500 text-sm font-bold text-white">
                  <AvatarImage src={row.photoUrl} />
                  <AvatarFallback className="bg-emerald-500 text-white">{String(name)[0]?.toUpperCase()}</AvatarFallback>
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
          label: 'Tổ Chuyên Môn (Org Unit)',
          render: (val) => (
            <Badge variant="outline" className="border-transparent bg-emerald-50 text-emerald-600">
              {val || 'Chưa phân tổ'}
            </Badge>
          )
        },
        {
          key: 'courses',
          label: 'Lớp phụ trách',
          render: (val) => (
            <Badge variant="outline" className="text-slate-600">
              {Array.isArray(val) ? val.length : 0} lớp
            </Badge>
          )
        }
      ]}
    />
  );
}
