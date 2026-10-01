import { BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function SubjectAnalyticsPage() {
  return (
    <ApiTablePage
      title="Phân tích khóa học & môn học"
      path="/api/classroom"
      columns={[
        {
          key: 'name',
          label: 'Tên Khóa Học / Bộ Môn',
          render: (val: any, row: any) => (
            <div className="flex items-center gap-2.5">
              <BookOpen className="size-[22px] text-primary" />
              <div>
                <p className="font-bold text-[#0f172a]">{val || '—'}</p>
                {row.id && <p className="text-xs text-slate-500">ID: {row.id}</p>}
              </div>
            </div>
          )
        },
        {
          key: 'section',
          label: 'Lớp / Phân ban',
          render: (val: any, row: any) => {
            const cls = row.className || val;
            return cls ? (
              <Badge variant="outline" className="border-transparent bg-secondary text-[#1d4ed8]">
                {cls}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          }
        },
        {
          key: 'grade',
          label: 'Khối',
          render: (val: any) => (val ? `Khối ${val}` : '—')
        },
        {
          key: 'rosterStudents',
          label: 'Sĩ số',
          render: (val: any, row: any) => {
            const count = val ?? row.rosterStudents ?? row.roster?.students;
            return count != null ? `${count} học sinh` : '—';
          }
        },
        {
          key: 'contentCoursework',
          label: 'Bài tập đã giao',
          render: (val: any, row: any) => {
            const total = val ?? row.contentCoursework ?? row.content?.coursework ?? row.content?.courseWorkTotal ?? 0;
            return (
              <Badge variant="outline" className="text-slate-600">
                {total} bài
              </Badge>
            );
          }
        },
        {
          key: 'courseState',
          label: 'Trạng thái',
          render: (val: any) => (
            <Badge
              variant="outline"
              className={cn('border-transparent font-bold', val === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600')}
            >
              {val === 'ACTIVE' ? 'Đang hoạt động' : val || '—'}
            </Badge>
          )
        }
      ]}
    />
  );
}
