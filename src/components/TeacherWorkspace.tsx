import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,BookOpen,ChartColumn,Home,Settings,CalendarDays,Tablet,Users} from 'lucide-react';
import type {Classroom,RosterStudent,TimetableEntry} from '../types';
import {subscribeMyClasses,subscribeRoster,startSavedClassSession,type ClassStartResult} from '../lib/classroomService';
import {cleanClassSeats} from '../lib/classSessionPlan';
import {subscribeTimetable} from '../lib/timetableService';
import {koreanClock,scheduledClasses,WEEKDAYS} from '../lib/timetable';
import TeacherDashboard,{type TeacherDashboardProps} from './TeacherDashboard';
import TeacherClassroomPanel,{UNASSIGNED_SCOPE,studentLabel} from './TeacherClassroomPanel';
import TeacherClassSession from './TeacherClassSession';
import TeacherTimetable from './TeacherTimetable';
import TeacherAlerts from './TeacherAlerts';
type Page='home'|'start'|'start-class'|'seats'|'result-class'|'result-kind'|'result-student'|'results'|'settings'|'roster'|'devices'|'timetable'|'alerts';
type Props=Omit<TeacherDashboardProps,'roster'|'initialLearner'>;
const titles:Record<Page,string>={home:'선생님',start:'수업 시작하기','start-class':'사용할 반을 골라 주세요',seats:'태블릿 배치 확인','result-class':'결과를 볼 반을 골라 주세요','result-kind':'어떤 결과를 볼까요?','result-student':'학생을 골라 주세요',results:'학생 데이터 결과',settings:'등록·설정',roster:'반·학생 등록',devices:'태블릿 관리',timetable:'시간표 관리',alerts:'긴급 알림 확인'};
const card='flex min-h-32 flex-col items-start justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-left font-bold shadow-sm hover:border-blue-400 focus-visible:outline focus-visible:outline-4 focus-visible:outline-blue-500';
export default function TeacherWorkspace(props:Props){
 const [path,setPath]=useState<Page[]>(['home']);const page=path[path.length-1];
 const [classes,setClasses]=useState<Classroom[]>([]); const [entries,setEntries]=useState<TimetableEntry[]>([]);
 const [classId,setClassId]=useState('');const [roster,setRoster]=useState<RosterStudent[]>([]);
 const [rosterClassId,setRosterClassId]=useState('');const [startResult,setStartResult]=useState<ClassStartResult|null>(null);
 const [starting,setStarting]=useState('');const startingRef=useRef(false);
 const [learner,setLearner]=useState('all');const [error,setError]=useState('');const [clock,setClock]=useState(()=>new Date());
 const heading=useRef<HTMLHeadingElement>(null);
 const active=classes.filter(c=>c.active);const selected=active.find(c=>c.id===classId);
 const planned=scheduledClasses(entries,active,clock);
 useEffect(()=>subscribeMyClasses(props.teacher.uid,setClasses,e=>setError(e.message)),[props.teacher.uid]);
 useEffect(()=>subscribeTimetable(props.teacher.uid,setEntries,e=>setError(e.message)),[props.teacher.uid]);
 useEffect(()=>{setRoster([]);setRosterClassId('');if(!classId||classId===UNASSIGNED_SCOPE)return;return subscribeRoster(classId,value=>{setRoster(value);setRosterClassId(classId);},e=>setError(e.message));},[classId]);
 useEffect(()=>{const timer=setInterval(()=>setClock(new Date()),60000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{props.onScopeChange(page==='results'||page==='alerts'?classId:'');heading.current?.focus();window.scrollTo({top:0,behavior:'instant'});},[page,classId]);
 const go=(next:Page)=>setPath(v=>[...v,next]);const home=()=>setPath(['home']);
 const classCards=(target:Page)=><div className="grid gap-4 sm:grid-cols-2">{active.map(c=><button key={c.id} className={card} onClick={()=>{setClassId(c.id);go(target);}}><Users aria-hidden="true" className="text-blue-600"/><span className="text-xl">{c.name}</span></button>)}{!active.length&&<p>아직 등록된 반이 없어요. ‘처음으로 → 등록·설정 → 반·학생 등록’에서 추가해 주세요.</p>}</div>;
 const openSeats=(c:Classroom)=>{setClassId(c.id);setStartResult(null);setError('');go('seats');};
 const quickStart=async(c:Classroom)=>{
  if(startingRef.current)return;
  if(!Object.keys(cleanClassSeats(c.seats??{})).length){openSeats(c);return;}
  startingRef.current=true;setStarting(c.id);setError('');setClassId(c.id);setStartResult(null);
  try{setStartResult(await startSavedClassSession(c.id));go('seats');}
  catch(e){setError(e instanceof Error?e.message:'수업을 시작하지 못했어요.');go('seats');}
  finally{startingRef.current=false;setStarting('');}
 };
 const startCards=<section aria-label="반 선택으로 수업 시작" className="space-y-4">
  <div><h2 className="text-2xl font-bold">어느 반을 시작할까요?</h2><p className="mt-2 text-slate-600">반을 누르면 저장된 태블릿 배치로 시작해요. 처음 사용하는 반은 배치를 한 번 정해 주세요.</p></div>
  <div className="grid gap-4 sm:grid-cols-2">{[...active].sort((a,b)=>Number(planned.some(c=>c.id===b.id))-Number(planned.some(c=>c.id===a.id))).map(c=>{
   const count=Object.keys(cleanClassSeats(c.seats??{})).length;
   return <article key={c.id} className="overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-sm">
    <button className="flex min-h-36 w-full flex-col items-start justify-center gap-2 p-6 text-left hover:bg-blue-50 disabled:opacity-50" disabled={!!starting} onClick={()=>void quickStart(c)}>
     {planned.some(p=>p.id===c.id)&&<span className="text-sm text-blue-700">{WEEKDAYS[koreanClock(clock).weekday]} 예정 수업</span>}
     <span className="text-2xl font-bold text-blue-700">{starting===c.id?'시작하고 있어요…':`${c.name} 시작`}</span>
     <span className="text-slate-600">{count?`저장된 배치 ${count}대 · 같은 수업은 이어서 사용`:'처음 한 번 학생 배치하기'}</span>
    </button>
    {count>0&&<button className="min-h-12 w-full border-t border-slate-200 px-6 text-left font-bold" disabled={!!starting} aria-label={`${c.name} 배치 보기·변경`} onClick={()=>openSeats(c)}>배치 보기·변경</button>}
   </article>;
  })}</div>
  {!active.length&&<button className={card} onClick={()=>go('roster')}>반·학생 등록부터 시작하기</button>}
  {!!starting&&<p role="status">저장된 배치와 현재 수업을 확인하고 있어요.</p>}
 </section>;
 const selectedProps={...props,scope:classId,onScopeChange:setClassId,onRosterChange:setRoster};
 return <main className="min-h-dvh bg-slate-50 px-4 py-6 sm:px-8"><div className="mx-auto max-w-6xl space-y-6">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 ref={heading} tabIndex={-1} className="text-3xl font-bold outline-none">{titles[page]}</h1>{page==='home'&&<p className="mt-2 text-slate-600">할 일을 선택해 주세요</p>}</div><button className="min-h-12 rounded-xl bg-white px-4 font-bold shadow-sm" disabled={!!starting} onClick={props.onExit}>닫고 나가기</button></header>
  {page!=='home'&&<nav aria-label="교사 화면 이동" className="flex gap-3"><button className="flex min-h-12 items-center gap-2 rounded-xl border px-4" onClick={()=>setPath(v=>v.slice(0,-1))}><ArrowLeft size={20}/>이전</button><button className="flex min-h-12 items-center gap-2 rounded-xl border px-4" onClick={home}><Home size={20}/>처음으로</button></nav>}
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
  {(page==='home'||page==='start'||page==='start-class')&&<>{startCards}<div className="flex flex-wrap gap-3"><button className="flex min-h-12 items-center gap-2 rounded-xl border bg-white px-5 font-bold" disabled={!!starting} onClick={()=>go('result-class')}><ChartColumn size={22}/>학생 데이터 결과 보기</button><button className="flex min-h-12 items-center gap-2 rounded-xl border bg-white px-5 font-bold" disabled={!!starting} onClick={()=>go('settings')}><Settings size={20}/>등록·설정</button></div></>}
  {page==='seats'&&selected&&<TeacherClassSession key={classId} classes={active} selectedClass={selected} roster={roster.filter(s=>s.active)} rosterReady={rosterClassId===classId} teacherUid={props.teacher.uid} currentDeviceId={props.device?.deviceId} initialResult={startResult} onRegister={()=>go('devices')}/>}
  {page==='result-class'&&<>{classCards('result-kind')}{props.teacher.admin&&<button className="min-h-12 underline" onClick={()=>{setClassId(UNASSIGNED_SCOPE);setLearner('unknown');go('results');}}>반 미지정 기록 확인</button>}</>}
  {page==='result-kind'&&<><p className="text-lg font-bold">{selected?.name}</p><div className="grid gap-4 sm:grid-cols-2"><button className={card} onClick={()=>{setLearner('all');go('results');}}><span className="text-xl">반별 데이터</span></button><button className={card} onClick={()=>go('result-student')}><span className="text-xl">학생별 데이터</span></button></div><button className="min-h-12 rounded-xl border bg-white px-4 font-bold" onClick={()=>go('alerts')}>긴급 알림·이메일 발송 확인</button></>}
  {page==='result-student'&&<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{roster.map(s=><button className={card} key={s.code} onClick={()=>{setLearner(`code:${s.code}`);go('results');}}><span className="text-2xl">{studentLabel(s)}</span></button>)}<button className={card} onClick={()=>{setLearner('unknown');go('results');}}>학생 미지정 기록</button></div>}
  {page==='results'&&<TeacherDashboard {...props} records={props.scope===classId?props.records:[]} loading={props.loading||props.scope!==classId} key={`${classId}:${learner}`} roster={roster} scope={classId} initialLearner={learner} onExit={home}/>}
  {page==='alerts'&&<TeacherAlerts classId={classId} roster={roster} demo={props.demo}/>}
  {page==='settings'&&<div className="grid gap-4 sm:grid-cols-3">{([['roster','반·학생 등록',Users],['devices','태블릿 관리',Tablet],['timetable','시간표 관리',CalendarDays]] as const).map(([next,label,Icon])=><button key={next} className={card} onClick={()=>go(next)}><Icon className="text-blue-600" size={30}/><span className="text-xl">{label}</span></button>)}</div>}
  {(page==='roster'||page==='devices')&&<TeacherClassroomPanel {...selectedProps} mode={page}/>}
  {page==='timetable'&&<TeacherTimetable entries={entries} classes={active}/>}
 </div></main>;
}
