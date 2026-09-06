import { z } from 'zod';

const schema = z.object({
  VITE_FIREBASE_API_KEY: z.string().optional().default(''),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().optional().default('thcs-giangvo.firebaseapp.com'),
  VITE_FIREBASE_PROJECT_ID: z.string().optional().default('thcs-giangvo'),
  VITE_FIREBASE_APP_ID: z.string().optional().default(''),
  VITE_API_BASE_URL: z.string().optional().default(''),
  VITE_SCHOOL_ID: z.string().default('giang-vo'),
  VITE_SCHOOL_NAME: z.string().default('Trường THCS Giảng Võ')
});

export const env = schema.parse(import.meta.env || {});