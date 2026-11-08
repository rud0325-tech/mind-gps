import { getLearningLanguage, type LearningLanguage } from './language';
import { CORE_ENGLISH } from './coreEnglish';
import { ACTIVITY_ENGLISH } from './activityEnglish';
import { REBT_ENGLISH } from './rebtEnglish';
import { CALM_ENGLISH } from './calmEnglish';

// Only authored learning content and UI labels are translated. No user text is
// sent to a service; IDs, stored records and form values retain their originals.
const normalize = (text: string) => text.replace(/\s+/gu, ' ').trim();
export const ENGLISH_TEXT: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries({ ...CALM_ENGLISH, ...REBT_ENGLISH, ...ACTIVITY_ENGLISH, ...CORE_ENGLISH })
    .map(([key, value]) => [normalize(key), value]),
);
const extra: Record<string, string> = {
  '현재': 'Current', '자 / 최대': ' / max', '자': ' characters',
  '와 함께': ' by your side', '글': 'Sentences', '그림': 'Pictures', '그림+단어': 'Pictures + words',
  '문장으로 학습해요': 'Learn with sentences', '그림과 단어로 학습해요': 'Learn with pictures and words', '그림으로 학습해요': 'Learn with pictures',
  '생각 바꾸기 (REBT)': 'Thinking differently',
  '기기 음성': 'Device voice', '타입캐스트': 'Typecast',
  '한국어': '한국어', 'English': 'English',
};
export function getEnglishText(text: string): string {
  const key = normalize(text);
  const exact = ENGLISH_TEXT[key] ?? extra[key];
  if (exact !== undefined) return `${text.match(/^\s*/u)?.[0] ?? ''}${exact}${text.match(/\s*$/u)?.[0] ?? ''}`;
  // Patterns are limited to app-authored wrappers around an unchanged selection.
  let match: RegExpMatchArray | null;
  if ((match = key.match(/^(.+)와 함께 연습한 방법$/u))) return `What I practiced with ${getEnglishText(match[1])}`;
  if ((match = key.match(/^(편한 만큼 해 봐요|이렇게 쉬어 봐요|해 볼 방법) (\d+)$/u))) return `${getEnglishText(match[1])} ${match[2]}`;
  if ((match = key.match(/^(.+) 선택$/u))) return `Choose ${getEnglishText(match[1])}`;
  if ((match = key.match(/^(\d+)단계$/u))) return `Level ${match[1]}`;
  if ((match = key.match(/^(\d+) (아주 작게|작게|보통|크게|아주 크게)$/u))) return `${match[1]} ${getEnglishText(match[2])}`;
  if ((match = key.match(/^기록 코드 (.+) · 함께할 캐릭터를 골라요\.$/u))) return `Record code ${match[1]} · Choose a character.`;
  if ((match = key.match(/^(.+)와 함께 생각해요$/u))) return `Think with ${getEnglishText(match[1])}`;
  if ((match = key.match(/^(생각 듣기|상황 듣기|표현 듣기|친구의 생각): (.+)$/u))) return `${({ '생각 듣기':'Listen to the thought', '상황 듣기':'Listen to the situation', '표현 듣기':'Listen to the words', '친구의 생각':"The friend's thought" } as Record<string,string>)[match[1]]}: ${getEnglishText(match[2])}`;
  if ((match = key.match(/^(왼쪽|오른쪽) 길 (.+), 생각 듣기$/u))) return `${match[1] === '왼쪽' ? 'Left' : 'Right'} path: ${getEnglishText(match[2])}, listen to the thought`;
  if ((match = key.match(/^(.*)와 함께$/u))) return `With ${getEnglishText(match[1])}`;
  if ((match = key.match(/^안내 재생 위치 (\d+)초$/u))) return `Guide position: ${match[1]} seconds`;
  if ((match = key.match(/^(\d+)퍼센트$/u))) return `${match[1]} percent`;
  if ((match = key.match(/^(\d+)개 핵심 단어 중 (\d+)번째$/u))) return `Cue ${match[2]} of ${match[1]}`;
  if ((match = key.match(/^현재 (\d+)자 \/ 최대 (\d+)자$/u))) return `${match[1]} of ${match[2]} characters`;
  if ((match = key.match(/^(.+), 안내 음성 속도$/u))) return `${getEnglishText(match[1])}, narration speed`;
  if ((match = key.match(/^(\d+)(?:\.\s*|\s+)([가-힣].*)$/u))) return `${match[1]}. ${getEnglishText(match[2])}`;
  if ((match = key.match(/^(.+), 연습함$/u))) return `${getEnglishText(match[1])}, practiced`;
  if ((match = key.match(/^(선택|이번 연습|연습한 문장|나-전달법 연습): (.+)$/u))) {
    const prefixes: Record<string,string> = { 선택: 'Selected', '이번 연습': 'This practice', '연습한 문장': 'My sentence', '나-전달법 연습': 'I-message practice' };
    return `${prefixes[match[1]]}: ${getEnglishText(match[2])}`;
  }
  if ((match = key.match(/^눌러서 듣기, (.+)$/u))) return `Tap to listen: ${getEnglishText(match[1])}`;
  // Joining already-authored pieces handles progress labels and custom sentences
  // without translating or rewriting the student's own words.
  for (const separator of ['\n', ' · ', ', ']) {
    if (text.includes(separator)) {
      const pieces = text.split(separator); const translated = pieces.map(getEnglishText);
      if (translated.some((piece, i) => piece !== pieces[i])) return translated.join(separator);
    }
  }
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/gu);
  if (sentences && sentences.length > 1) {
    const translated = sentences.map(part => getEnglishText(part.trim()));
    if (translated.some((part, index) => part !== sentences[index].trim())) return translated.join(' ');
  }
  // Exact clauses in composed I-messages (the rest may be personally authored).
  for (const [original, translated] of Object.entries(ENGLISH_TEXT)) {
    if (original.length > 5 && /(?:하면|으면)$/u.test(original) && key.startsWith(`${original} `)) {
      return `${translated} ${getEnglishText(key.slice(original.length + 1))}`;
    }
  }
  return text;
}
export function translateText(text: string, language: LearningLanguage = getLearningLanguage()): string {
  return language === 'en' ? getEnglishText(text) : text;
}
