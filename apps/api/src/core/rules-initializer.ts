import { col } from './firebase.js';

export async function ensureSystemRules(): Promise<{ initialized: boolean; message: string }> {
  try {
    const existingRules = await col('rules').limit(1).get();
    if (!existingRules.empty && existingRules.size > 0) {
      return { initialized: false, message: 'Quy tắc cảnh báo đã được cấu hình.' };
    }

    const defaultRules = [
      { id: 'RULE_ABSENCE_HIGH', name: 'Nghỉ học liên tiếp', threshold: 3, unit: 'buổi', enabled: true, severity: 'HIGH' },
      { id: 'RULE_SUBMISSION_LATE', name: 'Tỷ lệ nộp bài muộn', threshold: 25, unit: '%', enabled: true, severity: 'MEDIUM' },
      { id: 'RULE_MEET_SHORT', name: 'Thời lượng học Meet thấp', threshold: 50, unit: '% thời lượng', enabled: true, severity: 'MEDIUM' },
      { id: 'RULE_INACTIVE_CLASS', name: 'Lớp học không hoạt động', threshold: 14, unit: 'ngày', enabled: true, severity: 'HIGH' }
    ];

    for (const r of defaultRules) {
      await col('rules').doc(r.id).set(r);
    }

    return { initialized: true, message: 'Đã thiết lập các quy tắc cảnh báo hệ thống.' };
  } catch (error: any) {
    return { initialized: false, message: `Lỗi thiết lập quy tắc: ${error.message}` };
  }
}
