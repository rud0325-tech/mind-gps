import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { FEELINGS, I_MESSAGE_SCENARIOS, makeIMessage } from '../src/learning/content';
import { SIMPLE_REBT_SCENARIOS } from '../src/learning/simpleRebt';
import { POSITIVE_MESSAGES } from '../src/learning/positiveMessages';
import { getRebtStory } from '../src/learning/rebtStory';
import { createIMessageLesson, createRebtLesson, createRelaxationLesson, createSoundLesson } from '../src/learning/powerCardLesson';
import { createPowerCardContent, getPowerCardNarration } from '../src/lib/powerCardExport';
import { createTypecastNarrationResolver, normalizeRecordedNarration, type TypecastRecordingManifest } from '../src/lib/typecastNarration';
import { displayedIMessageParts } from '../src/i18n/iMessage';
import { resolveSentenceNarration } from '../src/hooks/useSentenceNarration';

type ApprovedScript = {
  version: 1;
  sourceManifestSha256: string;
  scriptSha256: string;
  clips: string[];
  requests: { id: string; clips: number[] }[];
};

// Minimal immutable snapshot of the approved 2026-10-09 script and connection map.
// Tests never read an external outputs directory or regenerate the approved words.
const approved: ApprovedScript = JSON.parse(readFileSync(new URL('./fixtures/typecastApprovedScript.json', import.meta.url), 'utf8'));
const scriptSha256 = 'ad97d7a4c2b9e0eb6cf48e7f07196834bb5c88a8262c1b75b0b316a7d48647fe';
const requestMapSha256 = 'b428669db68348419a55c99029b5763077222511a70ebba15b8876ecb8bf0eff';
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const clipId = (index: number) => `mgps-${String(index + 1).padStart(3, '0')}`;
const requestText = (request: ApprovedScript['requests'][number]) => request.clips.map(line => approved.clips[line - 1]).join(' ');
const approvedRequests = new Map(approved.requests.map(request => [request.id, requestText(request)]));
// Replacement audio supplied on 2026-10-11 repairs line 158 and its dependants.
// The unused old story introduction at 239 still lacks its ending; keep it blocked.
const expectedPendingClipIds = ['mgps-239'];
const expectedPendingLines = new Set(expectedPendingClipIds.map(id => Number(id.slice(5))));
const expectedPendingRequestIds = new Set(approved.requests.filter(request => request.clips.some(line => expectedPendingLines.has(line))).map(request => request.id));
const expectedPendingIds = new Set([...expectedPendingClipIds, ...expectedPendingRequestIds]);
const manifestPath = new URL('../src/learning/typecastRecordings.json', import.meta.url);
const audioDirectory = new URL('../src/assets/tts/recorded/', import.meta.url);
const packAvailable = existsSync(manifestPath);
// An absent pack is an explicit pending delivery, never a claim of audio coverage.
const delivery = { skip: packAvailable ? false : 'Verified Typecast pack has not been delivered; audio coverage is pending.' };

function readPack() {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as TypecastRecordingManifest;
  assert.equal(manifest.version, 1);
  assert.ok(Array.isArray(manifest.recordings));
  const byId = new Map(manifest.recordings.map(row => [row.id, row]));
  const files: Record<string, string> = {};
  for (const row of manifest.recordings) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.mp3$/u.test(row.fileName)) continue;
    const path = new URL(row.fileName, audioDirectory);
    if (existsSync(path)) files[`../assets/tts/recorded/${row.fileName}`] = fileURLToPath(path);
  }
  return { manifest, byId, files, resolver: createTypecastNarrationResolver(manifest, files) };
}

function expectRequest(pack: ReturnType<typeof readPack>, id: string, text: string) {
  assert.equal(approvedRequests.get(id), text, `Current Korean text changed: ${id}`);
  const row = pack.byId.get(id);
  assert.ok(row, `Missing request: ${id}`);
  assert.equal(row.text, text, `Delivered text differs: ${id}`);
  const pending = expectedPendingRequestIds.has(id);
  assert.equal(row.verified, !pending, `Unexpected verification state: ${id}`);
  if (pending) assert.equal(pack.resolver.getRecordedNarration(text), undefined, `Pending audio became playable: ${id}`);
  else assert.ok(pack.resolver.getRecordedNarration(text), `No playable exact match: ${id}`);
  return !pending;
}

