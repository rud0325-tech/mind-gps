import { useEffect, useState } from 'react';
import type { RosterStudent } from '../types';
import { dispatchMail, mailConfigured, subscribeOpenMail, subscribeMailHealth } from '../lib/mailService';
import { MAIL_STATUS_LABELS, type MailDelivery } from '../lib/mailStatus';
import { updateRecordStatus } from '../lib/activityService';

const reasons: Record<string, string> = {
  queued: '서버 처리 전', quota: '남은 무료 발송 한도가 없어요', daily_cap: '하루 보호 한도에 도달했어요',
  recipient_missing: '교사 이메일 등록을 확인해 주세요', teacher_inactive: '수업 교사의 승인·담당 반을 확인해 주세요',
  send_uncertain: '메일함 확인 후 재발송 여부를 정해 주세요', lease_expired: '처리 도중 연결이 끊겨 결과 확인이 필요해요',
  server_error: '서버 연결을 확인해 주세요', sent: '수신함 도착·읽음까지 확인한 상태는 아니에요',
  deduplicated: '같은 활동 단계의 강도 5 알림을 이미 발송 요청했어요',
};
const buttonClass = 'min-h-11 rounded-xl border border-slate-300 bg-white px-4 font-bold disabled:opacity-50';
const date = (value: any) => value?.seconds ? new Date(value.seconds * 1000).toLocaleString('ko-KR') : '처리 시각 확인 중';

