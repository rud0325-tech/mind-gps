import type { SimpleChoice, SimpleScenario } from './simpleRebt';

export type Direction = 'up' | 'down' | 'left' | 'right';
export type MazeSide = 'left' | 'right';
export interface MazePosition { x: number; y: number; }
export interface RebtMazeState {
  scenarioId: string;
  position: MazePosition;
  helpfulId: string;
  helpfulSide: MazeSide;
  passedGate: boolean;
  phase: 'playing' | 'won';
  feedback: 'none' | 'wall' | 'think-again' | 'helpful';
  /** Successful movement steps; this is not a score of the student's thoughts or behavior. */
  moves: number;
}

export const MAZE_COLS = 7;
export const MAZE_ROWS = 7;
export const MAZE_START: Readonly<MazePosition> = Object.freeze({ x: 3, y: 6 });
export const MAZE_GOAL: Readonly<MazePosition> = Object.freeze({ x: 3, y: 0 });
export const MAZE_GATES: Readonly<Record<MazeSide, Readonly<MazePosition>>> = Object.freeze({
  left: Object.freeze({ x: 1, y: 3 }),
  right: Object.freeze({ x: 5, y: 3 }),
});

/** One fork, two thought gates, then one destination. Wall cells cannot be entered. */
export function isMazePath(x: number, y: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= MAZE_COLS || y < 0 || y >= MAZE_ROWS) return false;
  if (y === 2 || y === 4) return x >= 1 && x <= 5;
  if (y === 3) return x === MAZE_GATES.left.x || x === MAZE_GATES.right.x;
  return x === 3;
}

function difficultChoice(scenario: SimpleScenario): SimpleChoice | undefined {
  return scenario.thoughts.find(choice => choice.flexible === false && choice.sentence.trim());
}

function helpfulChoices(scenario: SimpleScenario): SimpleChoice[] {
  return scenario.alternatives.filter(choice => choice.kind === 'help' && choice.id && choice.sentence.trim());
}

function randomIndex(length: number, random: () => number): number {
  const sample = random();
  const unit = Number.isFinite(sample) ? Math.max(0, Math.min(sample, 1 - Number.EPSILON)) : 0;
  return Math.floor(unit * length);
}

/** Random built-in practice examples only; user-entered beliefs are never graded by this game. */
export function selectRandomMaze(scenarios: readonly SimpleScenario[], previousScenarioId?: string, random: () => number = Math.random): RebtMazeState {
  const eligible = [...new Map(scenarios
    .filter(scenario => !scenario.custom && difficultChoice(scenario) && helpfulChoices(scenario).length > 0)
    .map(scenario => [scenario.id, scenario])).values()];
  if (eligible.length === 0) throw new Error('미로에서 연습할 기본 상황이 없어요.');
  const otherScenarios = eligible.filter(scenario => scenario.id !== previousScenarioId);
  const pool = otherScenarios.length > 0 ? otherScenarios : eligible;
  const scenario = pool[randomIndex(pool.length, random)];
  const alternatives = helpfulChoices(scenario);
  const helpful = alternatives[randomIndex(alternatives.length, random)];
  return {
    scenarioId: scenario.id,
    position: { ...MAZE_START },
    helpfulId: helpful.id,
    helpfulSide: randomIndex(2, random) === 0 ? 'left' : 'right',
    passedGate: false,
    phase: 'playing',
    feedback: 'none',
    moves: 0,
  };
}

/** A gate contains either a helpful thought or a difficult practice example, never a diagnosis. */
export function mazeChoiceForSide(state: RebtMazeState, scenario: SimpleScenario, side: MazeSide): SimpleChoice {
  if (scenario.custom || scenario.id !== state.scenarioId) throw new Error('미로의 상황과 생각 카드가 맞지 않아요.');
  const choice = side === state.helpfulSide
    ? helpfulChoices(scenario).find(item => item.id === state.helpfulId)
    : difficultChoice(scenario);
  if (!choice) throw new Error('미로에서 사용할 생각 카드를 찾지 못했어요.');
  return choice;
}

const directionOffset: Record<Direction, MazePosition> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

export function moveRebtMaze(state: RebtMazeState, direction: Direction): RebtMazeState {
  if (state.phase === 'won') return state;
  const offset = directionOffset[direction];
  const target = { x: state.position.x + offset.x, y: state.position.y + offset.y };
  if (!isMazePath(target.x, target.y)) return { ...state, feedback: 'wall' };
  const gateSide = target.y === 3 ? target.x === MAZE_GATES.left.x ? 'left' : 'right' : undefined;
  if (gateSide && gateSide !== state.helpfulSide) return { ...state, feedback: 'think-again' };
  const passedGate = state.passedGate || gateSide === state.helpfulSide;
  const atGoal = target.x === MAZE_GOAL.x && target.y === MAZE_GOAL.y;
  // A defensive check also prevents an invalid/restored state from winning above the gates.
  if (atGoal && !passedGate) return { ...state, feedback: 'think-again' };
  return {
    ...state,
    position: target,
    passedGate,
    phase: atGoal ? 'won' : 'playing',
    feedback: gateSide ? 'helpful' : 'none',
    moves: state.moves + 1,
  };
}

