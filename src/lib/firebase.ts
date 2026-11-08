import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import {
  browserPopupRedirectResolver, browserSessionPersistence, connectAuthEmulator, getAuth, initializeAuth, signInAnonymously,
  type Auth, type User,
} from 'firebase/auth';
import appletConfig from '../../firebase-applet-config.json';
import { DATA_MODE, USE_FIREBASE_EMULATOR } from './runtimeConfig';

// A build made with VITE_FIREBASE_EMULATOR=true only ever reaches local emulators, never a real project.
const EMULATOR_CONFIG = {
  projectId: 'demo-mindgps', appId: 'demo-mindgps-app', apiKey: 'demo-api-key',
  authDomain: 'demo-mindgps.firebaseapp.com', firestoreDatabaseId: '(default)',
};
const firebaseConfig = USE_FIREBASE_EMULATOR ? EMULATOR_CONFIG : appletConfig;

/** firebase-applet-config.json stays blank until Firebase is connected in AI Studio. */
export const isFirebaseConfigured = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey && firebaseConfig.appId);
export const FIREBASE_NOT_CONNECTED = '아직 기록 저장소(Firebase)가 연결되지 않아 기록을 저장할 수 없어요. 운영 담당자에게 알려 주세요.';
export const firebaseTarget = { projectId: firebaseConfig.projectId, databaseId: firebaseConfig.firestoreDatabaseId || '(default)' };

type Services = { db: Firestore; auth: Auth };
let studentServices: Services | undefined;
let teacherServices: Services | undefined;
let anonymousSignIn: Promise<User> | undefined;

function requireLive() {
  if (DATA_MODE !== 'live') {
    throw new Error('체험 모드에서는 외부 데이터 연결을 사용하지 않습니다.');
  }
  if (!isFirebaseConfigured) throw new Error(FIREBASE_NOT_CONNECTED);
}

function firestoreFor(app: FirebaseApp): Firestore {
  const db = getFirestore(app, firebaseTarget.databaseId);
  if (USE_FIREBASE_EMULATOR) connectFirestoreEmulator(db, '127.0.0.1', Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080));
  return db;
}

function emulated(auth: Auth): Auth {
  if (USE_FIREBASE_EMULATOR) connectAuthEmulator(auth, `http://127.0.0.1:${Number(import.meta.env.VITE_AUTH_EMULATOR_PORT || 9099)}`, { disableWarnings: true });
  return auth;
}

/** Student writes use a long-lived anonymous identity that teacher sign-in never replaces. */
export function getLiveFirebase(): Services {
  requireLive();
  if (!studentServices) {
    const app = initializeApp(firebaseConfig);
    studentServices = { db: firestoreFor(app), auth: emulated(getAuth(app)) };
  }
  return studentServices;
}

/**
 * Teachers sign in on a separate app whose session ends with the tab, so a shared
 * classroom tablet never reopens a teacher's records after the teacher walks away.
 */
export function getTeacherFirebase(): Services {
  requireLive();
  if (!teacherServices) {
    const app = initializeApp(firebaseConfig, 'teacher');
    teacherServices = {
      db: firestoreFor(app),
      auth: emulated(initializeAuth(app, { persistence: browserSessionPersistence, popupRedirectResolver: browserPopupRedirectResolver })),
    };
  }
  return teacherServices;
}

export async function ensureStudentUser(): Promise<User> {
  const { auth } = getLiveFirebase();
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  if (!anonymousSignIn) {
    anonymousSignIn = signInAnonymously(auth)
      .then(result => result.user)
      .finally(() => { anonymousSignIn = undefined; });
  }
  return anonymousSignIn;
}
