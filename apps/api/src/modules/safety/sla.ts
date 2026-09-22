/**
 * sla.ts — S10 "Quy trình, thời hạn và nhắc việc", port 1-1 từ `sla.js`
 * (project An toàn, Firebase). Module THUẦN LOGIC, không tự query DB.
 *
 * Ba quy tắc bắt buộc phải giữ đúng:
 *  1) P0/P1 tính theo GIỜ ĐỒNG HỒ (không trừ ngày nghỉ). P2/P3 tính theo
 *     GIỜ LÀM VIỆC đã khai báo (có tính ngày nghỉ/ngày lễ).
 *  2) "Không mất thời hạn": nâng mức thì tính lại theo mức mới, mốc bắt
 *     đầu giữ nguyên (được phép SIẾT lại). Hạ mức thì KHÔNG được kéo dài
 *     thời hạn đã phát sinh.
 *  3) Chỉ tạm dừng đồng hồ ở trạng thái đã khai báo trước, bắt buộc có lý
 *     do + người phê duyệt; thời gian tạm dừng không tính vào thời hạn.
 */

import { PRIORITY_SLA_MINUTES, priorityRank, type Priority } from './catalog.js';
import { toVnParts, fromVnParts } from './vntime.js';

export interface Calendar {
  startHour: number;
  endHour: number;
  workDays: number[]; // 0 = Chủ nhật
  holidays: string[]; // 'YYYY-MM-DD' theo ngày Việt Nam
}

export const DEFAULT_CALENDAR: Calendar = {
  startHour: 7,
  endHour: 17,
  workDays: [1, 2, 3, 4, 5, 6], // Thứ 2 - Thứ 7
  holidays: []
};

/**
 * Chuẩn hoá về JS Date thật. Ở bản Firestore gốc, đây là bước BẮT BUỘC vì
 * Timestamp đọc lại từ Firestore Admin SDK KHÔNG PHẢI Date thuần. Với
 * Postgres qua `node-postgres`/Drizzle, cột `timestamp` luôn trả về JS
 * `Date` thật — hàm này bớt quan trọng hơn nhưng GIỮ LẠI để tương thích
 * input dạng `{ toDate() }` nếu có nơi nào truyền vào kiểu đó.
 */
export function toJsDate(v: Date | { toDate: () => Date } | string | number): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: unknown }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
  return new Date(v as string | number);
}

