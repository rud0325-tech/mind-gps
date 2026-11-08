import { doc, getDocFromServer, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import type { DeviceRegistration } from '../types';
import { ensureStudentUser, getLiveFirebase } from './firebase';
import { DATA_MODE } from './runtimeConfig';
import { withOperationDeadline } from './operationDeadline';
import { allowsSelfSelection, identityForDevice, type LearningIdentity } from './learningIdentity';

/** Freeze a server-validated identity BEFORE allowing the first student response. */
export async function beginLearningSession(sessionId: string, demoDevice: DeviceRegistration | null, options: { purpose?: 'learning' | 'help'; learnerCode?: string } = {}): Promise<LearningIdentity> {
  if (DATA_MODE === 'demo') { const identity = identityForDevice(demoDevice); return options.learnerCode && allowsSelfSelection(demoDevice) ? {...identity, learnerCode:options.learnerCode, identifiedBy:'symbol'} : identity; }
  return withOperationDeadline((async () => {
    const user = await ensureStudentUser();
    const { db } = getLiveFirebase();
    const snapshot = await getDocFromServer(doc(db, 'devices', user.uid));
    if (!snapshot.exists()) throw new Error('선생님께 이 기기의 등록을 부탁해 주세요. 학생은 계정이나 코드를 입력하지 않아요.');
    const data = snapshot.data();
    const device = { ...data, deviceId: user.uid, activeUntil: data.activeUntil?.toMillis?.() ?? null } as DeviceRegistration;
    let identity = identityForDevice(device);
    if (options.learnerCode) {
      if (!allowsSelfSelection(device)) throw new Error('선생님이 정한 학생으로 시작해 주세요.');
      const selected = await getDocFromServer(doc(db, 'classes', identity.classId!, 'students', options.learnerCode));
      if (!selected.exists() || selected.data().active !== true) throw new Error('학생 표시를 다시 확인해 주세요.');
      identity = {...identity, learnerCode:options.learnerCode, identifiedBy:'symbol'};
    }
    if (options.purpose !== 'help' && !identity.learnerCode) throw new Error('선생님이 준비하고 있어요. 잠시 기다려 주세요.');
    if (!identity.teacherUid) throw new Error('선생님께 수업 시작을 다시 눌러 달라고 부탁해 주세요.');
    await setDoc(doc(db, 'learningSessions', `${user.uid}_${sessionId}`), {
      ...identity, purpose:options.purpose ?? 'learning', deviceId: user.uid, sessionId, createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 4 * 60 * 60 * 1000),
    });
    return identity;
  })());
}
