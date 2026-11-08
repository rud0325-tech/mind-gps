import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decideClassSeat,currentClassSeats,cleanClassSeats} from '../src/lib/classSessionPlan';
import {createClass,endClassSession,loadThisDevice,registerThisDevice,resetDemoClassrooms,saveRosterStudent,saveSeats,startClassSession,startSavedClassSession} from '../src/lib/classroomService';
import {signInTeacher,signOutTeacher} from '../src/lib/teacherAuth';
import type {DeviceRegistration} from '../src/types';
const running:DeviceRegistration={deviceId:'tablet',classId:'home',kind:'shared',label:'1번',studentCode:null,activeClassId:'class',activeStudentCode:'S02',activeSelectionMode:'teacher',activeTeacherUid:'teacher',activeUntil:200,assignmentId:'original'};
test('reopening a class preserves today’s changed student, timer and assignment',()=>{
 assert.equal(decideClassSeat(running,'class','S01','teacher',100,true),'keep');
 assert.deepEqual(currentClassSeats({tablet:'S01'},[running],'class','teacher',100),{tablet:'S02'});
 assert.deepEqual(currentClassSeats({tablet:'S01'},[running],'class','teacher',201),{tablet:'S01'});
});
test('other classes and teachers are protected, including a concurrent reassignment',()=>{
 assert.equal(decideClassSeat(running,'other','S02','teacher',100,true),'busy');
 assert.equal(decideClassSeat(running,'class','S02','another-teacher',100,true),'busy');
 assert.equal(decideClassSeat(running,'class','S01','teacher',100,false),'confirm');
 assert.equal(decideClassSeat(running,'class','S01','teacher',100,false,'original'),'start');
 assert.equal(decideClassSeat({...running,assignmentId:'changed'},'class','S01','teacher',100,false,'original'),'confirm');
});
test('expired, unregistered and dedicated tablets are distinguished; off seats are not learners',()=>{
 assert.equal(decideClassSeat(running,'other','S01','teacher',201,true),'start');
 assert.equal(decideClassSeat(null,'class','S01','teacher',100,true),'missing');
 assert.equal(decideClassSeat({...running,kind:'student'},'class','S01','teacher',100,true),'missing');
 assert.deepEqual(cleanClassSeats({a:'off',b:'',c:'S01',d:'@symbol'}),{c:'S01',d:'@symbol'});
});
test('saved class start, today-only change, next class and end-to-restart preserve identities',async()=>{
 resetDemoClassrooms();await signInTeacher();
 try{
  const device=await registerThisDevice({classId:'demo-class',kind:'shared',studentCode:null,label:'1번'});
  const seats={[device.deviceId]:'S01'};
  await saveSeats('demo-class',seats);
  const first=await startSavedClassSession('demo-class');assert.equal(first.started.length,1);
  const initial=(await loadThisDevice())!;
  const again=await startSavedClassSession('demo-class');assert.equal(again.continued.length,1);
  assert.deepEqual(await loadThisDevice(),initial);
  const blocked=await startClassSession('demo-class',{[device.deviceId]:'S02'},40);
  assert.equal(blocked.skipped.length,1);assert.deepEqual(await loadThisDevice(),initial);
  const changed=await startClassSession('demo-class',{[device.deviceId]:'S02'},40,{expectedAssignments:{[device.deviceId]:initial.assignmentId!}});
  assert.equal(changed.started.length,1);const today=(await loadThisDevice())!;
  assert.notEqual(today.assignmentId,initial.assignmentId);
  assert.deepEqual(await endClassSession([device.deviceId],{[device.deviceId]:initial.assignmentId!}),[]);
  assert.deepEqual(await loadThisDevice(),today);
  await startSavedClassSession('demo-class');assert.deepEqual(await loadThisDevice(),today);
  const other=await createClass('다른 반');await saveRosterStudent(other,{alias:'학생',symbol:'⭐'},[]);await saveSeats(other,seats);
  assert.equal((await startSavedClassSession(other)).skipped.length,1);
  assert.deepEqual(await loadThisDevice(),today);
  await endClassSession([device.deviceId]);await startSavedClassSession(other);
  assert.equal((await loadThisDevice())?.activeClassId,other);
  await endClassSession([device.deviceId]);await startSavedClassSession('demo-class');
  assert.equal((await loadThisDevice())?.activeStudentCode,'S01');
  assert.equal((await loadThisDevice())?.activeTeacherUid,'demo-teacher');
  await endClassSession([device.deviceId]);await saveRosterStudent('demo-class',{code:'S01',alias:'숨김',symbol:'⭐',active:false},[]);
  assert.equal((await startSavedClassSession('demo-class')).skipped.length,1);
  assert.equal((await loadThisDevice())?.activeClassId,null);
 }finally{await signOutTeacher();resetDemoClassrooms();}
});