/** Read MPEG Layer III frames, including MPEG-2/2.5 and ID3v2-prefixed files.
 * This proves nonempty MP3 framing/duration, not that the speech matches the script.
 * Actual words and clip boundaries require the separate delivery listening/ASR audit. */
function mp3FrameInfo(data: Buffer, name: string) {
  let start = 0;
  if (data.subarray(0, 3).toString('ascii') === 'ID3') {
    assert.ok(data.length >= 10, `Incomplete ID3 header: ${name}`);
    assert.ok(data.subarray(6, 10).every(byte => byte < 128), `Invalid ID3 size: ${name}`);
    const size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9];
    start = 10 + size + (data[3] === 4 && (data[5] & 0x10) ? 10 : 0);
    assert.ok(start < data.length, `ID3 without audio: ${name}`);
  }
  const frameAt = (offset: number) => {
    if (offset + 4 > data.length || data[offset] !== 0xff || (data[offset + 1] & 0xe0) !== 0xe0) return undefined;
    const version = (data[offset + 1] >> 3) & 3;
    const layer = (data[offset + 1] >> 1) & 3;
    const bitrateIndex = (data[offset + 2] >> 4) & 15;
    const sampleIndex = (data[offset + 2] >> 2) & 3;
    if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleIndex === 3) return undefined;
    const bitrates = version === 3
      ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
      : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    const sampleRate = [44100, 48000, 32000][sampleIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
    const length = Math.floor((version === 3 ? 144 : 72) * bitrates[bitrateIndex] * 1000 / sampleRate) + ((data[offset + 2] >> 1) & 1);
    return { length, seconds: (version === 3 ? 1152 : 576) / sampleRate };
  };
  // Tolerate a short encoder prefix while requiring consecutive complete frames.
  for (let candidate = start; candidate < Math.min(data.length - 3, start + 4096); candidate += 1) {
    let offset = candidate;
    let frames = 0;
    let duration = 0;
    let truncated = false;
    while (offset + 4 <= data.length) {
      const frame = frameAt(offset);
      if (!frame) break;
      if (offset + frame.length > data.length) { truncated = true; break; }
      frames += 1;
      duration += frame.seconds;
      offset += frame.length;
    }
    if (frames >= 2) {
      assert.equal(truncated, false, `Truncated MP3 frame: ${name}`);
      assert.ok(Number.isFinite(duration) && duration > 0, `No audio duration: ${name}`);
      return { frames, duration };
    }
  }
  assert.fail(`No consecutive MPEG Layer III frames: ${name}`);
}

test('approved fixture preserves all 296 lines and 433 request sequences without external files', () => {
  assert.equal(approved.version, 1);
  assert.equal(approved.clips.length, 296);
  assert.equal(new Set(approved.clips).size, 296);
  assert.equal(approved.scriptSha256, scriptSha256);
  assert.equal(sha256(`${approved.clips.join('\n')}\n`), scriptSha256);
  assert.equal(approved.requests.length, 433);
  assert.equal(approvedRequests.size, 433);
  assert.equal(sha256(JSON.stringify(approved.requests)), requestMapSha256);
  for (const request of approved.requests) {
    assert.ok(request.clips.length > 0, request.id);
    assert.ok(request.clips.every(line => Number.isInteger(line) && line >= 1 && line <= 296), request.id);
  }
  assert.equal(expectedPendingRequestIds.size, 1, 'Pending dependencies changed; review before publishing.');
  assert.equal(expectedPendingIds.size, 2);
});

