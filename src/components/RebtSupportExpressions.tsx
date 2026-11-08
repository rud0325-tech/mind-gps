import { localizeView } from '../i18n/localizeView';
import { Volume2 } from 'lucide-react';
import type { Difficulty } from '../types';
import type { SimpleScenario } from '../learning/simpleRebt';
import RebtPicture from './RebtPicture';
import './RebtSupportExpressions.css';

export function hasRebtSupportExpressions(scenario: SimpleScenario): boolean {
  return !scenario.custom && (scenario.category === 'teasing' || ['study', 'friend-conflict', 'friend-mistake', 'teacher-mistake'].includes(scenario.visual));
}

/** Models a request aloud; this is not a sent alert or a required sequence of actions. */
export default function RebtSupportExpressions({ scenario, difficulty, onRead }: {
  scenario: SimpleScenario; difficulty: Difficulty; onRead: (text: string) => void;
}) {
  if (!hasRebtSupportExpressions(scenario)) return null;
  const picture = difficulty === '그림';
  return localizeView(<section className={`rebt-support-expressions ${picture ? 'rebt-support-expressions--picture' : ''}`} aria-label="필요할 때 할 수 있는 말">
    <p>필요할 때 이렇게 표현해요. <span>눌러서 말 듣기</span></p>
    <div>{scenario.actions.map(action => <button type="button" key={action.id} aria-label={picture ? `표현 듣기: ${action.sentence}` : difficulty === '글' || action.sentence.includes(action.word) ? `${action.sentence}, 표현 듣기` : `${action.word}, 표현 듣기: ${action.sentence}`} onClick={() => onRead(action.sentence)}>
      {difficulty !== '글' && <RebtPicture visual={action.visual} variant="action" sentence={action.sentence}/>}
      {!picture && <strong>{difficulty === '글' ? action.sentence : action.word}</strong>}
      <Volume2 aria-hidden="true"/>
    </button>)}</div>
  </section>);
}
