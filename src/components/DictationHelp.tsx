import { localizeView } from '../i18n/localizeView';
/** Device guidance appears only after an input failure, outside the lesson flow. */
export default function DictationHelp() {
  return localizeView(<details className="dictation-help">
    <summary>음성 입력 도움말</summary>
    <p>휴대폰에 ‘Mac에 연결됨’이 뜨면 iPhone이 마이크로 연결되었을 수 있어요.</p>
    <ol>
      <li>맥의 시스템 설정 → 사운드 → 입력에서 MacBook 내장 마이크를 선택해 주세요.</li>
      <li>입력 음량 표시가 움직이는지 확인하고, 앱에서 다시 말해 주세요.</li>
      <li>계속 실패하면 같은 앱 주소를 다른 지원 브라우저에서 열어 확인해 주세요.</li>
    </ol>
    <p>앱은 기기의 마이크 선택을 바꾸지 않아요. 이미 입력한 글은 직접 고칠 수 있어요.</p>
    <a href="https://support.apple.com/ko-kr/guide/mac-help/mchlp2567/mac" target="_blank" rel="noreferrer">Mac 마이크 선택 안내</a>
  </details>);
}
