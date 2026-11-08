import type { ActivityRecord } from '../types';
import { NEGATIVE_EMOTIONS } from './activityService';
import { buildGrowthReport, formatKstDate, weekStartKst } from './growthReport';
import { recordsToTable, recordDate, summarizeOutcomes, summarizeTeacherIndicators, uniqueRecords } from './recordSummary';

export type ReportCell = string | number | boolean | null | undefined;
export interface SheetsReportOptions {
  records: ActivityRecord[];
  title: string;
  scope: string;
  coverage: string;
  generatedAt?: Date;
  truncated?: boolean;
}
const blue = { red: 0.1, green: 0.32, blue: 0.65 };
const colors = [{ red: .26, green: .52, blue: .96 }, { red: .5, green: .56, blue: .64 }, { red: .91, green: .57, blue: .2 }];

/** Explicit stringValue prevents teacher/student text from becoming a spreadsheet formula. */
export function sheetCell(value: ReportCell, heading = false) {
  return {
    ...(value == null ? {} : { userEnteredValue: typeof value === 'number' && Number.isFinite(value) ? { numberValue: value }
      : typeof value === 'boolean' ? { boolValue: value } : { stringValue: String(value) } }),
    userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'MIDDLE', textFormat: { fontSize: 11 },
      ...(heading ? { backgroundColor: blue, textFormat: { fontSize: 11, bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } : {}),
      ...(typeof value === 'number' ? { numberFormat: { type: 'NUMBER', pattern: Number.isInteger(value) ? '0' : '0.0#' } } : {}),
    },
  };
}
function tab(sheetId: number, title: string, rows: ReportCell[][], widths?: number[]) {
  const columns = Math.max(12, ...rows.map(row => row.length));
  return {
    properties: { sheetId, title, gridProperties: { rowCount: Math.max(100, rows.length + 5), columnCount: columns, frozenRowCount: 1, hideGridlines: true } },
    data: [{ startRow: 0, startColumn: 0, rowData: rows.map((row, i) => ({ values: row.map(value => sheetCell(value, i === 0)) })),
      rowMetadata: rows.map(row => ({ pixelSize: Math.min(360, Math.max(36, ...row.map((value, i) => Math.ceil(String(value ?? '').length / Math.max(8, (widths?.[i] ?? 170) / 11)) * 19 + 12))) })),
      columnMetadata: Array.from({ length: columns }, (_, i) => ({ pixelSize: widths?.[i] ?? 170 })) }],
    basicFilter: { range: { sheetId, startRowIndex: 0, endRowIndex: rows.length, startColumnIndex: 0, endColumnIndex: Math.max(...rows.map(row => row.length)) } },
    charts: [] as object[],
    merges: [] as object[],
  };
}
function chart(sourceId: number, endRow: number, domainColumn: number, seriesColumns: number[], title: string, row: number, type: 'COLUMN' | 'LINE' | 'BAR' = 'COLUMN', stacked = false) {
  const range = (column: number) => ({ sourceRange: { sources: [{ sheetId: sourceId, startRowIndex: 0, endRowIndex: endRow, startColumnIndex: column, endColumnIndex: column + 1 }] } });
  return {
    spec: { title, fontName: 'Arial', basicChart: { chartType: type, legendPosition: 'BOTTOM_LEGEND', headerCount: 1,
      ...(stacked ? { stackedType: 'STACKED' } : {}),
      axis: [{ position: 'BOTTOM_AXIS', title: type === 'BAR' ? '건수' : '' }, { position: 'LEFT_AXIS', title: type === 'LINE' ? '비율 (%) · 빈칸은 미관찰' : '' }],
      domains: [{ domain: range(domainColumn) }], series: seriesColumns.map((column, i) => ({ series: range(column), targetAxis: type === 'BAR' ? 'BOTTOM_AXIS' : 'LEFT_AXIS', colorStyle: { rgbColor: colors[i % colors.length] } })) } },
    position: { overlayPosition: { anchorCell: { sheetId: 0, rowIndex: row, columnIndex: 0 }, widthPixels: 960, heightPixels: 300 } },
  };
}
const percent = (count: number, total: number): number | null => total > 0 ? Math.round(count / total * 1000) / 10 : null;

