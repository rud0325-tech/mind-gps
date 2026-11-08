import type { DeviceRegistration, IdentifiedBy } from '../types';

export interface LearningIdentity {
  classId: string | null;
  learnerCode: string | null;
  identifiedBy: IdentifiedBy;
  teacherUid: string | null;
  assignmentId: string | null;
}

/** A character, a client-side roster choice, and a cached seat never identify a learner. */
export function identityForDevice(device: DeviceRegistration | null, now = Date.now()): LearningIdentity {
  if (!device) return { classId: null, learnerCode: null, identifiedBy: 'none', teacherUid: null, assignmentId: null };
  if (device.kind === 'student') return {
    classId: device.classId, learnerCode: device.studentCode, identifiedBy: 'device',
    teacherUid: device.registeredBy ?? null, assignmentId: null,
  };
  const active = Boolean(device.activeClassId && device.activeUntil && device.activeUntil > now);
  const code = active ? device.activeStudentCode ?? null : null;
  return {
    classId: active ? device.activeClassId! : device.classId,
    learnerCode: code, identifiedBy: code ? 'teacher-before' : 'none',
    teacherUid: active ? device.activeTeacherUid ?? null : device.registeredBy ?? null,
    assignmentId: active ? device.assignmentId ?? null : null,
  };
}

export function sameAssignment(a: LearningIdentity, b: LearningIdentity): boolean {
  return a.classId === b.classId && a.learnerCode === b.learnerCode
    && a.teacherUid === b.teacherUid && a.assignmentId === b.assignmentId;
}

export function allowsSelfSelection(device:DeviceRegistration|null, now=Date.now()):boolean {
  return Boolean(device?.kind==='shared' && device.activeClassId && device.activeUntil && device.activeUntil>now && device.activeSelectionMode==='symbol' && !device.activeStudentCode);
}
export function canBeginLearning(device:DeviceRegistration|null, now=Date.now()):boolean {
  return Boolean(identityForDevice(device,now).learnerCode) || allowsSelfSelection(device,now);
}
/** A self-selected learner stays fixed within a session, but never survives a new class assignment. */
export function sessionMatchesDevice(identity:LearningIdentity, device:DeviceRegistration|null, now=Date.now()):boolean {
  const current=identityForDevice(device,now);
  if(identity.identifiedBy==='symbol') return allowsSelfSelection(device,now) && identity.classId===current.classId && identity.teacherUid===current.teacherUid && identity.assignmentId===current.assignmentId;
  return sameAssignment(identity,current);
}
