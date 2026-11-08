import { Pause, Volume2 } from 'lucide-react';
import type { PositiveMessage } from '../learning/positiveMessages';
import { useSentenceNarration } from '../hooks/useSentenceNarration';
import { getRecordedNarration } from '../lib/typecastNarration';
import { localizeView } from '../i18n/localizeView';
import './PositiveMessageAudio.css';

interface Props {
  message: PositiveMessage;
  picture: boolean;
  onBeforePlay: () => void;
}

/** The user requested activation only after the matching Typecast file is delivered.
 * A missing recording adds neither a dead control nor Korean device speech. */
export default function PositiveMessageAudio(props: Props) {
  const recording = getRecordedNarration(props.message.sentence);
  if (!recording) return null;
  return <ReadyMessageAudio {...props} recording={recording} />;
}

function ReadyMessageAudio({ message, picture, onBeforePlay, recording }: Props & { recording: string }) {
  // Same complete message for all three learning levels. The shared hook uses
  // the visible English translation with device speech when English is selected.
  const narration = useSentenceNarration(message.sentence, recording);
  const label = narration.isPlaying ? '멈춤, 긍정 메시지 듣기' : '듣기, 긍정 메시지';
  const toggle = () => {
    if (!narration.isPlaying) onBeforePlay();
    narration.toggle();
  };
  return localizeView(<div className="positive-message-audio">
    <button type="button" className="positive-message-listen" aria-label={label}
      aria-pressed={narration.isPlaying} title={narration.sourceLabel} onClick={toggle}>
      {narration.isPlaying ? <Pause aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
      <span className={picture ? 'sr-only' : undefined}>{narration.isPlaying ? '멈춤' : '듣기'}</span>
    </button>
    {narration.error && <p className="positive-message-audio-error" role="status">{narration.error}</p>}
  </div>);
}
