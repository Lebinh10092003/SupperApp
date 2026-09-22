import { Router } from 'express';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { courses } from '../classroom/classroom.schema.js';
import { schedules } from '../schedules/schedules.schema.js';
import { people } from '../people/people.schema.js';

export const dataQualityRouter = Router();

dataQualityRouter.get(
  '/',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_q, r) => {
    const [allCourses, allSchedules, allPeople] = await Promise.all([
      db.select().from(courses),
      db.select().from(schedules),
      db.select().from(people)
    ]);

    const issues: any[] = [];
    let goodRoster = 0;
    let mapped = 0;

    for (const c of allCourses) {
      if (c.rosterStatus === 'COMPLETE') goodRoster++;
      else issues.push({ type: 'ROSTER', severity: 'WARNING', entity: c.id, message: 'Roster chưa COMPLETE' });
      if (c.classId) mapped++;
      else issues.push({ type: 'CLASS_MAPPING', severity: 'WARNING', entity: c.id, message: 'Classroom chưa mapping lớp' });
    }

    for (const s of allSchedules) {
      if (!s.courseId) issues.push({ type: 'SCHEDULE_COURSE', severity: 'WARNING', entity: s.id, message: 'TKB thiếu courseId' });
      if (!s.meetingCode && !s.spaceName) issues.push({ type: 'SCHEDULE_MEET', severity: 'INFO', entity: s.id, message: 'TKB thiếu Meet' });
    }

    const completeness = allCourses.length ? Math.round((goodRoster / allCourses.length) * 100) : 0;
    const coverage = allCourses.length ? Math.round((mapped / allCourses.length) * 100) : 0;
    const consistency = Math.max(0, 100 - Math.min(issues.length * 3, 100));
    const score = Math.round((completeness + coverage + (allPeople.length ? 100 : 0) + consistency) / 4);

    r.json({
      score,
      components: { completeness, coverage, directory: allPeople.length ? 100 : 0, consistency },
      issues
    });
  })
);
