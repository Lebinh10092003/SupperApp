import { col } from '../../core/firebase.js';

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
  const snap = await col('rules').get();
  if (snap.empty || snap.size === 0) {
    return DEFAULT_RULES;
  }
  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as AlertRule[];
}

export async function updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<{ ok: boolean; rule: any }> {
  await col('rules').doc(id).set(updates, { merge: true });
  const doc = await col('rules').doc(id).get();
  return { ok: true, rule: { id, ...doc.data() } };
}

export async function evaluateAlertRules(): Promise<{ evaluated: number; generated: number }> {
  const rules = await getAlertRules();
  const coursesSnap = await col('courses').get();
  let generated = 0;

  if (coursesSnap.empty || coursesSnap.size === 0) {
    return { evaluated: rules.length, generated: 0 };
  }

  const courses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    if (rule.id === 'RULE_INACTIVE_CLASS') {
      const inactiveCourses = courses.filter(c => {
        if (c.courseState !== 'ACTIVE') return false;
        const cw = c.content?.coursework || 0;
        return cw === 0;
      });

      for (const course of inactiveCourses) {
        const alertId = `alert_inactive_${course.id}`;
        await col('alerts').doc(alertId).set({
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
          resolved: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        generated++;
      }
    }

    if (rule.id === 'RULE_SUBMISSION_LATE') {
      for (const course of courses) {
        const turnedIn = Number(course.content?.submissionsTurnedIn || 0);
        const late = Number(course.content?.submissionsLate || 0);
        if (turnedIn >= 5) {
          const lateRate = (late / turnedIn) * 100;
          if (lateRate >= rule.threshold) {
            const alertId = `alert_late_${course.id}`;
            await col('alerts').doc(alertId).set({
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
              resolved: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }, { merge: true });
            generated++;
          }
        }
      }
    }
  }

  // Quét các khóa học chưa được ánh xạ lớp hành chính
  const unmappedCourses = courses.filter(c => !c.classId);
  for (const course of unmappedCourses) {
    const alertId = `alert_unmapped_${course.id}`;
    await col('alerts').doc(alertId).set({
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
      resolved: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
    generated++;
  }

  return { evaluated: rules.length, generated };
}
