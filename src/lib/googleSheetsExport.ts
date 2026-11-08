import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { getTeacherFirebase } from './firebase';
import { requireTeacher, teacherSignInErrorMessage } from './teacherAuth';
import { DATA_MODE, USE_FIREBASE_EMULATOR } from './runtimeConfig';
import { buildGoogleSheetsReport, type SheetsReportOptions } from './googleSheetsReport';

export const REPORT_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export class SheetsExportError extends Error {
  constructor(message: string, readonly uncertain = false) { super(message); }
}

/** One create request: do not retry ambiguous writes and accidentally create extra reports. */
export async function createSheetsSnapshot(token: string, body: ReturnType<typeof buildGoogleSheetsReport>, request: typeof fetch = fetch): Promise<string> {
  let response: Response;
  try {
    response = await request('https://sheets.googleapis.com/v4/spreadsheets?fields=spreadsheetId', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new SheetsExportError('보고서 생성 여부를 확인하지 못했어요. 중복 생성을 피하려면 먼저 내 Google Drive에서 방금 만든 마음GPS 보고서가 있는지 확인해 주세요.', true);
  }
  if (!response.ok) {
    let reason = '';
    try { const data = await response.json(); reason = data?.error?.details?.find((item: { reason?: string }) => item.reason)?.reason ?? ''; } catch { /* Never expose raw API responses. */ }
    if (reason === 'SERVICE_DISABLED') throw new SheetsExportError('Google Sheets API 연결 설정이 필요해요. 운영 담당자에게 Google Cloud의 마음GPS 프로젝트에서 Google Sheets API를 사용 설정해 달라고 알려 주세요.');
    if (response.status === 401 || response.status === 403) throw new SheetsExportError('보고서 생성 권한이 없어요. 교사 로그인과 같은 계정을 선택하고, 마음GPS가 만드는 Drive 파일에 대한 접근을 허용해 주세요. 학교 계정은 관리자 정책 확인이 필요할 수 있어요.');
    if (response.status === 429) throw new SheetsExportError('잠시 Google 요청 한도에 도달했어요. 1분 뒤 다시 눌러 주세요. 유료 전환은 필요하지 않아요.');
    throw new SheetsExportError(response.status >= 500 ? 'Google 응답이 불확실해요. 다시 만들기 전에 내 Drive에 보고서가 생겼는지 확인해 주세요.' : '보고서를 만들지 못했어요. 선택한 기록과 연결 설정을 확인해 주세요.', response.status >= 500);
  }
  let id: unknown;
  try { id = (await response.json()).spreadsheetId; } catch { /* Handle incomplete success as an uncertain write. */ }
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) throw new SheetsExportError('생성 결과를 확인하지 못했어요. 내 Drive에서 마음GPS 보고서를 확인해 주세요.', true);
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

/** Tokens live only in this call. No full-Drive scope, stored token, service key or sharing request. */
export async function exportTeacherSheets(teacherUid: string, options: SheetsReportOptions): Promise<string> {
  if (DATA_MODE === 'demo' || USE_FIREBASE_EMULATOR) throw new SheetsExportError('체험 모드에서는 Google Drive에 저장하지 않아요. 실제 앱에서 교사로 로그인해 사용해 주세요.');
  const auth = getTeacherFirebase().auth;
  const user = auth.currentUser;
  if (!user || user.uid !== teacherUid || user.isAnonymous) throw new SheetsExportError('먼저 교사로 다시 로그인해 주세요.');
  const provider = new GoogleAuthProvider();
  provider.addScope(REPORT_DRIVE_SCOPE);
  provider.setCustomParameters({ login_hint: user.email ?? '', prompt: 'select_account' });
  // Start the popup directly in the click event, before network awaits, for Safari.
  let result;
  try { result = await reauthenticateWithPopup(user, provider); }
  catch (error) {
    if ((error as { code?: string })?.code === 'auth/user-mismatch') throw new SheetsExportError('교사로 로그인한 계정과 같은 Google 계정을 선택해 주세요. 다른 계정에는 보고서를 저장하지 않았어요.');
    throw new SheetsExportError(teacherSignInErrorMessage(error, 'popup'));
  }
  const teacher = await requireTeacher();
  if (teacher.uid !== teacherUid || auth.currentUser?.uid !== teacherUid || result.user.uid !== teacherUid) throw new SheetsExportError('교사 계정이 바뀌어 저장을 멈췄어요. 다시 로그인해 주세요.');
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if (!token) throw new SheetsExportError('Google Drive 접근 승인이 완료되지 않았어요. 다시 시도해 주세요.');
  return createSheetsSnapshot(token, buildGoogleSheetsReport(options));
}
