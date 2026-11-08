import { localizeView } from '../i18n/localizeView';
import { getLearningLanguage } from '../i18n/language';
import { translateText } from '../i18n/translate';
import { Fragment } from 'react';
import type { Difficulty } from '../types';
import type { PositiveMessage } from '../learning/positiveMessages';
import './PositiveMessageText.css';

/** Editorial line breaks keep full sentences intact for assistive technology. */
export default function PositiveMessageText({ message, difficulty }: { message: PositiveMessage; difficulty: Difficulty }) {
  if (getLearningLanguage() === 'en') return localizeView(<>{translateText(message.sentence)}</>);
  if (difficulty === '그림') return localizeView(<>{message.sentence}</>);
  const lines = difficulty === '글' ? message.lines : [message.word];
  return localizeView(<>{lines.map((line, index) => <Fragment key={index}>
    {index > 0 && ' '}<span className="positive-message-line">{line}</span>
  </Fragment>)}</>);
}
