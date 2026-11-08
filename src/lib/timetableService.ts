import {collection,deleteDoc,doc,onSnapshot,serverTimestamp,setDoc,runTransaction} from 'firebase/firestore';
import type {TimetableEntry} from '../types';
import {getTeacherFirebase} from './firebase';
import {requireTeacher} from './teacherAuth';
import {isDemoMode} from './runtimeConfig';
import {validateTimetable,koreanClock} from './timetable';
import {withOperationDeadline} from './operationDeadline';
const demoRows=new Map<string,TimetableEntry[]>();
const listeners=new Set<()=>void>();
export function subscribeTimetable(uid:string,callback:(rows:TimetableEntry[])=>void,onError:(e:Error)=>void) {
 if(isDemoMode){const notify=()=>callback([...(demoRows.get(uid)??[])]);listeners.add(notify);notify();return()=>{listeners.delete(notify);};}
 return onSnapshot(collection(getTeacherFirebase().db,'teachers',uid,'timetable'),s=>callback(s.docs.filter(d=>!d.metadata.hasPendingWrites).map(d=>({id:d.id,...d.data()} as TimetableEntry))),()=>onError(new Error('시간표를 불러오지 못했어요. 연결을 확인해 주세요.')));
}
export async function saveTimetable(entry:Omit<TimetableEntry,'id'>,id: string=crypto.randomUUID()) {
 const teacher=await requireTeacher();validateTimetable(entry);
 const {weekday,classId,startTime,endTime,effectiveFrom,effectiveUntil,active}=entry;entry={weekday,classId,startTime,endTime,effectiveFrom,active,...(effectiveUntil?{effectiveUntil}:{})};
 if(isDemoMode){const rows=demoRows.get(teacher.uid)??[];demoRows.set(teacher.uid,[...rows.filter(e=>e.id!==id),{...entry,id}]);listeners.forEach(fn=>fn());return;}
 await withOperationDeadline(setDoc(doc(getTeacherFirebase().db,'teachers',teacher.uid,'timetable',id),{...entry,updatedAt:serverTimestamp()}));
}

export async function deleteTimetable(id: string): Promise<void> {
 if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error('삭제할 시간표를 확인해 주세요.');
 const teacher = await requireTeacher();
 if (isDemoMode) {
  const rows = demoRows.get(teacher.uid) ?? [];
  demoRows.set(teacher.uid, rows.filter(e => e.id !== id));
  listeners.forEach(fn => fn());
  return;
 }
 await withOperationDeadline(deleteDoc(doc(getTeacherFirebase().db, 'teachers', teacher.uid, 'timetable', id)));
}

/** Keep the previous weekly assignment until the chosen change date. */
export async function replaceTimetable(previous:TimetableEntry,next:Omit<TimetableEntry,'id'>){
 const teacher=await requireTeacher();validateTimetable(next);
 if(next.effectiveFrom<koreanClock().date || next.effectiveFrom<previous.effectiveFrom) throw new Error('변경 적용일은 오늘 또는 기존 적용일 이후로 골라 주세요.');
 if(previous.effectiveUntil && next.effectiveFrom>=previous.effectiveUntil) throw new Error('이 시간표 뒤에 예약된 변경이 있어요. 해당 시간표를 수정해 주세요.');
 const {weekday,classId,startTime,endTime,effectiveFrom,active}=next;
 const replacement={weekday,classId,startTime,endTime,effectiveFrom,active,...(previous.effectiveUntil?{effectiveUntil:previous.effectiveUntil}:{})};
 const id=crypto.randomUUID();
 if(isDemoMode){const rows=demoRows.get(teacher.uid)??[];demoRows.set(teacher.uid,[...rows.map(e=>e.id===previous.id?{...e,effectiveUntil:next.effectiveFrom}:e),{...replacement,id}]);listeners.forEach(fn=>fn());return;}
 const db=getTeacherFirebase().db;
 await withOperationDeadline(runTransaction(db,async tx=>{
  const ref=doc(db,'teachers',teacher.uid,'timetable',previous.id);const current=await tx.get(ref);
  if(!current.exists() || !current.data().active || current.data().effectiveUntil!==previous.effectiveUntil) throw new Error('시간표가 바뀌었어요. 다시 확인해 주세요.');
  tx.update(ref,{effectiveUntil:next.effectiveFrom,updatedAt:serverTimestamp()});
  tx.set(doc(db,'teachers',teacher.uid,'timetable',id),{...replacement,updatedAt:serverTimestamp()});
 }));
}
