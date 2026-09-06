import { doc, onSnapshot, collection, query, limit, where } from 'firebase/firestore';
import { db, hasValidFirebaseConfig } from '../../config/firebase';
import { env } from '../../config/env';
import { api } from '../../services/api';

const b = ['siSchools', env.VITE_SCHOOL_ID] as const;

const createEmptyDashboard = () => ({
  schoolName: 'Trường THCS Giảng Võ',
  dataStatus: 'UNAVAILABLE',
  kpis: {
    students: { value: 0, dataStatus: 'UNAVAILABLE', source: 'DIRECTORY' },
    teachers: { value: 0, dataStatus: 'UNAVAILABLE', source: 'DIRECTORY' },
    classes: { value: 0, dataStatus: 'UNAVAILABLE', source: 'SCHEDULE' },
    classrooms: { value: 0, dataStatus: 'UNAVAILABLE', source: 'CLASSROOM' },
    activeClassrooms: { value: 0, dataStatus: 'UNAVAILABLE', source: 'CLASSROOM' },
    meetSessionsToday: { value: 0, dataStatus: 'UNAVAILABLE', source: 'MEET' },
    liveMeets: { value: 0, dataStatus: 'UNAVAILABLE', source: 'MEET_STREAM' },
    onlineStudents: { value: 0, dataStatus: 'UNAVAILABLE', source: 'MEET_EVENTS' },
    attendanceRate: { value: null, dataStatus: 'UNAVAILABLE', source: 'ATTENDANCE' },
    lateRate: { value: null, dataStatus: 'UNAVAILABLE', source: 'ATTENDANCE' },
    submissionRate: { value: null, dataStatus: 'UNAVAILABLE', source: 'CLASSROOM' },
    openAlerts: { value: 0, dataStatus: 'UNAVAILABLE', source: 'ALERTS' }
  },
  schoolHealth: {
    score: null,
    components: {
      rosterCompleteness: null,
      classMapping: null,
      directory: 0
    },
    dataStatus: 'UNAVAILABLE'
  }
});

export const watchDashboard = (cb: (x: any) => void) => {
  if (!hasValidFirebaseConfig) {
    // Gọi trực tiếp backend API để lấy trạng thái thực tế
    api<any>('/dashboard/current')
      .then((data) => {
        if (data && data.kpis) {
          cb(data);
        } else {
          cb(createEmptyDashboard());
        }
      })
      .catch(() => {
        cb(createEmptyDashboard());
      });
    return () => {};
  }

  return onSnapshot(
    doc(db, ...b, 'dashboard', 'current'),
    (s) => {
      if (s.exists()) {
        cb(s.data());
      } else {
        // Tài liệu chưa tạo, gọi backend rebuild hoặc cung cấp empty state
        api<any>('/dashboard/current')
          .then((data) => cb(data || createEmptyDashboard()))
          .catch(() => cb(createEmptyDashboard()));
      }
    },
    () => {
      // Fallback khi Firestore listener bị lỗi quyền hạn
      api<any>('/dashboard/current')
        .then((data) => cb(data || createEmptyDashboard()))
        .catch(() => cb(createEmptyDashboard()));
    }
  );
};

export const watchLive = (cb: (x: any[]) => void) => {
  if (!hasValidFirebaseConfig) {
    api<{ items: any[] }>('/meet/live')
      .then((res) => cb(res.items || []))
      .catch(() => cb([]));
    return () => {};
  }
  return onSnapshot(
    query(collection(db, ...b, 'liveSessions'), limit(100)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => {
      api<{ items: any[] }>('/meet/live')
        .then((res) => cb(res.items || []))
        .catch(() => cb([]));
    }
  );
};

export const watchAlerts = (cb: (x: any[]) => void) => {
  if (!hasValidFirebaseConfig) {
    api<{ items: any[] }>('/alerts')
      .then((res) => cb(res.items || []))
      .catch(() => cb([]));
    return () => {};
  }
  return onSnapshot(
    query(collection(db, ...b, 'alerts'), where('resolved', '==', false), limit(100)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => {
      api<{ items: any[] }>('/alerts')
        .then((res) => cb(res.items || []))
        .catch(() => cb([]));
    }
  );
};