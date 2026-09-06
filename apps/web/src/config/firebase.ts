import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { env } from './env';

export const hasValidFirebaseConfig = Boolean(
  env.VITE_FIREBASE_API_KEY &&
  env.VITE_FIREBASE_API_KEY.length > 10 &&
  !env.VITE_FIREBASE_API_KEY.includes('Dummy') &&
  !env.VITE_FIREBASE_API_KEY.includes('LocalDev')
);

const app = getApps().length > 0
  ? getApps()[0]
  : initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyDummyKeyPlaceholder',
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'thcs-giangvo.firebaseapp.com',
      projectId: env.VITE_FIREBASE_PROJECT_ID || 'thcs-giangvo',
      appId: env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef'
    });

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();