import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { DATA_MODE, USE_FIREBASE_EMULATOR } from './runtimeConfig';
import { getTeacherFirebase, isFirebaseConfigured, FIREBASE_NOT_CONNECTED } from './firebase';

export interface TeacherSession {
  uid: string;
  email: string | null;
  /** The project owner also sees records from unregistered devices. */
  admin?: boolean;
}

/** Carries the account's UID so a new teacher can pass it to the owner, who approves it in Firebase. */
export class TeacherNotApprovedError extends Error {
  constructor(readonly uid: string) {
    super('Google 로그인은 됐지만 이 계정의 교사 승인이 아직 없어요. 아래 계정 번호를 운영 담당자에게 보내 승인을 요청해 주세요.');
    this.name = 'TeacherNotApprovedError';
  }
}

type TeacherListener = (teacher: TeacherSession | null) => void;
let demoTeacher: TeacherSession | null = null;
const demoListeners = new Set<TeacherListener>();

const popupErrorMessages: Record<string, string> = {
  'auth/popup-blocked': 'Google 로그인 창이 차단됐어요. 브라우저에서 팝업을 허용한 뒤 다시 눌러 주세요.',
  'auth/popup-closed-by-user': 'Google 로그인이 끝나기 전에 창이 닫혔어요. 로그인 버튼을 다시 눌러 주세요.',
  'auth/cancelled-popup-request': '다른 로그인 요청으로 창이 닫혔어요. 잠시 기다린 뒤 로그인 버튼을 한 번 눌러 주세요.',
  'auth/unauthorized-domain': '현재 앱 주소에서 Google 로그인이 허용되지 않았어요. 운영 담당자에게 앱 주소의 로그인 설정을 확인해 달라고 알려 주세요.',
  'auth/network-request-failed': 'Google 로그인 서비스에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.',
  'auth/operation-not-allowed': 'Google 로그인 방식이 활성화되지 않았어요. 운영 담당자에게 로그인 설정 확인을 요청해 주세요.',
  'auth/operation-not-supported-in-this-environment': '이 브라우저에서는 Google 로그인 창을 사용할 수 없어요. 일반 브라우저에서 앱을 열어 다시 시도해 주세요.',
  'auth/web-storage-unsupported': '로그인에 필요한 브라우저 저장 기능을 사용할 수 없어요. 브라우저 설정을 확인하거나 일반 브라우저에서 다시 시도해 주세요.',
  'auth/invalid-api-key': '앱의 로그인 연결 설정을 확인해야 해요. 운영 담당자에게 아래 오류 코드를 알려 주세요.',
  'auth/app-not-authorized': '앱의 로그인 연결 권한을 확인해야 해요. 운영 담당자에게 아래 오류 코드를 알려 주세요.',
  'auth/configuration-not-found': '앱의 로그인 설정을 찾지 못했어요. 운영 담당자에게 아래 오류 코드를 알려 주세요.',
  'auth/internal-error': 'Google 로그인 처리를 완료하지 못했어요. 다시 시도해도 같으면 운영 담당자에게 아래 오류 코드를 알려 주세요.',
};
const approvalErrorCodes = new Set(['permission-denied', 'unavailable', 'deadline-exceeded', 'unauthenticated', 'failed-precondition']);

/** Expose only an allowlisted SDK code, never raw messages, account data or tokens. */
export function teacherSignInErrorMessage(error: unknown, phase: 'popup' | 'approval'): string {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : '';
  if (phase === 'popup') {
    const message = Object.prototype.hasOwnProperty.call(popupErrorMessages, code) ? popupErrorMessages[code] : undefined;
    return message ? `${message} (${code})` : 'Google 로그인을 완료하지 못했어요. 로그인 창과 인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
  }
  const message = code === 'permission-denied'
    ? 'Google 로그인은 됐지만 교사 승인 정보를 읽을 수 없어요. 운영 담당자에게 데이터베이스 접근 설정 확인을 요청해 주세요.'
    : 'Google 로그인은 됐지만 교사 승인 정보를 확인하지 못했어요. 연결 상태를 확인하고, 계속되면 운영 담당자에게 문의해 주세요.';
  return approvalErrorCodes.has(code) ? `${message} (${code})` : message;
}

