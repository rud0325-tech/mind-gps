import { REBT_CATEGORIES, type RebtCategory, type RebtVisual, type SimpleChoice, type SimpleScenario } from '../learning/simpleRebt';

export const REBT_LIBRARY_STORAGE_KEY = 'mindgps.rebt-library.v1';
export const MAX_REBT_LIBRARY_ITEMS = 50;
export const MAX_REBT_TEXT_LENGTH = 60;
const MAX_THOUGHTS = 20;
const categories: RebtCategory[] = REBT_CATEGORIES.map(entry => entry.id);
const visuals: RebtVisual[] = ['wait', 'change', 'problem', 'study', 'greeting', 'game', 'laugh', 'share', 'sort', 'hello', 'feedback', 'play-choice', 'presentation', 'custom',
  'friend-other', 'friend-refusal', 'friend-conflict', 'presentation-anxiety', 'slow-finish', 'meal-spill', 'friend-mistake', 'teacher-mistake', 'practice-mistake',
  'denied-activity', 'unfair-scolding', 'peer-praise', 'peer-comparison', 'no-award', 'appearance-teasing', 'nickname-teasing', 'cancelled-activity', 'new-place'];

export interface CustomRebtInput { category: RebtCategory; situation: string; thought: string; helpful: string; }

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}을 입력해 주세요.`);
  const result = value.trim().replace(/\s+/gu, ' ');
  if (Array.from(result).length > MAX_REBT_TEXT_LENGTH) throw new Error(`${label}은 ${MAX_REBT_TEXT_LENGTH}자 이내로 적어 주세요.`);
  return result;
}

function id(prefix: string): string {
  const unique = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${unique}`;
}

function category(value: unknown, legacyVisual?: unknown): RebtCategory {
  // Old custom entries retain their text and pictures while adopting the new topic grouping.
  if (value === 'turns') return 'changes';
  if (value === 'school') return legacyVisual === 'wait' || legacyVisual === 'change' ? 'changes' : 'learning';
  if (value === 'practice') return 'learning';
  if (!categories.includes(value as RebtCategory)) throw new Error('목록에 있는 상황 종류를 골라 주세요.');
  return value as RebtCategory;
}

/** These are optional ways to express a need, not judgments about user-authored beliefs. */
function customActions(scenarioId: string): SimpleChoice[] {
  const base = scenarioId.slice(0, 100);
  return [
    { id: `${base}-express`, sentence: '내 생각을 말이나 그림으로 표현할래.', word: '내 생각 표현하기', visual: 'custom', kind: 'action' },
    { id: `${base}-support`, sentence: '선생님께 함께 살펴봐 달라고 할래.', word: '함께 살펴보기 요청하기', visual: 'custom', kind: 'action' },
  ];
}

/** User entries remain user-authored text. They are never automatically classified as correct. */
export function createCustomScenario(input: CustomRebtInput): SimpleScenario {
  const situation = text(input.situation, '상황');
  const thought = text(input.thought, '내 생각');
  const helpful = text(input.helpful, '도움 되는 생각');
  const scenarioId = id('custom');
  return {
    id: scenarioId, category: category(input.category), sentence: situation, word: situation,
    visual: 'custom', basic: false, custom: true,
    thoughts: [
      { id: `${scenarioId}-thought`, sentence: thought, word: thought, visual: 'custom', kind: 'thought', flexible: false },
      { id: `${scenarioId}-unknown`, sentence: '어떻게 생각할지 아직 모르겠어.', word: '어떻게 생각할지 아직 모르겠어.', visual: 'custom', kind: 'thought', flexible: false },
    ],
    check: '다른 생각도 함께 찾아볼까요?', pictureCheck: '다른 생각도 함께 찾아볼까요?',
    alternatives: [
      { id: `${scenarioId}-helpful`, sentence: helpful, word: helpful, visual: 'custom', kind: 'help' },
    ],
    actions: customActions(scenarioId),
  };
}

/** Editing visible fields must not erase older extra cards, illustrations, or stable identifiers. */
export function updateCustomScenario(existing: SimpleScenario, input: CustomRebtInput): SimpleScenario {
  const previous = readScenario(existing);
  const situation = text(input.situation, '상황');
  const thought = text(input.thought, '내 생각');
  const helpful = text(input.helpful, '도움 되는 생각');
  return {
    ...previous,
    category: category(input.category), sentence: situation, word: situation,
    thoughts: previous.thoughts.map((entry, index) => index === 0 ? { ...entry, sentence: thought, word: thought } : entry),
    alternatives: previous.alternatives.map((entry, index) => index === 0 ? { ...entry, sentence: helpful, word: helpful } : entry),
  };
}

export function addCustomThought(scenario: SimpleScenario, value: string): SimpleChoice {
  const sentence = text(value, '내 생각');
  if (scenario.thoughts.length >= MAX_THOUGHTS) throw new Error('한 상황에는 생각을 20개까지 넣을 수 있어요.');
  if (scenario.thoughts.some(item => item.sentence.trim() === sentence)) throw new Error('이미 같은 생각이 있어요.');
  return { id: id('custom-thought'), sentence, word: sentence, visual: 'custom', kind: 'thought', flexible: false };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('저장된 내용의 형식이 맞지 않아요.');
  return value as Record<string, unknown>;
}

