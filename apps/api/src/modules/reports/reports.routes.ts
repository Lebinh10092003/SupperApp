import { Router } from 'express';
import { desc } from 'drizzle-orm';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { metricsDaily } from '../dashboard/dashboard.schema.js';
import { courses } from '../classroom/classroom.schema.js';
import { meetSessions } from '../meet/meet.schema.js';

const cell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export const reportsRouter = Router();

reportsRouter.get(
  '/summary.csv',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (req, res) => {
    const days = Math.min(Number(req.query.days || 30), 365);
    const rows = await db.select().from(metricsDaily).orderBy(desc(metricsDaily.date)).limit(days);
    // metrics_daily bản Postgres KHÔNG lưu lateRate/số phiên Meet mỗi ngày
    // (quyết định thu gọn schema khi migrate) — bỏ hẳn 2 cột đó khỏi báo
    // cáo thay vì hiện "0" gây hiểu nhầm "không có phiên nào".
    const headers = ['Ngày', 'Tỷ lệ chuyên cần (%)', 'Lớp học hoạt động', 'Tỷ lệ nộp bài (%)'];

    const lines = [
      headers.map(cell).join(','),
      ...rows.map((r) => [cell(r.date), cell(r.attendanceRate ?? 0), cell(r.activeCourses ?? 0), cell(r.submissionRate ?? 0)].join(','))
    ];
    res.header('content-type', 'text/csv; charset=utf-8');
    res.header('content-disposition', 'attachment; filename="bao-cao-chuyen-can-thcs-giang-vo.csv"');
    res.send('﻿' + lines.join('\n'));
  })
);

reportsRouter.get(
  '/classroom.csv',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_req, res) => {
    const rows = await db.select().from(courses);
    const headers = [
      'Mã khóa học',
      'Tên khóa học Google Classroom',
      'Khối',
      'Lớp hành chính',
      'Bộ môn',
      'Sĩ số học sinh',
      'Số bài tập đã giao',
      'Tổng số bài nộp',
      'Số bài nộp đúng hạn',
      'Số bài nộp muộn',
      'Tỷ lệ hoàn thành (%)',
      'Tỷ lệ đúng hạn (%)',
      'Điểm trung bình (/10)',
      'Trạng thái'
    ];

    const lines = [
      headers.map(cell).join(','),
      ...rows.map((c) => {
        const turnedIn = c.submissionsTurnedIn;
        const late = c.submissionsLate;
        const onTime = Math.max(0, turnedIn - late);

        return [
          cell(c.id),
          cell(c.name || ''),
          cell(c.grade || ''),
          cell(c.className || c.classId || ''),
          cell(c.subjectName || ''),
          cell(c.rosterStudents || 0),
          cell(c.contentCoursework || 0),
          cell(c.submissionsTotal || 0),
          cell(onTime),
          cell(late),
          cell(c.completionRate != null ? `${c.completionRate}%` : 'Chưa có'),
          cell(c.onTimeRate != null ? `${c.onTimeRate}%` : 'Chưa có'),
          cell(c.averageScore != null ? c.averageScore : 'Chưa chấm'),
          cell(c.courseState || 'ACTIVE')
        ].join(',');
      })
    ];

    res.header('content-type', 'text/csv; charset=utf-8');
    res.header('content-disposition', 'attachment; filename="bao-cao-google-classroom.csv"');
    res.send('﻿' + lines.join('\n'));
  })
);

reportsRouter.get(
  '/meet.csv',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_req, res) => {
    const rows = await db.select().from(meetSessions);
    const headers = [
      'Mã phiên',
      'Ngày',
      'Lớp / Mã phòng',
      'Giáo viên / Chủ phòng',
      'Sĩ số',
      'Có mặt',
      'Đi muộn',
      'Vắng mặt',
      'Thời lượng (phút)',
      'Trạng thái'
    ];

    const lines = [
      headers.map(cell).join(','),
      ...rows.map((s) =>
        [
          cell(s.id),
          cell(s.date || ''),
          cell(s.className || s.conferenceName || s.id),
          cell(s.teacherEmail || ''),
          cell(s.rosterSize || 0),
          cell(s.present || 0),
          cell(s.late || 0),
          cell(s.absent || 0),
          cell(45),
          cell(s.attendanceStatus || 'COMPLETED')
        ].join(',')
      )
    ];

    res.header('content-type', 'text/csv; charset=utf-8');
    res.header('content-disposition', 'attachment; filename="bao-cao-phien-hoc-google-meet.csv"');
    res.send('﻿' + lines.join('\n'));
  })
);
