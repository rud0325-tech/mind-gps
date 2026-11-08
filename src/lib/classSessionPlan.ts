import type {DeviceRegistration} from '../types';

export type SeatDecision = 'start' | 'keep' | 'confirm' | 'busy' | 'missing';
export function hasActiveClass(device: DeviceRegistration, now: number): boolean {
  return !!(device.activeClassId && device.activeUntil && device.activeUntil > now);
}

/** Saved starts keep today's student and assignment, even if the default seat differs. */
export function decideClassSeat(
  device: DeviceRegistration | null, classId: string, code: string, teacherUid: string,
  now: number, preserveCurrentStudents: boolean, expectedAssignment?: string,
): SeatDecision {
  if (!device || device.kind !== 'shared') return 'missing';
  if (!hasActiveClass(device, now)) return 'start';
  if (device.activeClassId !== classId || device.activeTeacherUid !== teacherUid) return 'busy';
  const sameStudent = code === '@symbol'
    ? device.activeSelectionMode === 'symbol' && !device.activeStudentCode
    : device.activeStudentCode === code && device.activeSelectionMode !== 'symbol';
  if (preserveCurrentStudents || sameStudent) return 'keep';
  return device.assignmentId && device.assignmentId === expectedAssignment ? 'start' : 'confirm';
}

export function cleanClassSeats(seats: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(seats).filter(([, code]) => !!code && code !== 'off'));
}

/** Current assignments take precedence so changing one tablet never reverts its neighbours. */
export function currentClassSeats(
  defaults: Record<string, string> | undefined, devices: DeviceRegistration[], classId: string, teacherUid: string, now = Date.now(),
): Record<string, string> {
  const seats = {...cleanClassSeats(defaults ?? {})};
  for (const device of devices) {
    if (hasActiveClass(device, now) && device.activeClassId === classId && device.activeTeacherUid === teacherUid) {
      seats[device.deviceId] = device.activeSelectionMode === 'symbol' ? '@symbol' : device.activeStudentCode ?? 'off';
    }
  }
  return seats;
}
