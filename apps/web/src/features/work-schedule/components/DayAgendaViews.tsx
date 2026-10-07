import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, MapPin } from 'lucide-react';
import type { WorkEvent } from '../hooks/useEvents';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateLabel = (date: Date) => new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
const timeLabel = (iso: string) => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

function EventCard({ event, onSelect }: { event: WorkEvent; onSelect: (event: WorkEvent) => void }) {
  return <button type="button" onClick={() => onSelect(event)} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-primary/40 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{event.title}</p><p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><Clock3 className="size-3" />{timeLabel(event.startAt)}{event.endAt ? ` – ${timeLabel(event.endAt)}` : ''}</span>{event.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{event.location}</span>}</p></div><span className="shrink-0 rounded bg-secondary px-2 py-1 text-xs font-semibold text-primary">{event.scope === 'SCHOOL_WIDE' ? 'Toàn trường' : 'Cá nhân'}</span></div>
    {event.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{event.description}</p>}
    {!!event.taskCount && <div className="mt-2 flex items-center gap-2"><Progress value={event.taskProgressPercent || 0} className="h-1.5 flex-1" /><span className="text-xs text-slate-500">{event.taskProgressPercent || 0}%</span></div>}
  </button>;
}

export function DayView({ events, onSelectEvent }: { events: WorkEvent[]; onSelectEvent: (event: WorkEvent) => void }) {
  const [cursor, setCursor] = useState(() => new Date());
  const rows = useMemo(() => events.filter((event) => dayKey(new Date(event.startAt)) === dayKey(cursor)).sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt)), [events, cursor]);
  return <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold capitalize">{dateLabel(cursor)}</p><p className="text-xs text-slate-500">{rows.length} lịch</p></div><div className="flex items-center gap-1"><Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hôm nay</Button><Button variant="ghost" size="icon" className="size-8" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1))}><ChevronLeft className="size-4" /></Button><Button variant="ghost" size="icon" className="size-8" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1))}><ChevronRight className="size-4" /></Button></div></div><div className="space-y-2">{rows.map((event) => <EventCard key={event.id} event={event} onSelect={onSelectEvent} />)}{rows.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">Ngày này chưa có lịch.</p>}</div></section>;
}

export function AgendaView({ events, onSelectEvent }: { events: WorkEvent[]; onSelectEvent: (event: WorkEvent) => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, WorkEvent[]>();
    for (const event of [...events].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))) {
      const key = dayKey(new Date(event.startAt));
      map.set(key, [...(map.get(key) || []), event]);
    }
    return [...map.entries()];
  }, [events]);
  return <section className="space-y-4">{groups.map(([key, rows]) => <div key={key} className="grid gap-2 md:grid-cols-[150px_1fr]"><div className={cn('pt-2 text-sm font-bold', key === dayKey(new Date()) && 'text-primary')}>{dateLabel(new Date(`${key}T12:00:00`))}</div><div className="space-y-2">{rows.map((event) => <EventCard key={event.id} event={event} onSelect={onSelectEvent} />)}</div></div>)}{groups.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">Không có lịch phù hợp.</p>}</section>;
}
