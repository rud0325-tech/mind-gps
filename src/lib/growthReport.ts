import type { ActivityRecord, IdentifiedBy } from '../types';
import { NEGATIVE_EMOTIONS } from './activityService';
import { isActivityRecord, phaseResponse, recordDate, summarizeTeacherIndicators, uniqueRecords } from './recordSummary';

const DAY = 24 * 60 * 60 * 1000;
const KST_OFFSET = 9 * 60 * 60 * 1000;

export interface Ratio { count: number; total: number }
export interface Comparison<T> { first: T | null; second: T | null }

export interface ReportWeek {
  start: Date;
  records: number;
  activities: number;
  /** Activities with the same uncomfortable feeling before and after, both with an intensity. */
  comparable: number;
  lower: number;
  same: number;
  higher: number;
  alerts: number;
  /** Teacher-observed independent requests out of request opportunities; null when not observed. */
  requests: Ratio | null;
}

/** Midnight in Korea for a calendar date. */
export function kstDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day) - KST_OFFSET);
}

/** 'YYYY-MM-DD' as midnight in Korea, or null when the text is not a real date. */
export function parseKstDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = kstDate(Number(match[1]), Number(match[2]), Number(match[3]));
  return kstParts(date).join('-') === value ? date : null;
}

function kstParts(date: Date): [string, string, string] {
  const shifted = new Date(date.getTime() + KST_OFFSET);
  return [String(shifted.getUTCFullYear()), String(shifted.getUTCMonth() + 1).padStart(2, '0'), String(shifted.getUTCDate()).padStart(2, '0')];
}

export const formatKstDate = (date: Date) => kstParts(date).join('-');
export const shortKstDate = (date: Date) => { const [, month, day] = kstParts(date); return `${Number(month)}/${Number(day)}`; };

/** Monday 00:00 in Korea of the week containing the date. */
export function weekStartKst(date: Date): Date {
  const shifted = new Date(date.getTime() + KST_OFFSET);
  const back = (shifted.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - back) - KST_OFFSET);
}

export type PeriodPreset = 'last4' | 'last8' | 'semester';
export const PERIOD_LABELS: Record<PeriodPreset, string> = { last4: '최근 4주', last8: '최근 8주', semester: '이번 학기' };

/** [from, to) for a preset. Korean school terms: March to August, September to February. */
export function presetPeriod(preset: PeriodPreset, now = new Date()): { from: Date; to: Date } {
  const [year, month] = kstParts(now).map(Number);
  const to = new Date(weekStartKst(now).getTime() + 7 * DAY);
  if (preset !== 'semester') return { from: new Date(to.getTime() - (preset === 'last4' ? 4 : 8) * 7 * DAY), to };
  if (month >= 3 && month <= 8) return { from: kstDate(year, 3, 1), to: kstDate(year, 9, 1) };
  const startYear = month >= 9 ? year : year - 1;
  return { from: kstDate(startYear, 9, 1), to: kstDate(startYear + 1, 3, 1) };
}

/** Same uncomfortable feeling before and after with both intensities: the only pairs whose direction is compared. */
function discomfortPair(record: ActivityRecord): 'lower' | 'same' | 'higher' | null {
  if (!isActivityRecord(record) || record.schemaVersion !== 2) return null;
  const before = phaseResponse(record, 'before'), after = phaseResponse(record, 'after');
  if (!before.complete || !after.complete || before.emotion !== after.emotion || !NEGATIVE_EMOTIONS.has(before.emotion!)) return null;
  return after.intensity! < before.intensity! ? 'lower' : after.intensity! > before.intensity! ? 'higher' : 'same';
}

// Help-button presses and automatic strong-feeling alerts are both saved as help requests.
const isAlert = (record: ActivityRecord) => record.helpRequested;
const ratio = (count: number, total: number): Ratio | null => total > 0 ? { count, total } : null;

function discomfortLower(records: ActivityRecord[]): Ratio | null {
  const pairs = records.map(discomfortPair).filter(Boolean);
  return ratio(pairs.filter(pair => pair === 'lower').length, pairs.length);
}

function observedMeasures(records: ActivityRecord[]) {
  const teacher = summarizeTeacherIndicators(records);
  const promptTotal = teacher.promptCounts.reduce((sum, row) => sum + row.count, 0);
  const top = Math.max(0, ...teacher.promptCounts.map(row => row.count));
  const observedMinutes = teacher.participation.reduce((sum, point) => sum + point.observedMinutes, 0);
  return {
    requests: ratio(teacher.independentRequests, teacher.opportunities),
    prompt: promptTotal ? { label: teacher.promptCounts.filter(row => row.count === top).map(row => row.label).join('·'), count: top, total: promptTotal } : null,
    support: ratio(teacher.supportCounts.find(row => row.outcome === 'provided')!.count, teacher.supportKnown),
    participation: observedMinutes ? { minutes: teacher.participation.reduce((sum, point) => sum + point.minutes, 0), observed: observedMinutes } : null,
    behaviors: teacher.behaviors.map(item => ({ target: item.target, count: item.rates.reduce((sum, point) => sum + point.count, 0), minutes: item.rates.reduce((sum, point) => sum + point.minutes, 0), points: item.rates.length })),
    variety: teacher.generalizationRecords ? { settings: teacher.settings.length, partners: teacher.partners.length } : null,
  };
}