export default function TeacherAlerts({ classId, roster, demo }: { classId: string; roster: RosterStudent[]; demo: boolean }) {
  const [rows, setRows] = useState<MailDelivery[]>([]);
  const [cursors, setCursors] = useState<MailDelivery[]>([]);
  const [health, setHealth] = useState<{ checkedAt: any; remainingRecipients: number; protectionCap: number } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => subscribeMailHealth(setHealth), []);
  useEffect(() => { setCursors([]); }, [classId]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    setRows([]); setError(''); setNotice(''); setLoading(true);
    if (!classId || demo) return;
    return subscribeOpenMail(classId, items => { setRows(items); setMore(items.length === 100); setLoading(false); setError(''); }, problem => { setError(problem.message); setLoading(false); }, cursors[cursors.length - 1]);
  }, [classId, demo, cursors]);
  const visible = rows;
  const run = async (id: string, action: () => Promise<void>) => {
    setBusy(id); setError(''); setNotice('');
    try { await action(); } catch { setError('처리 결과를 확인하지 못했어요. 인터넷과 교사 권한을 확인해 주세요.'); }
    finally { setBusy(''); }
  };
  return <section aria-label="긴급 알림과 메일 발송 확인" className="space-y-3 rounded-3xl border-2 border-blue-200 bg-white p-5">
    <h2 className="text-xl font-bold">긴급 알림 · 이메일 확인</h2>
    <p className="text-sm text-slate-600">부정적인 감정 5단계와 도움 요청을 별도로 모읍니다. 학생 지원을 확인하고 메일 발송 요청도 성공한 항목만 이 목록에서 빠집니다. 일반 기록의 최근 100건 제한과 무관해요.</p>
    {!demo && !mailConfigured() && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-amber-950">즉시 메일 연결 주소가 아직 설정되지 않았어요. 배포 전에 Apps Script 연결과 발송 검증이 필요해요.</p>}
    <p className="text-sm">이메일은 수업을 시작한 교사의 Google 로그인 주소로 보냅니다. 무료 한도를 초과해도 유료 발송으로 전환하지 않아요.</p>
    {demo && <p className="rounded-xl bg-slate-50 p-3">체험 화면에서는 실제 이메일을 보내지 않아요.</p>}
    {(error || notice) && <p role={error ? 'alert' : 'status'} className="rounded-xl bg-amber-50 p-3">{error || notice}</p>}
    {!demo && <p className="text-sm">{health ? `재시도 서버 확인: ${date(health.checkedAt)} · 확인 당시 Gmail 잔여 발송 ${health.remainingRecipients}명 · 이 앱의 하루 보호 한도 ${health.protectionCap}명` : '재시도 서버의 실행 상태를 아직 확인하지 못했어요.'}</p>}
    {!demo && health && Date.now() - (health.checkedAt?.seconds ?? 0) * 1000 > 20 * 60000 && <p role="alert" className="rounded-xl bg-amber-50 p-3">재시도 서버의 최근 실행을 확인하지 못했어요. Apps Script 실행·할당량을 확인해 주세요.</p>}
    {loading && !demo && <p role="status">최신 알림을 확인하고 있어요.</p>}
    {!demo && !loading && !error && !visible.length && <p>{cursors.length ? '이 페이지에 남아 있는 알림이 없어요. 앞 페이지도 확인해 주세요.' : '남아 있는 알림이 없어요.'}</p>}
    {visible.map(item => <article key={item.id} className="space-y-2 rounded-2xl border border-slate-200 p-4">
      <p className="font-bold">{roster.find(student => student.code === item.learnerCode)?.alias ?? item.learnerCode ?? '학생 확인 중 / 미지정'} · {item.deviceLabel ?? '기기 확인 중'}</p>
      <p><strong>{MAIL_STATUS_LABELS[item.status]}</strong> · {item.supportResolved ? '학생 지원 확인함' : '학생 지원 확인 필요'}</p>
      <p className="text-sm">{reasons[item.reason] ?? '발송 결과를 확인하고 있어요'} · 시도 {item.attempts}회</p>
      <p className="text-sm text-slate-600">요청 {date(item.createdAt)}{item.sentAt ? ` · 발송 요청 ${date(item.sentAt)}` : ''}</p>
      {(item.status === 'pending' || item.status === 'sending') && <p className="text-sm text-amber-900">대기가 길어지면 서버 연결·재시도 실행 여부를 확인하고 학생에게 직접 도움을 제공해 주세요.</p>}
      <div className="flex flex-wrap gap-2">
        {!item.supportResolved && <button className={buttonClass} disabled={!!busy} onClick={() => void run(item.id, async () => {
          await updateRecordStatus(item.id, '처리 완료'); setNotice('학생 지원을 확인했어요. 메일 실패 내역은 성공 확인 전까지 남아요.');
        })}>학생 지원 확인</button>}
        {item.status !== 'sent' && <button className={buttonClass} disabled={!!busy || !mailConfigured() || item.status === 'sending'} onClick={() => {
          if (item.status === 'unknown' && confirmed !== item.id) { setConfirmed(item.id); return; }
          void run(item.id, async () => {
            const result = await dispatchMail(item.id, { teacher: true, allowDuplicate: item.status === 'unknown' });
            setNotice(result === 'requested' ? '서버에 재시도를 요청했어요. 목록의 실제 발송 결과를 확인해 주세요.' : '재시도 요청이 전달되지 않았어요.'); setConfirmed(null);
          });
        }}>메일 처리 다시 요청</button>}
      </div>
      {confirmed === item.id && <p role="alert" className="rounded-xl bg-amber-50 p-3">이미 발송됐을 수도 있어요. 교사 메일함을 확인해 주세요. 다시 누르면 중복 메일 가능성을 확인한 뒤 재발송을 요청합니다. <button className={buttonClass} onClick={() => setConfirmed(null)}>취소</button></p>}
    </article>)}
    <div className="flex flex-wrap gap-2">
      {cursors.length > 0 && <button className={buttonClass} onClick={() => setCursors(items => items.slice(0, -1))}>이전 알림 100건</button>}
      {more && visible.length > 0 && <button className={buttonClass} disabled={!!busy || loading} onClick={() => setCursors(items => [...items, visible[visible.length - 1]])}>다음 알림 100건</button>}
    </div>
  </section>;
}
