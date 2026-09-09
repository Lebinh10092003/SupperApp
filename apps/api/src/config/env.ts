import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PROJECT_ID: z.string().min(1).default('si-giang-vo'),
  REGION: z.string().default('asia-southeast1'),
  SCHOOL_ID: z.string().default('giang-vo'),
  SCHOOL_NAME: z.string().default('Trường THCS Giảng Võ'),
  WORKSPACE_DOMAIN: z.string().default(''),
  WORKSPACE_ADMIN_SUBJECT: z.string().default(''),
  DWD_SERVICE_ACCOUNT_EMAIL: z.string().default(''),
  BOOTSTRAP_ADMIN_EMAILS: z.string().default(''),
  BOOTSTRAP_SUPER_ADMIN_EMAILS: z.string().default('09.levanbinh2003@gmail.com'),
  BOOTSTRAP_SUPER_ADMIN_DOMAINS: z.string().default(''),
  TEACHER_OU_PREFIXES: z.string().default(''),
  STUDENT_OU_PREFIXES: z.string().default(''),
  CLASSROOM_TOPIC: z.string().default(''),
  MEET_TOPIC: z.string().default(''),
  PUBSUB_PUSH_AUDIENCE: z.string().default(''),
  PUBSUB_PUSH_SERVICE_ACCOUNT: z.string().default(''),
  GOOGLE_OAUTH_CLIENT_ID: z.string().default(''),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().default(''),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().default('http://localhost:5173/oauth/callback'),
  CLASSROOM_OAUTH_CLIENT_ID_SECRET: z.string().default('si-classroom-oauth-client-id'),
  CLASSROOM_OAUTH_CLIENT_SECRET_SECRET: z.string().default('si-classroom-oauth-client-secret'),
  CLASSROOM_OAUTH_REFRESH_TOKEN_SECRET: z.string().default('si-classroom-oauth-refresh-token'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  API_BASE_URL: z.string().default('http://localhost:8080'),
  PORT: z.coerce.number().default(8080),
  GOOGLE_SERVICE_ACCOUNT_KEY_PATH: z.string().default(''),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().default(''),

  // Postgres cho các module viết lại từ Firebase (An toàn trường học, Lịch
  // công tác). Mỗi trường 1 deployment + 1 database riêng — KHÔNG có khái
  // niệm multi-tenant/chọn schema động ở đây. Xem apps/api/src/core/db/.
  DATABASE_URL: z.string().default('postgres://postgres@localhost:5432/postgres'),
  DATABASE_POOL_MIN: z.coerce.number().default(0),
  DATABASE_POOL_MAX: z.coerce.number().default(10)
});

export const env = schema.parse(process.env);

// Hợp nhất bootstrap emails & super admin emails
export const bootstrapSuperAdminEmails = new Set(
  `${env.BOOTSTRAP_SUPER_ADMIN_EMAILS},${env.BOOTSTRAP_ADMIN_EMAILS}`
    .split(',')
    .map(x => x.trim().toLowerCase())
    .filter(Boolean)
);

export const bootstrapSuperAdminDomains = new Set(
  env.BOOTSTRAP_SUPER_ADMIN_DOMAINS
    .split(',')
    .map(x => x.trim().toLowerCase())
    .filter(Boolean)
);

export const bootstrapEmails = bootstrapSuperAdminEmails;
export const teacherOUs = env.TEACHER_OU_PREFIXES.split(',').map(x => x.trim()).filter(Boolean);
export const studentOUs = env.STUDENT_OU_PREFIXES.split(',').map(x => x.trim()).filter(Boolean);

