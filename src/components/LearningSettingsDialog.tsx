import { localizeView } from '../i18n/localizeView';
import type { LearningLanguage } from '../i18n/language';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { StudentTextSize } from '../lib/learningPreferences';
import './LearningSettingsDialog.css';

export default function LearningSettingsDialog({ confirmEmotion, onChange, language, onLanguageChange, textSize, onTextSizeChange, onClose, message }: {
  language: LearningLanguage; onLanguageChange: (language: LearningLanguage) => void;
  confirmEmotion: boolean; onChange: (confirm: boolean) => void; onClose: () => void; message: string;
  textSize: StudentTextSize; onTextSizeChange: (size: StudentTextSize) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal(); title.current?.focus();
    return () => { element?.close(); previous?.focus({ preventScroll: true }); };
  }, []);
  return localizeView(<dialog className="learning-settings-dialog" ref={dialog} aria-labelledby="learning-settings-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><h2 id="learning-settings-title" ref={title} tabIndex={-1}>학습 설정</h2>
      <button type="button" onClick={onClose} aria-label="닫기, 학습 설정"><X aria-hidden="true" /></button></header>
    <p>학생에게 편한 방법을 정해 주세요.</p>
    <fieldset><legend>학습 언어</legend>
      <label><input type="radio" name="learning-language" checked={language === 'ko'} onChange={() => onLanguageChange('ko')} /><span lang="ko" translate="no"><strong>한국어</strong></span></label>
      <label><input type="radio" name="learning-language" checked={language === 'en'} onChange={() => onLanguageChange('en')} /><span lang="en" translate="no"><strong>English</strong></span></label>
    </fieldset>
    <p className="learning-settings-note">영어 안내는 기기 음성으로 들려줘요. 직접 입력한 내용과 교사 기록은 원래 언어로 유지해요.</p>
    <fieldset><legend>마음을 고른 다음</legend>
      <label><input type="radio" name="emotion-navigation" checked={!confirmEmotion} onChange={() => onChange(false)} />
        <span><strong>바로 다음 화면으로 이동</strong><small>기본 설정이에요. 마음을 누르면 크기 선택으로 넘어가요.</small></span></label>
      <label><input type="radio" name="emotion-navigation" checked={confirmEmotion} onChange={() => onChange(true)} />
        <span><strong>‘다음’을 눌러 이동</strong><small>마음을 고른 뒤, 선택을 확인하고 다음을 눌러요.</small></span></label>
    </fieldset>
    <p className="learning-settings-note">‘다음’을 눌러 이동을 선택하면 캐릭터·학습 방법·마음·활동 카드도 먼저 고른 뒤 다음을 눌러 이동해요.</p>
    <fieldset><legend>글자 크기</legend>
      <label><input type="radio" name="student-text-size" checked={textSize === 'normal'} onChange={() => onTextSizeChange('normal')} />
        <span><strong>보통</strong><small>지금까지 사용한 글자 크기예요.</small></span></label>
      <label><input type="radio" name="student-text-size" checked={textSize === 'large'} onChange={() => onTextSizeChange('large')} />
        <span><strong>크게</strong><small>학습 화면의 글자를 더 크게 보여줘요.</small></span></label>
    </fieldset>
    <p className="learning-settings-note">크게 선택하면 화면에 따라 아래로 내려서 볼 수 있어요. 설정은 이 브라우저에 기억해요.</p>
    {message && <p role="status">{message}</p>}
    <button type="button" className="learning-settings-done" onClick={onClose}>닫기</button>
  </dialog>);
}
