import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { env } from './env.js';

let db: ReturnType<typeof getFirestore> | null = null;

export function getDb() {
  if (!env.isFirebaseConfigured()) {
    return null;
  }

  if (!db) {
    const app =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({
            apiKey: env.firebase.apiKey,
            authDomain: env.firebase.authDomain,
            projectId: env.firebase.projectId,
            storageBucket: env.firebase.storageBucket,
            messagingSenderId: env.firebase.messagingSenderId,
            appId: env.firebase.appId,
          });
    db = getFirestore(app);
  }

  return db;
}