async function approvedTeacher(user: User | null): Promise<TeacherSession | null> {
  if (!user || user.isAnonymous) return null;
  const { db } = getTeacherFirebase();
  const approval = await getDocFromServer(doc(db, 'teachers', user.uid));
  return approval.exists() && approval.data().approved === true
    ? { uid: user.uid, email: user.email, admin: approval.data()?.admin === true } : null;
}

/** The Auth emulator accepts a made-up Google account, so local tests skip the real Google popup. */
function emulatorGoogleSignIn(auth: ReturnType<typeof getTeacherFirebase>['auth']) {
  const email = sessionStorage.getItem('emulatorTeacherEmail') ?? 'teacher@example.com';
  return signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })));
}

export async function signInTeacher(): Promise<TeacherSession> {
  if (DATA_MODE === 'demo') {
    demoTeacher = { uid: 'demo-teacher', email: null, admin: true };
    demoListeners.forEach(listener => listener(demoTeacher));
    return demoTeacher;
  }
  let auth: ReturnType<typeof getTeacherFirebase>['auth'];
  if (!isFirebaseConfigured) throw new Error(FIREBASE_NOT_CONNECTED);
  try {
    auth = getTeacherFirebase().auth;
  } catch {
    throw new Error('앱의 로그인 연결을 준비하지 못했어요. 운영 담당자에게 앱 설정 확인을 요청해 주세요.');
  }
  let user: User;
  try {
    // Always show the account chooser, so a Google account left signed in on a tablet is never used silently.
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = USE_FIREBASE_EMULATOR ? await emulatorGoogleSignIn(auth) : await signInWithPopup(auth, provider);
    user = result.user;
  } catch (error) {
    await signOut(auth).catch(() => undefined);
    throw new Error(teacherSignInErrorMessage(error, 'popup'));
  }
  let teacher: TeacherSession | null;
  try {
    teacher = await approvedTeacher(user);
  } catch (error) {
    await signOut(auth).catch(() => undefined);
    throw new Error(teacherSignInErrorMessage(error, 'approval'));
  }
  if (teacher) return teacher;
  await signOut(auth).catch(() => undefined);
  throw new TeacherNotApprovedError(user.uid);
}

export async function signOutTeacher(): Promise<void> {
  if (DATA_MODE === 'demo') {
    demoTeacher = null;
    demoListeners.forEach(listener => listener(null));
    return;
  }
  try {
    await signOut(getTeacherFirebase().auth);
  } catch {
    throw new Error('로그아웃하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.');
  }
}

export function subscribeTeacher(
  callback: TeacherListener,
  onError?: (error: Error) => void,
): () => void {
  if (DATA_MODE === 'demo') {
    demoListeners.add(callback);
    callback(demoTeacher);
    return () => { demoListeners.delete(callback); };
  }
  // Until Firebase is connected nobody can be signed in; the app must still open for the setup check.
  if (!isFirebaseConfigured) {
    callback(null);
    return () => undefined;
  }
  let revision = 0;
  let disposed = false;
  const unsubscribe = onAuthStateChanged(getTeacherFirebase().auth, async user => {
    const currentRevision = ++revision;
    // Clear a previous teacher's records while the new user's approval is checked.
    callback(null);
    try {
      const teacher = await approvedTeacher(user);
      if (!disposed && currentRevision === revision) callback(teacher);
    } catch {
      if (!disposed && currentRevision === revision) {
        onError?.(new Error('교사 접근 권한을 확인하지 못했어요.'));
      }
    }
  }, () => {
    if (!disposed) {
      revision++;
      callback(null);
      onError?.(new Error('로그인 상태를 확인하지 못했어요.'));
    }
  });
  return () => { disposed = true; revision++; unsubscribe(); };
}

export async function requireTeacher(): Promise<TeacherSession> {
  if (DATA_MODE === 'demo') {
    if (demoTeacher) return demoTeacher;
  } else {
    if (!isFirebaseConfigured) throw new Error(FIREBASE_NOT_CONNECTED);
    const { auth } = getTeacherFirebase();
    await auth.authStateReady();
    try {
      const teacher = await approvedTeacher(auth.currentUser);
      if (teacher) return teacher;
    } catch {
      throw new Error('교사 접근 권한을 확인하지 못했어요.');
    }
  }
  throw new Error('교사로 로그인한 뒤 사용할 수 있어요.');
}
