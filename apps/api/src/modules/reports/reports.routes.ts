import { Router } from 'express';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { col } from '../../core/firebase.js';

const cell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export const reportsRouter = Router();

reportsRouter.get(
  '/summary.csv',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (req, res) => {
    const days = Math.min(Number(req.query.days || 30), 365);
    const snap = await col('metricsDaily').orderBy('date', 'desc').limit(days).get();
    const headers = ['Ngày', 'Tỷ lệ chuyên cần (%)', 'Tỷ lệ đi muộn (%)', 'Số phiên Meet', 'Lớp học hoạt động', 'Tỷ lệ nộp bài (%)'];
    const fields = ['date', 'attendanceRate', 'lateRate', 'meetSessions', 'activeClassrooms', 'submissionRate'];
    const lines = [
      headers.map(cell).join(','),
      ...snap.docs.map((doc) => fields.map((h) => cell(h === 'date' ? doc.id : doc.data()[h] ?? 0)).join(',')),
    ];
    res.header('content-type', 'text/csv; charset=utf-8');
    res.header('content-disposition', 'attachment; filename="bao-cao-chuyen-can-thcs-giang-vo.csv"');
    res.send('\uFEFF' + lines.join('\n'));
  }),
);

reportsRouter.get(
  '/classroom.csv',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_req, res) => {
    const snap = await col('courses').get();
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
      ...snap.docs.map((doc) => {
        const d = doc.data();
        const content = d.content || {};
        const roster = d.roster || {};
        const turnedIn = Number(content.submissionsTurnedIn || 0);
        const late = Number(content.submissionsLate || 0);
        const onTime = Math.max(0, turnedIn - late);

        return [
          cell(doc.id),
          cell(d.name || ''),
          cell(d.grade || ''),
          cell(d.className || d.classId || ''),
          cell(d.subjectName || ''),
          cell(roster.students || 0),
          cell(content.coursework || content.courseWorkTotal || 0),
          cell(content.submissionsTotal || 0),
          cell(onTime),
          cell(late),
          cell(content.completionRate != null ? `${content.completionRate}%` : 'Chưa có'),
          cell(content.onTimeRate != null ? `${content.onTimeRate}%` : 'Chưa có'),
          cell(content.averageScore != null ? content.averageScore : 'Chưa chấm'),
          cell(d.courseState || 'ACTIVE')
        ].join(',');
      })
    ];

    res.header('content-type', 'text/csv; charset=utf-8');
    res.header('content-disposition', 'attachment; filename="bao-cao-google-classroom.csv"');
    res.send('\uFEFF' + lines.join('\n'));
  }),
);

reportsRouter.get(
  '/meet.csv',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_req, res) => {
    const snap = await col('meetSessions').get();
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
      ...snap.docs.map((doc) => {
        const d = doc.data();
        return [
          cell(doc.id),
          cell(d.date || ''),
          cell(d.className || d.spaceName || doc.id),
          cell(d.hostEmail || ''),
          cell(d.rosterSize || 0),
          cell(d.present || 0),
          cell(d.late || 0),
          cell(d.absent || 0),
          cell(d.durationMinutes || 45),
          cell(d.attendanceStatus || 'COMPLETED')
        ].join(',');
      })
    ];

    res.header('content-type', 'text/csv; charset=utf-8');
    res.header('content-disposition', 'attachment; filename="bao-cao-phien-hoc-google-meet.csv"');
    res.send('\uFEFF' + lines.join('\n'));
  }),
);

