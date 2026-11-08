import { localizeView } from '../i18n/localizeView';
import { useLearningLanguage } from '../i18n/language';
import { translateText } from '../i18n/translate';
import { useEffect, useRef, type ReactNode } from 'react';
import type { View } from '../types';
import './AccessibleView.css';

const TITLES: Record<View, string> = {
  learnerSelect: '내 표시 선택',
  home: '마음GPS', studentSelect: '캐릭터 고르기', difficultySelect: '학습 방법 고르기',
  emotionSelect: '활동 전 · 지금 마음', intensitySelect: '활동 전 · 마음의 크기',
  techniqueSelect: '활동 고르기', positiveMessage: '오늘의 긍정 메시지',
  relaxation: '이완훈련', rebt: '생각 바꾸기', iMsg: '나-전달법', asmr: '마음의 소리',
  postEmotion: '활동 후 · 지금 마음', postIntensity: '활동 후 · 마음의 크기',
  completion: '칭찬 파워카드', adminPin: '선생님 확인', adminDashboard: '교사 기록과 변화',
};

export function focusActivityStart() {
  const root = document.getElementById('activity-content');
  const heading = root?.querySelector<HTMLElement>('h1, h2');
  const target = root?.dataset.view === 'home'
    ? root.querySelector<HTMLElement>('.home-start-surface') ?? root
    : heading ?? root;
  if (!target) return;
  if (!target.matches('button, a[href], input, select, textarea')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}

/** Runs when the new view actually mounts, including AnimatePresence exit waits. */
export default function AccessibleView({ view, children }: { view: View; children: ReactNode }) {
  const language = useLearningLanguage();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.title = view === 'home' ? translateText('마음GPS') : `${translateText(TITLES[view])} · ${translateText('마음GPS')}`;
    const frame = requestAnimationFrame(() => {
      // Activity steps and dialogs may already have set a more precise focus.
      if (root.current?.contains(document.activeElement) && document.activeElement !== root.current) return;
      focusActivityStart();
    });
    return () => cancelAnimationFrame(frame);
  }, [view, language]);
  return localizeView(<div id="activity-content" ref={root} tabIndex={-1} data-view={view}>{children}</div>);
}
