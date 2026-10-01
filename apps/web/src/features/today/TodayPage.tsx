import { Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function TodayPage() {
  return (
    <ApiTablePage
      title="Hoạt động hôm nay"
      path="/api/meet/live"
      columns={[
        {
          key: 'className',
          label: 'Lớp học',
          render: (val) => (
            <Badge variant="outline" className="border-transparent bg-secondary text-[#1d4ed8]">
              {val}
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
          label: 'Học sinh Online',
          render: (val) => (
            <span className="text-sm font-bold text-emerald-500">{val !== undefined && val !== null ? `${val} học sinh` : '0 học sinh'}</span>
          )
        },
        {
          key: 'status',
          label: 'Trạng thái',
          render: () => (
            <Badge variant="outline" className="gap-1 border-transparent bg-red-100 text-red-600 shadow-[0_0_8px_rgba(220,38,38,0.2)]">
              <Video className="size-3.5" />
              ĐANG LIVE
            </Badge>
          )
        }
      ]}
    />
  );
}
