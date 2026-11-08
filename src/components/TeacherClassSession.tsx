import {useEffect, useRef, useState} from 'react';
import type {Classroom, DeviceRegistration, RosterStudent} from '../types';
import {endClassSession, saveSeats, sessionIsActive, startClassSession, subscribeSharedDevices, type ClassStartResult} from '../lib/classroomService';
import {cleanClassSeats, currentClassSeats} from '../lib/classSessionPlan';
const primary='min-h-12 rounded-xl bg-primary px-5 py-3 font-bold text-white disabled:opacity-40';
const secondary='min-h-12 rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold disabled:opacity-40';
const select='min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3';
interface Props {
 classes: Classroom[]; selectedClass: Classroom; roster: RosterStudent[]; rosterReady: boolean;
 teacherUid: string; currentDeviceId?: string; initialResult?: ClassStartResult | null;
 onRegister: () => void;
}
export default function TeacherClassSession({classes,selectedClass,roster,rosterReady,teacherUid,currentDeviceId,initialResult,onRegister}:Props) {
 const [devices,setDevices]=useState<DeviceRegistration[]>([]);
 const [seats,setSeats]=useState<Record<string,string>>({...selectedClass.seats});
 const [editing,setEditing]=useState<string|null>(null);
 const [dirty,setDirty]=useState(false);
 const [minutes,setMinutes]=useState(40);
 const hasDefaults=Object.keys(cleanClassSeats(selectedClass.seats??{})).length>0;
 const [remember,setRemember]=useState(!hasDefaults);
 const [busy,setBusy]=useState(false);
 const busyRef=useRef(false);
 const [result,setResult]=useState<ClassStartResult|null>(initialResult??null);
 const [notice,setNotice]=useState('');const [error,setError]=useState('');
 const [confirm,setConfirm]=useState<'start'|'end'|null>(null);
 const expected=useRef<Record<string,string>>({});
 const [now,setNow]=useState(Date.now());
 const key=classes.map(c=>c.id).join(',');
 useEffect(()=>subscribeSharedDevices(key?key.split(','):[],setDevices,e=>setError(e.message)),[key]);
 useEffect(()=>{setNow(Date.now());},[devices]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(!dirty)setSeats(currentClassSeats(selectedClass.seats,devices,selectedClass.id,teacherUid));},[devices,selectedClass.seats,selectedClass.id,teacherUid,dirty]);
 const names=(code:string|null|undefined)=>roster.find(s=>s.active&&s.code===code);
 const currentDevices=devices.filter(d=>sessionIsActive(d,now)&&d.activeClassId===selectedClass.id&&d.activeTeacherUid===teacherUid);
 const chosen=devices.filter(d=>seats[d.deviceId]&&seats[d.deviceId]!=='off');
 const usable=Object.fromEntries(chosen.filter(d=>seats[d.deviceId]==='@symbol'||names(seats[d.deviceId])).map(d=>[d.deviceId,seats[d.deviceId]]));
 const invalid=chosen.some(d=>!(d.deviceId in usable));
 const changing=currentDevices.filter(d=>d.deviceId in usable&&(d.activeSelectionMode==='symbol'?'@symbol':d.activeStudentCode)!==usable[d.deviceId]);
 const run=async(action:()=>Promise<void>)=>{if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');setNotice('');try{await action();setConfirm(null);}catch(e){setError(e instanceof Error?e.message:'저장하지 못했어요.');}finally{busyRef.current=false;setBusy(false);}};
 const apply=()=>run(async()=>{
   const next=await startClassSession(selectedClass.id,usable,minutes,{expectedAssignments:expected.current});
   setResult(next);
   if(remember||!hasDefaults){await saveSeats(selectedClass.id,usable);setNotice('기본 배치를 저장했어요. 다음부터 반 이름을 누르면 바로 시작해요.');}
   setDirty(false);setEditing(null);setRemember(false);expected.current={};
 });
 const requestApply=()=>{if(changing.length){expected.current=Object.fromEntries(changing.flatMap(d=>d.assignmentId?[[d.deviceId,d.assignmentId]]:[]));setConfirm('start');}else void apply();};
 const resultNames=(id:string)=>devices.find(d=>d.deviceId===id)?.label??id;
 const ownCount=currentDevices.length;
 return <section className="space-y-5" aria-label="반별 태블릿 배치">
  <div><h2 className="text-2xl font-bold">{selectedClass.name}</h2><p className="mt-2 text-slate-600">{hasDefaults?'학생이 바뀐 기기만 변경하세요. 다른 학생의 활동은 그대로 이어져요.':'처음 한 번, 각 태블릿을 사용할 학생을 정해 주세요. 다음부터 반 이름만 누르면 시작해요.'}</p></div>
  {result&&<div role="status" className={`space-y-2 rounded-2xl p-4 ${result.started.length+result.continued.length?'bg-emerald-50':'bg-amber-50'}`}>
   <p className="font-bold">{result.started.length+result.continued.length?`${result.started.length}대 시작 설정 완료 · ${result.continued.length}대는 기존 활동 유지`:'아직 시작된 기기가 없어요. 아래 안내를 확인해 주세요.'}</p>
   <p className="text-sm">시작 설정은 서버에 저장돼요. 각 태블릿에서 앱을 열고 인터넷에 연결하면 적용돼요.</p>
   {result.skipped.map(item=><p key={item.deviceId} className="text-sm text-amber-950">{resultNames(item.deviceId)}: {item.reason}</p>)}
  </div>}
  {!devices.length&&<div className="space-y-3 rounded-2xl bg-blue-50 p-4"><p>아직 연결된 공용 태블릿이 없어요. 학생이 사용할 기기에서 처음 한 번 연결해 주세요.</p><button className={secondary} onClick={onRegister}>이 기기 연결하기</button></div>}
  {devices.length>0&&<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{devices.map(d=>{
   const value=seats[d.deviceId]??'off';const learner=names(value);const running=sessionIsActive(d,now);
   const own=running&&d.activeClassId===selectedClass.id&&d.activeTeacherUid===teacherUid;
   const conflict=running&&!own;
   const currentLearner=names(d.activeStudentCode);
   return <article key={d.deviceId} className={`rounded-2xl border-2 bg-white p-4 ${conflict?'border-amber-300':own?'border-emerald-300':value==='off'?'border-slate-200':'border-blue-300'}`}>
    <h3 className="text-lg font-bold">{d.label}{d.deviceId===currentDeviceId&&<span className="ml-2 rounded bg-blue-50 px-2 py-1 text-sm text-blue-700">지금 이 기기</span>}</h3>
    <p className="my-3 text-xl font-bold">{value==='@symbol'?'학생이 자기 표시 고르기':learner?`${learner.symbol} ${learner.alias}`:value==='off'?'이번 수업에 사용 안 함':'학생 다시 지정'}</p>
    {own&&<p className="mb-3 text-sm text-emerald-800">현재 지정: {d.activeSelectionMode==='symbol'?'자기 표시 선택':currentLearner?`${currentLearner.symbol} ${currentLearner.alias}`:'학생 확인 필요'} · 약 {Math.max(1,Math.ceil(((d.activeUntil??now)-now)/60000))}분 남음</p>}
    {conflict&&<p className="mb-3 text-sm text-amber-900">{classes.find(c=>c.id===d.activeClassId)?.name??'다른 반'}{d.activeClassId===selectedClass.id?' · 다른 선생님':''} 수업 중 · 자동 변경하지 않아요</p>}
    <button type="button" className={secondary} disabled={busy||!rosterReady} aria-label={`${d.label} 학생 변경`} aria-expanded={editing===d.deviceId} onClick={()=>setEditing(editing===d.deviceId?null:d.deviceId)}>변경</button>
    {editing===d.deviceId&&<label className="mt-3 block font-bold">사용할 학생<select className={`${select} mt-2`} value={value} disabled={busy} onChange={e=>{setSeats(prev=>({...prev,[d.deviceId]:e.target.value}));setDirty(true);setConfirm(null);setResult(null);}}>
      <option value="off" disabled={own}>이번 수업에 사용 안 함</option>
      {!learner&&value!=='off'&&value!=='@symbol'&&<option value={value} disabled>학생을 다시 골라 주세요</option>}
      {roster.filter(s=>s.active).map(s=><option key={s.code} value={s.code}>{s.symbol} {s.alias}</option>)}
      <option value="@symbol">학생이 자기 표시 고르기</option>
    </select>{value==='@symbol'&&<span className="mt-2 block text-sm font-normal text-slate-600">자기 표시를 고르기 어려운 학생은 선생님이 지정해 주세요.</span>}</label>}
   </article>;
  })}</div>}
  {!rosterReady&&<p role="status">학생 목록을 확인하고 있어요.</p>}
  {rosterReady&&!roster.length&&<p role="alert">이 반에 등록된 학생이 없어요. 등록·설정에서 학생을 먼저 추가해 주세요.</p>}
  {(dirty||!hasDefaults||!ownCount)&&devices.length>0&&<div className="space-y-4 rounded-2xl bg-white p-4">
    <details><summary className="min-h-11 cursor-pointer font-bold">새로 시작할 수업 시간 · {minutes}분</summary><label className="block max-w-48">수업 시간<select className={`${select} mt-2`} value={minutes} disabled={busy} onChange={e=>setMinutes(Number(e.target.value))}>{[40,50,90].map(m=><option key={m} value={m}>{m}분</option>)}</select></label></details>
    {hasDefaults&&<label className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={remember} disabled={busy} onChange={e=>setRemember(e.target.checked)}/>기본 배치로도 저장하기</label>}
    <p className="text-sm text-slate-600">{!hasDefaults?'이번 배치를 저장하면 다음 수업부터 반 선택으로 시작할 수 있어요.':remember?'다음 수업에도 변경한 배치를 사용해요.':'변경은 오늘 수업에만 적용돼요. 다음 수업에는 기본 배치를 불러와요.'}</p>
    {invalid&&<p role="alert" className="text-red-800">‘학생 다시 지정’으로 표시된 기기의 학생을 골라 주세요.</p>}
    <button type="button" className={primary} disabled={busy||!rosterReady||!chosen.length||invalid} onClick={requestApply}>{busy?'적용하고 있어요…':!hasDefaults?'기본 배치 저장하고 시작':remember?'기본 배치 저장하고 적용':dirty?'오늘만 적용':'이 배치로 시작'}</button>
    {dirty&&<button className={`${secondary} ml-2`} disabled={busy} onClick={()=>{setDirty(false);setEditing(null);setConfirm(null);}}>변경 취소</button>}
  </div>}
  {ownCount>0&&<button className={secondary} disabled={busy} onClick={()=>{expected.current=Object.fromEntries(currentDevices.flatMap(d=>d.assignmentId?[[d.deviceId,d.assignmentId]]:[]));setConfirm('end');}}>이 반 수업 종료</button>}
  {confirm&&<div role="group" aria-label="수업 변경 확인" className="space-y-3 rounded-2xl bg-amber-50 p-4"><p>{confirm==='start'?`${changing.map(d=>d.label).join(', ')}의 학생이 바뀌므로 해당 기기의 활동 화면이 처음으로 돌아가요. 적용할까요?`:`${currentDevices.map(d=>d.label).join(', ')}의 수업을 마칠까요? 다음 수업의 기본 배치는 유지돼요.`}</p><div className="flex gap-3"><button className={secondary} disabled={busy} onClick={()=>setConfirm(null)}>취소</button><button className={primary} disabled={busy} onClick={()=>{if(confirm==='start')void apply();else void run(async()=>{const ended=await endClassSession(Object.keys(expected.current),expected.current);setResult(null);setNotice(`${ended.length}대의 수업을 마쳤어요. 다른 수업으로 변경된 기기는 유지돼요. 다음에는 반 이름을 눌러 다시 시작하세요.`);});}}>{confirm==='start'?'학생 변경 적용':'수업 종료'}</button></div></div>}
  {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4">{notice}</p>}{error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
 </section>;
}
