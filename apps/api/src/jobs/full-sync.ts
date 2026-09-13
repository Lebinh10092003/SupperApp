import 'dotenv/config';
import { db } from '../core/db/client.js';
import { syncRuns } from '../modules/classroom/classroom.schema.js';
import { syncDirectory, teacherEmails } from '../modules/directory/directory.service.js';
import { syncAllCourses } from '../modules/classroom/classroom.service.js';
import { rebuildDashboard } from '../modules/dashboard/dashboard.service.js';
import { eq } from 'drizzle-orm';

const runId = `fullsync_${Date.now()}`;

try {
  await db.insert(syncRuns).values({ id: runId, type: 'FULL_SYNC', status: 'IN_PROGRESS' });
  const directory = await syncDirectory();
  const classroom = await syncAllCourses(await teacherEmails());
  await rebuildDashboard();
  await db
    .update(syncRuns)
    .set({ status: 'COMPLETED', note: JSON.stringify({ directory, classroom }), finishedAt: new Date() })
    .where(eq(syncRuns.id, runId));
} catch (e) {
  await db
    .update(syncRuns)
    .set({ status: 'FAILED', note: e instanceof Error ? e.message : String(e), finishedAt: new Date() })
    .where(eq(syncRuns.id, runId));
  process.exitCode = 1;
}
