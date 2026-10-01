import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ApiTablePage } from '../../components/ApiTablePage';

export default function AttendancePage() {
  return (
    <ApiTablePage
      title="Điểm danh chuyên cần"
      path="/api/attendance"
      columns={[
        {
          key: 'date',
          label: 'Ngày học',
          render: (val) => <strong>{val || '—'}</strong>
        },
        {
          key: 'className',
          label: 'Lớp',
          render: (val) => (
            <Badge variant="outline" className="border-transparent bg-secondary font-bold text-[#1d4ed8]">
              {val || '—'}
            </Badge>
          )
        },
        {
          key: 'present',
          label: 'Có mặt',
          render: (val) => <span className="text-sm font-bold text-green-600">{val ?? 0} HS</span>
        },
        {
          key: 'late',
          label: 'Đi muộn',
          render: (val) => (
            <span className={cn('text-sm font-semibold', Number(val) > 0 ? 'text-amber-600' : 'text-slate-500')}>{val ?? 0} HS</span>
          )
        },
        {
          key: 'absent',
          label: 'Vắng mặt',
          render: (val) => (
            <span className={cn('text-sm font-bold', Number(val) > 0 ? 'text-red-600' : 'text-slate-500')}>{val ?? 0} HS</span>
          )
        },
        {
          key: 'attendanceRate',
          label: 'Tỷ lệ Chuyên cần',
          render: (val) => {
            if (val === undefined || val === null) {
              return <span className="text-xs text-slate-500">—</span>;
            }
            const num = Number(val);
            return (
              <Badge
                variant="outline"
                className={cn('border-transparent font-extrabold', num >= 95 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}
              >
                {num}%
              </Badge>
            );
          }
        }
      ]}
    />
  );
}
