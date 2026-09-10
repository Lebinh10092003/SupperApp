/**
 * ics.ts — xuất lịch công tác sang định dạng iCalendar (.ics), khớp tính
 * năng `/api/calendar.ics` ở bản gốc Mr Tiến (Firebase). Tự dựng chuỗi
 * theo chuẩn RFC 5545 thay vì thêm thư viện npm mới — nội dung cần xuất
 * đơn giản (1 khối VEVENT/lịch, không lặp lại/không múi giờ phức tạp),
 * không đáng thêm dependency chỉ cho việc này.
 *
 * CHỈ xuất lịch đã `PUBLISHED` — DRAFT/PENDING_APPROVAL/REVISION_REQUIRED
 * là nội bộ, CANCELLED không còn giá trị hiển thị trên lịch cá nhân.
 */

export interface IcsEventInput {
  id: string;
  title: string;
  description: string;
  location: string;
  startAt: Date;
  endAt: Date;
  updatedAt: Date;
}

/** Escape đúng 4 ký tự bắt buộc theo RFC 5545 (backslash, xuống dòng, dấu phẩy, chấm phẩy). */
function escapeIcsText(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** Định dạng UTC "YYYYMMDDTHHMMSSZ" bắt buộc cho DTSTART/DTEND/DTSTAMP khi không kèm VTIMEZONE. */
function formatIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * `.ics` giới hạn dòng 75 octet, dòng tiếp theo phải bắt đầu bằng 1
 * khoảng trắng (RFC 5545 §3.1) — cần gấp dòng cho DESCRIPTION/SUMMARY dài.
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    parts.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return parts.join('\r\n');
}

export function buildIcsCalendar(events: IcsEventInput[]): string {
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SupperApp//Lich Cong Tac//VI', 'CALSCALE:GREGORIAN'];
  for (const ev of events) {
    lines.push(
      'BEGIN:VEVENT',
      foldLine(`UID:${ev.id}@lich-cong-tac.supperapp`),
      `DTSTAMP:${formatIcsUtc(ev.updatedAt)}`,
      `DTSTART:${formatIcsUtc(ev.startAt)}`,
      `DTEND:${formatIcsUtc(ev.endAt)}`,
      foldLine(`SUMMARY:${escapeIcsText(ev.title)}`)
    );
    if (ev.description) lines.push(foldLine(`DESCRIPTION:${escapeIcsText(ev.description)}`));
    if (ev.location) lines.push(foldLine(`LOCATION:${escapeIcsText(ev.location)}`));
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
