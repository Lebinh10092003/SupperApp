import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { env } from '../config/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { localDb } from './localStore.js';

export interface ServiceAccountMetadata {
  path: string;
  projectId: string;
  clientEmail: string;
}

export function resolveServiceAccount(): { path: string; data: any } | null {
  const candidatePaths = [
    env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(process.cwd(), 'service-account.json'),
    path.resolve(process.cwd(), 'apps/api/service-account.json'),
    path.resolve(process.cwd(), 'firebase-service-account.json'),
    path.resolve(process.cwd(), '..', 'service-account.json')
  ].filter(Boolean) as string[];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.type === 'service_account' || parsed.private_key) {
          return { path: p, data: parsed };
        }
      } catch {}
    }
  }
  return null;
}

const sa = resolveServiceAccount();

if (!getApps().length) {
  if (sa) {
    initializeApp({
      credential: cert(sa.data),
      projectId: sa.data.project_id || env.PROJECT_ID
    });
  } else {
    initializeApp({
      credential: applicationDefault(),
      projectId: env.PROJECT_ID
    });
  }
}

export const isLiveFirestore = Boolean(sa);

export const db = getFirestore();
export const adminAuth = getAuth();
export const schoolRef = () => db.collection('siSchools').doc(env.SCHOOL_ID);
export const col = (name: string): any => {
  if (isLiveFirestore) {
    return schoolRef().collection(name);
  }
  return localDb.collection(name);
};

export const createBatch = (): any => {
  if (isLiveFirestore) {
    return schoolRef().firestore.batch();
  }
  return localDb.batch();
};

export const serviceAccountInfo: ServiceAccountMetadata | null = sa
  ? {
      path: sa.path,
      projectId: sa.data.project_id || env.PROJECT_ID,
      clientEmail: sa.data.client_email || ''
    }
  : null;