/** A snapshot of exactly the loaded range. No cross-emotion scores or inferred observations. */
export function buildGoogleSheetsReport(options: SheetsReportOptions) {
  const allRecords = uniqueRecords(options.records);
  const records = allRecords.filter(r=>r.learnerCode && r.usageMode==='live');
  const outcomes = summarizeOutcomes(records);
  const observation = summarizeTeacherIndicators(records);
  const codes = [...new Set(records.map(record => record.learnerCode).filter((code): code is string => Boolean(code)))].sort();
  const unassigned = allRecords.filter(record => !record.learnerCode).length;
  const weekly: ReportCell[][] = [['학생 코드', '주 시작일 (한국 시간)', '활동 수', '동일 부정감정 비교 수', '강도 감소', '강도 같음', '강도 증가', '요청 기회 수', '자발적 요청 수', '자발적 요청 (%)', '지원 확인 수', '지원 제공 수', '지원 제공 (%)', '관찰 시간 (분)', '참여 시간 (분)', '참여 (%)', '성공 요청 관찰 장소 수', '성공 요청 관찰 상대 역할 수']];
  const students: ReportCell[][] = [['학생 코드', '활동 수', '완료 수', '전후 응답 완성', '교사 생활 관찰 수', '도움·강도 알림 수', '미확인 알림', '자발적 요청 수', '요청 기회 수', '자발적 요청 (%)']];
  for (const code of codes) {
    const growth = buildGrowthReport(records, code);
    const studentRecords = records.filter(record => record.learnerCode === code);
    const observed = summarizeTeacherIndicators(studentRecords);
    students.push([code, growth.coverage.activities, growth.coverage.completed, growth.coverage.bothAnswered, growth.coverage.withObservation, growth.alerts.total, growth.alerts.unresolved, observed.opportunities ? observed.independentRequests : null, observed.opportunities || null, percent(observed.independentRequests, observed.opportunities)]);
    for (const week of growth.weeks) {
      const inWeek = studentRecords.filter(record => { const date = recordDate(record); return date && weekStartKst(date).getTime() === week.start.getTime(); });
      const teacher = summarizeTeacherIndicators(inWeek);
      const minutes = teacher.participation.reduce((sum, point) => sum + point.observedMinutes, 0);
      const participation = teacher.participation.reduce((sum, point) => sum + point.minutes, 0);
      const provided = teacher.supportCounts.find(item => item.outcome === 'provided')!.count;
      weekly.push([code, formatKstDate(week.start), week.activities, week.comparable, week.comparable ? week.lower : null, week.comparable ? week.same : null, week.comparable ? week.higher : null,
        week.requests?.total, week.requests?.count, week.requests ? percent(week.requests.count, week.requests.total) : null,
        teacher.supportKnown || null, teacher.supportKnown ? provided : null, percent(provided, teacher.supportKnown), minutes || null, minutes ? participation : null, percent(participation, minutes),
        teacher.generalizationRecords ? teacher.settings.length : null, teacher.generalizationRecords ? teacher.partners.length : null]);
    }
  }
  const emotions: ReportCell[][] = [['동일 감정', '강도 감소', '강도 같음', '강도 증가', '비교 수', '해석']];
  for (const row of outcomes.sameEmotion) emotions.push([row.emotion, row.lower, row.unchanged, row.higher, row.lower + row.unchanged + row.higher, NEGATIVE_EMOTIONS.has(row.emotion) ? '같은 부정 감정의 강도 변화 · 치료 효과를 뜻하지 않음' : '긍정 감정 · 강도 감소를 개선으로 해석하지 않음']);
  const emotionDataEnd = emotions.length;
  emotions.push([], ['활동 전 감정', '활동 후 감정', '변경 수', '해석']);
  outcomes.transitions.forEach(row => emotions.push([row.before, row.after, row.count, '다른 감정끼리 강도를 빼거나 점수화하지 않음']));
  const teacherRows: ReportCell[][] = [['관찰 지표', '건수 / 값', '분모 / 단위', '해석']];
  observation.promptCounts.forEach(row => teacherRows.push([`지원 수준 · ${row.label}`, row.count, '교사가 수준을 기록한 생활 관찰', '단계별 기록 수 · 점수 아님']));
  observation.supportCounts.forEach(row => teacherRows.push([`요청 후 도움 · ${row.label}`, row.count, observation.supportKnown, '지원 여부를 확인한 관찰 기준']));
  observation.behaviors.forEach(row => {
    const count = row.rates.reduce((sum, point) => sum + point.count, 0);
    const minutes = row.rates.reduce((sum, point) => sum + point.minutes, 0);
    teacherRows.push([`생활 속 행동 · ${row.target}`, minutes ? count / minutes : null, '회/분', `빈도와 관찰 시간이 모두 있는 ${row.rates.length}건 · 서로 다른 행동은 합치지 않음`]);
  });
  teacherRows.push(['다른 상황에서도 사용 · 장소', observation.generalizationRecords ? observation.settings.join(', ') : null, '생활 관찰', '자발적 요청이 실제로 기록된 장소'], ['다른 상대에게도 사용 · 상대 역할', observation.generalizationRecords ? observation.partners.join(', ') : null, '생활 관찰', '관찰 장소·상대 수는 기회 수의 영향도 받음']);
  const overview: ReportCell[][] = [
    ['마음GPS · 교사 보고서'], [options.scope], [options.coverage], [`생성: ${(options.generatedAt ?? new Date()).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (한국 시간) · 저장 시점의 사본`],
    ['현황', '값', '읽는 방법'],
    ['활동 기록', outcomes.totalActivities, '도움 알림·교사 관찰만 남긴 기록 제외'], ['완료한 활동', outcomes.completed, '미완료·중단과 구분'],
    ['전후 응답 완성', outcomes.response.both, `새 기록 방식 활동 ${outcomes.explicitActivities}건 중 감정과 강도 모두 응답`],
    ['활동 전만 응답 완성', outcomes.response.beforeOnly, '활동 후 미완성이며 변화 판단 보류'], ['활동 후만 응답 완성', outcomes.response.afterOnly, '활동 전 미완성이며 변화 판단 보류'],
    ['전후 모두 미완성', outcomes.response.neither, '감정 또는 강도 일부 응답도 포함 · 0점 처리하지 않음'], ['이전 방식 활동', outcomes.legacyActivities, '선택 여부 확인 불가 · 전후 비교 제외'],
    ['교사 생활 관찰', observation.observedRecords, '앱의 카드 선택과 구분'], ['자발적 요청', observation.opportunities ? observation.independentRequests : null, `관찰된 기회 ${observation.opportunities}회 · 빈칸은 미관찰`],
    ['도움·강도 알림', records.filter(record => record.helpRequested).length, '이메일 발송 성공 횟수와 다름'], ['학생 미지정', unassigned, '학생별·주별 변화에서 제외'],
    ['중복 제거', options.records.length - records.length, '이벤트/기록 ID 기준'],
    ['해석', codes.length === 1 && !unassigned ? '한 학생의 기록' : '범위 내 현황 · 여러 학생 합계는 개인의 변화가 아님'],
    ['자료 범위', options.truncated ? '불러오기 상한에 도달한 부분 기록입니다. 기간을 줄여 다시 만드세요.' : '선택하여 불러온 기록만 포함합니다.'],
    ['주의', '수치만으로 앱의 효과나 학생의 성장 정도를 단정하지 않습니다. 관찰 기회·수업 상황·응답 수를 함께 살펴보세요.'],
    ['그래프', '학생 한 명의 기간 보고서를 만들면 주별 감정 강도·자발적 요청·지원 제공 그래프가 함께 표시됩니다.'],
  ];
  const instructions: ReportCell[][] = [['항목', '해석 방법'], ['보고서 저장', '교사가 보고서 만들기를 누른 시점의 사본입니다. 이후 앱 기록은 자동 반영되지 않으며 새 보고서를 만들어 비교합니다.'],
    ['비공개', '공유 권한을 추가하지 않습니다. 교사 본인의 Drive에 생성합니다. 이후 공유·다운로드·삭제는 교사가 관리합니다.'],
    ['학생이 느끼는 변화', '활동 전후에 같은 감정과 강도를 모두 선택한 기록만 강도 방향을 비교합니다. 감정이 바뀐 경우 별도 표로 봅니다.'],
    ['미응답', '빈칸은 미응답·미관찰 또는 비교 불가이며 0이 아닙니다. 요청 기회가 없으면 자발적 요청 비율도 비워 둡니다.'],
    ['스스로 표현하는 능력', '교사가 생활 속에서 관찰한 자발적 요청 수 / 요청 기회 수를 봅니다. 앱에서 답을 고른 횟수는 대신 사용하지 않습니다.'],
    ['필요한 지원', '혼자·말로 안내·시범·함께 수행의 분포를 봅니다. 관찰 기회와 상황이 비슷한지 먼저 확인합니다.'],
    ['실제 도움으로 연결', '요청 뒤 지원이 제공/일부 제공/제공되지 않음으로 확인된 관찰만 셉니다. 이메일 발송과는 다른 지표입니다.'],
    ['생활 속 변화', '같은 목표 행동의 관찰 시간당 빈도 및 참여 시간 / 관찰 시간을 봅니다. 다른 목표 행동이나 학생을 단일 점수로 합치지 않습니다.'],
    ['다른 상황에서도 사용', '생활 속 자발적 요청이 기록된 장소·상대 역할을 봅니다. 새로운 장소에서의 관찰 기회가 있었는지도 함께 확인합니다.'],
    ['표본이 적을 때', '기록 수·분모가 작은 비율은 쉽게 달라집니다. 개선률·효과 점수로 부르거나 인과관계를 단정하지 않습니다.'],
    ['분석 제외', `학생 미지정·시험·사용 구분 미확인 ${allRecords.length-records.length}건은 변화 지표에서 제외하고 원본에 보존합니다. 기록을 임의로 추정하지 않습니다.`],
    ['원본 기록', '감정·관찰·메모가 포함되어 있습니다. 목적에 필요한 사람에게만 공유하고 학교의 보관·삭제 기준을 따르세요.']];
  const sheets = [tab(0, '한눈에 보기', overview, [230, 230, 440]), tab(1, '주별 변화', weekly), tab(2, '학생별 요약', students), tab(3, '감정 변화', emotions), tab(4, '교사 관찰', teacherRows, [280, 220, 220, 440]), tab(5, '원본 기록', recordsToTable(allRecords)), tab(6, '해석 안내', instructions, [240, 850])];
  sheets[0].merges = [0, 1, 2, 3].map(row => ({ sheetId: 0, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: 0, endColumnIndex: 3 }));
  for (const row of [17, 18, 19, 20]) sheets[0].merges.push({ sheetId: 0, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: 1, endColumnIndex: 3 });
  for (const row of [0, 1, 2, 3, 17, 18, 19, 20]) sheets[0].data[0].rowMetadata[row].pixelSize = row === 19 ? 64 : 48;
  // The cover is a report, not a sortable table. Charts start below the summary.
  delete (sheets[0] as Partial<typeof sheets[0]>).basicFilter;
  if (students.length > 1) sheets[0].charts.push(chart(2, students.length, 0, [1, 2, 3], '학생별 활동·완료·전후 응답 수', 23));
  if (codes.length === 1 && weekly.length > 1) {
    sheets[0].charts.push(chart(1, weekly.length, 1, [4, 5, 6], '주별 동일 부정 감정의 강도 변화 (비교 가능한 기록만)', 40, 'COLUMN', true));
    sheets[0].charts.push(chart(1, weekly.length, 1, [9, 12, 15], '교사 생활 관찰 · 자발적 요청 / 지원 제공 / 참여 비율', 57, 'LINE'));
  } else if (emotionDataEnd > 1) sheets[0].charts.push(chart(3, emotionDataEnd, 0, [1, 2, 3], '범위 내 동일 감정의 강도 변화 (개인 성장 점수 아님)', 40, 'COLUMN', true));
  sheets[0].charts.forEach((item, i) => { (item as { position: { overlayPosition: { anchorCell: { rowIndex: number } } } }).position.overlayPosition.anchorCell.rowIndex = 23 + i * 17; });
  return { properties: { title: options.title.slice(0, 180), locale: 'ko_KR', timeZone: 'Asia/Seoul' }, sheets };
}