test('delivered pack retains every approved clip and request with exact wording and no conflicting files', delivery, () => {
  const pack = readPack();
  assert.equal(pack.byId.size, pack.manifest.recordings.length, 'Recording IDs must be unique.');
  const textByFile = new Map<string, string>();
  for (const row of pack.manifest.recordings) {
    assert.equal(row.verified, !expectedPendingIds.has(row.id), `Unexpected verification state: ${row.id}`);
    assert.match(row.fileName, /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.mp3$/u);
    const text = normalizeRecordedNarration(row.text);
    const previous = textByFile.get(row.fileName);
    if (previous !== undefined) assert.equal(previous, text, `One file mapped to different words: ${row.fileName}`);
    textByFile.set(row.fileName, text);
    if (row.verified) assert.ok(pack.files[`../assets/tts/recorded/${row.fileName}`], `Missing verified audio file: ${row.fileName}`);
  }
  approved.clips.forEach((text, index) => {
    const row = pack.byId.get(clipId(index));
    assert.ok(row, `Missing approved clip: ${clipId(index)}`);
    assert.equal(row.text, text, `Clip wording changed: ${clipId(index)}`);
    if (expectedPendingIds.has(row.id)) assert.equal(pack.resolver.getRecordedNarration(text), undefined, `Pending clip became playable: ${row.id}`);
    else assert.ok(pack.resolver.getRecordedNarration(text), `Unresolved clip: ${clipId(index)}`);
  });
  for (const request of approved.requests) {
    expectRequest(pack, request.id, requestText(request));
    if (request.id.startsWith('guide_')) assert.ok(pack.resolver.getRecordedGuide(request.id), request.id);
  }
});

test('every verified unique audio file has complete MP3 frames and nonzero duration', delivery, () => {
  const { manifest } = readPack();
  const names = new Set(manifest.recordings.filter(row => row.verified).map(row => row.fileName));
  assert.ok(names.size > 0, 'An empty manifest is not a completed voice pack.');
  for (const name of names) {
    assert.match(name, /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.mp3$/u);
    const path = new URL(name, audioDirectory);
    assert.ok(existsSync(path), `Missing MP3: ${name}`);
    assert.ok(statSync(path).size > 0, `Empty MP3: ${name}`);
    mp3FrameInfo(readFileSync(path), name);
  }
});

test('all 8 supplementary lines resolve to the independently checked audio bytes', delivery, () => {
  const supplement = JSON.parse(readFileSync(new URL('./fixtures/typecastSupplement20261011.json', import.meta.url), 'utf8')) as {
    sourceSha256: string;
    clips: { id: string; text: string; fileName: string; sha256: string }[];
  };
  const pack = readPack();
  assert.equal(supplement.sourceSha256, 'fe13f673a1b5c923121bb5ac95d4dce1f0f56cda4b2eb26e6789a8c47df79836');
  assert.equal(supplement.clips.length, 8);
  for (const clip of supplement.clips) {
    const row = pack.byId.get(clip.id);
    assert.equal(row?.text, clip.text);
    assert.equal(row?.fileName, clip.fileName);
    assert.equal(row?.verified, true);
    const audio = pack.resolver.getRecordedNarration(clip.text);
    assert.equal(audio, fileURLToPath(new URL(clip.fileName, audioDirectory)));
    assert.equal(createHash('sha256').update(readFileSync(audio!)).digest('hex'), clip.sha256);
  }
  assert.equal(pack.byId.get('mgps-158')?.fileName, supplement.clips[7].fileName);
});

