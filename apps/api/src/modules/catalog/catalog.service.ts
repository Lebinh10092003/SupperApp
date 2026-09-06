export interface DetectedClass {
  classId: string;
  className: string;
  grade: number;
  confidence: number;
}

export interface DetectedSubject {
  subjectId: string;
  subjectName: string;
  confidence: number;
}

export function autoDetectClass(courseName: string): DetectedClass | null {
  const match = courseName.match(/\b([6-9][A-Z][0-9]?)\b/i);
  if (!match || !match[1]) return null;
  const name = match[1].toUpperCase();
  const grade = parseInt(name[0] || '9', 10);
  return {
    classId: `class_${name.toLowerCase()}`,
    className: name,
    grade,
    confidence: 0.95
  };
}

export function autoDetectSubject(courseName: string): DetectedSubject | null {
  const name = courseName.toLowerCase();
  if (name.includes('toán')) return { subjectId: 'math', subjectName: 'Toán học', confidence: 0.9 };
  if (name.includes('văn')) return { subjectId: 'literature', subjectName: 'Ngữ văn', confidence: 0.9 };
  if (name.includes('anh')) return { subjectId: 'english', subjectName: 'Tiếng Anh', confidence: 0.9 };
  if (name.includes('lý') || name.includes('vật lí')) return { subjectId: 'physics', subjectName: 'Vật lý', confidence: 0.9 };
  if (name.includes('hóa')) return { subjectId: 'chemistry', subjectName: 'Hóa học', confidence: 0.9 };
  if (name.includes('sinh')) return { subjectId: 'biology', subjectName: 'Sinh học', confidence: 0.9 };
  if (name.includes('sử')) return { subjectId: 'history', subjectName: 'Lịch sử', confidence: 0.9 };
  if (name.includes('địa')) return { subjectId: 'geography', subjectName: 'Địa lý', confidence: 0.9 };
  if (name.includes('tin')) return { subjectId: 'informatics', subjectName: 'Tin học', confidence: 0.9 };
  return null;
}
