import { doc, getDocFromServer } from 'firebase/firestore';
import { ensureStudentUser, firebaseTarget, getLiveFirebase, isFirebaseConfigured } from './firebase';
import { withOperationDeadline } from './operationDeadline';

/** Must match the rulesVersion block in firestore.rules. */
export const RULES_VERSION = 'mindgps-2026-10-12';

export interface SetupCheck {
  key: 'config' | 'anonymous' | 'rules';
  label: string;
  ok: boolean;
  detail: string;
}

const codeOf = (error: unknown) => error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : '';

/**
 * What the owner can check without signing in: the connection file, anonymous sign-in for
 * student records, and whether this app's own firestore.rules are the ones deployed.
 */
export async function runSetupChecks(): Promise<SetupCheck[]> {
  if (!isFirebaseConfigured) {
    return [{ key: 'config', label: '기록 저장소 연결 정보', ok: false, detail: 'firebase-applet-config.json이 비어 있어요. AI Studio에서 Firebase를 연결해 주세요.' }];
  }
  const checks: SetupCheck[] = [
    { key: 'config', label: '기록 저장소 연결 정보', ok: true, detail: `프로젝트 ${firebaseTarget.projectId} · 데이터베이스 ${firebaseTarget.databaseId}` },
  ];
  try {
    await withOperationDeadline(ensureStudentUser());
    checks.push({ key: 'anonymous', label: '학생 기록용 익명 로그인', ok: true, detail: '켜져 있어요.' });
  } catch (error) {
    const code = codeOf(error);
    checks.push({
      key: 'anonymous', label: '학생 기록용 익명 로그인', ok: false,
      detail: code === 'auth/admin-restricted-operation' || code === 'auth/operation-not-allowed'
        ? 'Firebase 콘솔의 Authentication → 로그인 방법에서 ‘익명’을 사용 설정해 주세요.'
        : `익명 로그인을 확인하지 못했어요.${code ? ` (${code})` : ''}`,
    });
    return checks;
  }
  try {
    await withOperationDeadline(getDocFromServer(doc(getLiveFirebase().db, 'rulesVersion', RULES_VERSION)));
    checks.push({ key: 'rules', label: '보안 규칙 연결 확인', ok: true, detail: '연결 확인용 경로를 읽을 수 있어요. 전체 보안 규칙의 안전성이나 배포 일치는 별도 검증이 필요해요.' });
  } catch (error) {
    const code = codeOf(error);
    checks.push({
      key: 'rules', label: '보안 규칙 연결 확인', ok: false,
      detail: code === 'permission-denied'
        ? '데이터베이스에 배포된 보안 규칙이 이 앱의 firestore.rules와 달라요. firestore.rules를 그대로 배포해 주세요.'
        : `보안 규칙을 확인하지 못했어요.${code ? ` (${code})` : ' 연결 상태를 확인해 주세요.'}`,
    });
  }
  return checks;
}
