import { localizeView } from '../i18n/localizeView';
import { useLayoutEffect, useRef } from 'react';
import { RotateCw } from 'lucide-react';
import { getDisplayedCardText, getPowerCardFaces, type PowerCardContent } from '../lib/powerCardExport';
import { useLearningLanguage } from '../i18n/language';
import './FlippablePowerCard.css';

interface Props {
  card: PowerCardContent;
  back: boolean;
  celebrating: boolean;
  onFlip: () => void;
}

/** Turning a card is optional review; it never completes or saves an activity. */
export default function FlippablePowerCard({ card, back, celebrating, onFlip }: Props) {
  const language = useLearningLanguage();
  const faces = getPowerCardFaces(card);
  const cardElement = useRef<HTMLElement>(null);
  const frontFace = useRef<HTMLDivElement>(null);
  const backFace = useRef<HTMLDivElement>(null);
  const backRows = useRef<HTMLDListElement>(null);
  useLayoutEffect(() => {
    const element = cardElement.current;
    const front = frontFace.current;
    const face = backFace.current;
    const rows = backRows.current;
    const heading = face?.querySelector('header');
    const message = front?.querySelector<HTMLElement>('.power-front-message');
    const characterLabel = front?.querySelector<HTMLElement>('.power-front-character > p');
    const hint = element?.querySelector<HTMLElement>('.power-flip-hint');
    if (!element || !front || !face || !rows || !heading || !message || !characterLabel || !hint) return;
    let frame = 0;
    const measure = () => {
      const footerHeight = `${Math.ceil(hint.scrollHeight + 24)}px`;
      if (element.style.getPropertyValue('--power-flip-footer-height') !== footerHeight) {
        element.style.setProperty('--power-flip-footer-height', footerHeight);
      }
      const style = getComputedStyle(face);
      const backHeight = rows.scrollHeight + heading.scrollHeight + parseFloat(style.rowGap || '0')
        + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + 2;
      const frontStyle = getComputedStyle(front);
      const labelStyle = getComputedStyle(characterLabel);
      const characterHeight = characterLabel.scrollHeight + 96
        + parseFloat(labelStyle.marginTop || '0') + parseFloat(labelStyle.marginBottom || '0');
      const frontContent = frontStyle.flexDirection === 'column'
        ? message.scrollHeight + characterHeight + parseFloat(frontStyle.rowGap || '0')
        : Math.max(message.scrollHeight, characterHeight);
      const frontHeight = frontContent + parseFloat(frontStyle.paddingTop) + parseFloat(frontStyle.paddingBottom) + 2;
      const required = `${Math.ceil(Math.max(frontHeight, backHeight))}px`;
      // Grow the card instead of overriding the reader's chosen font size.
      if (element.style.getPropertyValue('--power-required-height') !== required) {
        element.style.setProperty('--power-required-height', required);
      }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    measure();
    const observer = new ResizeObserver(schedule);
    [element, rows, heading, message, characterLabel, hint].forEach(target => observer.observe(target));
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [card, language]);
  const dense = faces.back.length > 3 || faces.back.reduce((length, row) => length + row.text.length, 0) > 110;
  return localizeView(<article ref={cardElement} className={`power-flip-card ${back ? 'is-back' : ''} ${dense ? 'power-flip-dense' : ''}`} aria-label="나의 마음 파워카드">
    <div className="power-flip-inner">
      <div ref={frontFace} className="power-card-face power-card-front" aria-hidden={back} inert={back}>
        <span className="power-face-name">앞면</span>
        <div className="power-front-character">
          <div className="power-front-portrait">
            <div className="completion-celebration" data-celebrating={celebrating} aria-hidden="true">
              {['✦', '●', '✧', '●', '✦', '✧'].map((shape, index) => <span key={index}>{shape}</span>)}
            </div>
            {card.image ? <img src={card.image} alt={card.character}/> : <span aria-hidden="true">🌱</span>}
          </div>
          <p>{`${card.character}와 함께`}</p>
        </div>
        <div className="power-front-message"><p>{card.technique}</p><h2>{faces.front.praise}</h2></div>
      </div>
      <div ref={backFace} className="power-card-face power-card-back" aria-hidden={!back} inert={!back}>
        <header className="power-back-heading">
          {card.image && <img src={card.image} alt={card.character}/>}
          <h2>오늘 연습한 방법</h2><span className="power-face-name">뒷면</span>
        </header>
        <dl ref={backRows} className="power-back-rows">
          {faces.back.map((row, index) => <div className="power-back-row" key={`${row.label}-${index}`}>
            <span className="power-row-icon" aria-hidden="true">{row.icon}</span>
            <div><dt>{row.label}</dt><dd translate="no">{getDisplayedCardText(row, language)}</dd></div>
          </div>)}
        </dl>
      </div>
    </div>
    <button type="button" className="power-flip-toggle" onClick={onFlip}
      aria-label={back ? '눌러서 앞면 보기, 현재 파워카드 뒷면' : '눌러서 뒷면 보기, 현재 파워카드 앞면'}>
      <span className="power-flip-hint"><RotateCw aria-hidden="true"/>{back ? '눌러서 앞면 보기' : '눌러서 뒷면 보기'}</span>
    </button>
    <span className="sr-only" role="status">{back ? '뒷면' : '앞면'}</span>
  </article>);
}
