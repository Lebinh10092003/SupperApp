/**
 * MonthView.tsx — chế độ xem "Lịch theo tháng" cho Lịch công tác (Sin yêu
 * cầu 2026-10-05: "Lịch tháng thì thiết kế theo kiểu này:
 * shadcnuikit.com/dashboard/apps/calendar"). Lưới 7 cột (Thứ 2 → Chủ nhật,
 * quy ước Việt Nam) x 6 hàng, mỗi ô hiện tối đa 3 lịch + "+N khác", bấm vào
 * số ngày để tạo lịch thẳng ngày đó, bấm vào 1 lịch để mở chi tiết (component
 * cha vẫn quản lý dialog chi tiết/tạo mới — view này chỉ phát sự kiện ra).
 */
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { WorkEvent } from '../hooks/useEvents';
import { EVENT_STATUS_COLOR } from '../constants';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const MAX_VISIBLE_PER_CELL = 3;

function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
/** Thứ 2 của tuần chứa ngày đầu tháng — lưới bắt đầu từ đây (quy ước VN, khác Chủ nhật-đầu-tuần của Mỹ). */
function gridStart(monthStart: Date): Date {
  const day = monthStart.getDay(); // 0=CN
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate() + diff);
}

export function MonthView({
  events,
  onSelectEvent,
  onCreateOnDate
}: {
  events: WorkEvent[];
  onSelectEvent: (ev: WorkEvent) => void;
  onCreateOnDate: (date: Date) => void;
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  // "+N khác" MỞ RỘNG ô đó ra xem hết (không phải tạo lịch mới — bấm vào
  // SỐ NGÀY mới là tạo mới, tránh nhầm 2 hành động khác nhau vào cùng 1 chỗ).
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const toggleExpand = (key: string) =>
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const eventsByDate = useMemo(() => {
    const map = new Map<string, WorkEvent[]>();
    for (const ev of events) {
      const key = dateKey(new Date(ev.startAt));
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const start = gridStart(cursor);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [cursor]);

  const today = dateKey(new Date());

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b border-slate-200 p-3">
        <p className="text-sm font-bold">
          Tháng {cursor.getMonth() + 1}/{cursor.getFullYear()}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
            Hôm nay
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-200 text-center text-xs font-semibold text-slate-500">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const key = dateKey(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const dayEvents = eventsByDate.get(key) ?? [];
          const expanded = expandedKeys.has(key);
          const visible = expanded ? dayEvents : dayEvents.slice(0, MAX_VISIBLE_PER_CELL);
          const extra = expanded ? 0 : dayEvents.length - visible.length;
          return (
            <div key={key} className={cn('min-h-25 border-r border-b border-slate-100 p-1.5 last:border-r-0', !inMonth && 'bg-slate-50')}>
              <button
                type="button"
                onClick={() => onCreateOnDate(d)}
                className={cn(
                  'mb-1 grid size-6 place-items-center rounded-full text-xs font-semibold hover:bg-slate-100',
                  !inMonth && 'text-slate-400',
                  key === today && 'bg-primary text-primary-foreground hover:bg-primary'
                )}
              >
                {d.getDate()}
              </button>
              <div className="flex flex-col gap-0.5">
                {visible.map((ev) => {
                  const c = EVENT_STATUS_COLOR[ev.status] || { bg: '#f1f5f9', fg: '#334155', border: '#e2e8f0' };
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onSelectEvent(ev)}
                      title={ev.title}
                      className="truncate rounded px-1.5 py-0.5 text-left text-xs font-medium"
                      style={{ backgroundColor: c.bg, color: c.fg }}
                    >
                      {ev.title}
                    </button>
                  );
                })}
                {extra > 0 && (
                  <button type="button" onClick={() => toggleExpand(key)} className="px-1.5 text-left text-xs text-slate-500 hover:underline">
                    +{extra} khác
                  </button>
                )}
                {expanded && dayEvents.length > MAX_VISIBLE_PER_CELL && (
                  <button type="button" onClick={() => toggleExpand(key)} className="px-1.5 text-left text-xs text-slate-500 hover:underline">
                    Thu gọn
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
