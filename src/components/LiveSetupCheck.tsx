import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { runSetupChecks, type SetupCheck } from '../lib/liveSetupCheck';

/** The owner's one-tap check that this copy of the app is connected the way it expects. */
export default function LiveSetupCheck() {
  const [checks, setChecks] = useState<SetupCheck[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { setChecks(await runSetupChecks()); }
    catch { setChecks([{ key: 'config', label: '연결 점검', ok: false, detail: '점검을 끝내지 못했어요. 잠시 뒤 다시 눌러 주세요.' }]); }
    finally { setBusy(false); }
  };
  return <section aria-label="연결 점검" className="space-y-3 rounded-2xl bg-slate-50 p-4 text-left">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-bold text-slate-700">처음 설정했다면 연결 상태를 확인해 보세요.</p>
      <button type="button" disabled={busy} onClick={() => void run()} className="min-h-11 shrink-0 rounded-xl bg-white px-4 font-bold text-primary shadow-sm disabled:opacity-50">{busy ? '확인 중…' : '연결 점검'}</button>
    </div>
    {checks && <ul className="space-y-2" role="status">
      {checks.map(check => <li key={check.key} className="flex gap-2 text-sm">
        {check.ok
          ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          : <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
        <span><strong>{check.label}</strong> {check.ok ? '정상' : '확인 필요'}<br /><span className="break-all text-slate-600">{check.detail}</span></span>
      </li>)}
    </ul>}
  </section>;
}
