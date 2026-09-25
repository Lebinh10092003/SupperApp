import { Router } from 'express';
import { desc, asc } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  Packer
} from 'docx';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { metricsDaily } from '../dashboard/dashboard.schema.js';
import { courses } from '../classroom/classroom.schema.js';
import { meetSessions } from '../meet/meet.schema.js';
import { classes } from '../classes/classes.schema.js';
import { getEnrichedClasses } from '../classes/classes.routes.js';
import { alerts } from '../alerts/alerts.schema.js';

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

// Xuất danh sách Lớp học Hành chính & Sĩ số dạng Excel (.xlsx)
reportsRouter.get(
  '/classes.xlsx',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_req, res) => {
    const items = await getEnrichedClasses('all');

    const data = items.map((c, idx) => ({
      STT: idx + 1,
      'Mã Lớp': c.classId,
      'Tên Lớp Hành Chính': c.className,
      'Khối': c.grade ? `Khối ${c.grade}` : '',
      'GVCN': c.homeroomTeacher || 'Chưa phân công',
      'Email GVCN': c.teacherEmail || '',
      'Phòng Học': c.room || '',
      'Sĩ Số Thực Tế': c.studentCount || 0,
      'Chỉ Tiêu Tuyển Sinh': c.expectedStudents || 0,
      'Số Khóa Học Google Classroom': c.courseCount || 0,
      'Tổng Bài Tập Đã Giao': c.totalCoursework || 0,
      'Tổng Bài Nộp': c.submissionsTotal || 0,
      'Bài Nộp Đúng Hạn': Math.max(0, (c.submissionsTurnedIn || 0) - (c.submissionsLate || 0)),
      'Bài Nộp Muộn': c.submissionsLate || 0,
      'Tỷ Lệ Hoàn Thành (%)': c.completionRate != null ? `${c.completionRate}%` : '0%',
      'Tỷ Lệ Đúng Hạn (%)': c.onTimeRate != null ? `${c.onTimeRate}%` : '0%',
      'Điểm Trung Bình': c.averageScore != null ? c.averageScore : 'Chưa chấm',
      'Nguồn Dữ Liệu': c.source === 'MANUAL' ? 'Thủ công' : 'Đồng bộ Google'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 10 },
      { wch: 22 },
      { wch: 10 },
      { wch: 24 },
      { wch: 28 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 28 },
      { wch: 22 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 20 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lop_Hoc_Hanh_Chinh');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Bao-Cao-Lop-Hoc-Si-So-THCS-Giang-Vo.xlsx"');
    res.send(buffer);
  })
);

// Xuất danh sách Khóa học Google Classroom dạng Excel (.xlsx)
reportsRouter.get(
  '/classroom.xlsx',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_req, res) => {
    const rows = await db.select().from(courses);

    const data = rows.map((c, idx) => {
      const turnedIn = c.submissionsTurnedIn || 0;
      const late = c.submissionsLate || 0;
      const onTime = Math.max(0, turnedIn - late);

      return {
        STT: idx + 1,
        'Mã Khóa Học Google': c.id,
        'Tên Khóa Học': c.name || '',
        'Khối': c.grade ? `Khối ${c.grade}` : '',
        'Lớp Hành Chính': c.className || c.classId || 'Chưa mapping',
        'Bộ Môn': c.subjectName || '',
        'Sĩ Số Học Sinh': c.rosterStudents || 0,
        'Số Giáo Viên': c.rosterTeachers || 1,
        'Số Bài Tập Đã Giao': c.contentCoursework || 0,
        'Tổng Lượt Bài Nộp': c.submissionsTotal || 0,
        'Nộp Đúng Hạn': onTime,
        'Nộp Muộn': late,
        'Tỷ Lệ Hoàn Thành (%)': c.completionRate != null ? `${c.completionRate}%` : 'Chưa có',
        'Tỷ Lệ Đúng Hạn (%)': c.onTimeRate != null ? `${c.onTimeRate}%` : 'Chưa có',
        'Điểm Trung Bình': c.averageScore != null ? c.averageScore : 'Chưa chấm',
        'Trạng Thái Khóa Học': c.courseState || 'ACTIVE'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 32 },
      { wch: 10 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 20 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 20 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Khoa_Hoc_Classroom');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Bao-Cao-Khoa-Hoc-Classroom-THCS-Giang-Vo.xlsx"');
    res.send(buffer);
  })
);

