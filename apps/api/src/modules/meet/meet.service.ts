import { eq } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../core/db/client.js';
import { googleJson } from '../../integrations/dwd.js';
import { meetSessions, meetAttendance } from './meet.schema.js';
import { schedules } from '../schedules/schedules.schema.js';
import { courses, courseMembers } from '../classroom/classroom.schema.js';

const scopes = ['https://www.googleapis.com/auth/meetings.space.readonly'];
const base = 'https://meet.googleapis.com/v2';

export type Interval = { start: Date; end: Date };

export function mergeIntervals(xs: Interval[]) {
  const a = [...xs].sort((x, y) => x.start.getTime() - y.start.getTime());
  const out: Interval[] = [];
  for (const x of a) {
    const last = out.at(-1);
    if (last && x.start <= last.end) last.end = new Date(Math.max(last.end.getTime(), x.end.getTime()));
    else out.push({ start: new Date(x.start), end: new Date(x.end) });
  }
  return out;
}

async function list<T>(url: string, key: string, subject: string): Promise<T[]> {
  let page = '';
  const out: T[] = [];
  do {
    const u = new URL(url);
    u.searchParams.set('pageSize', '100');
    if (page) u.searchParams.set('pageToken', page);
    const d = await googleJson<any>(u.toString(), subject, scopes);
    out.push(...(d[key] || []));
    page = d.nextPageToken || '';
  } while (page);
  return out;
}

/**
 * refreshConference — kéo dữ liệu 1 buổi Meet thật từ Google, tính điểm
 * danh nếu `finalize` (buổi đã kết thúc) và lớp đã có roster đầy đủ. Ghi
 * vào bảng `meet_sessions` HỢP NHẤT — cùng 1 `id` (conferenceId), chuyển
 * `status` LIVE→FINISHED khi finalize, KHÔNG cần xoá doc riêng như bản
 * Firestore cũ (2 collection tách biệt).
 */
export async function refreshConference(name: string, finalize = false, subject = env.WORKSPACE_ADMIN_SUBJECT) {
  const conf = await googleJson<any>(`${base}/${name}`, subject, scopes);
  const participants = await list<any>(`${base}/${name}/participants`, 'participants', subject);
  const rows: Array<{ p: any; intervals: Interval[] }> = [];
  let online = 0;

  for (const p of participants) {
    const sessions = await list<any>(`${base}/${p.name}/participantSessions`, 'participantSessions', subject);
    if (sessions.some((s: any) => !s.endTime)) online++;
    rows.push({
      p,
      intervals: sessions.map((s: any) => ({ start: new Date(s.startTime), end: new Date(s.endTime || Date.now()) }))
    });
  }

  const id = name.split('/').pop()!;
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(conf.startTime)
  );

  const schedule = await db
    .select()
    .from(schedules)
    .where(eq(schedules.spaceName, conf.space))
    .limit(20)
    .then((rows) => rows[0] ?? null);

  await db
    .insert(meetSessions)
    .values({
      id,
      conferenceName: name,
      raw: JSON.stringify(conf),
      date,
      scheduleId: schedule?.id || null,
      classId: schedule?.classId || null,
      className: schedule?.className || null,
      subject: schedule?.subject || null,
      teacherEmail: schedule?.teacherEmail || null,
      onlineStudents: online,
      joinedStudents: participants.length,
      status: finalize ? 'FINISHED' : 'LIVE'
    })
    .onConflictDoUpdate({
      target: meetSessions.id,
      set: {
        conferenceName: name,
        raw: JSON.stringify(conf),
        date,
        scheduleId: schedule?.id || null,
        classId: schedule?.classId || null,
        className: schedule?.className || null,
        subject: schedule?.subject || null,
        teacherEmail: schedule?.teacherEmail || null,
        onlineStudents: online,
        joinedStudents: participants.length,
        status: finalize ? 'FINISHED' : 'LIVE',
        updatedAt: new Date()
      }
    });

  if (finalize && schedule?.courseId) {
    const course = await db.select().from(courses).where(eq(courses.id, schedule.courseId)).then((r) => r[0] ?? null);
    if (course?.rosterStatus === 'COMPLETE') {
      const roster = await db
        .select()
        .from(courseMembers)
        .where(eq(courseMembers.courseId, schedule.courseId));
      const students = roster.filter((m) => m.role === 'STUDENT');

      const byId = new Map<string, { p: any; intervals: Interval[] }>();
      for (const row of rows) {
        const uid = row.p?.signedinUser?.user?.split('/').pop();
        if (uid) byId.set(uid, row);
      }

      let present = 0;
      let late = 0;
      let absent = 0;
      const start = conf.startTime ? new Date(conf.startTime) : new Date();
      const end = conf.endTime ? new Date(conf.endTime) : new Date();
      const lateAfter = new Date(start.getTime() + Number(schedule.lateMinutes || 10) * 60000);

      for (const m of students) {
        const row = byId.get(m.userId);
        let status: 'PRESENT' | 'LATE' | 'ABSENT' = 'ABSENT';
        let durationMinutes = 0;
        let joinTime: Date | null = null;

        if (row) {
          const ints = mergeIntervals(row.intervals)
            .map((x) => ({
              start: new Date(Math.max(x.start.getTime(), start.getTime())),
              end: new Date(Math.min(x.end.getTime(), end.getTime()))
            }))
            .filter((x) => x.end > x.start);
          durationMinutes = Math.round(ints.reduce((n, x) => n + (x.end.getTime() - x.start.getTime()), 0) / 60000);
          joinTime = ints[0]?.start || null;
          status = joinTime && joinTime > lateAfter ? 'LATE' : 'PRESENT';
          status === 'LATE' ? late++ : present++;
        } else {
          absent++;
        }

        await db
          .insert(meetAttendance)
          .values({
            id: `${id}_${m.userId}`,
            sessionId: id,
            userId: m.userId,
            email: m.email || null,
            name: m.name || null,
            status,
            durationMinutes,
            joinTime
          })
          .onConflictDoUpdate({
            target: meetAttendance.id,
            set: { email: m.email || null, name: m.name || null, status, durationMinutes, joinTime, updatedAt: new Date() }
          });
      }

      const rosterSize = students.length;
      await db
        .update(meetSessions)
        .set({
          attendanceStatus: 'COMPLETE',
          rosterSize,
          present,
          late,
          absent,
          attendanceRate: rosterSize ? String(Math.round(((present + late) / rosterSize) * 1000) / 10) : null,
          lateRate: rosterSize ? String(Math.round((late / rosterSize) * 1000) / 10) : null
        })
        .where(eq(meetSessions.id, id));
    } else {
      await db
        .update(meetSessions)
        .set({ attendanceStatus: 'DATA_UNAVAILABLE', attendanceReason: 'ROSTER_NOT_COMPLETE' })
        .where(eq(meetSessions.id, id));
    }
  }

  return { conferenceId: id, participants: participants.length, online };
}
