import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { alertRules, alerts } from './alerts.schema.js';
import { courses } from '../classroom/classroom.schema.js';

export interface AlertRule {
  id: string;
  name: string;
  threshold: number;
  unit: string;
  enabled: boolean;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
}

const DEFAULT_RULES: AlertRule[] = [
  { id: 'RULE_ABSENCE_HIGH', name: 'Nghỉ học liên tiếp', threshold: 3, unit: 'buổi', enabled: true, severity: 'HIGH' },
  { id: 'RULE_SUBMISSION_LATE', name: 'Tỷ lệ nộp bài muộn', threshold: 25, unit: '%', enabled: true, severity: 'WARNING' },
  { id: 'RULE_MEET_SHORT', name: 'Thời lượng học Meet thấp', threshold: 50, unit: '%', enabled: true, severity: 'WARNING' },
  { id: 'RULE_INACTIVE_CLASS', name: 'Lớp học không hoạt động', threshold: 14, unit: 'ngày', enabled: true, severity: 'CRITICAL' }
];

export async function getAlertRules(): Promise<AlertRule[]> {
  const rows = await db.select().from(alertRules);
  if (rows.length === 0) return DEFAULT_RULES;
  return rows.map((r) => ({ ...r, threshold: Number(r.threshold), severity: r.severity as AlertRule['severity'] }));
}

export async function updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<{ ok: boolean; rule: any }> {
  const setValues: Record<string, unknown> = {};
  if (updates.threshold !== undefined) setValues.threshold = String(updates.threshold);
  if (updates.enabled !== undefined) setValues.enabled = updates.enabled;
  if (updates.severity !== undefined) setValues.severity = updates.severity;
  if (updates.name !== undefined) setValues.name = updates.name;
  if (updates.unit !== undefined) setValues.unit = updates.unit;

  const existing = await db.select().from(alertRules).where(eq(alertRules.id, id)).then((r) => r[0] ?? null);
  const base = existing ?? DEFAULT_RULES.find((r) => r.id === id);
  if (!base) return { ok: false, rule: null };

  const [row] = await db
    .insert(alertRules)
    .values({
      id,
      name: (setValues.name as string) ?? base.name,
      threshold: (setValues.threshold as string) ?? String(base.threshold),
      unit: (setValues.unit as string) ?? base.unit,
      enabled: (setValues.enabled as boolean) ?? base.enabled,
      severity: (setValues.severity as string) ?? base.severity
    })
    .onConflictDoUpdate({ target: alertRules.id, set: setValues })
    .returning();

  return { ok: true, rule: row };
}

export async function evaluateAlertRules(): Promise<{ evaluated: number; generated: number }> {
  const rules = await getAlertRules();
  const allCourses = await db.select().from(courses);
  let generated = 0;

  if (allCourses.length === 0) {
    return { evaluated: rules.length, generated: 0 };
  }

  for (const rule of rules) {
    if (!rule.enabled) continue;

    if (rule.id === 'RULE_INACTIVE_CLASS') {
      const inactiveCourses = allCourses.filter((c) => c.courseState === 'ACTIVE' && c.contentCoursework === 0);

      for (const course of inactiveCourses) {
        const alertId = `alert_inactive_${course.id}`;
        await db
          .insert(alerts)
          .values({
            id: alertId,
            ruleId: rule.id,
            title: `Khóa học chưa giao bài tập: ${course.name}`,
            severity: rule.severity || 'CRITICAL',
            category: 'CLASSROOM',
            targetId: course.id,
            targetName: course.name,
            classId: course.classId || null,
            message: `Khóa học "${course.name}" trên Google Classroom chưa có bài tập số nào được giao.`,
            action: 'Đôn đốc giáo viên phụ trách cập nhật nội dung học tập số.',
            resolved: false
          })
          .onConflictDoUpdate({
            target: alerts.id,
            set: {
              severity: rule.severity || 'CRITICAL',
              message: `Khóa học "${course.name}" trên Google Classroom chưa có bài tập số nào được giao.`,
              updatedAt: new Date()
            }
          });
        generated++;
      }
    }

    if (rule.id === 'RULE_SUBMISSION_LATE') {
      for (const course of allCourses) {
        const turnedIn = course.submissionsTurnedIn;
        const late = course.submissionsLate;
        if (turnedIn >= 5) {
          const lateRate = (late / turnedIn) * 100;
          if (lateRate >= rule.threshold) {
            const alertId = `alert_late_${course.id}`;
            await db
              .insert(alerts)
              .values({
                id: alertId,
                ruleId: rule.id,
                title: `Tỷ lệ nộp bài muộn cao: ${course.name}`,
                severity: rule.severity || 'WARNING',
                category: 'CLASSROOM',
                targetId: course.id,
                targetName: course.name,
                classId: course.classId || null,
                message: `Khóa học "${course.name}" có ${late}/${turnedIn} bài nộp muộn (${lateRate.toFixed(1)}%, vượt ngưỡng ${rule.threshold}%).`,
                action: 'Kiểm tra hạn nộp bài tập hoặc nhắc nhở học sinh hoàn thành đúng thời gian quy định.',
                resolved: false
              })
              .onConflictDoUpdate({
                target: alerts.id,
                set: {
                  severity: rule.severity || 'WARNING',
                  message: `Khóa học "${course.name}" có ${late}/${turnedIn} bài nộp muộn (${lateRate.toFixed(1)}%, vượt ngưỡng ${rule.threshold}%).`,
                  updatedAt: new Date()
                }
              });
            generated++;
          }
        }
      }
    }
  }

  // Quét các khóa học chưa được ánh xạ lớp hành chính
  const unmappedCourses = allCourses.filter((c) => !c.classId);
  for (const course of unmappedCourses) {
    const alertId = `alert_unmapped_${course.id}`;
    await db
      .insert(alerts)
      .values({
        id: alertId,
        ruleId: 'RULE_UNMAPPED_CLASS',
        title: `Chưa ánh xạ lớp hành chính: ${course.name}`,
        severity: 'INFO',
        category: 'CLASSROOM',
        targetId: course.id,
        targetName: course.name,
        classId: null,
        message: `Khóa học "${course.name}" chưa được liên kết với mã lớp hành chính trong trường.`,
        action: 'Vào mục Quản lý Lớp học để cấu hình mapping.',
        resolved: false
      })
      .onConflictDoUpdate({
        target: alerts.id,
        set: { message: `Khóa học "${course.name}" chưa được liên kết với mã lớp hành chính trong trường.`, updatedAt: new Date() }
      });
    generated++;
  }

  return { evaluated: rules.length, generated };
}
