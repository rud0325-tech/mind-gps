import { I_MESSAGE_SCENARIOS, I_MESSAGE_RETIRED_SCENARIOS, type IMessageScenario, type LearningChoice } from '../learning/content';

export const I_MESSAGE_LIBRARY_STORAGE_KEY = 'mindgps.imessage-library.v1';
export const MAX_I_MESSAGE_LIBRARY_ITEMS = 50;
export const MAX_I_MESSAGE_REQUESTS = 20;
export const MAX_I_MESSAGE_TEXT_LENGTH = 60;
export const I_MESSAGE_SITUATION_PICTURE_IDS = ['friend-teasing', 'activity-difficult', 'noise', 'activity-unavailable', 'waiting', 'custom-situation'] as const;
export const I_MESSAGE_REQUEST_PICTURE_IDS = ['quieter', 'quiet-place', 'time', 'rest-while-waiting', 'stop-teasing', 'kind-words', 'repeat-explanation', 'easier-activity', 'unavailable-reason', 'available-time', 'choose-other-activity', 'custom-request'] as const;

/** Extra requests are keyed by either an existing situation or a locally authored one. */
export interface IMessageLibrary {
  scenarios: IMessageScenario[];
  requests: Record<string, LearningChoice[]>;
}

const pictureIcons: Record<string, string> = {
  'activity-unavailable': '🎯', 'unavailable-reason': '❓', 'available-time': '🕒', 'choose-other-activity': '🎲',
  noise: '🔊', waiting: '⏳', 'friend-teasing': '💬', 'activity-difficult': '🧩', 'custom-situation': '💬',
  quieter: '🤫', 'quiet-place': '🌿', time: '🕒', 'rest-while-waiting': '🌿', 'stop-teasing': '✋',
  'kind-words': '💬', 'repeat-explanation': '🔄', 'easier-activity': '🧩', 'custom-request': '🗣️',
};

function emptyLibrary(): IMessageLibrary {
  return { scenarios: [], requests: {} };
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}을 입력해 주세요.`);
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (Array.from(normalized).length > MAX_I_MESSAGE_TEXT_LENGTH) throw new Error(`${label}은 ${MAX_I_MESSAGE_TEXT_LENGTH}자 이내로 적어 주세요.`);
  return normalized;
}

function id(prefix: string): string {
  const unique = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${unique}`;
}

function identifier(value: unknown, prefix?: string): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(value) || (prefix && (!value.startsWith(`${prefix}-`) || value.length <= prefix.length + 1))) {
    throw new Error('저장된 항목의 번호가 올바르지 않아요.');
  }
  return value;
}

function picture(value: unknown, type: 'situation' | 'request'): string {
  const allowed: readonly string[] = type === 'situation' ? I_MESSAGE_SITUATION_PICTURE_IDS : I_MESSAGE_REQUEST_PICTURE_IDS;
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error('상황이나 부탁에 사용할 그림을 골라 주세요.');
  return value;
}

function register(value: unknown): 'peer' | 'polite' {
  if (value !== 'peer' && value !== 'polite') throw new Error('친구에게 말하기 또는 높임말을 골라 주세요.');
  return value;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('저장된 내용의 형식이 맞지 않아요.');
  return value as Record<string, unknown>;
}

function choice(choiceId: string, sentence: string, pictureId: string): LearningChoice {
  return { id: choiceId, sentence, word: sentence, icon: pictureIcons[pictureId], pictureId, custom: true };
}

/** Keep the student's words intact; choosing a register never rewrites Korean endings. */
export function createCustomIMessageScenario(input: {
  situation: string; request: string; register: 'peer' | 'polite'; situationPicture: string; requestPicture: string;
}): IMessageScenario {
  const situation = text(input.situation, '상황');
  const request = createCustomIMessageRequest({ sentence: input.request, pictureId: input.requestPicture }, []);
  return {
    ...choice(id('custom-imessage'), situation, picture(input.situationPicture, 'situation')),
    clause: situation,
    register: register(input.register),
    requests: [request],
  };
}

/** Pass the situation's visible requests, including its saved additions, for duplicate/limit checks. */
export function createCustomIMessageRequest(input: { sentence: string; pictureId: string }, existing: readonly LearningChoice[]): LearningChoice {
  const sentence = text(input.sentence, '부탁하는 말');
  if (existing.length >= MAX_I_MESSAGE_REQUESTS) throw new Error('한 상황에는 부탁하는 말을 20개까지 넣을 수 있어요.');
  if (existing.some(item => item.sentence.trim().replace(/\s+/gu, ' ') === sentence)) throw new Error('이미 같은 부탁하는 말이 있어요.');
  return choice(id('custom-request'), sentence, picture(input.pictureId, 'request'));
}

function readRequest(value: unknown): LearningChoice {
  const entry = object(value);
  if (entry.custom !== true) throw new Error('직접 등록한 부탁하는 말만 저장할 수 있어요.');
  return choice(identifier(entry.id, 'custom-request'), text(entry.sentence, '부탁하는 말'), picture(entry.pictureId, 'request'));
}