test('positive messages use 49 checked recordings and keep the user-held 24th recording unavailable', delivery, () => {
  const supplied = JSON.parse(readFileSync(new URL('./fixtures/typecastPositive20261011.json', import.meta.url), 'utf8')) as {
    sourceSha256: string;
    scriptSha256: string;
    clips: { id: string; messageId: string; text: string; fileName: string; sha256: string; verified: boolean }[];
  };
  const pack = readPack();
  assert.equal(supplied.sourceSha256, '1568ffb851d6cb304b4023a01b7ead2a0433acf3feb2ef92fb716bf1154105a7');
  assert.equal(supplied.scriptSha256, 'c43f9757c029f3fcae0471a9aca9dc8a3f589e73d4496663517656cb0f08d88e');
  assert.equal(sha256(supplied.clips.map(row => row.text).join('\n') + '\n'), supplied.scriptSha256);
  assert.equal(supplied.clips.length, 50);
  assert.equal(POSITIVE_MESSAGES.length, 50);
  assert.equal(new Set(supplied.clips.map(row => row.messageId)).size, 50);
  assert.deepEqual(supplied.clips.filter(row => !row.verified).map(row => row.id), ['positive-20261011-24']);
  assert.equal(supplied.clips.filter(row => row.verified).length, 49);
  const byMessage = new Map(supplied.clips.map(row => [row.messageId, row]));
  for (const message of POSITIVE_MESSAGES) {
    const clip = byMessage.get(message.id);
    assert.ok(clip, `No supplied message: ${message.id}`);
    assert.equal(clip.text, message.sentence);
    assert.equal(message.lines.join(' '), clip.text, 'Sentence layout must keep the spoken words.');
    assert.equal(message.word, clip.text, 'Word-level display must retain the same message.');
    const entry = pack.byId.get(clip.id);
    if (!clip.verified) {
      assert.equal(entry, undefined, 'The user-held wrong recording must not be installed.');
      assert.equal(pack.resolver.getRecordedNarration(message.sentence), undefined, 'Keep the listen button hidden until replacement delivery.');
      assert.equal(existsSync(new URL(clip.fileName, audioDirectory)), false);
      continue;
    }
    assert.equal(entry?.text, clip.text);
    assert.equal(entry?.fileName, clip.fileName);
    assert.equal(entry?.verified, true);
    const audio = pack.resolver.getRecordedNarration(message.sentence);
    assert.equal(audio, fileURLToPath(new URL(clip.fileName, audioDirectory)));
    assert.equal(createHash('sha256').update(readFileSync(audio!)).digest('hex'), clip.sha256);
    assert.equal(resolveSentenceNarration(message.sentence, audio, 'ko').recording, audio);
    assert.equal(resolveSentenceNarration(message.sentence, audio, 'en').recording, undefined, 'English must not play the Korean recording.');
  }
});

test('the unused pending story clip and its dependent request stay blocked while fallback remains usable', delivery, () => {
  const pack = readPack();
  for (const id of expectedPendingIds) {
    const row = pack.byId.get(id);
    assert.ok(row, `Pending review row must remain explicit: ${id}`);
    assert.equal(row.verified, false);
    assert.equal(pack.resolver.getRecordedNarration(row.text), undefined);
    assert.equal(pack.resolver.getRecordedGuide(id), undefined);
    assert.equal(pack.resolver.getRecordedGuide(id, '/existing-verified.mp3'), '/existing-verified.mp3');
    assert.equal(resolveSentenceNarration(row.text, '/existing-verified.mp3', 'ko', true).recording, '/existing-verified.mp3');
    const device = resolveSentenceNarration(row.text, undefined, 'ko', true);
    assert.equal(device.recording, undefined);
    assert.equal(device.text, row.text);
    assert.equal(resolveSentenceNarration(row.text, '/existing-verified.mp3', 'en', true).recording, undefined);
  }
});

test('all 36 Korean I-messages match the displayed parts, narration and card without wording changes', delivery, () => {
  const pack = readPack();
  let count = 0;
  for (const scenario of I_MESSAGE_SCENARIOS) for (const feeling of FEELINGS) for (const request of scenario.requests) {
    const text = makeIMessage(scenario, feeling, request);
    const displayed = displayedIMessageParts(scenario, feeling, request, 'ko').join(' ');
    assert.equal(displayed, text);
    expectRequest(pack, `imessage-${scenario.id}-${feeling.id}-${request.id}`, text);
    const audio = pack.resolver.getRecordedNarration(text);
    assert.equal(resolveSentenceNarration(displayed, audio, 'ko', true).text, text);
    assert.equal(resolveSentenceNarration(displayed, audio, 'ko', true).recording, audio);
    assert.equal(resolveSentenceNarration(displayed, audio, 'en', true).recording, undefined, 'English must not play Korean recordings.');
    for (const difficulty of ['글', '그림+단어', '그림'] as const) {
      const card = createPowerCardContent(null, difficulty, '나-전달법', undefined, createIMessageLesson(scenario, feeling, request));
      assert.equal(card.spokenText, text);
      assert.equal(getPowerCardNarration(card, 'ko'), text);
    }
    count += 1;
  }
  assert.equal(count, 36);
});

