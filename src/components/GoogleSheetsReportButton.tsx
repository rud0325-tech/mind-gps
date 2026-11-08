import { useRef, useState } from 'react';
import { ExternalLink, Sheet } from 'lucide-react';
import { exportTeacherSheets, SheetsExportError } from '../lib/googleSheetsExport';
import type { SheetsReportOptions } from '../lib/googleSheetsReport';

export default function GoogleSheetsReportButton({ teacherUid, options, disabled = false, demo = false }: {
  teacherUid: string; options: SheetsReportOptions; disabled?: boolean; demo?: boolean;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; scope: string } | null>(null);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const create = async () => {
    if (disabled || pending.current || demo) return;
    pending.current = true; setBusy(true); setError(''); setUncertain(false); setResult(null);
    try {
      const url = await exportTeacherSheets(teacherUid, options);
      setResult({ url, scope: options.scope });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : '보고서를 만들지 못했어요. 다시 시도해 주세요.');
      setUncertain(problem instanceof SheetsExportError && problem.uncertain);
    } finally { pending.current = false; setBusy(false); }
  };
  return <div className="space-y-2">
    <button type="button" onClick={() => void create()} disabled={disabled || busy || demo || uncertain} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-40">
      <Sheet size={21} aria-hidden="true" /> {busy ? 'Google 보고서 만드는 중…' : 'Google Sheets로 보고서 저장'}
    </button>
    <p className="text-sm leading-relaxed text-slate-600">{demo ? '실제 앱의 교사 로그인에서 이용할 수 있어요.' : '내 Drive에 표·그래프가 있는 새 비공개 파일을 만들어요. 처음에는 Google 접근 승인이 필요해요.'}</p>
    {busy && <p role="status" className="text-sm text-emerald-800">Google 연결에 잠시 시간이 걸릴 수 있어요. 승인 창이 열리면 교사 로그인과 같은 계정을 선택해 주세요.</p>}
    {result && <div role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-950"><p>{result.scope} · 저장했어요. 새 탭이 열리지 않았다면 아래를 눌러 주세요.</p><a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 font-bold underline">Google Sheets 보고서 열기 <ExternalLink size={18} /></a></div>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {uncertain && <div className="flex flex-wrap items-center gap-3 text-sm"><a href="https://drive.google.com/drive/u/0/my-drive" target="_blank" rel="noopener noreferrer" className="min-h-11 py-3 font-bold underline">내 Drive 확인하기</a><button type="button" onClick={() => { setUncertain(false); setError(''); }} className="min-h-11 rounded-lg border px-3">파일이 없는 것을 확인했어요</button></div>}
  </div>;
}