function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(value)) throw new Error('저장된 항목의 번호가 올바르지 않아요.');
  return value;
}

function visual(value: unknown): RebtVisual {
  if (!visuals.includes(value as RebtVisual)) throw new Error('저장된 그림의 형식이 맞지 않아요.');
  return value as RebtVisual;
}

function readChoice(value: unknown, thought: boolean): SimpleChoice {
  const entry = object(value);
  if (entry.kind !== undefined && !['thought', 'help', 'action'].includes(entry.kind as string)) throw new Error('저장된 생각의 형식이 맞지 않아요.');
  if (entry.flexible !== undefined && typeof entry.flexible !== 'boolean') throw new Error('저장된 생각의 형식이 맞지 않아요.');
  return {
    id: identifier(entry.id), sentence: text(entry.sentence, '문장'), word: text(entry.word, '짧은 문장'), visual: visual(entry.visual),
    ...(entry.kind ? { kind: entry.kind as SimpleChoice['kind'] } : {}),
    ...(thought ? { flexible: entry.flexible === true } : {}),
  };
}

function readScenario(value: unknown): SimpleScenario {
  const entry = object(value);
  if (entry.custom !== true || typeof entry.basic !== 'boolean') throw new Error('직접 등록한 상황만 저장할 수 있어요.');
  if (!Array.isArray(entry.thoughts) || entry.thoughts.length < 2 || entry.thoughts.length > MAX_THOUGHTS || !Array.isArray(entry.alternatives) || entry.alternatives.length < 1 || entry.alternatives.length > 2) {
    throw new Error('저장된 카드 수가 올바르지 않아요.');
  }
  const thoughts = entry.thoughts.map(item => readChoice(item, true));
  const alternatives = entry.alternatives.map(item => readChoice(item, false));
  const scenarioId = identifier(entry.id);
  if (entry.actions !== undefined && (!Array.isArray(entry.actions) || entry.actions.length !== 2)) {
    throw new Error('저장된 행동 카드 수가 올바르지 않아요.');
  }
  const actions = entry.actions === undefined
    ? customActions(scenarioId)
    : (entry.actions as unknown[]).map(item => readChoice(item, false));
  if (actions.some(item => item.kind !== 'action')) throw new Error('저장된 행동 카드의 형식이 맞지 않아요.');
  const choices = [...thoughts, ...alternatives, ...actions];
  if (new Set(choices.map(item => item.id)).size !== choices.length) throw new Error('카드 번호가 겹쳐요.');
  return {
    id: scenarioId, category: category(entry.category, entry.visual), sentence: text(entry.sentence, '상황'), word: text(entry.word, '짧은 상황'),
    visual: visual(entry.visual), basic: entry.basic, custom: true, thoughts, alternatives, actions,
    check: text(entry.check, '다시 살펴보기'), pictureCheck: text(entry.pictureCheck, '그림 안내'),
  };
}

function readLibrary(value: unknown): SimpleScenario[] {
  if (!Array.isArray(value) || value.length > MAX_REBT_LIBRARY_ITEMS) throw new Error('직접 등록한 상황은 50개까지 저장할 수 있어요.');
  const result = value.map(readScenario);
  if (new Set(result.map(item => item.id)).size !== result.length) throw new Error('상황 번호가 겹쳐요.');
  return result;
}

/** Local-only library; audio recordings are never stored here. */
export function loadRebtLibrary(storage: Pick<Storage, 'getItem'>): { scenarios: SimpleScenario[]; error: string } {
  let raw: string | null;
  try {
    raw = storage.getItem(REBT_LIBRARY_STORAGE_KEY);
  } catch {
    return { scenarios: [], error: '이 기기에서 저장한 상황을 읽을 수 없어요.' };
  }
  if (raw === null) return { scenarios: [], error: '' };
  try {
    // Reject unexpectedly large data before JSON parsing (50 entries × bounded cards/text).
    if (raw.length > 1_000_000) throw new Error('저장된 내용이 너무 커요.');
    const data = object(JSON.parse(raw));
    if (data.version !== 1) throw new Error('저장된 내용의 버전을 확인할 수 없어요.');
    return { scenarios: readLibrary(data.scenarios), error: '' };
  } catch {
    return { scenarios: [], error: '저장된 상황을 읽지 못했어요. 기존 저장 내용은 그대로 두었어요.' };
  }
}

export function saveRebtLibrary(storage: Pick<Storage, 'setItem'>, scenarios: SimpleScenario[]): { ok: boolean; error: string } {
  let validated: SimpleScenario[];
  try {
    validated = readLibrary(scenarios);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '저장할 내용을 확인해 주세요.' };
  }
  try {
    storage.setItem(REBT_LIBRARY_STORAGE_KEY, JSON.stringify({ version: 1, scenarios: validated }));
    return { ok: true, error: '' };
  } catch {
    return { ok: false, error: '이 기기에 저장하지 못했어요. 저장 공간과 브라우저 설정을 확인해 주세요.' };
  }
}
