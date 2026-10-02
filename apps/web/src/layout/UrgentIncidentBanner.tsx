import { TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMyUrgentIncidents } from '../features/safety/hooks/useMyUrgentIncidents';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Banner toàn site dưới Topbar — cảnh báo sự vụ BẠN là chỉ huy/tham gia
 * đang quá hạn hoặc sắp đến hạn tiếp nhận/phân công (Sin chốt 2026-10-02).
 * Màu lấy theo mức NGHIÊM TRỌNG NHẤT trong các hồ sơ liên quan (có quá hạn
 * → đỏ, không thì sắp đến hạn → vàng). Ẩn hẳn khi không có gì cần cảnh báo. */
export function UrgentIncidentBanner() {
  const navigate = useNavigate();
  const { tone, count, worstIncidentId } = useMyUrgentIncidents();

  if (!tone || !worstIncidentId) return null;

  const isOverdue = tone === 'overdue';

  return (
    <div
      className={cn(
        'mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5',
        isOverdue ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
      )}
    >
      <div className="flex items-center gap-2.5">
        <TriangleAlert className={cn('size-4 shrink-0', isOverdue ? 'text-red-600' : 'text-amber-600')} />
        <p className={cn('text-sm font-medium', isOverdue ? 'text-red-800' : 'text-amber-800')}>
          {count} sự vụ bạn tham gia {isOverdue ? 'đã quá hạn tiếp nhận hoặc xử lý' : 'sắp đến hạn tiếp nhận hoặc xử lý'}
        </p>
      </div>
      <Button
        size="sm"
        variant={isOverdue ? 'destructive' : 'outline'}
        className={!isOverdue ? 'border-amber-300 text-amber-800 hover:bg-amber-100' : undefined}
        onClick={() => navigate(`/safety/incidents/${worstIncidentId}`)}
      >
        Xử lý ngay
      </Button>
    </div>
  );
}
