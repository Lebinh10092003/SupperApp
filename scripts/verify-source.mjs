import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'apps/web/src/features/dashboard/DashboardPage.tsx',
  'apps/api/src/server.ts',
  'apps/api/src/modules/classroom/classroom.service.ts',
  'apps/api/src/modules/meet/meet.service.ts',
  'apps/api/src/modules/schedules/schedules.routes.ts',
  'firestore/rules.fragment',
];
const errors = required.filter((f) => !fs.existsSync(path.join(root, f))).map((f) => `Missing: ${f}`);
for (const f of ['package.json','apps/api/package.json','apps/web/package.json','firebase.json','firestore/indexes.fragment.json']) {
  try { JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); }
  catch { errors.push(`Invalid JSON: ${f}`); }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('PASS: source structure verified');
