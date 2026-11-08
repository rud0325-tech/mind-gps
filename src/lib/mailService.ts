import { collection, doc, documentId, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, startAfter, where } from 'firebase/firestore';
import { ensureStudentUser, getLiveFirebase, getTeacherFirebase } from './firebase';
import { DATA_MODE, GOOGLE_SCRIPT_URL } from './runtimeConfig';
import { requireTeacher, type TeacherSession } from './teacherAuth';
import { withOperationDeadline } from './operationDeadline';
import type { MailDelivery } from './mailStatus';

/** Rules compare this address to the Google token's verified email; no free-text recipient. */
export async function saveTeacherAlertProfile(teacher: TeacherSession): Promise<void> {
  if (DATA_MODE === 'demo') return;
  if (!teacher.email) throw new Error('알림을 받을 Google 이메일을 확인하지 못했어요. 다시 로그인해 주세요.');
  await withOperationDeadline(setDoc(doc(getTeacherFirebase().db, 'teacherAlertProfiles', teacher.uid), {
    email: teacher.email, updatedAt: serverTimestamp(),
  }));
}

export const mailConfigured = () => /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(GOOGLE_SCRIPT_URL);

/** A no-cors response is never treated as proof of sending. The receipt is in Firestore. */
export async function dispatchMail(id: string, options: { teacher?: boolean; allowDuplicate?: boolean } = {}): Promise<'requested' | 'not-configured' | 'connection-failed'> {
  if (DATA_MODE === 'demo' || !mailConfigured()) return 'not-configured';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    if (options.teacher) await requireTeacher();
    const user = options.teacher ? getTeacherFirebase().auth.currentUser : await ensureStudentUser();
    if (!user) throw new Error('로그인 정보 없음');
    const idToken = await user.getIdToken();
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST', mode: 'no-cors', credentials: 'omit', redirect: 'follow', signal: controller.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ recordId: id, idToken, retry: !!options.teacher, allowDuplicate: !!options.allowDuplicate }),
    });
    return 'requested';
  } catch { return 'connection-failed'; }
  finally { clearTimeout(timer); }
}

export function subscribeMailReceipt(id: string, callback: (delivery: MailDelivery | null) => void, onError?: () => void): () => void {
  if (DATA_MODE === 'demo') return () => undefined;
  return onSnapshot(doc(getLiveFirebase().db, 'mailDeliveries', id), { includeMetadataChanges: true }, snapshot => {
    if (snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache) return;
    callback(snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as MailDelivery : null);
  }, () => onError?.());
}

/** An independent oldest-first queue: new ordinary records cannot hide old failed alerts. */
export function subscribeOpenMail(classId: string, callback: (deliveries: MailDelivery[]) => void, onError: (error: Error) => void, after?: MailDelivery): () => void {
  if (DATA_MODE === 'demo') { callback([]); return () => undefined; }
  return onSnapshot(query(collection(getTeacherFirebase().db, 'mailDeliveries'),
    where('classId', '==', classId), where('closed', '==', false), orderBy('createdAt', 'asc'), orderBy(documentId()),
    ...(after ? [startAfter(after.createdAt, after.id)] : []), limit(100)), { includeMetadataChanges: true },
  snapshot => {
    if (snapshot.metadata.fromCache) { onError(new Error('서버의 최신 알림을 확인하고 있어요. 연결이 끊겼다면 마지막 화면만으로 발송 여부를 판단하지 마세요.')); return; }
    callback(snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as MailDelivery));
  },
  () => onError(new Error('긴급 알림 목록을 확인하지 못했어요. 인터넷 연결과 알림 색인·권한을 확인해 주세요.')));
}

export function subscribeMailHealth(callback: (value: { checkedAt: any; remainingRecipients: number; protectionCap: number } | null) => void): () => void {
  if (DATA_MODE === 'demo') return () => undefined;
  return onSnapshot(doc(getTeacherFirebase().db, 'mailServiceHealth', 'current'), { includeMetadataChanges: true }, snapshot => {
    if (!snapshot.metadata.fromCache) callback(snapshot.exists() ? snapshot.data() as any : null);
  }, () => callback(null));
}