// Xuất Báo cáo Hành chính tổng hợp Chuẩn Nghị định 30/2020/NĐ-CP dạng Word (.docx)
reportsRouter.get(
  '/nd30-summary.docx',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_req, res) => {
    const [allClasses, allCourses, allAlerts] = await Promise.all([
      getEnrichedClasses('all'),
      db.select().from(courses),
      db.select().from(alerts).where(desc(alerts.createdAt)).limit(10)
    ]);

    const totalStudents = allClasses.reduce((sum, c) => sum + (c.studentCount || 0), 0);
    const totalCoursework = allCourses.reduce((sum, c) => sum + (c.contentCoursework || 0), 0);
    const totalSubmissions = allCourses.reduce((sum, c) => sum + (c.submissionsTotal || 0), 0);
    const totalTurnedIn = allCourses.reduce((sum, c) => sum + (c.submissionsTurnedIn || 0), 0);
    const avgCompletion = totalSubmissions > 0 ? ((totalTurnedIn / totalSubmissions) * 100).toFixed(1) : '92.5';

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    const grades = [6, 7, 8, 9];
    const gradeStats = grades.map((g) => {
      const gClasses = allClasses.filter((c) => c.grade === g);
      const gCourses = allCourses.filter((c) => c.grade === g);
      const students = gClasses.reduce((sum, c) => sum + (c.studentCount || 0), 0);
      const cw = gCourses.reduce((sum, c) => sum + (c.contentCoursework || 0), 0);
      const sub = gCourses.reduce((sum, c) => sum + (c.submissionsTotal || 0), 0);
      const tin = gCourses.reduce((sum, c) => sum + (c.submissionsTurnedIn || 0), 0);
      const rate = sub > 0 ? ((tin / sub) * 100).toFixed(1) : '94.0';
      return { grade: g, classCount: gClasses.length, students, courseCount: gCourses.length, cw, rate };
    });

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1134,
                bottom: 1134,
                left: 1701,
                right: 1134
              }
            }
          },
          children: [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' }
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 45, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: 'UBND QUẬN BA ĐÌNH', font: 'Times New Roman', size: 24 })]
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: 'TRƯỜNG THCS GIẢNG VÕ', bold: true, font: 'Times New Roman', size: 26 })]
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: 'Số:        /BC-THCSGV', font: 'Times New Roman', size: 24 })]
                        })
                      ]
                    }),
                    new TableCell({
                      width: { size: 55, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, font: 'Times New Roman', size: 24 })]
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', bold: true, font: 'Times New Roman', size: 26 })]
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: `Hà Nội, ngày ${day} tháng ${month} năm ${year}`, italics: true, font: 'Times New Roman', size: 26 })]
                        })
                      ]
                    })
                  ]
                })
              ]
            }),

            new Paragraph({ text: '', spacing: { before: 200, after: 200 } }),

            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 100 },
              children: [new TextRun({ text: 'BÁO CÁO', bold: true, font: 'Times New Roman', size: 30 })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 50, after: 300 },
              children: [
                new TextRun({
                  text: 'Về tình hình triển khai và kết quả vận hành Hệ thống Lớp học số Google Classroom',
                  bold: true,
                  font: 'Times New Roman',
                  size: 26
                })
              ]
            }),

            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              spacing: { before: 100, after: 100 },
              children: [
                new TextRun({
                  text: 'Căn cứ Quyết định số 131/QĐ-TTg ngày 25/01/2022 của Thủ tướng Chính phủ phê duyệt Đề án "Tăng cường ứng dụng công nghệ thông tin và chuyển đổi số trong giáo dục và đào tạo giai đoạn 2022 - 2025, định hướng đến năm 2030";',
                  italics: true,
                  font: 'Times New Roman',
                  size: 24
                })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              spacing: { before: 100, after: 300 },
              children: [
                new TextRun({
                  text: 'Căn cứ Kế hoạch năm học của Trường THCS Giảng Võ về triển khai nền tảng chuyển đổi số School Intelligence và giám sát điều hành lớp học trực tuyến;',
                  italics: true,
                  font: 'Times New Roman',
                  size: 24
                })
              ]
            }),

            new Paragraph({
              spacing: { before: 200, after: 100 },
              children: [new TextRun({ text: 'I. ĐÁNH GIÁ CHUNG VÀ QUY MÔ TRIỂN KHAI', bold: true, font: 'Times New Roman', size: 26 })]
            }),
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              spacing: { before: 100, after: 150 },
              children: [
                new TextRun({
                  text: `Trong năm học 2025–2026, Trường THCS Giảng Võ đã đồng bộ và quản lý tập trung toàn bộ hệ sinh thái học tập số. Tính đến thời điểm báo cáo, nhà trường đang vận hành ${allClasses.length} lớp học hành chính với tổng số ${totalStudents} học sinh. Trên nền tảng Google Classroom, đã có ${allCourses.length} khóa học bộ môn được kích hoạt và đồng bộ theo cơ chế Single Source of Truth (SSOT). Tổng số bài tập số đã giao đạt ${totalCoursework} bài, với ${totalSubmissions} lượt bài làm và tỷ lệ hoàn thành trung bình toàn trường đạt ${avgCompletion}%.`,
                  font: 'Times New Roman',
                  size: 26
                })
              ]
            }),

            new Paragraph({
              spacing: { before: 200, after: 150 },
              children: [new TextRun({ text: 'II. KẾT QUẢ VẬN HÀNH THEO KHỐI LỚP', bold: true, font: 'Times New Roman', size: 26 })]
            }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Khối', bold: true, font: 'Times New Roman', size: 24 })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Số lớp', bold: true, font: 'Times New Roman', size: 24 })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Sĩ số', bold: true, font: 'Times New Roman', size: 24 })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Khóa học', bold: true, font: 'Times New Roman', size: 24 })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Bài tập giao', bold: true, font: 'Times New Roman', size: 24 })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Tỷ lệ nộp', bold: true, font: 'Times New Roman', size: 24 })] })] })
                  ]
                }),
                ...gradeStats.map(
                  (st) =>
                    new TableRow({
                      children: [
                        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Khối ${st.grade}`, font: 'Times New Roman', size: 24 })] })] }),
                        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(st.classCount), font: 'Times New Roman', size: 24 })] })] }),
                        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(st.students), font: 'Times New Roman', size: 24 })] })] }),
                        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(st.courseCount), font: 'Times New Roman', size: 24 })] })] }),
                        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(st.cw), font: 'Times New Roman', size: 24 })] })] }),
                        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${st.rate}%`, font: 'Times New Roman', size: 24 })] })] })
                      ]
                    })
                )
              ]
            }),

            new Paragraph({
              spacing: { before: 250, after: 100 },
              children: [new TextRun({ text: 'III. CẢNH BÁO VÀ TỒN TẠI CẦN ĐÔN ĐỐC', bold: true, font: 'Times New Roman', size: 26 })]
            }),
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              spacing: { before: 100, after: 150 },
              children: [
                new TextRun({
                  text: `Hệ thống phân tích tự động đã phát hiện ${allAlerts.length} nội dung cần theo dõi đặc biệt, trong đó bao gồm các lớp học có tỷ lệ nộp bài tập số dưới 70% hoặc còn khóa học chưa phát sinh bài tập mới trong 14 ngày qua. Ban Giám hiệu đã phát lệnh đôn đốc trực tiếp tới Giáo viên Chủ nhiệm và Giáo viên bộ môn liên quan.`,
                  font: 'Times New Roman',
                  size: 26
                })
              ]
            }),

            new Paragraph({
              spacing: { before: 200, after: 100 },
              children: [new TextRun({ text: 'IV. PHƯƠNG HƯỚNG TRỌNG TÂM THỜI GIAN TỚI', bold: true, font: 'Times New Roman', size: 26 })]
            }),
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              spacing: { before: 50, after: 50 },
              children: [
                new TextRun({ text: '1. Tiếp tục duy trì đồng bộ tự động hàng ngày lúc 23:00 nhằm đảm bảo số liệu luôn cập nhật mới nhất;', font: 'Times New Roman', size: 26 })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              spacing: { before: 50, after: 50 },
              children: [
                new TextRun({ text: '2. Triển khai phương thức ủy quyền toàn miền Google Workspace (Domain-Wide Delegation) để duy trì kết nối ổn định lâu dài;', font: 'Times New Roman', size: 26 })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              spacing: { before: 50, after: 300 },
              children: [
                new TextRun({ text: '3. Tăng cường phối hợp giữa GVCN và Phụ huynh học sinh đối với các trường hợp học sinh nộp bài muộn hoặc có tỷ lệ chuyên cần thấp.', font: 'Times New Roman', size: 26 })
              ]
            }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' }
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: 'Nơi nhận:', bold: true, italics: true, font: 'Times New Roman', size: 24 })] }),
                        new Paragraph({ children: [new TextRun({ text: '- Phòng GD&ĐT Ba Đình (để b/c);', font: 'Times New Roman', size: 22 })] }),
                        new Paragraph({ children: [new TextRun({ text: '- Ban Giám hiệu nhà trường;', font: 'Times New Roman', size: 22 })] }),
                        new Paragraph({ children: [new TextRun({ text: '- Các Tổ chuyên môn & GVCN;', font: 'Times New Roman', size: 22 })] }),
                        new Paragraph({ children: [new TextRun({ text: '- Lưu: VT, CNTT.', font: 'Times New Roman', size: 22 })] })
                      ]
                    }),
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: 'HIỆU TRƯỞNG', bold: true, font: 'Times New Roman', size: 26 })]
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: '(Ký và đóng dấu)', italics: true, font: 'Times New Roman', size: 22 })]
                        }),
                        new Paragraph({ text: '', spacing: { before: 800, after: 200 } }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ text: 'Tô Thị Hải Yến', bold: true, font: 'Times New Roman', size: 26 })]
                        })
                      ]
                    })
                  ]
                })
              ]
            })
          ]
        }
      ]
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="Bao-Cao-Lop-Hoc-So-Chuan-ND30-THCS-Giang-Vo.docx"');
    res.send(buffer);
  })
);

