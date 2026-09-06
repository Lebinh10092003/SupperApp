import { FieldValue } from 'firebase-admin/firestore';
import { col } from '../../core/firebase.js';
import { isTeacher, isStudent } from '../people/people.shared.js';

const metric = (value: number | null, status = 'COMPLETE', source = 'AGGREGATE') => ({
  value,
  dataStatus: status,
  source,
  updatedAt: new Date()
});

export async function rebuildDashboard() {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const [people, classes, courses, live, alerts, sessions] = await Promise.all([
    col('people').get(),
    col('classes').get(),
    col('courses').get(),
    col('liveSessions').get(),
    col('alerts').where('resolved', '==', false).get(),
    col('meetSessions').where('date', '==', today).get()
  ]);

  // Áp dụng Single Source of Truth (SSOT) cho phân loại Giáo viên & Học sinh
  const allPeople = people.docs.map(d => d.data());
  const students = allPeople.filter(isStudent).length;
  const teachers = allPeople.filter(isTeacher).length;

  const activeCourses = courses.docs.filter(d => d.data().courseState === 'ACTIVE').length;
  const online = live.docs.reduce((n, d) => n + Number(d.data().onlineStudents || 0), 0);

  let present = 0;
  let late = 0;
  let roster = 0;
  for (const d of sessions.docs) {
    const x = d.data();
    if (x.attendanceStatus === 'COMPLETE') {
      present += Number(x.present || 0) + Number(x.late || 0);
      late += Number(x.late || 0);
      roster += Number(x.rosterSize || 0);
    }
  }

  let submissions = 0;
  let turned = 0;
  for (const d of courses.docs) {
    submissions += Number(d.data().content?.submissionsTotal || 0);
    turned += Number(d.data().content?.submissionsTurnedIn || 0);
  }

  const attendanceRate = roster ? Math.round((present / roster) * 1000) / 10 : null;
  const lateRate = roster ? Math.round((late / roster) * 1000) / 10 : null;
  const submissionRate = submissions ? Math.round((turned / submissions) * 1000) / 10 : null;

  const rosterOk = courses.docs.filter(d => d.data().roster?.status === 'COMPLETE').length;
  const mapped = courses.docs.filter(d => d.data().classId).length;
  const health = courses.size
    ? Math.round((rosterOk / courses.size) * 50 + (mapped / courses.size) * 30 + (people.size ? 20 : 0))
    : null;

  const doc = {
    schoolName: process.env.SCHOOL_NAME || 'Trường THCS Giảng Võ',
    date: today,
    updatedAt: FieldValue.serverTimestamp(),
    dataStatus: people.empty && courses.empty ? 'UNAVAILABLE' : 'COMPLETE',
    kpis: {
      students: metric(students, people.empty ? 'UNAVAILABLE' : 'COMPLETE', 'DIRECTORY'),
      teachers: metric(teachers, people.empty ? 'UNAVAILABLE' : 'COMPLETE', 'DIRECTORY'),
      classes: metric(classes.size, classes.empty ? 'UNAVAILABLE' : 'SCHEDULE'),
      classrooms: metric(courses.size, courses.empty ? 'UNAVAILABLE' : 'CLASSROOM'),
      activeClassrooms: metric(activeCourses, 'COMPLETE', 'CLASSROOM'),
      meetSessionsToday: metric(sessions.size, 'COMPLETE', 'MEET'),
      liveMeets: metric(live.size, 'COMPLETE', 'MEET_EVENTS'),
      onlineStudents: metric(online, 'COMPLETE', 'MEET_EVENTS'),
      attendanceRate: metric(attendanceRate, roster ? 'COMPLETE' : 'UNAVAILABLE', 'MEET'),
      lateRate: metric(lateRate, roster ? 'COMPLETE' : 'UNAVAILABLE', 'MEET'),
      submissionRate: metric(submissionRate, courses.empty ? 'UNAVAILABLE' : 'CLASSROOM'),
      openAlerts: metric(alerts.size, 'COMPLETE', 'ALERTS')
    },
    schoolHealth: {
      score: health,
      components: {
        rosterCompleteness: courses.size ? Math.round((rosterOk / courses.size) * 100) : null,
        classMapping: courses.size ? Math.round((mapped / courses.size) * 100) : null,
        directory: people.size ? 100 : 0
      },
      dataStatus: courses.empty ? 'UNAVAILABLE' : 'COMPLETE'
    }
  };

  await col('dashboard').doc('current').set(doc, { merge: true });
  await col('metricsDaily').doc(today).set(
    {
      date: today,
      meetSessions: sessions.size,
      activeClassrooms: activeCourses,
      attendanceRate,
      lateRate,
      submissionRate,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return doc;
}

export async function trend(days = 30) {
  const s = await col('metricsDaily').orderBy('date', 'desc').limit(Math.min(Math.max(days, 1), 90)).get();
  return s.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
}