/**
 * One student's records over a period, described rather than scored: counts with their
 * denominators, by week and for the earlier versus later half of the recorded span.
 * Only records that name the student are used; unassigned records are counted separately.
 */
export function buildGrowthReport(classRecords: ActivityRecord[], learnerCode: string) {
  const unique = uniqueRecords(classRecords);
  const records = unique.filter(record => record.learnerCode === learnerCode && recordDate(record))
    .sort((a, b) => recordDate(a)!.getTime() - recordDate(b)!.getTime());
  const activities = records.filter(isActivityRecord);
  const byIdentity = {} as Record<IdentifiedBy, number>;
  for (const record of records) {
    const key = record.identifiedBy ?? 'none';
    byIdentity[key] = (byIdentity[key] ?? 0) + 1;
  }
  const coverage = {
    total: records.length,
    activities: activities.length,
    completed: activities.filter(record => record.activityOutcome === 'completed' || (!record.activityOutcome && record.completed)).length,
    interrupted: activities.filter(record => record.activityOutcome === 'interrupted').length,
    bothAnswered: activities.filter(record => record.schemaVersion === 2 && phaseResponse(record, 'before').complete && phaseResponse(record, 'after').complete).length,
    alerts: records.filter(isAlert).length,
    checkIns: records.filter(record => record.recordKind === 'check-in').length,
    observationOnly: records.filter(record => record.recordKind === 'observation').length,
    withObservation: records.filter(record => record.observation?.context === 'daily-life').length,
    byIdentity,
    unassignedInClass: unique.filter(record => !record.learnerCode).length,
  };
  if (!records.length) return { learnerCode, coverage, span: null, weeks: [], halves: null, byTechnique: [], alerts: { total: 0, helpButton: 0, strongFeeling: 0, unresolved: 0 } };

  const first = recordDate(records[0])!, last = recordDate(records[records.length - 1])!;
  const weeks: ReportWeek[] = [];
  for (let start = weekStartKst(first); start <= last; start = new Date(start.getTime() + 7 * DAY)) {
    const end = start.getTime() + 7 * DAY;
    const inWeek = records.filter(record => { const time = recordDate(record)!.getTime(); return time >= start.getTime() && time < end; });
    const pairs = inWeek.map(discomfortPair);
    const teacher = summarizeTeacherIndicators(inWeek);
    weeks.push({
      start, records: inWeek.length, activities: inWeek.filter(isActivityRecord).length,
      comparable: pairs.filter(Boolean).length,
      lower: pairs.filter(pair => pair === 'lower').length, same: pairs.filter(pair => pair === 'same').length, higher: pairs.filter(pair => pair === 'higher').length,
      alerts: inWeek.filter(isAlert).length, requests: ratio(teacher.independentRequests, teacher.opportunities),
    });
  }

  // Split the span the student actually has records for, so an unfinished term is not half empty.
  const middle = new Date(first.getTime() + (last.getTime() - first.getTime()) / 2);
  const earlier = records.filter(record => recordDate(record)! < middle);
  const later = records.filter(record => recordDate(record)! >= middle);
  const [a, b] = [observedMeasures(earlier), observedMeasures(later)];
  const pair = <T,>(first: T | null, second: T | null): Comparison<T> => ({ first, second });
  const targets = [...new Set([...a.behaviors, ...b.behaviors].filter(item => item.points).map(item => item.target))];
  const halves = {
    first: { from: first, to: middle, records: earlier.length },
    second: { from: middle, to: last, records: later.length },
    discomfortLower: pair(discomfortLower(earlier), discomfortLower(later)),
    requests: pair(a.requests, b.requests),
    prompt: pair(a.prompt, b.prompt),
    support: pair(a.support, b.support),
    participation: pair(a.participation, b.participation),
    behaviors: targets.map(target => {
      const find = (list: typeof a.behaviors) => { const item = list.find(row => row.target === target && row.points); return item ? { count: item.count, minutes: item.minutes } : null; };
      return { target, ...pair(find(a.behaviors), find(b.behaviors)) };
    }),
    variety: pair(a.variety, b.variety),
  };

  const techniques = [...new Set(activities.map(record => record.technique))].sort();
  const byTechnique = techniques.map(technique => {
    const items = activities.filter(record => record.technique === technique);
    const pairs = items.map(discomfortPair).filter(Boolean);
    return { technique, activities: items.length, comparable: pairs.length, lower: pairs.filter(item => item === 'lower').length };
  });
  const alertRecords = records.filter(isAlert);
  return {
    learnerCode, coverage, span: { first, last }, weeks, halves, byTechnique,
    alerts: {
      total: alertRecords.length,
      helpButton: alertRecords.filter(record => record.alertTrigger !== 'negative-intensity').length,
      strongFeeling: alertRecords.filter(record => record.alertTrigger === 'negative-intensity').length,
      unresolved: alertRecords.filter(record => record.status !== '처리 완료').length,
    },
  };
}

export type GrowthReport = ReturnType<typeof buildGrowthReport>;
