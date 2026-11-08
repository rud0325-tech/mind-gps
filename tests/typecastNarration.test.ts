import assert from 'node:assert/strict';
import test from 'node:test';
import { createTypecastNarrationResolver, normalizeRecordedNarration, type TypecastRecordingManifest } from '../src/lib/typecastNarration';

const text = '지금 마음이 어떤가요? 내 마음과 비슷한 표정을 하나 골라 주세요.';
const row = { id: 'guide_emotion', text, fileName: 'guide_emotion.mp3', verified: true };
const files = { '../assets/tts/recorded/guide_emotion.mp3': '/bundled/guide-emotion.mp3' };

test('a verified delivered recording matches only exact text with normalized whitespace', () => {
  const resolver = createTypecastNarrationResolver({ version: 1, recordings: [row] }, files);
  assert.equal(resolver.getRecordedNarration(text), files['../assets/tts/recorded/guide_emotion.mp3']);
  assert.equal(resolver.getRecordedNarration(`  ${text.replace(' ', '\n\t ')}\n`), files['../assets/tts/recorded/guide_emotion.mp3']);
  assert.equal(resolver.getRecordedNarration(text.replace('어떤가요?', '어떤가요.')), undefined);
  assert.equal(resolver.getRecordedNarration(text.replace('하나 ', '')), undefined);
  assert.equal(resolver.getRecordedNarration(text.slice(0, 11)), undefined);
  assert.equal(resolver.getRecordedNarration('How do you feel?'), undefined);
});

test('normalization does not change punctuation, Korean wording, or personal text', () => {
  assert.equal(normalizeRecordedNarration('  나는\n 쉬고   싶어!  '), '나는 쉬고 싶어!');
  assert.equal(normalizeRecordedNarration('나는 쉬고 싶어!'), '나는 쉬고 싶어!');
});

test('unverified rows and missing files never become available and guide fallback remains usable', () => {
  for (const manifest of [
    undefined,
    { version: 2, recordings: [row] },
    { version: 1, recordings: [{ ...row, verified: false }] },
    { version: 1, recordings: [{ id: row.id, text, fileName: row.fileName }] },
    { version: 1, recordings: [{ ...row, fileName: 'not-delivered.mp3' }] },
  ]) {
    const resolver = createTypecastNarrationResolver(manifest, files);
    assert.equal(resolver.getRecordedNarration(text), undefined);
    assert.equal(resolver.getRecordedGuide(row.id), undefined);
    assert.equal(resolver.getRecordedGuide(row.id, '/legacy/emotion.mp3'), '/legacy/emotion.mp3');
  }
});

test('guide IDs select a verified local file without replacing the legacy file', () => {
  const resolver = createTypecastNarrationResolver({ version: 1, recordings: [row] }, files);
  assert.equal(resolver.getRecordedGuide('guide_emotion', '/legacy/emotion.mp3'), '/bundled/guide-emotion.mp3');
  assert.equal(resolver.getRecordedGuide('guide_other', '/legacy/other.mp3'), '/legacy/other.mp3');
  assert.equal(files['../assets/tts/recorded/guide_emotion.mp3'], '/bundled/guide-emotion.mp3');
});

test('duplicate exact requests keep the first delivered recording and preserve both guide IDs', () => {
  const resolver = createTypecastNarrationResolver({ version: 1, recordings: [
    { ...row, id: 'missing-first', fileName: 'missing.mp3' },
    row,
    { ...row, id: 'guide_duplicate', fileName: 'duplicate.mp3' },
  ] }, { ...files, '../assets/tts/recorded/duplicate.mp3': '/bundled/duplicate.mp3' });
  assert.equal(resolver.getRecordedNarration(text), '/bundled/guide-emotion.mp3');
  assert.equal(resolver.getRecordedGuide('guide_duplicate'), '/bundled/duplicate.mp3');
});

test('malformed rows and paths outside the delivered recording folder are ignored', () => {
  const resolver = createTypecastNarrationResolver({ version: 1, recordings: [
    null, false, { ...row, text: '' }, { ...row, id: '' },
    { ...row, fileName: '../guide_emotion.mp3' },
    { ...row, fileName: 'https://example.com/guide.mp3' },
  ] }, files);
  assert.equal(resolver.getRecordedNarration(text), undefined);
  assert.equal(resolver.getRecordedGuide(row.id), undefined);
});

test('a typed pending recording stays unavailable even when its audio file is present', () => {
  const manifest: TypecastRecordingManifest = { version: 1, recordings: [{ ...row, verified: false }] };
  const resolver = createTypecastNarrationResolver(manifest, files);
  assert.equal(resolver.getRecordedNarration(text), undefined);
  assert.equal(resolver.getRecordedGuide(row.id), undefined);
  assert.equal(resolver.getRecordedGuide(row.id, '/legacy/emotion.mp3'), '/legacy/emotion.mp3');
});