const directionNames: Record<Direction, string> = { up: '위', down: '아래', left: '왼쪽', right: '오른쪽' };
const directionPlaces: Record<Direction, string> = { up: '위쪽', down: '아래쪽', left: '왼쪽', right: '오른쪽' };
const directionActions: Record<Direction, string> = { up: '위로', down: '아래로', left: '왼쪽으로', right: '오른쪽으로' };
const navigationOrder: Direction[] = ['up', 'left', 'down', 'right'];
const positionText = ({ x, y }: MazePosition) => `위에서 ${y + 1}번째 줄, 왼쪽에서 ${x + 1}번째 칸`;
const samePosition = (a: MazePosition, b: MazePosition) => a.x === b.x && a.y === b.y;

export interface MazeNavigationRoute {
  direction: Direction;
  target: MazePosition;
  kind: 'path' | 'gate' | 'goal' | 'start';
  description: string;
}

/** The text alternative describes visible roads and both thought gates. It must
 * not reveal which thought opens a gate before the learner tries that route. */
export function getMazeNavigation(state: RebtMazeState, attemptedDirection?: Direction) {
  const routes: MazeNavigationRoute[] = [];
  const directionDescriptions = {} as Record<Direction, string>;
  for (const direction of navigationOrder) {
    const offset = directionOffset[direction];
    const target = { x: state.position.x + offset.x, y: state.position.y + offset.y };
    const place = directionPlaces[direction];
    const action = directionActions[direction];
    if (state.phase === 'won') {
      directionDescriptions[direction] = '목표 깃발에 도착했어요.';
      continue;
    }
    if (!isMazePath(target.x, target.y)) {
      directionDescriptions[direction] = `${place}은 벽이에요.`;
      continue;
    }
    const gateSide = (['left', 'right'] as const).find(side => samePosition(target, MAZE_GATES[side]));
    const kind = gateSide ? 'gate' : samePosition(target, MAZE_GOAL) ? 'goal' : samePosition(target, MAZE_START) ? 'start' : 'path';
    const description = gateSide
      ? `${place}에 ${directionNames[gateSide]} 생각의 문이 있어요. ${state.passedGate && state.helpfulSide === gateSide ? '열린 문을 지나갈 수 있어요.' : `${action} 이동해 문을 살펴볼 수 있어요.`}`
      : kind === 'goal' ? `${action} 한 칸 이동하면 목표 깃발이에요.`
      : `${action} 한 칸 이동할 수 있어요.${kind === 'start' ? ' 출발 자리예요.' : ''}`;
    routes.push({ direction, target, kind, description });
    directionDescriptions[direction] = description;
  }
  const currentGate = (['left', 'right'] as const).find(side => samePosition(state.position, MAZE_GATES[side]));
  const landmark = state.phase === 'won' ? '목표 깃발에 도착했어요.'
    : samePosition(state.position, MAZE_START) ? '출발 자리예요.'
    : currentGate ? `${directionNames[currentGate]} 생각의 문을 지났어요.`
    : state.position.x === MAZE_START.x && state.position.y === 4 ? '왼쪽 길과 오른쪽 길의 갈림길이에요.'
    : '';
  const feedback = state.feedback === 'wall'
    ? `${attemptedDirection ? `${directionPlaces[attemptedDirection]}은 ` : ''}벽이라 이동하지 않았어요.`
    : state.feedback === 'think-again' ? '생각의 문이 열리지 않아 이동하지 않았어요. 다른 생각도 살펴봐요.'
    : state.feedback === 'helpful' ? '나를 도와주는 생각을 찾았어요! 길이 열렸어요! 깃발까지 가요.'
    : '';
  const openRoads = routes.filter(route => route.kind !== 'gate').map(route => directionNames[route.direction]);
  const gateDescriptions = routes.filter(route => route.kind === 'gate').map(route => route.description);
  const position = `현재 위치: ${positionText(state.position)}.`;
  const goal = `목표 깃발: ${positionText(MAZE_GOAL)}.`;
  const description = [feedback, position, landmark,
    openRoads.length ? `이동할 수 있는 길: ${openRoads.join(', ')}.` : '',
    ...gateDescriptions, state.phase === 'won' ? '' : goal].filter(Boolean).join(' ');
  return { position, goal, landmark, routes, directionDescriptions, description };
}

/** All road cells, including start/goal/gates, are available without seeing color
 * or the drawing. Coordinates use the same top/left origin as the live status. */
export function getMazeMapDescription() {
  const rows = Array.from({ length: MAZE_ROWS }, (_, y) => {
    const columns = Array.from({ length: MAZE_COLS }, (_, x) => x).filter(x => isMazePath(x, y));
    return `${y + 1}번째 줄의 길: ${columns.map(x => x + 1).join(', ')}번째 칸.`;
  });
  return [`지도는 ${MAZE_ROWS}줄, ${MAZE_COLS}칸이에요.`,
    `출발: ${positionText(MAZE_START)}.`, `목표 깃발: ${positionText(MAZE_GOAL)}.`,
    `왼쪽 생각의 문: ${positionText(MAZE_GATES.left)}. 오른쪽 생각의 문: ${positionText(MAZE_GATES.right)}.`,
    ...rows, '나머지 칸은 벽이에요. 두 생각의 문은 각 생각 카드와 이어져 있어요.'].join(' ');
}
