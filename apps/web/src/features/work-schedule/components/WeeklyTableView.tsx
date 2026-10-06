import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import type { WorkEvent } from '../hooks/useEvents';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dm = (date: Date) => `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
const timeOf = (iso: string) => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const sessionOf = (iso: string) => new Date(iso).getHours() < 12 ? 'Sáng' : new Date(iso).getHours() < 18 ? 'Chiều' : 'Tối';
function mondayOf(date: Date) {
  const offset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
}
function peopleSummary(event: WorkEvent) {
  if (event.scope === 'SCHOOL_WIDE') return 'Toàn trường';
  const participants = event.participantLabels?.length ? event.participantLabels : event.participantPerIds;
  const labels = [event.chairLabel || event.chairPerId, ...participants].filter(Boolean);
  return labels.length <= 2 ? labels.join(', ') || '—' : `${labels.slice(0, 2).join(', ')} +${labels.length - 2} người khác`;
}

export function WeeklyTableView({ events, onSelectEvent, onEditEvent, canEditEvent, onCreateOnDate, highlightedEventId }: {
  events: WorkEvent[];
  onSelectEvent: (event: WorkEvent) => void;
  onEditEvent: (event: WorkEvent) => void;
  canEditEvent: (event: WorkEvent) => boolean;
  onCreateOnDate: (date: Date) => void;
  highlightedEventId?: string | null;
}) {
  const [cursor, setCursor] = useState(() => mondayOf(new Date()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + index)), [cursor]);
  const byDate = useMemo(() => {
    const result = new Map<string, WorkEvent[]>();
    for (const event of events) result.set(keyOf(new Date(event.startAt)), [...(result.get(keyOf(new Date(event.startAt))) || []), event]);
    for (const rows of result.values()) rows.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return result;
  }, [events]);

  useEffect(() => {
    if (highlightedEventId) document.getElementById(`week-event-${highlightedEventId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedEventId, events]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <p className="text-sm font-bold">Tuần {dm(days[0]!)} – {dm(days[6]!)}/{days[6]!.getFullYear()}</p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setCursor(mondayOf(new Date()))}>Hôm nay</Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Tuần trước" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7))}><ChevronLeft className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Tuần sau" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7))}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[1040px] table-fixed">
          <TableHeader><TableRow className="bg-amber-50/80 dark:bg-amber-950/20"><TableHead className="w-36">Thứ/ngày</TableHead><TableHead className="w-20">Buổi</TableHead><TableHead className="w-20">Thời gian</TableHead><TableHead>Nội dung công việc</TableHead><TableHead className="w-44">Địa điểm</TableHead><TableHead className="w-52">Người thực hiện</TableHead><TableHead className="w-32">Tiến trình</TableHead><TableHead className="w-14"><span className="sr-only">Thao tác</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {days.flatMap((day, dayIndex) => {
              const rows: Array<WorkEvent | null> = byDate.get(keyOf(day))?.length ? byDate.get(keyOf(day))! : [null];
              return rows.map((event, rowIndex) => <TableRow id={event ? `week-event-${event.id}` : undefined} key={event?.id || `${keyOf(day)}-empty`} onClick={() => event && onSelectEvent(event)} className={cn(event && 'cursor-pointer', keyOf(day) === keyOf(new Date()) && 'bg-blue-50/30', event?.id === highlightedEventId && 'bg-amber-100 ring-2 ring-inset ring-amber-400 dark:bg-amber-950/40')}>
                {rowIndex === 0 && <TableCell rowSpan={rows.length} className="align-top font-semibold"><div className="flex items-start justify-between gap-2"><span>{WEEKDAYS[dayIndex]} ({dm(day)})</span><Button variant="ghost" size="icon" className="size-7 shrink-0 text-primary" aria-label={`Tạo lịch ${dm(day)}`} onClick={(click) => { click.stopPropagation(); onCreateOnDate(day); }}><Plus className="size-4" /></Button></div></TableCell>}
                {event ? <>
                  <TableCell>{sessionOf(event.startAt)}</TableCell><TableCell className="font-medium">{timeOf(event.startAt)}</TableCell>
                  <TableCell><p className="line-clamp-2 font-medium" title={event.title}>{event.title}</p>{event.description && <p className="line-clamp-1 text-xs text-slate-500">{event.description}</p>}</TableCell>
                  <TableCell className="text-sm">{event.location || '—'}</TableCell><TableCell className="text-sm" title={peopleSummary(event)}>{peopleSummary(event)}</TableCell>
                  <TableCell>{event.taskCount ? <div className="space-y-1"><Progress value={event.taskProgressPercent || 0} className="h-1.5" /><span className="text-xs text-slate-500">{event.taskProgressPercent || 0}% · {event.taskCompletedCount}/{event.taskCount}</span></div> : <span className="text-xs text-slate-400">—</span>}</TableCell>
                  <TableCell onClick={(click) => click.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8" aria-label="Công cụ"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onSelectEvent(event)}>Xem chi tiết</DropdownMenuItem>{canEditEvent(event) && <DropdownMenuItem onClick={() => onEditEvent(event)}>Chỉnh sửa nhanh</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></TableCell>
                </> : <TableCell colSpan={7} className="py-4 text-sm text-slate-400">Chưa có lịch. Dùng nút + để tạo nhanh.</TableCell>}
              </TableRow>);
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
