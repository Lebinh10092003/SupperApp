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

  // 1. Khớp các định dạng có từ "Lớp": Lớp 12A1, Lớp 6A10, Lớp 11A3, Lớp 7A12...
  const matchWithWord = clean.match(/(?:lớp\s+)(1[0-2]|[1-9])\s*([a-zA-Z]+[0-9]{0,2})\b/i);
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

  // 2. Khớp định dạng mã lớp đứng độc lập: 6A, 6A1, 6A10, 7A12, 10A1, 11A3, 12A1...
  const standalone = clean.match(/\b(1[0-2]|[1-9])\s*([a-zA-Z]+[0-9]{0,2})\b/i);
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
  if (!courseName) return null;
  const name = courseName.toLowerCase();

  // Môn tích hợp & đặc thù THCS (GDPT 2018)
  if (name.includes('khtn') || name.includes('khoa học tự nhiên') || name.includes('khoa hoc tu nhien')) {
    return { subjectId: 'natural_sciences', subjectName: 'Khoa học tự nhiên', confidence: 0.95 };
  }
  if (
    name.includes('lịch sử và địa lý') ||
    name.includes('lịch sử & địa lý') ||
    name.includes('lich su va dia ly') ||
    name.includes('ls&đl') ||
    name.includes('ls & đl')
  ) {
    return { subjectId: 'history_geography', subjectName: 'Lịch sử & Địa lý', confidence: 0.95 };
  }
  if (name.includes('gdcd') || name.includes('giáo dục công dân') || name.includes('giao duc cong dan')) {
    return { subjectId: 'civics', subjectName: 'Giáo dục công dân', confidence: 0.95 };
  }
  if (name.includes('hđtn') || name.includes('hdtn') || name.includes('trải nghiệm') || name.includes('trai nghiem')) {
    return { subjectId: 'experiential_activities', subjectName: 'HĐTN & Hướng nghiệp', confidence: 0.95 };
  }
  if (name.includes('gdđp') || name.includes('gddp') || name.includes('địa phương') || name.includes('dia phuong')) {
    return { subjectId: 'local_education', subjectName: 'Giáo dục địa phương', confidence: 0.95 };
  }
  if (name.includes('công nghệ') || name.includes('cong nghe')) {
    return { subjectId: 'technology', subjectName: 'Công nghệ', confidence: 0.95 };
  }
  if (name.includes('âm nhạc') || name.includes('am nhac') || name.includes('mỹ thuật') || name.includes('my thuat') || name.includes('nghệ thuật')) {
    return { subjectId: 'arts', subjectName: 'Nghệ thuật', confidence: 0.95 };
  }
  if (name.includes('gdtc') || name.includes('thể chất') || name.includes('thể dục') || name.includes('the chat')) {
    return { subjectId: 'physical_education', subjectName: 'Giáo dục thể chất', confidence: 0.95 };
  }
  if (name.includes('stem') || name.includes('steam') || name.includes('robotics')) {
    return { subjectId: 'stem', subjectName: 'STEM / Robotics', confidence: 0.95 };
  }

  // Môn học văn hóa cơ bản
  if (name.includes('toán') || name.includes('toan') || name.includes('math')) {
    return { subjectId: 'math', subjectName: 'Toán học', confidence: 0.95 };
  }
  if (name.includes('ngữ văn') || name.includes('ngu van') || name.includes('văn học') || name.includes('tiếng việt') || name.includes('văn')) {
    return { subjectId: 'literature', subjectName: 'Ngữ văn', confidence: 0.95 };
  }
  if (name.includes('tiếng anh') || name.includes('tieng anh') || name.includes('english') || name.includes('ngoại ngữ') || name.includes('anh')) {
    return { subjectId: 'english', subjectName: 'Tiếng Anh', confidence: 0.95 };
  }
  if (name.includes('vật lý') || name.includes('vật lí') || name.includes('vat ly') || name.includes('vat li') || name.includes('physics') || name.includes('lý')) {
    return { subjectId: 'physics', subjectName: 'Vật lý', confidence: 0.9 };
  }
  if (name.includes('hóa học') || name.includes('hoa hoc') || name.includes('chemistry') || name.includes('hóa')) {
    return { subjectId: 'chemistry', subjectName: 'Hóa học', confidence: 0.9 };
  }
  if (name.includes('sinh học') || name.includes('sinh hoc') || name.includes('biology') || name.includes('sinh')) {
    return { subjectId: 'biology', subjectName: 'Sinh học', confidence: 0.9 };
  }
  if (name.includes('lịch sử') || name.includes('lich su') || name.includes('history') || name.includes('sử')) {
    return { subjectId: 'history', subjectName: 'Lịch sử', confidence: 0.9 };
  }
  if (name.includes('địa lý') || name.includes('địa lí') || name.includes('dia ly') || name.includes('geography') || name.includes('địa')) {
    return { subjectId: 'geography', subjectName: 'Địa lý', confidence: 0.9 };
  }
  if (name.includes('tin học') || name.includes('tin hoc') || name.includes('informatics') || name.includes('tin')) {
    return { subjectId: 'informatics', subjectName: 'Tin học', confidence: 0.9 };
  }

  return null;
}
