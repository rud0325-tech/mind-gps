import type { Classroom, TimetableEntry } from '../types';
export const WEEKDAYS = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
export function koreanClock(now = new Date()) {
  const date = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const time = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
  return { date, time, weekday: new Date(`${date}T12:00:00+09:00`).getUTCDay() };
}
export function validateTimetable(entry: Omit<TimetableEntry,'id'>): void {
  if (!Number.isInteger(entry.weekday) || entry.weekday < 0 || entry.weekday > 6 || !entry.classId) throw new Error('요일과 반을 골라 주세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.effectiveFrom)) throw new Error('적용 시작 날짜를 확인해 주세요.');
  if (entry.effectiveUntil && (!/^\d{4}-\d{2}-\d{2}$/.test(entry.effectiveUntil) || entry.effectiveUntil < entry.effectiveFrom)) throw new Error('적용 종료 날짜를 확인해 주세요.');
  const validTime=(value:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if ((entry.startTime || entry.endTime) && (!validTime(entry.startTime) || !validTime(entry.endTime) || entry.startTime >= entry.endTime)) throw new Error('시작·종료 시각을 함께 입력하고 종료를 더 늦게 정해 주세요.');
}
export function scheduledClasses(entries: TimetableEntry[], classes: Classroom[], now=new Date()): Classroom[] {
  const {date,time,weekday}=koreanClock(now);
  const ids=new Set(entries.filter(e=>e.active && e.weekday===weekday && e.effectiveFrom<=date && (!e.effectiveUntil || date<e.effectiveUntil) && (!e.startTime || (e.startTime<=time && time<e.endTime))).map(e=>e.classId));
  return classes.filter(c=>c.active && ids.has(c.id));
}
export type TimetableDraft = {weekday:number;classId:string;source:string;selected:boolean};
/** Conservative text suggestions. Unknown or ambiguous classes stay unselected for teacher review. */
export function suggestTimetable(text:string, classes:Classroom[]):TimetableDraft[] {
  const result:TimetableDraft[]=[];
  const compact=(s:string)=>s.replace(/\s/g,'');
  for(const line of text.split(/\n/).filter(Boolean)) {
    const days=WEEKDAYS.flatMap((day,index)=>new RegExp(`${day}|${day[0]}\\s*요|(?:^|[\\s,|])${day[0]}(?:[\\s,|]|$)`).test(line)?[index]:[]);
    const matches=classes.filter(c=>compact(line).includes(compact(c.name)));
    for(const weekday of days) for(const c of matches) if(!result.some(e=>e.weekday===weekday&&e.classId===c.id)) result.push({weekday,classId:c.id,source:line.slice(0,160),selected:false});
  }
  return result;
}
export interface TimetableWord {text:string;x:number;y:number;width:number;height:number}
/** Table columns are proposals only: the user must select every row before saving. */
export function suggestTimetableColumns(words:TimetableWord[],classes:Classroom[]):TimetableDraft[]{
 const headers=words.flatMap(w=>{const day=WEEKDAYS.findIndex(d=>new RegExp(`^${d[0]}(?:요일|요)?$`).test(w.text.trim()));return day<0?[]:[{...w,day}];});
 const row=headers.map(h=>headers.filter(x=>Math.abs(x.y-h.y)<Math.max(h.height,12))).sort((a,b)=>b.length-a.length)[0]??[];
 if(new Set(row.map(h=>h.day)).size<2)return [];
 const result:TimetableDraft[]=[];
 const sorted=[...row].sort((a,b)=>a.x-b.x);
 for(let i=0;i<sorted.length;i++){
  const header=sorted[i],center=header.x+header.width/2;
  const left=i===0?center-(sorted[1].x-center)/2:(sorted[i-1].x+sorted[i-1].width/2+center)/2;
  const right=i===sorted.length-1?Infinity:(center+sorted[i+1].x+sorted[i+1].width/2)/2;
  const column=words.filter(w=>w.y>header.y+header.height&&w.x+w.width/2>=left&&w.x+w.width/2<right);
  for(const w of column){const near=column.filter(n=>Math.abs(n.y-w.y)<Math.max(w.height,12)).sort((a,b)=>a.x-b.x);const line=near.map(n=>n.text).join('').replace(/\s/g,'');
   for(const c of classes){const compact=c.name.replace(/\s/g,'');const match=c.name.match(/(\d+)학년\s*(\d+)반/);const alias=match?`${match[1]}-${match[2]}`:'';
    if((line.includes(compact)||(alias&&line.includes(alias)))&&!result.some(r=>r.classId===c.id&&r.weekday===header.day))result.push({weekday:header.day,classId:c.id,source:`${WEEKDAYS[header.day]} 열: ${line}`,selected:false});
   }
  }
 }
 return result;
}
