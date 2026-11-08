import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { I_MESSAGE_GUIDES, getIMessageGuide } from '../src/learning/activityGuides';
import { createTypecastNarrationResolver } from '../src/lib/typecastNarration';

const approved = JSON.parse(readFileSync(new URL('./fixtures/typecastApprovedScript.json', import.meta.url), 'utf8')) as { clips: string[] };
const manifest = JSON.parse(readFileSync(new URL('../src/learning/typecastRecordings.json', import.meta.url), 'utf8'));

test('each I-message step contains only its approved Korean instruction, in recorded sentence order', () => {
  assert.equal(I_MESSAGE_GUIDES.length, 4);
  const expectedLines = [[11], [12], [13], [14, 15]];
  expectedLines.forEach((lines, step) => {
    const guide = getIMessageGuide(step);
    assert.equal(guide.ko, lines.map(line => approved.clips[line - 1]).join(' '));
    assert.deepEqual(guide.clipIds, lines.map(line => `mgps-${String(line).padStart(3, '0')}`));
    for (const id of guide.clipIds) {
      const recording = manifest.recordings.find((row: { id: string }) => row.id === id);
      assert.equal(recording?.verified, true, `${id} must be confirmed before use in a stage guide.`);
    }
  });
});

test('English instructions retain the existing four choices and supported ways to express the final message', () => {
  assert.deepEqual(I_MESSAGE_GUIDES.map(guide => guide.en), [
    'Choose a situation. You can also add your own situation.',
    'Choose how you feel. All feelings are okay.',
    'Choose what you want to ask for. You can also add your own words.',
    'This is your I-message. It tells what happened, how you feel, and what you need. You can speak, listen, point, or show your message.',
  ]);
});

test('a missing short guide does not resolve to the longer full-activity recording', () => {
  const full = manifest.recordings.find((row: { id: string }) => row.id === 'guide_i_message');
  assert.ok(full);
  const onlyFullGuide = createTypecastNarrationResolver({ version: 1, recordings: [full] }, {
    [`../assets/tts/recorded/${full.fileName}`]: '/full-activity.mp3',
  });
  for (const guide of I_MESSAGE_GUIDES) assert.equal(onlyFullGuide.getRecordedNarration(guide.ko), undefined);
});
