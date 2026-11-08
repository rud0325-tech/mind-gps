import test from 'node:test';
import assert from 'node:assert/strict';
import type { ActivityRecord } from '../src/types';
import { buildGoogleSheetsReport, sheetCell } from '../src/lib/googleSheetsReport';
import { createSheetsSnapshot, SheetsExportError } from '../src/lib/googleSheetsExport';
import { emptyObservation } from '../src/lib/recordSummary';
const base: ActivityRecord = { usageMode: 'live', id: '1', eventId: 'e1', createdBy: 'device', createdAt: { seconds: new Date('2026-10-05T01:00:00Z').getTime()/1000, nanoseconds: 0 }, learnerCode: 'S01', classId: 'class', student: 'pin-artist', studentName: '그림작가', difficulty: '그림', emotion: '화가나요', intensity: 4, afterEmotion: '화가나요', afterIntensity: 2, schemaVersion: 2, recordKind: 'activity', activityOutcome: 'completed', technique: '이완훈련', completed: true, helpRequested: false, status: '완료', interventionNeeded: false };
const report = (records: ActivityRecord[]) => buildGoogleSheetsReport({ records, title: '검증용', scope: 'S01', coverage: '테스트 기록' });
const values = (sheet: ReturnType<typeof report>['sheets'][number]) => sheet.data[0].rowData.map(row => row.values.map(cell => {
  const value = cell.userEnteredValue; return value && ('stringValue' in value ? value.stringValue : 'numberValue' in value ? value.numberValue : value.boolValue);
}));
test('report deduplicates events, excludes missing and cross-emotion intensity pairs, and does not zero-fill unobserved ratios', () => {
  const data = report([base, { ...base, id: 'duplicate' }, { ...base, id: '2', eventId: '2', afterEmotion: null, afterIntensity: null }, { ...base, id: '3', eventId: '3', afterEmotion: '편안해요' }, { ...base, id: '4', eventId: '4', learnerCode: null }]);
  const week = values(data.sheets[1])[1];
  assert.equal(week[2], 3); assert.equal(week[3], 1); assert.equal(week[4], 1);
  assert.equal(week[9], undefined); assert.equal(week[12], undefined); assert.equal(week[15], undefined);
  assert.equal(data.sheets[5].data[0].rowData.length, 5);
  assert.equal(values(data.sheets[0]).find(row => row[0] === '학생 미지정')?.[1], 1);
});
test('observed rates use opportunities, preserve real zero, and cover all six indicators', () => {
  const data = report([{ ...base, observation: { ...emptyObservation(), context: 'daily-life', requestOpportunities: 5, independentRequests: 0, supportOutcome: 'not-provided', observationMinutes: 20, participationMinutes: 10, promptLevel: 'verbal' } }]);
  const week = values(data.sheets[1])[1];
  assert.deepEqual(week.slice(7, 16), [5, 0, 0, 1, 0, 0, 20, 10, 50]);
  assert.equal(data.sheets[0].charts.length, 3);
  assert.ok(JSON.stringify(data).includes('다른 상황에서도 사용'));
});
test('user strings are literal values, not formulas, including original records', () => {
  assert.deepEqual(sheetCell('=IMPORTXML("https://example.org", "x")').userEnteredValue, { stringValue: '=IMPORTXML("https://example.org", "x")' });
  const body = report([{ ...base, practiceSummary: '=1+1' }]);
  assert.ok(JSON.stringify(body).includes('"stringValue":"=1+1"')); assert.ok(!JSON.stringify(body).includes('formulaValue'));
});
test('all chart ranges reference existing tabs/cells and individual trends are not fabricated for mixed students', () => {
  const data = report([base, { ...base, id: '2', eventId: '2', learnerCode: 'S02' }]);
  assert.equal(data.sheets[0].charts.length, 2);
  for (const chart of data.sheets[0].charts as any[]) for (const item of [...chart.spec.basicChart.domains.map((d:any)=>d.domain), ...chart.spec.basicChart.series.map((s:any)=>s.series)]) {
    const r = item.sourceRange.sources[0], source = data.sheets.find(sheet => sheet.properties.sheetId === r.sheetId)!;
    assert.ok(source); assert.ok(r.endRowIndex <= source.data[0].rowData.length); assert.ok(r.endColumnIndex <= source.properties.gridProperties.columnCount);
  }
});
test('successful export makes exactly one create call; no sharing calls or persisted credentials', async () => {
  let calls = 0;
  const url = await createSheetsSnapshot('test-token', report([base]), (async (url, init) => {
    calls++; assert.equal(url, 'https://sheets.googleapis.com/v4/spreadsheets?fields=spreadsheetId');
    assert.equal(init?.method, 'POST'); assert.equal((init?.headers as any).Authorization, 'Bearer test-token');
    return new Response(JSON.stringify({ spreadsheetId: 'test_report_123' }), { status: 200 });
  }) as typeof fetch);
  assert.equal(calls, 1); assert.equal(url, 'https://docs.google.com/spreadsheets/d/test_report_123/edit');
});
test('ambiguous create failure never retries; quota and access failures remain explicit', async () => {
  let calls = 0;
  await assert.rejects(createSheetsSnapshot('x', report([base]), (async () => { calls++; throw new Error('offline'); }) as typeof fetch), (e: unknown) => e instanceof SheetsExportError && e.uncertain);
  assert.equal(calls, 1);
  await assert.rejects(createSheetsSnapshot('x', report([base]), (async () => new Response('{}', { status: 403 })) as typeof fetch), /권한이 없어요/);
  await assert.rejects(createSheetsSnapshot('x', report([base]), (async () => new Response('{}', { status: 429 })) as typeof fetch), /요청 한도/);
});

test('create payload excludes read-only spreadsheet fields', () => {
  const body = report([base]);
  assert.equal('defaultFormat' in body.properties, false);
  assert.equal('spreadsheetId' in body, false);
  assert.equal('spreadsheetUrl' in body, false);
});

test('test and unconfirmed records stay in raw export but cannot inflate student growth',()=>{
 const data=report([base,{...base,id:'test',eventId:'test',usageMode:'test'},{...base,id:'old',eventId:'old',usageMode:undefined}]);
 assert.equal(values(data.sheets[1])[1][2],1);
 assert.equal(data.sheets[5].data[0].rowData.length,4);
 assert.ok(JSON.stringify(data).includes('미확인 2건'));
});