function isHoliday(date: Date, calendar: Calendar): boolean {
  const p = toVnParts(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
  return calendar.holidays.includes(iso);
}

export function nextWorkingMoment(date: Date, calendar: Calendar): Date {
  let cursor = new Date(date.getTime());
  for (let i = 0; i < 366; i++) {
    const p = toVnParts(cursor);
    const workingDay = calendar.workDays.includes(p.weekday) && !isHoliday(cursor, calendar);
    if (workingDay) {
      const h = p.hour + p.minute / 60;
      if (h < calendar.startHour) {
        return fromVnParts({ year: p.year, month: p.month, day: p.day, hour: calendar.startHour, minute: 0, second: 0 });
      }
      if (h < calendar.endHour) {
        return cursor;
      }
      // sau giờ làm hôm nay -> sang sáng hôm sau
    }
    const p2 = toVnParts(cursor);
    cursor = fromVnParts({ year: p2.year, month: p2.month, day: p2.day + 1, hour: calendar.startHour, minute: 0, second: 0 });
  }
  return cursor; // an toàn: không lặp vô hạn
}

/** Cộng `minutes` phút GIỜ LÀM VIỆC (giờ Việt Nam) vào `start`, bỏ qua giờ ngoài ca/ngày nghỉ. */
export function addBusinessMinutes(start: Date, minutes: number, calendar: Calendar = DEFAULT_CALENDAR): Date {
  let remaining = minutes;
  let cursor = nextWorkingMoment(start, calendar);

  while (remaining > 0) {
    const p = toVnParts(cursor);
    const endOfDay = fromVnParts({ year: p.year, month: p.month, day: p.day, hour: calendar.endHour, minute: 0, second: 0 });
    const minutesLeftToday = Math.max(0, (endOfDay.getTime() - cursor.getTime()) / 60000);

    if (remaining <= minutesLeftToday) {
      cursor = new Date(cursor.getTime() + remaining * 60000);
      remaining = 0;
    } else {
      remaining -= minutesLeftToday;
      const next = fromVnParts({ year: p.year, month: p.month, day: p.day + 1, hour: calendar.startHour, minute: 0, second: 0 });
      cursor = nextWorkingMoment(next, calendar);
    }
  }
  return cursor;
}

/** Số phút SLA cho một `clockLabel` ('ack'|'assign') của 1 mức ưu tiên. */
export function slaMinutesFor(priority: Priority, clockLabel: 'ack' | 'assign'): number {
  const spec = PRIORITY_SLA_MINUTES[priority];
  if (!spec) throw new Error('sla.slaMinutesFor: mức ưu tiên không hợp lệ: ' + priority);
  const v = spec[clockLabel];
  if (v === undefined) throw new Error(`sla.slaMinutesFor: clockLabel "${clockLabel}" không có cho mức ${priority}`);
  return v;
}

export function computeDeadline(startAt: Date, priority: Priority, clockLabel: 'ack' | 'assign', calendar?: Calendar): Date {
  const start = toJsDate(startAt);
  const spec = PRIORITY_SLA_MINUTES[priority];
  const minutes = slaMinutesFor(priority, clockLabel);
  if (spec.clockType === 'wall') {
    return new Date(start.getTime() + minutes * 60000);
  }
  return addBusinessMinutes(start, minutes, calendar ?? DEFAULT_CALENDAR);
}

export type SlaClockStatus = 'running' | 'paused' | 'met' | 'overdue';

export interface PauseEntry {
  from: Date;
  to: Date | null;
  reason: string;
  approved_by: string;
}

export interface SlaClock {
  object_id: string;
  clock_label: 'ack' | 'assign';
  priority: Priority;
  start_at: Date;
  deadline_at: Date;
  status: SlaClockStatus;
  paused: boolean;
  pause_history: PauseEntry[];
}

/** Đăng ký một đồng hồ mới cho 1 đối tượng. */
export function registerSlaClock(input: { objectId: string; clockLabel: 'ack' | 'assign'; priority: Priority; startAt: Date; calendar?: Calendar }): SlaClock {
  if (!input.objectId) throw new Error('sla.registerSlaClock: thiếu objectId.');
  const deadlineAt = computeDeadline(input.startAt, input.priority, input.clockLabel, input.calendar);
  return {
    object_id: input.objectId,
    clock_label: input.clockLabel,
    priority: input.priority,
    start_at: input.startAt,
    deadline_at: deadlineAt,
    status: 'running',
    paused: false,
    pause_history: []
  };
}

/**
 * Tính lại đồng hồ khi mức ưu tiên đổi — ĐÚNG quy tắc "không mất thời
 * hạn": nâng mức (khẩn hơn) được phép siết lại; hạ mức (đỡ khẩn hơn)
 * không được kéo dài hạn đã có.
 */
export function recomputeOnPriorityChange(clock: SlaClock, input: { toPriority: Priority; calendar?: Calendar }): SlaClock {
  const oldDeadline = toJsDate(clock.deadline_at);
  const candidateDeadline = computeDeadline(clock.start_at, input.toPriority, clock.clock_label, input.calendar);
  const isDowngrade = priorityRank(input.toPriority) > priorityRank(clock.priority);
  let deadlineAt = candidateDeadline;
  if (isDowngrade && candidateDeadline.getTime() > oldDeadline.getTime()) {
    // Hạ mức nhưng hạn mới sẽ dài hơn hạn cũ -> GIỮ hạn cũ, không kéo dài.
    deadlineAt = oldDeadline;
  }
  return { ...clock, priority: input.toPriority, deadline_at: deadlineAt };
}

/** Tạm dừng đồng hồ — bắt buộc lý do + người phê duyệt. */
export function pauseClock(clock: SlaClock, input: { reason: string; approvedBy: string; now?: Date }): SlaClock {
  if (!input.reason) throw new Error('sla.pauseClock: bắt buộc có lý do tạm dừng.');
  if (!input.approvedBy) throw new Error('sla.pauseClock: bắt buộc có người phê duyệt tạm dừng.');
  if (clock.paused) throw new Error('sla.pauseClock: đồng hồ đang tạm dừng rồi.');
  const pausedAt = input.now ?? new Date();
  return {
    ...clock,
    paused: true,
    status: 'paused',
    pause_history: [...clock.pause_history, { from: pausedAt, to: null, reason: input.reason, approved_by: input.approvedBy }]
  };
}

/** Tiếp tục đồng hồ — cộng bù đúng thời gian đã tạm dừng vào hạn (không bị trừ vào SLA). */
export function resumeClock(clock: SlaClock, input: { now?: Date }): SlaClock {
  if (!clock.paused) throw new Error('sla.resumeClock: đồng hồ không ở trạng thái tạm dừng.');
  const resumedAt = input.now ?? new Date();
  const history = [...clock.pause_history];
  const last = history[history.length - 1];
  if (!last) throw new Error('sla.resumeClock: không tìm thấy lần tạm dừng gần nhất.');
  const pausedMs = resumedAt.getTime() - toJsDate(last.from).getTime();
  history[history.length - 1] = { ...last, to: resumedAt };
  return {
    ...clock,
    paused: false,
    status: 'running',
    deadline_at: new Date(toJsDate(clock.deadline_at).getTime() + pausedMs),
    pause_history: history
  };
}

export function isOverdue(clock: Pick<SlaClock, 'paused' | 'deadline_at'>, now?: Date): boolean {
  if (clock.paused) return false;
  return (now ?? new Date()).getTime() > toJsDate(clock.deadline_at).getTime();
}
