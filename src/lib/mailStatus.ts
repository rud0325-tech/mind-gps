import type { ActivityRecord } from '../types';

export type MailState = 'pending' | 'sending' | 'sent' | 'failed' | 'quota' | 'unknown';
export interface MailDelivery {
  id: string;
  classId: string;
  createdBy: string;
  status: MailState;
  createdAt: any;
  updatedAt: any;
  nextAttemptAt?: any;
  attempts: number;
  reason: string;
  supportResolved: boolean;
  closed: boolean;
  learnerCode?: string | null;
  deviceLabel?: string;
  sentAt?: any;
  deduplicated?: boolean;
}

export const MAIL_STATUS_LABELS: Record<MailState, string> = {
  pending: '발송 대기', sending: '발송 처리 중', sent: '발송 요청 성공',
  failed: '발송 실패', quota: '무료 발송 한도 부족', unknown: '발송 결과 확인 필요',
};

/** Positive/calm strength 5 is NOT an emergency. */
export function requiresMail(record: Pick<ActivityRecord, 'recordKind' | 'helpRequested' | 'emotion' | 'intensity' | 'afterEmotion' | 'afterIntensity'>): boolean {
  const negative = (emotion: unknown, level: unknown) => ['속상해요', '화가나요', '힘들어요'].includes(String(emotion)) && level === 5;
  return record.helpRequested || record.recordKind === 'help'
    || negative(record.emotion, record.intensity) || negative(record.afterEmotion, record.afterIntensity);
}

export function mailFeedback(state: MailState | 'not-configured' | 'connection-failed'): string {
  if (state === 'failed' || state === 'quota' || state === 'not-configured' || state === 'connection-failed') {
    return '선생님께 도움을 요청했어요. 가까운 선생님께도 직접 알려 주세요.';
  }
  return '선생님께 도움을 요청했어요. 잠시만 기다려 주세요.';
}
