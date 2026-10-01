import { Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function MeetPage() {
  return (
    <ApiTablePage
      title="Google Meet"
      path="/api/meet/sessions"
      columns={[
        {
          key: 'date',
          label: 'Ngày học',
          render: (val) => <strong>{val || '—'}</strong>
        },
        {
          key: 'className',
          label: 'Lớp học',
          render: (val) => (
            <Badge variant="outline" className="border-transparent bg-secondary text-[#1d4ed8]">
              {val || '—'}
            </Badge>
          )
        },
        {
          key: 'subject',
          label: 'Môn học',
          render: (val) => <span className="text-sm font-semibold text-primary">{val || 'Chưa phân môn'}</span>
        },
        {
          key: 'teacherEmail',
          label: 'Giáo viên phụ trách',
          render: (val) => val || '—'
        },
        {
          key: 'onlineStudents',
          label: 'Online',
          render: (val, row) => (
            <span className={cn('text-sm font-bold', row?.status === 'LIVE' ? 'text-red-600' : 'text-slate-500')}>
              {val !== undefined && val !== null ? `${val} HS` : '0 HS'}
            </span>
          )
        },
        {
          key: 'attendanceRate',
          label: 'Chuyên cần %',
          render: (val) => (
            <Badge variant="outline" className="border-transparent bg-emerald-50 text-emerald-600">
              {val !== undefined && val !== null ? `${val}%` : '—'}
            </Badge>
          )
        },
        {
          key: 'status',
          label: 'Trạng thái',
          render: (val) => {
            const isLive = String(val).toUpperCase() === 'LIVE';
            return (
              <Badge
                variant="outline"
                className={cn('gap-1 border-transparent font-extrabold', isLive ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500')}
              >
                <Video className="size-3.5" />
                {isLive ? 'Đang diễn ra' : 'Đã kết thúc'}
              </Badge>
            );
          }
        }
      ]}
    />
  );
}
