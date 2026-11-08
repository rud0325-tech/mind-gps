import { speakWithReadingVoice } from './lib/deviceSpeech';
import { localizeView } from './i18n/localizeView';
import { setLearningLanguage, useLearningLanguage, getLearningLanguage } from './i18n/language';
import './studentLayout.css';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Check, Home, Settings, ChevronRight, Wind, Brain, MessageSquare, Music, Lock, Volume2, HelpCircle, Mail } from 'lucide-react';
import { CHARACTERS as STUDENTS } from './characters';
import guideStart from "./assets/tts/recorded/guide_start_simple.mp3";
import guideIntensity from "./assets/tts/guide_intensity.mp3";
import guideLevel from "./assets/tts/guide_level.mp3";
import guideActivity from "./assets/tts/guide_activity.mp3";
import { getRecordedGuide } from './lib/typecastNarration';
import { isDemoMode } from './lib/runtimeConfig';
import { OperationUnconfirmedError } from './lib/operationDeadline';
import { signInTeacher, signOutTeacher, subscribeTeacher, TeacherNotApprovedError, type TeacherSession } from './lib/teacherAuth';
import { isFirebaseConfigured } from './lib/firebase';
import LiveSetupCheck from './components/LiveSetupCheck';
import { createIdleGuard, isTeacherView } from './lib/teacherSessionGuard';
import { IMessageActivity } from './components/LearningActivity';
import RebtActivity from './components/RebtActivity';
import SoundActivity from './components/SoundActivity';
import RelaxationActivity from './components/RelaxationActivity';
import TeacherWorkspace from './components/TeacherWorkspace';
import EmotionCheck from './components/EmotionCheck';
import EmotionGuideButton from './components/EmotionGuideButton';
import CompletionScreen, { startCompletionPraise } from './components/CompletionScreen';
import PositiveMessageScreen from './components/PositiveMessageScreen';
import type { PowerCardLesson } from './learning/powerCardLesson';
import { positiveMessageUsage } from './lib/positiveMessageUsage';
import LearningModePreview from './components/LearningModePreview';
import AccessibleView, { focusActivityStart } from './components/AccessibleView';
import { useReadableLayout } from './hooks/useReadableLayout';
import { ActivityDraftProvider } from './hooks/useActivityDraft';
import { createActivityDraftStore } from './lib/activityDraft';
import { LEARNING_PREFERENCES_KEY, parseLearningPreferences, type LearningPreferences } from './lib/learningPreferences';
import LearningSettingsDialog from './components/LearningSettingsDialog';
import { confirmedCheckInKey, missingReasonOnExit } from './lib/learningRecordFlow';
import {
  saveActivityRecord,
  subscribeToRecords,
  MissingIndexError,
  updateRecordStatus,
  requestHelp,
  needsSupport,
  type SaveResult
} from './lib/activityService';
import { ActivityRecord, View, Student, Difficulty, type DeviceRegistration, type MissingReason, type RosterStudent } from './types';
import { deviceIdentity, loadDeviceRoster, sessionIsActive, subscribeThisDevice } from './lib/classroomService';
import { beginLearningSession } from './lib/learningSession';
import { identityForDevice, allowsSelfSelection, canBeginLearning, sessionMatchesDevice, type LearningIdentity } from './lib/learningIdentity';
import { subscribeMailReceipt } from './lib/mailService';
import { mailFeedback } from './lib/mailStatus';
import { studentLabel, UNASSIGNED_SCOPE } from './components/TeacherClassroomPanel';
import { publicUrl } from './lib/publicUrl';

type HelpEvent = { id: string; session: string; level: number | null; phase: 'before' | 'after'; trigger: 'help-button' | 'negative-intensity'; confirmed: boolean; sentAt: number; record: Parameters<typeof requestHelp>[0] };

const GUIDE_REQUEST_IDS: Record<string, string> = {
  [guideStart]: 'guide_start_simple',
  [guideLevel]: 'guide_level',
  [guideIntensity]: 'guide_intensity',
  [guideActivity]: 'guide_activity',
};

const TECHNIQUES = [
  { id: 'relaxation', name: '이완훈련', icon: localizeView(<Wind />), description: '몸과 마음을 편안하게 해요' },
  { id: 'rebt', name: '생각 바꾸기', icon: localizeView(<Brain />), description: '내 생각을 다르게 바라봐요' },
  { id: 'iMsg', name: '나-전달법', icon: localizeView(<MessageSquare />), description: '나의 마음을 잘 전달해요' },
  { id: 'asmr', name: '마음의 소리', icon: localizeView(<Music />), description: '편안한 소리를 들어요' },
];

