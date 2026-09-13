import 'dotenv/config';
import { db } from '../core/db/client.js';
import { syncRuns } from '../modules/classroom/classroom.schema.js';

await db.insert(syncRuns).values({
  id: `renew_${Date.now()}`,
  type: 'RENEW_SUBSCRIPTIONS',
  status: 'DONE',
  note: 'Cấu hình Classroom Push/Meet subscriptions sau OAuth consent theo docs/DEPLOYMENT.md',
  finishedAt: new Date()
});
