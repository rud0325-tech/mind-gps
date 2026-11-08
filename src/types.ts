export type Difficulty = '글' | '그림+단어' | '그림';

export type Status = '완료' | '확인 필요' | '도움 요청' | '처리 완료' | '활동 중';

export type MissingReason = 'not-asked' | 'unsure' | 'skipped' | 'interrupted' | 'unconfirmed';
/** How the app knew whose record this is. */
export type IdentifiedBy = 'device' | 'teacher-before' | 'teacher-after' | 'symbol' | 'none';
export type InputSupport = 'unknown' | 'independent' | 'access-assisted' | 'prompted';
export interface TeacherObservation {
  context: 'not-recorded' | 'practice' | 'daily-life';
  requestOpportunities: number | null;
  independentRequests: number | null;
  promptLevel: 'not-recorded' | 'independent' | 'verbal' | 'model' | 'together' | 'not-observed';
  supportOutcome: 'not-recorded' | 'provided' | 'partly-provided' | 'not-provided' | 'no-request';
  targetBehavior: string;
  behaviorCount: number | null;
  behaviorDurationSeconds: number | null;
  observationMinutes: number | null;
  beforeInputSupport: InputSupport;
  afterInputSupport: InputSupport;
  setting: string;
  communicationPartner: string;
  participationMinutes: number | null;
  note: string;
}

export interface ActivityRecord {
  /** Old records without this field remain unconfirmed, never inferred from a character or device. */
  usageMode?: 'live' | 'test' | 'unknown';
  usageUpdatedBy?: string;
  usageUpdatedAt?: { seconds: number; nanoseconds: number };
  id?: string;
  eventId?: string;
  sessionId?: string;
  createdBy?: string;
  practiceSummary?: string;
  createdAt: any; // ServerTimestamp
  student: string; // Selected character ID, not a student identifier.
  studentName: string; // Selected character name.
  /** '해당 없음' only on a teacher's observation-only record. */
  difficulty: Difficulty | '해당 없음';
  emotion: string | null;
  intensity: number | null;
  afterEmotion?: string | null;
  afterIntensity?: number | null;
  schemaVersion?: 2;
  learnerCode?: string | null;
  classId?: string | null;
  identifiedBy?: IdentifiedBy;
  /** 'observation': a teacher observed a student who did not use the app. */
  recordKind?: 'activity' | 'help' | 'check-in' | 'observation';
  alertTrigger?: 'help-button' | 'negative-intensity';
  activityOutcome?: 'completed' | 'interrupted';
  beforeEmotionMissingReason?: MissingReason | null;
  beforeIntensityMissingReason?: MissingReason | null;
  afterEmotionMissingReason?: MissingReason | null;
  afterIntensityMissingReason?: MissingReason | null;
  appVersion?: string;
  observation?: TeacherObservation;
  observationUpdatedAt?: any;
  observationUpdatedBy?: string;
  statusUpdatedAt?: any;
  statusUpdatedBy?: string;
  learnerAssignedAt?: any;
  learnerAssignedBy?: string;
  technique: string;
  completed: boolean;
  helpRequested: boolean;
  status: Status;
  interventionNeeded: boolean;
}

export type View = 
  | 'home' 
  | 'learnerSelect'
  | 'studentSelect' 
  | 'difficultySelect' 
  | 'emotionSelect' 
  | 'intensitySelect' 
  | 'techniqueSelect'
  | 'positiveMessage'
  | 'relaxation' 
  | 'rebt' 
  | 'iMsg' 
  | 'asmr' 
  | 'postEmotion'
  | 'postIntensity'
  | 'completion' 
  | 'adminPin' 
  | 'adminDashboard';

export interface Student {
  id: string;
  name: string;
  image: string;
}

export interface Classroom {
  id: string;
  name: string;
  teacherIds: string[];
  active: boolean;
  /** Teacher-approved default seats: shared browser ID -> student code or '@symbol'. Omitted IDs are not used. */
  seats?: Record<string, string>;
}

/** Rosters hold a teacher-chosen alias, never a real name. */
export interface RosterStudent {
  code: string;
  alias: string;
  symbol: string;
  active: boolean;
}

export type DeviceKind = 'student' | 'shared';

export interface DeviceRegistration {
  deviceId: string;
  classId: string;
  kind: DeviceKind;
  studentCode: string | null;
  label: string;
  /** While a class session runs, a shared tablet records for this class and seat. */
  activeClassId?: string | null;
  activeStudentCode?: string | null;
  /** Session end, epoch milliseconds. */
  activeUntil?: number | null;
  registeredBy?: string;
  activeTeacherUid?: string | null;
  assignmentId?: string | null;
  /** Self selection is allowed only for an explicitly opened class session. */
  activeSelectionMode?: 'teacher' | 'symbol';
  /** Only a server-confirmed registration can start a live learning session. */
  confirmed?: boolean;
}

export interface TimetableEntry {
  id: string;
  weekday: number;
  classId: string;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  active: boolean;
}
