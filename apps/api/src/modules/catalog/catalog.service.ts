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

export function cleanCourseName(name?: string | null): string {
  if (!name) return '';
  return name.replace(/^\[.*?\]\s*/g, '').trim();
}

export function autoDetectClass(courseName: string): DetectedClass | null {
  if (!courseName) return null;
  const clean = cleanCourseName(courseName);

  // 1. Khớp các định dạng lớp có khối: Lớp 12A1, 12A1, Lớp 6A2, 11A3, 10A1, 7A, 9A4...
  const matchWithWord = clean.match(/(?:lớp\s*)?([1-9]|1[0-2])\s*([a-zA-Z][0-9]?)\b/i);
  if (matchWithWord && matchWithWord[1] && matchWithWord[2]) {
    const gradeNum = parseInt(matchWithWord[1], 10);
    const section = matchWithWord[2].toUpperCase();
    const classCode = `${gradeNum}${section}`;
    return {
      classId: classCode,
      className: `Lớp ${classCode}`,
      grade: gradeNum,
      confidence: 0.98
    };
  }

  // 2. Khớp định dạng từ đứng độc lập: 6A1, 10A2, 12A3
  const standalone = clean.match(/\b([1-9]|1[0-2])([a-zA-Z][0-9]?)\b/i);
  if (standalone && standalone[1] && standalone[2]) {
    const gradeNum = parseInt(standalone[1], 10);
    const section = standalone[2].toUpperCase();
    const classCode = `${gradeNum}${section}`;
    return {
      classId: classCode,
      className: `Lớp ${classCode}`,
      grade: gradeNum,
      confidence: 0.95
    };
  }

  // 3. Với các lớp chuyên đề / câu lạc bộ / STEAM (1 Classroom = 1 Lớp thực tế)
  const slug = clean.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return {
    classId: slug ? `class_${slug}` : `class_${Date.now()}`,
    className: clean || 'Lớp học thực tế',
    grade: 0,
    confidence: 0.85
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
