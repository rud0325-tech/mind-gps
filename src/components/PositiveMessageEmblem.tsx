import { localizeView } from '../i18n/localizeView';
import type { PositiveMessage } from '../learning/positiveMessages';
import { POSITIVE_MESSAGE_ARTWORK } from '../learning/positiveMessageArtwork';
import { useLearningLanguage } from '../i18n/language';
import './PositiveMessageEmblem.css';

/** A quiet supporting cue alongside the message. */
/** withArtwork: sentence, word, and picture levels all show the illustration and its accessible description. */
export default function PositiveMessageEmblem({ message: _message, picture = false, withArtwork = true, artworkIndex = 0 }: { message: PositiveMessage; picture?: boolean; withArtwork?: boolean; artworkIndex?: number }) {
  const language = useLearningLanguage();
  const artwork = POSITIVE_MESSAGE_ARTWORK[artworkIndex % POSITIVE_MESSAGE_ARTWORK.length];
  const showArtworkClass = !picture && withArtwork;
  return localizeView(<div className={`positive-message-emblem ${picture ? 'positive-message-emblem--picture' : showArtworkClass ? 'positive-message-emblem--artwork' : 'positive-message-emblem--artwork'}`}>
    <img src={artwork.src} alt={artwork[language]} />
  </div>);
}
