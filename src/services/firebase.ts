import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  type Firestore,
  type FirestoreSettings,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

type ExtendedFirestoreSettings = FirestoreSettings & {
  useFetchStreams?: boolean;
};

function initFirestoreDb(firebaseApp: FirebaseApp): Firestore {
  const databaseId = firebaseConfig.firestoreDatabaseId || undefined;
  const settings: ExtendedFirestoreSettings = {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
    ignoreUndefinedProperties: true,
  };
  try {
    return initializeFirestore(firebaseApp, settings, databaseId);
  } catch {
    return databaseId ? getFirestore(firebaseApp, databaseId) : getFirestore(firebaseApp);
  }
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = initFirestoreDb(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function checkFirestoreRestReachability(): Promise<boolean> {
  try {
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseConfig.projectId
    )}/databases/${encodeURIComponent(dbId)}/documents/test/connection?key=${encodeURIComponent(
      firebaseConfig.apiKey
    )}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    return res.ok || res.status === 401 || res.status === 403;
  } catch {
    return false;
  }
}

let connectionTested = false;
let connectionCheckPromise: Promise<boolean> | null = null;
export async function validateFirestoreConnection(): Promise<boolean> {
  if (connectionTested) return true;
  if (connectionCheckPromise) return connectionCheckPromise;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  connectionCheckPromise = (async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      connectionTested = true;
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        const restReachable = await checkFirestoreRestReachability();
        if (!restReachable) {
          console.error('Please check your Firebase configuration.');
        }
        return restReachable;
      }
      connectionTested = true;
      return true; // permission denied on test/connection still confirms online reachability
    } finally {
      connectionCheckPromise = null;
    }
  })();

  return connectionCheckPromise;
}