function uniqueChoices(choices: readonly LearningChoice[]) {
  if (new Set(choices.map(item => item.id)).size !== choices.length) throw new Error('부탁하는 말의 번호가 겹쳐요.');
  if (new Set(choices.map(item => item.sentence)).size !== choices.length) throw new Error('이미 같은 부탁하는 말이 있어요.');
}

function readScenario(value: unknown): IMessageScenario {
  const entry = object(value);
  if (entry.custom !== true) throw new Error('직접 등록한 상황만 저장할 수 있어요.');
  if (!Array.isArray(entry.requests) || entry.requests.length < 1 || entry.requests.length > MAX_I_MESSAGE_REQUESTS) {
    throw new Error('한 상황에는 부탁하는 말을 1개부터 20개까지 넣을 수 있어요.');
  }
  const sentence = text(entry.sentence, '상황');
  const requests = entry.requests.map(readRequest);
  uniqueChoices(requests);
  return {
    ...choice(identifier(entry.id, 'custom-imessage'), sentence, picture(entry.pictureId, 'situation')),
    clause: sentence,
    register: register(entry.register),
    requests,
  };
}

function readLibrary(value: unknown): IMessageLibrary {
  const entry = object(value);
  if (!Array.isArray(entry.scenarios) || entry.scenarios.length > MAX_I_MESSAGE_LIBRARY_ITEMS) throw new Error('직접 등록한 상황은 50개까지 저장할 수 있어요.');
  const scenarios = entry.scenarios.map(readScenario);
  const allScenarios = [...I_MESSAGE_SCENARIOS, ...scenarios];
  const requestScenarios = [...allScenarios, ...I_MESSAGE_RETIRED_SCENARIOS];
  if (new Set(allScenarios.map(item => item.id)).size !== allScenarios.length) throw new Error('상황 번호가 겹쳐요.');
  if (new Set(allScenarios.map(item => item.sentence)).size !== allScenarios.length) throw new Error('이미 같은 상황이 있어요. 그 상황에서 부탁하는 말을 추가해 주세요.');
  const savedRequests = object(entry.requests);
  if (Object.keys(savedRequests).length > requestScenarios.length) throw new Error('저장된 상황과 부탁하는 말이 맞지 않아요.');
  const requests = Object.fromEntries(Object.entries(savedRequests).map(([scenarioId, values]) => {
    identifier(scenarioId);
    const scenario = requestScenarios.find(item => item.id === scenarioId);
    if (!scenario) throw new Error('부탁하는 말에 연결된 상황을 찾을 수 없어요.');
    if (!Array.isArray(values) || scenario.requests.length + values.length > MAX_I_MESSAGE_REQUESTS) throw new Error('한 상황에는 부탁하는 말을 20개까지 넣을 수 있어요.');
    const added = values.map(readRequest);
    uniqueChoices([...scenario.requests, ...added]);
    return [scenarioId, added];
  }));
  const customRequestIds = [
    ...scenarios.flatMap(scenario => scenario.requests.map(request => request.id)),
    ...Object.values(requests).flatMap(choices => choices.map(request => request.id)),
  ];
  if (new Set(customRequestIds).size !== customRequestIds.length) throw new Error('부탁하는 말의 번호가 겹쳐요.');
  return { scenarios, requests };
}

/** Local-only authored content. Neither microphone recordings nor external activity records go here. */
export function loadIMessageLibrary(storage: Pick<Storage, 'getItem'>): { library: IMessageLibrary; error: string } {
  let raw: string | null;
  try {
    raw = storage.getItem(I_MESSAGE_LIBRARY_STORAGE_KEY);
  } catch {
    return { library: emptyLibrary(), error: '이 기기에서 저장한 상황과 부탁하는 말을 읽을 수 없어요.' };
  }
  if (raw === null) return { library: emptyLibrary(), error: '' };
  try {
    if (raw.length > 1_000_000) throw new Error('저장된 내용이 너무 커요.');
    const data = object(JSON.parse(raw));
    if (data.version !== 1) throw new Error('저장된 내용의 버전을 확인할 수 없어요.');
    return { library: readLibrary(data), error: '' };
  } catch {
    return { library: emptyLibrary(), error: '저장된 상황과 부탁하는 말을 읽지 못했어요. 기존 저장 내용은 그대로 두었어요.' };
  }
}

export function saveIMessageLibrary(storage: Pick<Storage, 'setItem'>, library: IMessageLibrary): { ok: boolean; error: string } {
  let validated: IMessageLibrary;
  try {
    validated = readLibrary(library);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '저장할 내용을 확인해 주세요.' };
  }
  try {
    storage.setItem(I_MESSAGE_LIBRARY_STORAGE_KEY, JSON.stringify({ version: 1, ...validated }));
    return { ok: true, error: '' };
  } catch {
    return { ok: false, error: '이 기기에 저장하지 못했어요. 저장 공간과 브라우저 설정을 확인해 주세요.' };
  }
}
