import {useState} from 'react';
import type {ActivityRecord} from '../types';
import {updateRecordUsage} from '../lib/activityService';
const labels={live:'수업 사용',test:'시험',unknown:'미확인'};
export default function RecordUsageReview({record,disabled}:{record:ActivityRecord;disabled:boolean}){
 const [mode,setMode]=useState(record.usageMode??'unknown');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
 return <details className="rounded-xl border p-3">
  <summary className="min-h-10 cursor-pointer font-bold">사용 구분: {labels[record.usageMode??'unknown']}</summary>
  <p className="my-2 text-sm">직접 확인한 경우에만 바꿔 주세요. 시험·미확인 기록은 변화 지표에서 제외해요. 학생 지정이나 도움 처리 상태는 바뀌지 않아요.</p>
  <label className="block">확인한 사용 구분<select className="ml-2 min-h-12 rounded-lg border px-3" value={mode} onChange={e=>setMode(e.target.value as typeof mode)}>{Object.entries(labels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
  <button className="mt-2 min-h-12 rounded-lg bg-slate-800 px-4 font-bold text-white disabled:opacity-40" disabled={disabled||busy||!record.id||mode===(record.usageMode??'unknown')} onClick={async()=>{setBusy(true);setNotice('');try{await updateRecordUsage(record.id!,mode);setNotice('확인한 구분을 저장했어요.');}catch(e){setNotice(e instanceof Error?e.message:'저장하지 못했어요.');}finally{setBusy(false);}}}>확인한 구분으로 저장</button>
  {notice&&<p role="status">{notice}</p>}
 </details>;
}