test('all 50 REBT game hints have complete exact recordings', delivery, () => {
  const pack = readPack();
  let count = 0;
  let playable = 0;
  for (const scenario of SIMPLE_REBT_SCENARIOS) {
    for (const [suffix, check] of [['maze-hint', scenario.check], ['maze-picture-hint', scenario.pictureCheck]]) {
      if (expectRequest(pack, `${scenario.id}-${suffix}`, `${check} ${scenario.alternatives[0].sentence}`)) playable += 1;
      count += 1;
    }
  }
  assert.equal(count, 50);
  assert.equal(playable, 50);
});

test('all 45 other cards have exact recorded narration in each reading level', delivery, () => {
  const pack = readPack();
  const cases = [
    ...SIMPLE_REBT_SCENARIOS.map(scenario => ({ id: `card-${scenario.id}`, technique: '생각 바꾸기', lesson: createRebtLesson(scenario, scenario.alternatives[0]) })),
    ...Array.from({ length: 16 }, (_, mask) => ({ id: `card-relax-${mask}`, technique: '이완훈련', lesson: createRelaxationLesson(Array.from({ length: 4 }, (_, index) => Boolean(mask & (1 << index)))) })),
    ...[['rain', '빗소리'], ['ocean', '파도 소리'], ['campfire', '모닥불 소리'], ['forest', '숲 소리']].map(([id, name]) => ({ id: `card-sound-${id}`, technique: '마음의 소리', lesson: createSoundLesson(name) })),
  ];
  assert.equal(cases.length, 45);
  const playable = new Set<string>();
  for (const item of cases) for (const difficulty of ['글', '그림+단어', '그림'] as const) {
    const card = createPowerCardContent(null, difficulty, item.technique, undefined, item.lesson);
    const text = getPowerCardNarration(card, 'ko');
    assert.equal(text, card.spokenText);
    if (expectRequest(pack, item.id, text)) playable.add(item.id);
  }
  assert.equal(playable.size, 45);
});

test('all 17 I-message selections have exact recordings, including the 7 newly supplied lines', delivery, () => {
  const pack = readPack();
  const choices = [...I_MESSAGE_SCENARIOS, ...FEELINGS, ...I_MESSAGE_SCENARIOS.flatMap(scenario => scenario.requests)];
  const supplied = ['친구가 나를 놀리는 말을 해요.', '지금 하는 활동이 어려워요.', '주변 사람이 큰 목소리로 말해요.', '불편해요', '화가 나요', '속상해요', '걱정이 돼요'];
  assert.equal(choices.length, 17);
  let reused = 0;
  const added: string[] = [];
  for (const choice of choices) {
    const audio = pack.resolver.getRecordedNarration(choice.sentence);
    assert.ok(audio, `Missing exact selection recording: ${choice.id}`);
    assert.equal(resolveSentenceNarration(choice.sentence, audio, 'ko').recording, audio);
    if (approved.clips.includes(choice.sentence)) {
      reused += 1;
    } else {
      added.push(choice.sentence);
      assert.equal(pack.byId.get(`add-20261011-${String(supplied.indexOf(choice.sentence) + 1).padStart(2, '0')}`)?.text, choice.sentence);
    }
  }
  assert.equal(reused, 10);
  assert.deepEqual(added, supplied);
});

test('story practice uses direct recordings in all 25 situations, without the former introductory phrase', delivery, () => {
  const pack = readPack();
  let recorded = 0;
  for (const scenario of SIMPLE_REBT_SCENARIOS) {
    const story = getRebtStory(scenario)!;
    for (const [part, text] of Object.entries(story)) {
      assert.doesNotMatch(text, /이야기 속 친구|친구와 함께 살펴볼 생각/);
      const audio = pack.resolver.getRecordedNarration(text);
      assert.ok(audio, `${scenario.id} ${part}: ${text}`);
      recorded += 1;
    }
  }
  assert.equal(recorded, 125);
  const praise = pack.byId.get('praise-direct-20261011');
  assert.equal(praise?.text, '잘했어요! 내 마음을 잘 다루었어요.');
  assert.ok(pack.resolver.getRecordedNarration(praise!.text));
});
