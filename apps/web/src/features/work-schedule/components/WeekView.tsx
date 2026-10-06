/**
 * WeekView.tsx — chế độ xem "Lịch theo tuần" cho Lịch công tác (Sin yêu
 * cầu 2026-10-05: "lịch theo tuần thì col đầu sẽ là các thứ trong tuần, có
 * thể tạo thẳng trực tiếp... để tạo lịch ngày trong tuần"). KHÁC hẳn lưới
 * giờ-theo-cột kiểu Google Calendar — mỗi THỨ trong tuần là 1 HÀNG, có nút
 * "+" ngay trên hàng để tạo lịch thẳng đúng ngày đó, liệt kê các lịch
 * trong ngày ngay bên dưới (không cần mở thêm dialog để xem nhanh).
 */
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { WorkEvent } from '../hooks/useEvents';
import { EVENT_STATUS_COLOR } from '../constants';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatDM(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}
function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** Thứ 2 của tuần chứa `d` (quy ước VN — tuần bắt đầu Thứ 2). */
function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=CN
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}

export function WeekView({
  events,
  onSelectEvent,
  onCreateOnDate
}: {
  events: WorkEvent[];
  onSelectEvent: (ev: WorkEvent) => void;
  onCreateOnDate: (date: Date) => void;
}) {
  const [cursor, setCursor] = useState(() => startOfWeek(new Date()));

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

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i)), [cursor]);
  const today = dateKey(new Date());
  const weekEnd = days[6]!;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b border-slate-200 p-3">
        <p className="text-sm font-bold">
          Tuần {formatDM(days[0]!)} – {formatDM(weekEnd)}/{weekEnd.getFullYear()}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfWeek(new Date()))}>
            Hôm nay
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-slate-100">
        {days.map((d, i) => {
          const key = dateKey(d);
          const dayEvents = eventsByDate.get(key) ?? [];
          return (
            <div key={key} className={cn('flex gap-3 p-3', key === today && 'bg-secondary/40')}>
              <div className="w-24 shrink-0">
                <p className={cn('text-sm font-bold', key === today && 'text-primary')}>{WEEKDAY_LABELS[i]}</p>
                <p className="text-xs text-slate-500">{formatDM(d)}</p>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {dayEvents.length === 0 && <span className="text-xs text-slate-400">Không có lịch.</span>}
                {dayEvents.map((ev) => {
                  const c = EVENT_STATUS_COLOR[ev.status] || { bg: '#f1f5f9', fg: '#334155', border: '#e2e8f0' };
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onSelectEvent(ev)}
                      className="max-w-60 truncate rounded px-2 py-1 text-left text-xs font-medium"
                      style={{ backgroundColor: c.bg, color: c.fg }}
                      title={ev.title}
                    >
                      {formatTime(ev.startAt)} · {ev.title}
                    </button>
                  );
                })}
              </div>
              <Button variant="ghost" size="icon" className="size-7 shrink-0 text-primary" onClick={() => onCreateOnDate(d)} title={`Tạo lịch ngày ${formatDM(d)}`}>
                <Plus className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
