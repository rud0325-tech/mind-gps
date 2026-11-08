import { getLearningLanguage } from '../i18n/language';
import { localizeView } from '../i18n/localizeView';
import type { Difficulty } from '../types';
import './LearningModePreview.css';

/** A shared picture symbol lets learners compare the amount of text on each tablet. */
function PictureSymbol({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return localizeView(<svg x={x} y={y} width={width} height={height} viewBox="0 0 100 80" fill="none" focusable="false">
    <rect x="3" y="3" width="94" height="74" rx="10" fill="#EAF3FF" stroke="#26466A" strokeWidth="5" />
    <circle cx="69" cy="23" r="10" fill="#3574B9" />
    <path d="M10 68L36 37L57 59L70 46L90 68H10Z" fill="#3574B9" stroke="#26466A" strokeWidth="3" strokeLinejoin="round" />
  </svg>);
}

export default function LearningModePreview({ mode }: { mode: Difficulty }) {
  const english = getLearningLanguage() === 'en';
  const kind = mode === '글' ? 'sentence' : mode === '그림+단어' ? 'word' : 'picture';
  return localizeView(<div className={`learning-mode-preview learning-mode-preview--${kind}`} aria-hidden="true">
    <svg className="learning-mode-tablet" viewBox="0 0 240 170" fill="none" focusable="false">
      <rect x="12" y="10" width="216" height="150" rx="19" fill="#FFFFFF" stroke="#233C58" strokeWidth="6" />
      <rect x="24" y="22" width="192" height="126" rx="9" fill="#F5F9FE" />
      {kind === 'sentence' && <g>
        <text x="120" y="68" textAnchor="middle" className="learning-mode-symbol-text" style={english ? { fontSize: 23 } : undefined}>{english ? 'Sentences' : '문장'}</text>
        <path d="M57 94H183M57 115H183" stroke="#26466A" strokeWidth="9" strokeLinecap="round" />
      </g>}
      {kind === 'word' && <g>
        <PictureSymbol x={37} y={51} width={84} height={68} />
        <text x="167" y="96" textAnchor="middle" className="learning-mode-symbol-text" style={english ? { fontSize: 22 } : undefined}>{english ? 'Words' : '단어'}</text>
      </g>}
      {kind === 'picture' && <PictureSymbol x={57} y={34} width={126} height={102} />}
    </svg>
  </div>);
}