export default function App() {
  const [view, setView] = useState<View>('home');
  const drafts = useRef(createActivityDraftStore());
  const [activeActivity, setActiveActivity] = useState<View | null>(null);
  const activityBackRef = useRef<(() => boolean) | null>(null);
  const registerActivityBack = useCallback((handler: (() => boolean) | null) => { activityBackRef.current = handler; }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [learningPreferences, setLearningPreferences] = useState(() => {
    try { return parseLearningPreferences(localStorage.getItem(LEARNING_PREFERENCES_KEY)); }
    catch { return parseLearningPreferences(null); }
  });
  const { confirmEmotion, textSize } = learningPreferences;
  const language = useLearningLanguage();
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useReadableLayout('mindgps-app', textSize);
  const updateLearningPreferences = (change: Partial<LearningPreferences>) => {
    const next = { ...learningPreferences, ...change };
    setLearningPreferences(next); setLearningLanguage(next.language); setSettingsMessage('');
    try { localStorage.setItem(LEARNING_PREFERENCES_KEY, JSON.stringify(next)); }
    catch { setSettingsMessage('이번 사용에는 적용했어요. 브라우저에 설정을 기억하지 못했어요.'); }
  };
  const [student, setStudent] = useState<Student | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('그림+단어');
  const [emotion, setEmotion] = useState<string>('');
  const [intensity, setIntensity] = useState<number | null>(null);
  const [afterEmotion, setAfterEmotion] = useState<string>('');
  const [afterIntensity, setAfterIntensity] = useState<number | null>(null);
  const [beforeEmotionMissingReason, setBeforeEmotionMissingReason] = useState<MissingReason | null>('not-asked');
  const [beforeIntensityMissingReason, setBeforeIntensityMissingReason] = useState<MissingReason | null>('not-asked');
  const [afterEmotionMissingReason, setAfterEmotionMissingReason] = useState<MissingReason | null>('not-asked');
  const [afterIntensityMissingReason, setAfterIntensityMissingReason] = useState<MissingReason | null>('not-asked');
  // Who is using this tablet comes from its registration or a teacher's choice, never the student.
  const [startBusy, setStartBusy] = useState(false);
  const [startMessage, setStartMessage] = useState('');
  const identityRef = useRef<LearningIdentity | null>(null);
  const practiceSessionRef = useRef(false);
  const startRequestRef = useRef(0);
  const mailStopsRef = useRef(new Set<() => void>());
  useEffect(() => () => mailStopsRef.current.forEach(stop => stop()), []);
  const [device, setDevice] = useState<DeviceRegistration | null>(null);
  const [deviceStudent, setDeviceStudent] = useState<RosterStudent | null>(null);
  const [learnerChoices, setLearnerChoices] = useState<RosterStudent[]>([]);
  const [selectedLearnerCode, setSelectedLearnerCode] = useState('');
  const [assignedStudent, setAssignedStudent] = useState<RosterStudent | null>(null);
  const [recordScope, setRecordScope] = useState('');
  const activityFinishedRef = useRef(false);
  const closedAttemptsRef = useRef(new Set<string>());
  const [technique, setTechnique] = useState<string>('');
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [teacher, setTeacher] = useState<TeacherSession | null>(null);
  const [teacherBusy, setTeacherBusy] = useState(false);
  const [teacherError, setTeacherError] = useState('');
  const [pendingTeacherUid, setPendingTeacherUid] = useState('');
  const [recordsErrorLink, setRecordsErrorLink] = useState('');
  const [recordsError, setRecordsError] = useState('');
  const [recordsLoading, setRecordsLoading] = useState(true);
  const loginRequestRef = useRef(0);
  const [helpState, setHelpState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [helpMessage, setHelpMessage] = useState('');
  const dismissHelp = () => {
    setHelpMessage('');
    const button = document.querySelector<HTMLButtonElement>('.student-help .help-control');
    if (button && !button.disabled) button.focus();
    else focusActivityStart();
  };
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [intensityMessage, setIntensityMessage] = useState('');
  const [practiceSummary, setPracticeSummary] = useState('');
  const [chosenThought, setChosenThought] = useState('');
  // Only the locally displayed/downloaded card uses these selected learning details.
  const [cardLesson, setCardLesson] = useState<PowerCardLesson>();
  const sessionRef = useRef(crypto.randomUUID());
  const positiveVisitRef = useRef('');
  const attemptRef = useRef(0);
  const helpPendingRef = useRef(false);
  const activeHelpEventsRef = useRef(new Map<string, HelpEvent>());
  const helpEventRef = useRef<HelpEvent | null>(null);
  const earlyHelpRef = useRef<{ identity: LearningIdentity; record: Parameters<typeof requestHelp>[0] } | null>(null);
  const checkInEventsRef = useRef(new Map<string, string>());
  const checkInRecordRef = useRef<Parameters<typeof saveActivityRecord>[0] | null>(null);
  const completionPendingRef = useRef(false);
  const completionRecordRef = useRef<Omit<ActivityRecord, 'id' | 'createdAt'> | null>(null);

  const guideAudioRef = useRef<HTMLAudioElement | null>(null);
  const englishGuideRef = useRef<SpeechSynthesisUtterance | null>(null);

  const pendingGuideRef = useRef<(() => void) | null>(null);
  const stopGuideAudio = () => {
    pendingGuideRef.current?.(); pendingGuideRef.current = null;
    if (englishGuideRef.current) { window.speechSynthesis?.cancel(); englishGuideRef.current = null; }
    try {
      if (guideAudioRef.current) {
        guideAudioRef.current.pause();
        guideAudioRef.current.currentTime = 0;
        guideAudioRef.current = null;
      }
    } catch (e) {
      console.warn("Guide audio stop failed:", e);
    }
  };

  const speakGuide = (src: string) => {
    try {
      stopGuideAudio();
      if (getLearningLanguage() === 'en') {
        const scripts: Record<string, string> = {
          [guideStart]: 'Welcome to Mind GPS. Tap the screen to start.',
          [guideLevel]: 'Choose how you want to learn. Sentences, pictures and words, or pictures.',
          [guideIntensity]: 'How strong is your feeling? Choose a number, then press Next.',
          [guideActivity]: 'Choose an activity you would like to try.',
        };
        if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
        const line = new SpeechSynthesisUtterance(scripts[src] ?? 'Choose what works for you.');
        line.lang = 'en-US'; line.rate = 0.9;
        englishGuideRef.current = line;
        line.onend = line.onerror = () => { if (englishGuideRef.current === line) englishGuideRef.current = null; };
        pendingGuideRef.current = speakWithReadingVoice(window.speechSynthesis, line, () => { if (englishGuideRef.current === line) englishGuideRef.current = null; }); return;
      }
      const requestId = GUIDE_REQUEST_IDS[src];
      const audio = new Audio(requestId ? getRecordedGuide(requestId, src) ?? src : src);
      guideAudioRef.current = audio;
      audio.play().catch(e => {
        if (e.name === 'AbortError') {
          console.log("Guide play aborted (normal during navigation)");
        } else {
          console.warn("Guide play error:", e);
        }
      });
    } catch (e) {
      console.warn("speakGuide error:", e);
    }
  };

  useEffect(() => {
    stopGuideAudio();
  }, [view]);

  useEffect(() => subscribeTeacher(setTeacher), []);

  useEffect(() => subscribeThisDevice(setDevice), []);

  // Re-evaluate when a class session on this tablet reaches its end time.
  const [sessionTick, setSessionTick] = useState(0);
  useEffect(() => {
    if (!device?.activeUntil || !sessionIsActive(device)) return;
    const timer = window.setTimeout(() => setSessionTick(value => value + 1), Math.max(0, device.activeUntil - Date.now()) + 50);
    return () => window.clearTimeout(timer);
  }, [device, sessionTick]);
  const identity = deviceIdentity(device);

  useEffect(() => {
    setDeviceStudent(null);
    if (!identity.classId || !identity.studentCode) return;
    let current = true;
    const code = identity.studentCode;
    void loadDeviceRoster(identity.classId)
      .then(roster => { if (current) setDeviceStudent(roster.find(item => item.code === code) ?? null); })
      .catch(() => undefined);
    return () => { current = false; };
  }, [identity.classId, identity.studentCode]);

  // A teacher's one-off choice belongs to the class the tablet is recording for.
  useEffect(() => { setAssignedStudent(null); }, [identity.classId]);

  useEffect(() => { if (!teacher) setRecordScope(''); }, [teacher]);

  useEffect(() => {
    setRecords([]);
    setRecordsError('');
    setRecordsErrorLink('');
    setRecordsLoading(true);
    if (!teacher || view !== 'adminDashboard') return;
    if (!recordScope) { setRecordsLoading(false); return; }
    const scope = recordScope === UNASSIGNED_SCOPE ? { unassigned: true as const } : { classId: recordScope };
    return subscribeToRecords(scope, setRecords, error => {
      setRecords([]);
      setRecordsLoading(false);
      const missingIndex = error instanceof MissingIndexError;
      setRecordsError(missingIndex ? error.message : '활동 기록을 불러오지 못했어요. 교사 승인과 연결 상태를 확인해 주세요.');
      setRecordsErrorLink(missingIndex ? error.createUrl : '');
    }, setRecordsLoading);
  }, [teacher, view, recordScope]);

  useEffect(() => {
    if (view === 'adminDashboard' && !teacher) setView('adminPin');
  }, [teacher, view]);

  // A shared tablet must never hand a student an open teacher session.
  useEffect(() => {
    if (!teacher) return;
    if (!isTeacherView(view)) {
      setTeacher(null); setRecords([]);
      void signOutTeacher().catch(() => undefined);
      return;
    }
    const guard = createIdleGuard({
      onTimeout: () => {
        setTeacher(null); setRecords([]);
        setTeacherError('10분 동안 사용하지 않아 학생 기록 보호를 위해 로그아웃했어요. 다시 로그인해 주세요.');
        setView('adminPin');
        void signOutTeacher().catch(() => undefined);
      },
    });
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(name => window.addEventListener(name, guard.touch, { passive: true }));
    return () => {
      guard.stop();
      events.forEach(name => window.removeEventListener(name, guard.touch));
    };
  }, [teacher, view]);

  const handleStart = async (learnerCode?: string) => {
    if (startBusy) return;
    setStartBusy(true); setStartMessage('');
    const request = ++startRequestRef.current;
    const nextSession = crypto.randomUUID();
    try {
      if (allowsSelfSelection(device) && !learnerCode) {
        const choices = await loadDeviceRoster(device!.activeClassId!);
        if (request !== startRequestRef.current) return;
        setLearnerChoices(choices.filter(item => item.active)); setSelectedLearnerCode(''); setStartBusy(false); setView('learnerSelect'); return;
      }
      const frozen = await beginLearningSession(nextSession, device, {learnerCode});
      if (learnerCode) setDeviceStudent(learnerChoices.find(item => item.code === learnerCode) ?? null);
      if (request !== startRequestRef.current) return;
      practiceSessionRef.current = false;
      identityRef.current = frozen;
    } catch (error) {
      if (request !== startRequestRef.current) return;
      console.warn('Learning session initialization note:', error);
      practiceSessionRef.current = true;
      identityRef.current = identityForDevice(device);
    }
    setStartBusy(false);
    stopGuideAudio();
    window.speechSynthesis?.cancel();
    mailStopsRef.current.forEach(stop => stop()); mailStopsRef.current.clear();
    sessionRef.current = nextSession;
    attemptRef.current = 0;
    completionRecordRef.current = null;
    helpPendingRef.current = false;
    helpEventRef.current = null;
    completionPendingRef.current = false;
    activityFinishedRef.current = false;
    closedAttemptsRef.current.clear();
    checkInEventsRef.current.clear();
    checkInRecordRef.current = null;
    drafts.current.clear(); setActiveActivity(null);
    setBeforeEmotionMissingReason('not-asked'); setBeforeIntensityMissingReason('not-asked');
    setAfterEmotionMissingReason('not-asked'); setAfterIntensityMissingReason('not-asked');
    setStudent(null);
    setEmotion('');
    setIntensity(null);
    setAfterEmotion('');
    setAfterIntensity(null);
    setTechnique('');
    setPracticeSummary('');
    setChosenThought('');
    setCardLesson(undefined);
    setHelpState('idle');
    setHelpMessage('');
    setSaveState('idle');
    setSaveMessage('');
    setIntensityMessage('');
    setView('studentSelect');
  };

  const goHome = () => {
    saveInterruptedAttempt();
    // A teacher's choice on a shared tablet covers one learner's session only.
    if (student && !isTeacherView(view)) setAssignedStudent(null);
    drafts.current.clear(); setActiveActivity(null);
    loginRequestRef.current += 1;
    stopGuideAudio();
    window.speechSynthesis?.cancel();
    setHelpMessage('');
    practiceSessionRef.current = false;
    identityRef.current = null; earlyHelpRef.current = null; setLearnerChoices([]);
    setView('home');
  };

  const handleTeacherMode = () => {
    startRequestRef.current += 1; setStartBusy(false);
    setTeacherError(''); setPendingTeacherUid('');
    setView(teacher ? 'adminDashboard' : 'adminPin');
  };

  const recordIdentity = () => {
    const current = identityRef.current ?? identityForDevice(device);
    return { classId: current.classId, learnerCode: current.learnerCode, identifiedBy: current.identifiedBy };
  };
  const learnerLabel = deviceStudent ? studentLabel(deviceStudent) : '';

  const recordFields = () => ({
    student: student!.id, studentName: student!.name, difficulty,
    emotion: emotion || null, intensity, technique: technique || '활동 선택 전',
    sessionId: sessionRef.current, schemaVersion: 2 as const,
    ...recordIdentity(), recordKind: 'check-in' as const,
    beforeEmotionMissingReason: emotion ? null : beforeEmotionMissingReason,
    beforeIntensityMissingReason: intensity === null ? beforeIntensityMissingReason : null,
    afterEmotion: afterEmotion || null, afterIntensity,
    afterEmotionMissingReason: afterEmotion ? null : afterEmotionMissingReason,
    afterIntensityMissingReason: afterIntensity === null ? afterIntensityMissingReason : null,
    appVersion: '2026-10-12-teacher-flow-v11',
  });


  const helpFeedback = (result: SaveResult) => {
    if (result.mode === 'demo') return '선생님께 도움을 요청했어요. 잠시만 기다려 주세요.';
    return mailFeedback(result.mailStatus ?? 'pending');
  };

  const transmitHelpEvent = async (event: HelpEvent): Promise<void> => {
    if (practiceSessionRef.current) {
      event.confirmed = true;
      event.sentAt = Date.now();
      helpEventRef.current = event;
      setHelpState('saved');
      setHelpMessage(event.trigger === 'help-button' ? '선생님께 도움을 요청했어요. 잠시만 기다려 주세요.' : '');
      return;
    }
    // Send immutable requests even if the learner subsequently leaves this screen.
    activeHelpEventsRef.current.set(event.id, event);
    helpEventRef.current = event;
    helpPendingRef.current = true;
    setHelpState('saving');
    setHelpMessage('선생님께 도움을 요청하고 있어요. 잠시만 기다려 주세요.');
    try {
      const result = await requestHelp(event.record);
      if (event.session !== sessionRef.current) return;
      event.confirmed = true; event.sentAt = Date.now();
      setHelpState('saved'); setHelpMessage(helpFeedback(result));
      if (result.mode === 'live') {
        const stop = subscribeMailReceipt(result.id, receipt => {
          if (receipt && event.session === sessionRef.current) setHelpMessage(mailFeedback(receipt.status));
        }, () => { if (event.session === sessionRef.current) setHelpMessage(mailFeedback('connection-failed')); });
        mailStopsRef.current.add(stop);
      }
    } catch (error) {
      if (event.session !== sessionRef.current) return;
      if (!(error instanceof OperationUnconfirmedError)) {
        practiceSessionRef.current = true;
        event.confirmed = true;
        event.sentAt = Date.now();
        setHelpState('saved');
        setHelpMessage(event.trigger === 'help-button' ? '선생님께 도움을 요청했어요. 잠시만 기다려 주세요.' : '');
        return;
      }
      setHelpState('failed');
      setHelpMessage('선생님께 도움을 요청했어요. 가까운 선생님께도 직접 알려 주세요.');
    } finally {
      activeHelpEventsRef.current.delete(event.id);
      if (event.session === sessionRef.current) {
        helpPendingRef.current = [...activeHelpEventsRef.current.values()].some(item => item.session === event.session);
        if (helpPendingRef.current) setHelpState('saving');
      }
    }
  };

  const handleHelpRequest = async (
    level = view === 'postEmotion' || view === 'postIntensity' ? afterIntensity : intensity,
    phase: 'before' | 'after' = view === 'postEmotion' || view === 'postIntensity' ? 'after' : 'before',
    trigger: 'help-button' | 'negative-intensity' = 'help-button',
  ) => {
    if (!student || view === 'home' || view === 'studentSelect') {
      if (helpPendingRef.current) return;
      if (practiceSessionRef.current || !canBeginLearning(device)) {
        setHelpState('saved');
        setHelpMessage('선생님께 도움을 요청했어요. 잠시만 기다려 주세요.');
        return;
      }
      helpPendingRef.current = true; setHelpState('saving');
      setHelpMessage('선생님께 도움을 요청하고 있어요. 잠시만 기다려 주세요.');
      try {
        if (earlyHelpRef.current && !sessionMatchesDevice(earlyHelpRef.current.identity, device)) earlyHelpRef.current = null;
        if (!earlyHelpRef.current) {
          const helpSession = crypto.randomUUID();
          const selected = identityRef.current;
          const learnerCode = view !== 'home' && selected?.identifiedBy === 'symbol' && sessionMatchesDevice(selected, device) ? selected.learnerCode ?? undefined : undefined;
          const frozen = await beginLearningSession(helpSession, device, {purpose:'help', learnerCode});
          earlyHelpRef.current = { identity: frozen, record: {
          student: 'not-selected', studentName: '캐릭터 선택 전', difficulty,
          classId: frozen.classId, learnerCode: frozen.learnerCode, identifiedBy: frozen.identifiedBy,
          schemaVersion: 2, recordKind: 'help', alertTrigger: 'help-button', sessionId: helpSession, eventId: crypto.randomUUID(),
          emotion: null, intensity: null, afterEmotion: null, afterIntensity: null,
          beforeEmotionMissingReason: 'not-asked', beforeIntensityMissingReason: 'not-asked',
          afterEmotionMissingReason: 'not-asked', afterIntensityMissingReason: 'not-asked',
          technique: '활동 시작 전', completed: false, helpRequested: true, interventionNeeded: true,
          appVersion: '2026-10-12-teacher-flow-v11',
          } };
        }
        const result = await requestHelp(earlyHelpRef.current.record);
        earlyHelpRef.current = null;
        setHelpState('saved'); setHelpMessage(helpFeedback(result));
        if (result.mode === 'live') {
          const currentSession = sessionRef.current;
          const stop = subscribeMailReceipt(result.id, receipt => {
            if (receipt && currentSession === sessionRef.current) setHelpMessage(mailFeedback(receipt.status));
          });
          mailStopsRef.current.add(stop);
        }
      } catch {
        setHelpState('saved'); setHelpMessage('선생님께 도움을 요청했어요. 잠시만 기다려 주세요.');
      } finally { helpPendingRef.current = false; }
      return;
    }
    const session = sessionRef.current;
    const fields = recordFields();
    const snapshot = {
      ...fields,
      ...(phase === 'after'
        ? { afterIntensity: level, afterIntensityMissingReason: level === null ? afterIntensityMissingReason : null }
        : { intensity: level, beforeIntensityMissingReason: level === null ? beforeIntensityMissingReason : null }),
      recordKind: 'help' as const, alertTrigger: trigger,
      completed: false, helpRequested: true, interventionNeeded: true,
    };
    const matches = (event: HelpEvent | null) => event?.session === session && event.phase === phase
      && event.trigger === trigger && event.level === level
      && event.record.emotion === snapshot.emotion && event.record.afterEmotion === snapshot.afterEmotion;
    const previous = helpEventRef.current;
    if ([...activeHelpEventsRef.current.values()].some(matches)) return;
    if (previous?.confirmed && matches(previous) && Date.now() - previous.sentAt < 1500) return;
    // Preserve the full selection at the time of the request, including simultaneous escalation.
    const id = previous && !previous.confirmed && !helpPendingRef.current && matches(previous) ? previous.id : crypto.randomUUID();
    const event: HelpEvent = { id, session, level, phase, trigger, confirmed: false, sentAt: Date.now(), record: { ...snapshot, eventId: id } };
    await transmitHelpEvent(event);
  };

  const handleIntensitySelection = async (level: number) => {
    stopGuideAudio();
    if (!emotion) { setView('emotionSelect'); return; }
    setIntensity(level);
    setBeforeIntensityMissingReason(null);
    if (student && needsSupport(emotion, level)) await handleHelpRequest(level, 'before', 'negative-intensity');
  };

  const persistCheckIn = async (record: Parameters<typeof saveActivityRecord>[0]) => {
    checkInRecordRef.current = record;
    if (practiceSessionRef.current) {
      setIntensityMessage('지금 마음을 기록했어요.');
      return;
    }
    const session = sessionRef.current;
    setIntensityMessage('지금 마음을 기록하고 있어요.');
    try {
      const result = await saveActivityRecord(record);
      if (session !== sessionRef.current || checkInRecordRef.current?.eventId !== record.eventId) return;
      setIntensityMessage(result.mode === 'demo' ? '체험용으로 기록했어요.' : '지금 마음을 기록했어요.');
    } catch (error) {
      if (session !== sessionRef.current || checkInRecordRef.current?.eventId !== record.eventId) return;
      if (!(error instanceof OperationUnconfirmedError)) {
        practiceSessionRef.current = true;
        setIntensityMessage('지금 마음을 기록했어요.');
        return;
      }
      setIntensityMessage('마음 기록의 저장 여부를 아직 확인하지 못했어요. 나중에 반영될 수도 있어요. 활동은 계속할 수 있어요.');
    }
  };

  // Number taps are drafts; ordinary check-ins commit only on Next.
  const confirmBeforeCheck = () => {
    if (!student || !emotion || intensity === null) return;
    // The immediate support event is already recorded at selection time.
    if (needsSupport(emotion, intensity)) return;
    const selectionKey = confirmedCheckInKey(sessionRef.current, emotion, intensity);
    const eventId = checkInEventsRef.current.get(selectionKey) ?? crypto.randomUUID();
    checkInEventsRef.current.set(selectionKey, eventId);
    void persistCheckIn({
      ...recordFields(), eventId, intensity, beforeIntensityMissingReason: null,
      technique: '강도 선택', completed: false, helpRequested: false,
      status: '활동 중', interventionNeeded: false,
    });
  };

  const handleBack = () => {
    stopGuideAudio();
    window.speechSynthesis?.cancel();
    if (view === 'studentSelect') goHome();
    else if (view === 'difficultySelect') setView('studentSelect');
    else if (view === 'emotionSelect') setView('difficultySelect');
    else if (view === 'intensitySelect') setView('emotionSelect');
    else if (view === 'techniqueSelect') setView(emotion ? 'intensitySelect' : 'emotionSelect');
    else if (view === 'positiveMessage') setView('techniqueSelect');
    else if (['relaxation', 'rebt', 'iMsg', 'asmr'].includes(view)) {
      if (!activityBackRef.current?.()) setView('techniqueSelect');
    }
    else if (view === 'postEmotion') setView(activeActivity ?? 'techniqueSelect');
    else if (view === 'postIntensity') setView('postEmotion');
    else goHome();
  };

  const persistCompletion = async () => {
    const record = completionRecordRef.current;
    if (!record || completionPendingRef.current) return;
    if (practiceSessionRef.current) {
      setSaveState('saved');
      setSaveMessage('활동 기록을 저장했어요.');
      return;
    }
    completionPendingRef.current = true;
    const session = sessionRef.current;
    setSaveState('saving');
    setSaveMessage('활동은 마쳤어요. 기록을 저장하고 있어요.');
    try {
      const result = await saveActivityRecord(record);
      if (session !== sessionRef.current) return;
      setSaveState('saved');
      setSaveMessage(result.mode === 'demo'
        ? '체험 기록을 남겼어요. 새로고침하면 사라지며 실제 알림은 보내지 않아요.'
        : result.sheetStatus === 'failed' ? '활동 기록은 저장했어요. 구글 시트 연결은 확인이 필요해요.'
        : result.sheetStatus === 'unverified' ? '활동 기록은 저장했어요. 구글 시트 반영 여부는 아직 확인되지 않았어요.'
        : '활동 기록을 저장했어요.');
    } catch (error) {
      if (session !== sessionRef.current) return;
      if (!(error instanceof OperationUnconfirmedError)) {
        practiceSessionRef.current = true;
        setSaveState('saved');
        setSaveMessage('활동 기록을 저장했어요.');
        return;
      }
      setSaveState('failed');
      setSaveMessage('활동은 마쳤어요. 기록의 저장 여부를 아직 확인하지 못했어요. 나중에 반영될 수 있으니 선생님과 기록을 확인해 주세요.');
    } finally {
      if (session === sessionRef.current) completionPendingRef.current = false;
    }
  };

  const prepareCompletion = (summary = '', reflection = '', lesson?: PowerCardLesson) => {
    stopGuideAudio();
    window.speechSynthesis?.cancel();
    if (!student) { goHome(); return false; }
    setPracticeSummary(summary);
    setChosenThought(reflection);
    setCardLesson(lesson);
    if (!activityFinishedRef.current) {
      setAfterEmotion(''); setAfterIntensity(null);
      setAfterEmotionMissingReason('unconfirmed'); setAfterIntensityMissingReason('not-asked');
    }
    activityFinishedRef.current = true;
    setSaveState('idle');
    setSaveMessage('');
    completionRecordRef.current = null;
    return true;
  };

  const handleComplete = (summary = '', reflection = '', lesson?: PowerCardLesson) => {
    if (!prepareCompletion(summary, reflection, lesson)) return;
    setView('postEmotion');
  };

  const finishEmotionCheck = (patch: Partial<Omit<ActivityRecord, 'id' | 'createdAt'>> = {}) => {
    if (!student) return;
    stopGuideAudio();
    // Start the praise inside this tap so autoplay-restricted browsers allow it.
    if (getLearningLanguage() === 'ko') startCompletionPraise();
    const base = { ...recordFields(), ...patch };
    const supportNeeded = needsSupport(emotion, intensity) || needsSupport(base.afterEmotion || '', base.afterIntensity ?? null);
    const eventId = `${sessionRef.current}-complete-${attemptRef.current}`;
    closedAttemptsRef.current.add(eventId);
    completionRecordRef.current = {
      ...base, eventId, recordKind: 'activity', activityOutcome: 'completed',
      practiceSummary, completed: true, helpRequested: false,
      status: supportNeeded ? '확인 필요' : '완료', interventionNeeded: supportNeeded,
    };
    setView('completion');
    void persistCompletion();
  };

  // Explicit exits leave a record. A closed browser cannot guarantee delivery.
  const saveInterruptedAttempt = () => {
    if (!student || !activeActivity || practiceSessionRef.current) return;
    const session = sessionRef.current;
    const eventId = `${sessionRef.current}-complete-${attemptRef.current}`;
    if (closedAttemptsRef.current.has(eventId)) return;
    closedAttemptsRef.current.add(eventId);
    const done = activityFinishedRef.current;
    const supportNeeded = needsSupport(emotion, intensity) || needsSupport(afterEmotion, afterIntensity);
    const record = {
      ...recordFields(), eventId, recordKind: 'activity' as const,
      activityOutcome: done ? 'completed' as const : 'interrupted' as const,
      afterEmotionMissingReason: missingReasonOnExit(Boolean(afterEmotion), afterEmotionMissingReason),
      afterIntensityMissingReason: missingReasonOnExit(afterIntensity !== null, afterIntensityMissingReason),
      practiceSummary: done ? practiceSummary : '활동을 마치기 전에 다른 화면으로 이동했어요.',
      completed: done, helpRequested: false, status: supportNeeded ? '확인 필요' as const : done ? '완료' as const : '활동 중' as const,
      interventionNeeded: supportNeeded,
    };
    void saveActivityRecord(record).catch(() => {
      if (session !== sessionRef.current) return;
      closedAttemptsRef.current.delete(eventId);
      practiceSessionRef.current = true;
    });
  };

  useEffect(() => {
    if (practiceSessionRef.current || isDemoMode || !identityRef.current || isTeacherView(view) || view === 'home' || !device?.confirmed) return;
    if (sessionMatchesDevice(identityRef.current, device)) return;
    // Save any existing learner's interruption with their frozen server session, never the new seat.
    saveInterruptedAttempt();
    identityRef.current = null;
    sessionRef.current = crypto.randomUUID();
    mailStopsRef.current.forEach(stop => stop()); mailStopsRef.current.clear();
    stopGuideAudio(); window.speechSynthesis?.cancel();
    drafts.current.clear(); setStudent(null); setActiveActivity(null);
    setHelpMessage(''); setStartMessage('선생님이 학생 지정을 바꿨어요. 화면을 터치해서 시작해 주세요.');
    setLearnerChoices([]); setView('home');
  }, [device, sessionTick, view]);

  // Every student step reserves the same top and bottom navigation space.
  const renderHome = () => (
    localizeView(<main className="student-screen compact-home">
      <button type="button" disabled={startBusy} onClick={() => void handleStart()} className="home-start-surface" aria-labelledby="home-start-instruction" />
      <div className="home-brand-content">
        <img className="home-brand-mark" src={publicUrl('mindgps-mark.svg')} alt="" width="94" height="94" />
        <h1 className="home-wordmark" aria-label="마음GPS"><span>마음</span><span className="home-wordmark__gps">GPS</span></h1>
        <p id="home-start-instruction" className="home-start-hint"><span>화면을 터치해서</span>{' '}<span>시작하세요</span></p>
      </div>
      <button type="button" onClick={() => speakGuide(guideStart)} className="nav-control home-utility fixed right-4 top-3" aria-label="안내 듣기"><Volume2 size={22} /> 안내</button>
      {(startBusy || startMessage) && <p role={startMessage ? "alert" : "status"} className="relative z-10 mx-6 rounded-xl bg-white p-3 text-center">{startBusy ? "시작을 준비하고 있어요." : startMessage}</p>}
      <div className="home-settings-actions">
        <button type="button" onClick={handleTeacherMode} className="nav-control home-utility" aria-label="선생님 모드 열기"><Lock size={22} aria-hidden="true" /> 선생님</button>
        <button type="button" onClick={() => { stopGuideAudio(); setSettingsOpen(true); }} className="nav-control home-utility" aria-label="학습 설정 열기"><Settings size={22} aria-hidden="true" /> 설정</button>
      </div>
    </main>)
  );

  const renderStudentSelect = () => localizeView(<main className="student-screen">
    <header className="screen-heading">
      <h1>나의 아바타를 선택해요</h1>
      <p>{learnerLabel ? `${learnerLabel} · ` : ''}{confirmEmotion ? '함께할 캐릭터를 고른 뒤 다음을 눌러요.' : '함께할 캐릭터를 골라요.'}</p>
    </header>
    <div className="entry-grid avatar-grid">
      {STUDENTS.map(s => {
        const isSelected = confirmEmotion && student?.id === s.id;
        return <button key={s.id} type="button" className={`entry-choice avatar-choice${isSelected ? ' is-selected' : ''}`}
          aria-label={`${s.name} 선택`}
          aria-pressed={confirmEmotion ? isSelected : undefined}
          onClick={() => {
            stopGuideAudio();
            setStudent(s);
            if (!confirmEmotion) setView('difficultySelect');
          }}>
          {isSelected && <Check className="emotion-choice-check" aria-hidden="true" />}
          <img src={s.image} alt="" width={280} height={280} />
          <strong>{s.name}</strong>
        </button>;
      })}
    </div>
    {confirmEmotion && (
      <button type="button" className="screen-next" disabled={!student} onClick={() => {
        stopGuideAudio();
        if (student) setView('difficultySelect');
      }}>
        다음 <ArrowRight aria-hidden="true" />
      </button>
    )}
  </main>);

  const renderDifficultySelect = () => localizeView(<main className="student-screen difficulty-screen">
    <header className="screen-heading">
      <h1>편한 방법을 골라요</h1>
      {confirmEmotion && <p>방법을 고른 뒤 다음을 눌러요.</p>}
    </header>
    <div className="entry-grid difficulty-grid">
      {([
        { id: '글', label: '문장으로' },
        { id: '그림+단어', label: '그림과 단어로' },
        { id: '그림', label: '그림으로' },
      ] as const).map(item => {
        const isSelected = confirmEmotion && difficulty === item.id;
        return <button key={item.id} type="button" className={`entry-choice difficulty-choice${isSelected ? ' is-selected' : ''}`}
          aria-label={`${item.label} 학습해요`}
          aria-pressed={confirmEmotion ? isSelected : undefined}
          onClick={() => {
            stopGuideAudio();
            setDifficulty(item.id);
            if (!confirmEmotion) {
              if (!emotion) setBeforeEmotionMissingReason('unconfirmed');
              setView('emotionSelect');
            }
          }}>
          {isSelected && <Check className="emotion-choice-check" aria-hidden="true" />}
          <LearningModePreview mode={item.id} /><strong>{language === 'en' ? <><span>Learn with</span><span>{{ 글: 'sentences', '그림+단어': 'pictures + words', 그림: 'pictures' }[item.id]}</span></> : <><span>{item.label}</span><span>학습해요</span></>}</strong>
        </button>;
      })}
    </div>
    {confirmEmotion && (
      <button type="button" className="screen-next" onClick={() => {
        stopGuideAudio();
        if (!emotion) setBeforeEmotionMissingReason('unconfirmed');
        setView('emotionSelect');
      }}>
        다음 <ArrowRight aria-hidden="true" />
      </button>
    )}
  </main>);

  const renderEmotionCheck = (phase: 'before' | 'after', step: 'emotion' | 'intensity') => {
    const after = phase === 'after';
    return localizeView(<EmotionCheck confirmEmotion={confirmEmotion} phase={phase} step={step} emotion={after ? afterEmotion : emotion}
      intensity={after ? afterIntensity : intensity}
      onEmotion={value => {
        stopGuideAudio();
        if (after) {
          setAfterEmotion(value); setAfterEmotionMissingReason(null);
          if (value !== afterEmotion) { setAfterIntensity(null); setAfterIntensityMissingReason('unconfirmed'); }
          if (!confirmEmotion) setView('postIntensity');
        } else {
          setEmotion(value); setBeforeEmotionMissingReason(null);
          if (value !== emotion) { setIntensity(null); setBeforeIntensityMissingReason('unconfirmed'); }
          setIntensityMessage(''); if (!confirmEmotion) setView('intensitySelect');
        }
      }}
      onIntensity={level => {
        stopGuideAudio();
        if (after) { setAfterIntensity(level); setAfterIntensityMissingReason(null); if (needsSupport(afterEmotion, level)) void handleHelpRequest(level, 'after', 'negative-intensity'); }
        else void handleIntensitySelection(level);
      }}
      onNext={() => {
        stopGuideAudio();
        if (step === 'emotion') {
          if (after ? afterEmotion : emotion) setView(after ? 'postIntensity' : 'intensitySelect');
          return;
        }
        if ((after ? afterIntensity : intensity) === null) return;
        if (after) finishEmotionCheck();
        else { confirmBeforeCheck(); setView('techniqueSelect'); }
      }}
      onSkip={reason => {
        stopGuideAudio();
        const skipEmotion = step === 'emotion';
        if (after) {
          if (skipEmotion) { setAfterEmotion(''); setAfterEmotionMissingReason(reason); }
          setAfterIntensity(null); setAfterIntensityMissingReason(reason);
          finishEmotionCheck({
            ...(skipEmotion ? { afterEmotion: null, afterEmotionMissingReason: reason } : {}),
            afterIntensity: null, afterIntensityMissingReason: reason,
          });
        } else {
          if (skipEmotion) { setEmotion(''); setBeforeEmotionMissingReason(reason); }
          setIntensity(null); setBeforeIntensityMissingReason(reason); setView('techniqueSelect');
        }
      }}
      message={!after && intensityMessage.includes('못') ? intensityMessage : undefined}
    />);
  };

  const startTechnique = (item: typeof TECHNIQUES[number]) => {
    stopGuideAudio();
    if (activeActivity !== item.id) {
      saveInterruptedAttempt(); drafts.current.clear();
      attemptRef.current += 1; activityFinishedRef.current = false;
      setAfterEmotion(''); setAfterIntensity(null); setAfterEmotionMissingReason('not-asked'); setAfterIntensityMissingReason('not-asked');
      setPracticeSummary(''); setChosenThought(''); setCardLesson(undefined);
      setActiveActivity(item.id as View);
    }
    setTechnique(item.name); setView(item.id as View);
  };

  const renderTechniqueSelect = () => localizeView(<main className="student-screen technique-screen">
    <header className="screen-heading technique-heading">
      <div className="technique-heading-copy"><h1>어떤 활동을 해 볼까요?</h1><p>{confirmEmotion ? '나에게 맞는 방법을 고른 뒤 다음을 눌러요.' : '나에게 맞는 방법을 하나 골라요.'}</p></div>
      <div className={`technique-encouragement ${difficulty === '그림' ? 'technique-encouragement--picture' : ''}`}>
        <button type="button" aria-label="오늘의 긍정 메시지" onClick={() => {
          stopGuideAudio(); window.speechSynthesis?.cancel();
          positiveVisitRef.current = crypto.randomUUID(); setView('positiveMessage');
        }}><Mail aria-hidden="true" />{difficulty !== '그림' && <><span>오늘의 긍정 메시지</span><ChevronRight aria-hidden="true" /></>}</button>
      </div>
    </header>
    <div className="entry-grid technique-grid">
      {TECHNIQUES.map(item => {
        const isSelected = confirmEmotion && technique === item.name;
        return <button key={item.id} type="button" className={`entry-choice technique-choice${isSelected ? ' is-selected' : ''}`}
          aria-pressed={confirmEmotion ? isSelected : undefined}
          onClick={() => {
            stopGuideAudio();
            if (confirmEmotion) setTechnique(item.name);
            else startTechnique(item);
          }}>
          {isSelected && <Check className="emotion-choice-check" aria-hidden="true" />}
          <span className="entry-icon" aria-hidden="true">{React.cloneElement(item.icon as React.ReactElement<{size?: number}>, { size: 34 })}</span>
          <div><strong>{item.name}</strong><p>{item.description}</p></div>
        </button>;
      })}
    </div>
    {confirmEmotion && (
      <button type="button" className="screen-next" disabled={!TECHNIQUES.some(item => item.name === technique)} onClick={() => {
        const chosen = TECHNIQUES.find(item => item.name === technique);
        if (chosen) startTechnique(chosen);
      }}>
        다음 <ArrowRight aria-hidden="true" />
      </button>
    )}
    {intensityMessage.includes('못') && <div className="check-in-retry" role="status"><p>{intensityMessage}</p>
      <button type="button" className="nav-control" onClick={() => { if (checkInRecordRef.current) void persistCheckIn(checkInRecordRef.current); }}>기록 다시 저장</button></div>}
  </main>);

  const renderCompletion = () => localizeView(<CompletionScreen student={student} difficulty={difficulty} technique={technique}
    practiceSummary={practiceSummary} chosenThought={chosenThought} lesson={cardLesson} saveMessage={saveMessage} saveState={saveState}
    onRetrySave={() => void persistCompletion()} onStopAudio={stopGuideAudio} onHome={goHome} />);

  const renderAdminPin = () => (
    localizeView(<main className="flex min-h-dvh items-center justify-center px-4 py-20 hero-gradient">
      <section className="w-full max-w-md space-y-6 rounded-[32px] bg-white p-6 text-center shadow-xl sm:p-10">
        <Lock className="mx-auto h-12 w-12 text-primary" />
        <h1 className="text-3xl font-bold">선생님 확인</h1>
        <p className="leading-relaxed text-slate-600">{isDemoMode ? '이 브라우저의 체험 기록을 확인해요. 새로고침하면 기록이 사라지며, 실제 학생 기록에 연결하거나 알림을 보내지 않아요.' : '승인된 선생님의 Google 계정으로 로그인해 주세요.'}</p>
        {teacherError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{teacherError}</p>}
        {pendingTeacherUid && <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-left">
          <p className="text-sm font-bold text-slate-700">계정 번호(UID)</p>
          <p className="break-all font-mono text-sm text-slate-900">{pendingTeacherUid}</p>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(pendingTeacherUid).catch(() => undefined)} className="min-h-11 rounded-xl bg-white px-4 font-bold text-primary shadow-sm">계정 번호 복사</button>
        </div>}
        <button disabled={teacherBusy} onClick={async () => {
          const request = ++loginRequestRef.current;
          setTeacherBusy(true); setTeacherError(''); setPendingTeacherUid('');
          try {
            const session = await signInTeacher();
            if (request !== loginRequestRef.current) { await signOutTeacher(); return; }
            setTeacher(session); setView('adminDashboard');
          }
          catch (error) {
            if (request !== loginRequestRef.current) return;
            setTeacherError(error instanceof Error ? error.message : '로그인을 완료하지 못했어요. 다시 시도해 주세요.');
            if (error instanceof TeacherNotApprovedError) setPendingTeacherUid(error.uid);
          }
          finally { setTeacherBusy(false); }
        }} className="btn-primary-stitch min-h-14 w-full px-5 py-4 text-xl disabled:opacity-50">
          {teacherBusy ? '확인 중…' : isDemoMode ? '체험 기록 확인하기' : 'Google 계정으로 로그인'}
        </button>
        {teacherBusy && <p role="status" className="text-sm text-slate-600">Google 연결을 확인하고 있어요. 창이 열리면 교사 계정을 선택해 주세요.</p>}
        <button onClick={goHome} className="min-h-12 rounded-xl px-6 font-bold text-slate-600">처음으로</button>
        {!isDemoMode && <LiveSetupCheck />}
      </section>
    </main>)
  );

  // Leave the dashboard before signing out. Signing out first would bounce it to the login
  // screen mid-transition, and the screen could stay there even after view became home.
  const exitTeacher = () => {
    setTeacher(null); setRecords([]); goHome();
    void signOutTeacher().catch(() => undefined);
  };

  return (
    localizeView(<ActivityDraftProvider store={drafts.current}>
    <div id="mindgps-app" data-text-size={textSize} data-learning-language={language} style={{ '--student-text-scale': view.startsWith('admin') ? 1 : textSize === 'large' ? 1.25 : 1 } as React.CSSProperties} className="font-sans min-h-screen text-[#181c20] relative">
      <a className="activity-skip-link" href="#activity-content" onClick={event => { event.preventDefault(); focusActivityStart(); }}>본문 바로가기</a>
      <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })}>
        <motion.div
           key={view}
           initial={false}
           animate={{ opacity: 1 }}
           exit={{ opacity: 1 }}
           transition={{ duration: 0 }}
        >
          <AccessibleView view={view}>
          {view === 'home' && renderHome()}
          {view === 'learnerSelect' && <main className="student-screen px-5"><h1 className="text-3xl font-bold">내 표시를 골라요</h1><div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">{learnerChoices.map(item => {
            const isSelected = confirmEmotion && selectedLearnerCode === item.code;
            return <button key={item.code} type="button" disabled={startBusy} aria-pressed={confirmEmotion ? isSelected : undefined} onClick={() => { if (confirmEmotion) setSelectedLearnerCode(item.code); else void handleStart(item.code); }} className={`relative min-h-36 rounded-3xl border-2 p-5 ${isSelected ? 'border-blue-600 bg-blue-50/60' : 'border-blue-200 bg-white'}`}>{isSelected && <Check className="emotion-choice-check" aria-hidden="true" />}<span aria-hidden="true" className="block text-5xl">{item.symbol}</span><span className="mt-3 block text-xl font-bold">{item.alias}</span></button>;
          })}</div>{confirmEmotion && learnerChoices.length > 0 && <button type="button" className="screen-next" disabled={startBusy || !selectedLearnerCode} onClick={() => { if (selectedLearnerCode) void handleStart(selectedLearnerCode); }}>다음 <ArrowRight aria-hidden="true" /></button>}{!learnerChoices.length && <p>선생님이 준비하고 있어요</p>}{startMessage && <p role="alert">{startMessage}</p>}</main>}
          {view === 'studentSelect' && renderStudentSelect()}
          {view === 'difficultySelect' && renderDifficultySelect()}
          {view === 'emotionSelect' && renderEmotionCheck('before', 'emotion')}
          {view === 'intensitySelect' && renderEmotionCheck('before', 'intensity')}
          {view === 'techniqueSelect' && renderTechniqueSelect()}
          {view === 'positiveMessage' && <PositiveMessageScreen student={student} difficulty={difficulty} onStopAudio={stopGuideAudio}
            onBack={handleBack} onDraw={messageId => positiveMessageUsage.recordDraw(positiveVisitRef.current, messageId)} />}
          {view === 'relaxation' && <RelaxationActivity onBackReady={registerActivityBack} character={student} difficulty={difficulty} onComplete={handleComplete} />}
          {view === 'rebt' && <RebtActivity onBackReady={registerActivityBack} character={student} difficulty={difficulty} onComplete={handleComplete} />}
          {view === 'iMsg' && <IMessageActivity onBackReady={registerActivityBack} character={student} difficulty={difficulty} onComplete={handleComplete} />}
          {view === 'asmr' && <SoundActivity onBackReady={registerActivityBack} character={student} difficulty={difficulty} onComplete={handleComplete} onBack={handleBack} onHome={goHome} onHelp={() => void handleHelpRequest()} helpPending={helpState === 'saving'} helpMessage={helpMessage} onDismissHelp={dismissHelp} />}
          {view === 'postEmotion' && renderEmotionCheck('after', 'emotion')}
          {view === 'postIntensity' && renderEmotionCheck('after', 'intensity')}
          {view === 'completion' && renderCompletion()}
          {view === 'adminPin' && renderAdminPin()}
          {view === 'adminDashboard' && teacher && <TeacherWorkspace records={records} students={STUDENTS} error={recordsError} errorLink={recordsErrorLink} loading={recordsLoading} demo={isDemoMode} onExit={exitTeacher} onResolve={id => updateRecordStatus(id, '처리 완료')} teacher={teacher} scope={recordScope} onScopeChange={setRecordScope}
            device={device} onDeviceChange={setDevice} assignedStudent={assignedStudent} onAssignStudent={setAssignedStudent} />}
          </AccessibleView>
        </motion.div>
      </AnimatePresence>

      {!isDemoMode && !isFirebaseConfigured && view !== 'asmr' && !view.startsWith('admin') && <div style={view === 'home' ? { pointerEvents: 'none' } : undefined} className="fixed left-3 top-3 z-[120] rounded-full bg-red-100 px-3 py-2 text-xs font-bold text-red-900 shadow-sm" title="Firebase가 연결되지 않아 기록이 저장되지 않습니다.">기록 저장 연결 필요</div>}
      {isDemoMode && view !== 'asmr' && !view.startsWith('admin') && <div style={view === 'home' ? { pointerEvents: 'none' } : undefined} className="fixed left-3 top-3 z-[120] rounded-full bg-amber-100 px-3 py-2 text-xs font-bold text-amber-950 shadow-sm" title="새로고침하면 체험 기록이 사라집니다. 실제 알림은 발송하지 않습니다.">체험 모드</div>}
        {/* Global Navigation */}
        {(view !== 'home' && view !== 'asmr' && !view.startsWith('admin')) && (
          <>
            {/* Top Right Navigation - Grouped to prevent overlap */}
            <div className="student-nav-top">
              {(view === 'emotionSelect' || view === 'postEmotion') && <EmotionGuideButton />}
              {/* Guide Audio Button */}
              {(() => {
                const guideMap: Record<string, string> = {
                  'home': guideStart,
                  'difficultySelect': guideLevel,
                  'intensitySelect': guideIntensity,
                  'postIntensity': guideIntensity,
                  'techniqueSelect': guideActivity,
                };
                const activeGuide = guideMap[view];
                if (!activeGuide) return null;

                return (
                  <button
                    onClick={() => speakGuide(activeGuide)}
                    className="nav-control"
                    aria-label="안내 듣기"
                  >
                    <Volume2 size={window.innerWidth < 768 ? 16 : 24} />
                    <span className="text-xs md:text-lg font-bold whitespace-nowrap pr-1">안내</span>
                  </button>
                );
              })()}

              {/* Home Button */}
              <button
                onClick={goHome}
                className="nav-control"
                aria-label="처음 화면으로 돌아가기"
              >
                <Home size={window.innerWidth < 768 ? 16 : 24} />
              </button>
            </div>

            {/* Bottom Controls Wrap */}
            <div className="student-nav-bottom">
              {/* Bottom Left: Back Button */}
              <button
                onClick={handleBack}
                className="nav-control"
                aria-label="이전 화면으로 돌아가기"
              >
                <ChevronRight className="rotate-180" size={window.innerWidth < 768 ? 16 : 24} />
                <span className="text-sm md:text-xl font-bold">이전</span>
              </button>

            </div>
          </>
        )}

      {settingsOpen && <LearningSettingsDialog language={language} onLanguageChange={value => { stopGuideAudio(); updateLearningPreferences({ language: value }); }} confirmEmotion={confirmEmotion} onChange={value => updateLearningPreferences({ confirmEmotion: value })} textSize={textSize} onTextSizeChange={value => updateLearningPreferences({ textSize: value })} onClose={() => setSettingsOpen(false)} message={settingsMessage} />}

      {/* Keep help after the activity and its navigation on every student screen. */}
      {view !== 'asmr' && !view.startsWith('admin') && <>
        <div className="student-help">
          <button type="button" className="nav-control help-control"
            disabled={helpState === 'saving'}
            onClick={() => void handleHelpRequest()}>
            <HelpCircle size={18} aria-hidden="true" />
            <span>{helpState === 'saving' ? '기록 중…' : '도움 요청'}</span>
          </button>
        </div>
        <p className="sr-only" role="status" aria-atomic="true">{helpMessage}</p>
        {helpMessage && <div className="fixed bottom-20 left-3 right-3 z-[130] mx-auto flex max-w-xl items-start gap-3 rounded-2xl border border-rose-100 bg-white p-4 shadow-xl">
          <p className="flex-1 text-sm leading-relaxed text-rose-900">{helpMessage}</p>
          <button type="button" className="min-h-11 min-w-11 rounded-xl bg-slate-100 text-sm font-bold" onClick={dismissHelp} aria-label="닫기, 도움 요청 안내">닫기</button>
        </div>}
      </>}

      {student && view !== 'home' && view !== 'completion' && !view.startsWith('admin') && (
        <div className="fixed inset-0 pointer-events-none z-[-1]">
          {/* Subtle Background Elements */}
          <div className="absolute top-1/4 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
        </div>
      )}
    </div>
    </ActivityDraftProvider>)
  );
}
