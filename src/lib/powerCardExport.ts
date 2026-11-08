import type { PowerCardLesson, PowerCardTextPart } from '../learning/powerCardLesson';
import type { Difficulty, Student } from '../types';
import type { PositiveMessage } from '../learning/positiveMessages';
import { getLearningLanguage, type LearningLanguage } from '../i18n/language';
import { translateText } from '../i18n/translate';

type CardTextTranslator = (text: string) => string;
const originalCardText: CardTextTranslator = text => text;

export interface PowerCardContent {
  title: string;
  character: string;
  image: string | null;
  technique: string;
  introduction: string;
  steps: (PowerCardTextPart & { icon: string })[];
  encouragement: string;
  context?: PowerCardTextPart & { icon: string };
  contextLabel?: string;
  actionLabel?: string;
  spokenText?: string;
  narrationParts?: PowerCardTextPart[];
  expression?: PowerCardLesson['expression'];
  artwork?: string;
  messageLines?: readonly string[];
  messageEmoji?: string;
}

export function createPositivePowerCardContent(student: Student | null, message: PositiveMessage, artwork?: string): PowerCardContent {
  const character = student?.name || '마음친구';
  return { title: '오늘의 긍정 메시지', character, image: student?.image || null,
    technique: '나를 응원하는 한마디', introduction: `${character}도 나를 응원해요.`,
    steps: [{ icon: message.emoji, text: message.sentence }], messageLines: message.lines,
    messageEmoji: message.emoji, ...(artwork ? { artwork } : {}), encouragement: '이 한마디를 평소에도 꺼내 봐요.' };
}

// The on-screen and downloaded cards share these learning cues.
// Activity records and mood ratings are never inputs. Local lesson details are explicit selections, not inferred student problems.
export function createPowerCardContent(student: Student | null, difficulty: Difficulty, technique: string, chosenThought?: string, lesson?: PowerCardLesson): PowerCardContent {
  const character = student?.name || '마음친구';
  const expectedKind = technique.includes('나-전달법') ? 'iMessage' : technique.includes('생각 바꾸기') ? 'rebt' : technique.includes('이완훈련') ? 'relaxation' : technique.includes('마음의 소리') ? 'sound' : undefined;
  if (lesson && lesson.kind === expectedKind) {
    const text = (cue: { text: string; shortText: string }) => difficulty === '글' ? cue.text : cue.shortText;
    const narrationParts = lesson.narrationParts ?? (lesson.kind === 'iMessage' ? [] : [lesson.context]).concat(lesson.steps);
    return {
      title: '나의 마음 파워카드', character, image: student?.image || null, technique,
      introduction: `${character}와 함께 연습해요.`,
      context: { icon: lesson.context.icon, text: text(lesson.context), ...(lesson.context.preserveText ? { preserveText: true } : {}) },
      contextLabel: lesson.contextLabel || '이럴 때', actionLabel: lesson.actionLabel,
      ...(lesson.kind === 'iMessage' && lesson.expression ? { expression: {
        situation: lesson.expression.situation,
        feeling: lesson.expression.feeling,
        request: lesson.expression.request,
        ...(lesson.expression.preserveSituation ? { preserveSituation: true } : {}),
        ...(lesson.expression.preserveRequest ? { preserveRequest: true } : {}),
      } } : {}),
      spokenText: (lesson.kind === 'iMessage' ? [] : [lesson.context.text]).concat(lesson.steps.map(step => step.text)).join(' '),
      ...(narrationParts.some(part => part.preserveText) ? { narrationParts: narrationParts.map(part => ({ text: part.text, ...(part.preserveText ? { preserveText: true } : {}) })) } : {}),
      steps: lesson.steps.map(step => ({ icon: step.icon, text: text(step), ...(step.preserveText ? { preserveText: true } : {}) })),
      encouragement: '나에게 필요한 순간, 다시 써 봐요.',
    };
  }
  const reflection = technique.includes('생각 바꾸기') ? chosenThought?.trim() : undefined;
  const cues = technique.includes('나-전달법')
    ? [['👀', '상황', '무슨 일이 있었는지 말해요.'], ['💛', '내 마음', '내 마음을 말해요.'], ['💬', '부탁', '원하는 도움을 부탁해요.']]
    : technique.includes('생각 바꾸기')
      ? [['👀', '일어난 일', '실제로 일어난 일을 살펴봐요.'], ['💭', '다른 생각', '다른 생각을 찾아봐요.'], ['🙋', '해 볼 방법', '해 볼 방법을 고르거나 도움을 요청해요.']]
      : technique.includes('이완훈련')
        ? [['🪑', '편한 자세', '편한 자세를 찾아요.'], ['🙌', '힘 빼기', '손과 어깨의 힘을 풀어요.'], ['🍃', '편한 숨', '내 속도로 편안하게 숨을 쉬어요.']]
        : [['🎵', '소리 고르기', '편안하게 느끼는 소리를 골라요.'], ['⏸️', '불편하면 멈춤', '불편하면 소리를 멈춰요.'], ['🙋', '도움받기', '필요하면 선생님께 도움을 요청해요.']];

  return {
    title: reflection ? '오늘의 한마디' : '나의 마음 파워카드',
    character,
    image: student?.image || null,
    technique: technique || '마음 돌보기',
    introduction: `${character}도 이렇게 연습해요.`,
    steps: reflection ? [{ icon: '💬', text: reflection }] : cues.map(([icon, word, sentence]) => ({ icon, text: difficulty === '글' ? sentence : word })),
    encouragement: reflection ? '나를 도와주는 생각을 살펴봤어요!' : '마음이 바로 편해지지 않아도 괜찮아요.',
  };
}

export interface PowerCardFaces {
  front: { praise: string };
  back: (PowerCardTextPart & { label: string; icon: string })[];
}

/** Translate only the field's own authored/built-in content, never by string identity. */
export function getDisplayedCardText(part: PowerCardTextPart, language: LearningLanguage = getLearningLanguage()): string {
  return translateCardPart(part, text => translateText(text, language));
}

function translateCardPart(part: PowerCardTextPart, translate: CardTextTranslator): string {
  return part.preserveText ? part.text : translate(part.text);
}

export function getPowerCardNarration(content: PowerCardContent, language: LearningLanguage = getLearningLanguage()): string {
  return content.narrationParts
    ? content.narrationParts.map(part => getDisplayedCardText(part, language)).join(' ')
    : translateText(content.spokenText || '', language);
}

/** One semantic source for both visible faces and the two-panel download. */
export function getPowerCardFaces(content: PowerCardContent): PowerCardFaces {
  const praise = content.technique.includes('나-전달법') ? '내 마음을 표현했어요!'
    : content.technique.includes('생각 바꾸기') ? '도움 되는 생각을 연습했어요!'
      : content.technique.includes('마음의 소리') ? '나를 위한 쉼을 연습했어요!'
        : '내 마음을 돌보는 시간을 가졌어요!';
  if (content.technique.includes('나-전달법') && content.expression) {
    return { front: { praise }, back: [
      { label: '상황', icon: content.context?.icon || '👀', text: content.expression.situation, ...(content.expression.preserveSituation ? { preserveText: true } : {}) },
      { label: '내 마음', icon: '💛', text: content.expression.feeling },
      { label: '부탁', icon: '💬', text: content.expression.request, ...(content.expression.preserveRequest ? { preserveText: true } : {}) },
    ] };
  }
  const actionLabel = content.actionLabel || '해 볼 방법';
  return { front: { praise }, back: [
    ...(content.context ? [{ label: content.contextLabel || '이럴 때', icon: content.context.icon, text: content.context.text, ...(content.context.preserveText ? { preserveText: true } : {}) }] : []),
    ...content.steps.map((step, index) => ({
      label: content.steps.length === 1 ? actionLabel : `${actionLabel} ${index + 1}`,
      icon: step.icon, text: step.text,
      ...(step.preserveText ? { preserveText: true } : {}),
    })),
  ] };
}

/** Preserve words and explicit line breaks; split only words wider than the card. */
export function wrapCardText(text: string, maxWidth: number, measure: (value: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const character of Array.from(word)) {
        if (line && measure(line + character) > maxWidth) {
          lines.push(line);
          line = '';
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawText(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, size: number, weight = 700) {
  context.font = `${weight} ${size}px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  const lines = wrapCardText(text, width, value => context.measureText(value).width);
  lines.forEach((line, index) => context.fillText(line, x, y + index * size * 1.48));
  return lines.length * size * 1.48;
}

/** Fit the complete message, including its deliberate phrase breaks, inside the printable card. */
export function fitPositiveCardMessage(text: string, width: number, height: number, measure: (text: string, size: number) => number) {
  for (let size = 68; size >= 24; size -= 2) {
    const lines = wrapCardText(text, width, value => measure(value, size));
    const lineHeight = size * 1.55;
    if (lines.length * lineHeight <= height || size === 24) {
      return { lines, size, lineHeight, height: lines.length * lineHeight };
    }
  }
  throw new Error('메시지를 배치하지 못했어요.');
}

function drawPositiveCard(context: CanvasRenderingContext2D, content: PowerCardContent, translate: CardTextTranslator, language: LearningLanguage, artwork: HTMLImageElement | null = null) {
  const background = context.createLinearGradient(0, 0, 1200, 1600);
  background.addColorStop(0, '#e8f1ff');
  background.addColorStop(1, '#f5f8ff');
  context.fillStyle = background;
  context.fillRect(0, 0, 1200, 1600);
  context.fillStyle = '#ffffff';
  roundedRect(context, 48, 48, 1104, 1504, 48);
  context.fill();

  // Restrained corner shapes add warmth while keeping the sentence as the focus.
  context.save();
  roundedRect(context, 48, 48, 1104, 1504, 48);
  context.clip();
  context.fillStyle = '#f3f7ff';
  context.beginPath();
  context.ellipse(1152, 48, 340, 260, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#f5f8ff';
  context.beginPath();
  context.ellipse(48, 1552, 390, 225, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.fillStyle = '#4285f4';
  drawText(context, 'MindGPS', 104, 100, 990, 31);
  context.textAlign = 'center';
  context.fillStyle = '#244263';
  drawText(context, translate(content.title), 600, 182, 992, 49);
  if (artwork) {
    context.save();
    roundedRect(context, 150, 280, 900, 900, 32); context.clip();
    // Preserve the full landscape illustration without stretching the characters.
    drawCharacter(context, artwork, 150, 280, 900);
    context.restore();
  } else {
    context.font = '128px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    context.fillText(content.messageEmoji || '✨', 600, 320);
  }

  // English is translated as one complete thought, then wrapped by English words.
  // Korean keeps the original author's deliberate phrase breaks.
  const phrase = language === 'en'
    ? translate(content.steps[0]?.text || content.messageLines?.join(' ') || '')
    : content.messageLines?.join('\n') || content.steps[0]?.text || '';
  const messageHeight = artwork ? 160 : 730;
  const layout = fitPositiveCardMessage(phrase, 912, messageHeight, (value, size) => {
    context.font = `700 ${size}px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    return context.measureText(value).width;
  });
  context.font = `700 ${layout.size}px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  context.fillStyle = '#1c3556';
  const startY = (artwork ? 1220 : 502) + (messageHeight - layout.height) / 2;
  layout.lines.forEach((line, index) => context.fillText(line, 600, startY + index * layout.lineHeight));

  context.strokeStyle = '#dbe7f8';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(460, 1350);
  context.lineTo(740, 1350);
  context.stroke();
  context.fillStyle = '#5b7290';
  drawText(context, translate(content.encouragement), 600, 1400, 910, 31, 500);
  context.textAlign = 'start';
}

/** Fit every reverse-side row without dropping words or crossing the footer. */
export function fitLearningCardLayout(content: PowerCardContent, measure: (text: string, size: number) => number, translate: CardTextTranslator = originalCardText) {
  const rows = getPowerCardFaces(content).back;
  const width = 840;
  const gap = 16;
  for (let size = 50; size >= 16; size -= 2) {
    const labelSize = Math.min(26, size);
    const labelLineHeight = labelSize * 1.35;
    const lineHeight = size * 1.45;
    const labels = rows.map(row => wrapCardText(translate(row.label), width, value => measure(value, labelSize)));
    const lines = rows.map(row => wrapCardText(translateCardPart(row, translate), width, value => measure(value, size)));
    const rowHeights = rows.map((_, index) => 44 + labels[index].length * labelLineHeight + 14 + lines[index].length * lineHeight);
    const height = rowHeights.reduce((sum, h) => sum + h, 0) + Math.max(0, rows.length - 1) * gap;
    if (height <= 1020) return { size, labelSize, labelLineHeight, lineHeight, labels, lines, rowHeights, height, width, gap };
  }
  throw new Error('카드에 담긴 문장이 너무 길어요. 문장을 나누거나 줄인 뒤 다시 저장해 주세요.');
}

async function loadAvatar(source: string): Promise<HTMLImageElement> {
  // Only bundled/local assets are allowed. Export never sends a student record anywhere.
  const url = new URL(source, window.location.href);
  if (url.origin !== window.location.origin && url.protocol !== 'data:' && url.protocol !== 'blob:') {
    throw new Error('캐릭터 이미지를 이 기기에서 불러올 수 없어요.');
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error('캐릭터 이미지를 불러오는 시간이 길어지고 있어요. 다시 눌러 주세요.'));
    }, 8000);
    image.onload = () => { window.clearTimeout(timer); resolve(image); };
    image.onerror = () => { window.clearTimeout(timer); reject(new Error('캐릭터 이미지를 불러오지 못했어요. 다시 눌러 주세요.')); };
    image.src = source;
  });
}

async function waitForFonts() {
  if (!document.fonts) return;
  let timer: number | undefined;
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>(resolve => { timer = window.setTimeout(resolve, 2500); }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

function drawCharacter(context: CanvasRenderingContext2D, avatar: HTMLImageElement | null, x: number, y: number, side: number) {
  if (avatar) {
    const factor = Math.min(side / avatar.naturalWidth, side / avatar.naturalHeight);
    const width = avatar.naturalWidth * factor;
    const height = avatar.naturalHeight * factor;
    context.drawImage(avatar, x + (side - width) / 2, y + (side - height) / 2, width, height);
  } else {
    context.font = `${side * 0.65}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    context.textAlign = 'center';
    context.fillText('🌱', x + side / 2, y + side * 0.15);
    context.textAlign = 'start';
  }
}

function drawLearningPanelBase(context: CanvasRenderingContext2D, face: '앞면' | '뒷면', translate: CardTextTranslator) {
  context.fillStyle = '#eef4ff';
  context.fillRect(0, 0, 1200, 1600);
  context.fillStyle = '#ffffff';
  roundedRect(context, 48, 48, 1104, 1504, 44);
  context.fill();
  context.fillStyle = '#4285f4';
  drawText(context, 'MindGPS', 104, 100, 760, 30);
  context.fillStyle = '#edf4ff';
  roundedRect(context, 948, 90, 148, 56, 28);
  context.fill();
  context.fillStyle = '#466890';
  context.textAlign = 'center';
  drawText(context, translate(face), 1022, 101, 130, 28);
  context.textAlign = 'start';
}

function drawLearningFront(context: CanvasRenderingContext2D, content: PowerCardContent, avatar: HTMLImageElement | null, faces: PowerCardFaces, translate: CardTextTranslator) {
  drawLearningPanelBase(context, '앞면', translate);
  context.textAlign = 'center';
  context.fillStyle = '#47759f';
  drawText(context, translate(content.technique), 600, 207, 936, 34);
  const praiseLayout = fitPositiveCardMessage(translate(faces.front.praise), 920, 234, (value, size) => {
    context.font = `700 ${size}px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    return context.measureText(value).width;
  });
  context.font = `700 ${praiseLayout.size}px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  context.fillStyle = '#183757';
  praiseLayout.lines.forEach((line, index) => context.fillText(line, 600, 294 + (234 - praiseLayout.height) / 2 + index * praiseLayout.lineHeight));
  context.textAlign = 'start';
  context.fillStyle = '#f2f7ff';
  context.beginPath();
  context.ellipse(600, 897, 405, 368, 0, 0, Math.PI * 2);
  context.fill();
  drawCharacter(context, avatar, 245, 536, 710);
  context.textAlign = 'center';
  context.fillStyle = '#224867';
  drawText(context, translate(`${content.character}와 함께`), 600, 1287, 928, 44);
  context.fillStyle = '#5a7490';
  drawText(context, translate('연습한 나를 응원해요.'), 600, 1430, 920, 31, 500);
  context.textAlign = 'start';
}

function drawLearningBack(context: CanvasRenderingContext2D, content: PowerCardContent, avatar: HTMLImageElement | null, faces: PowerCardFaces, translate: CardTextTranslator) {
  drawLearningPanelBase(context, '뒷면', translate);
  drawCharacter(context, avatar, 914, 176, 160);
  context.fillStyle = '#183757';
  drawText(context, translate('필요할 때 꺼내 봐요'), 104, 204, 782, 46);
  context.fillStyle = '#5a7490';
  drawText(context, translate(`${content.character}와 함께 연습한 방법`), 104, 287, 782, 28, 500);
  const layout = fitLearningCardLayout(content, (value, size) => {
    context.font = `700 ${size}px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    return context.measureText(value).width;
  }, translate);
  // More room between a few rows; all four poses still fit beside their context.
  const extraGap = faces.back.length > 1 ? Math.min(20, (1020 - layout.height) / (faces.back.length - 1)) : 0;
  let y = 374;
  faces.back.forEach((row, index) => {
    context.fillStyle = index === 0 && content.context ? '#f0f5fc' : '#edf7f2';
    roundedRect(context, 104, y, 992, layout.rowHeights[index], 24);
    context.fill();
    context.font = '40px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    context.fillStyle = '#224867';
    context.fillText(row.icon, 132, y + 30);
    context.font = `700 ${layout.labelSize}px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    context.fillStyle = '#4b6d88';
    layout.labels[index].forEach((line, lineIndex) => context.fillText(line, 212, y + 22 + lineIndex * layout.labelLineHeight));
    const textY = y + 22 + layout.labels[index].length * layout.labelLineHeight + 14;
    context.font = `700 ${layout.size}px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    context.fillStyle = '#172f48';
    layout.lines[index].forEach((line, lineIndex) => context.fillText(line, 212, textY + lineIndex * layout.lineHeight));
    y += layout.rowHeights[index] + layout.gap + extraGap;
  });
  context.fillStyle = '#5a7490';
  context.textAlign = 'center';
  drawText(context, translate(content.encouragement), 600, 1450, 940, 27, 500);
  context.textAlign = 'start';
}

/** Learning downloads always include both faces; positive-message downloads stay single-sided. */
export async function createPowerCardPng(content: PowerCardContent): Promise<Blob> {
  // Capture before loading images/fonts so one export cannot mix two languages.
  const language = getLearningLanguage();
  const translate: CardTextTranslator = text => translateText(text, language);
  const isPositiveMessage = Boolean(content.messageEmoji);
  const [, avatar, artwork] = await Promise.all([
    waitForFonts(),
    !isPositiveMessage && content.image ? loadAvatar(content.image) : Promise.resolve(null),
    isPositiveMessage && content.artwork ? loadAvatar(content.artwork) : Promise.resolve(null),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = isPositiveMessage ? 1200 : 2400;
  canvas.height = 1600;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('이 브라우저에서는 이미지를 만들 수 없어요.');
  context.textBaseline = 'top';
  if (isPositiveMessage) {
    drawPositiveCard(context, content, translate, language, artwork);
  } else {
    const faces = getPowerCardFaces(content);
    drawLearningFront(context, content, avatar, faces, translate);
    context.save();
    context.translate(1200, 0);
    drawLearningBack(context, content, avatar, faces, translate);
    context.restore();
    // This line sits between equal panels for cutting or folding a printed sheet.
    context.strokeStyle = '#9cafc7';
    context.lineWidth = 2;
    context.setLineDash([10, 10]);
    context.beginPath();
    context.moveTo(1200, 24);
    context.lineTo(1200, 1576);
    context.stroke();
    context.setLineDash([]);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('이미지를 만들지 못했어요. 다시 눌러 주세요.'));
    }, 'image/png');
  });
}

export function canShareImageFiles(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    typeof navigator.share !== 'function' ||
    typeof navigator.canShare !== 'function' ||
    typeof File === 'undefined'
  ) {
    return false;
  }
  try {
    const testFile = new File([''], 'test.png', { type: 'image/png' });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

export interface CardSaveResult {
  blob: Blob;
  url: string;
  fileName: string;
  shared: boolean;
}

export async function saveOrShareCardImage(
  blob: Blob,
  fileName: string,
  title: string
): Promise<CardSaveResult> {
  const url = URL.createObjectURL(blob);

  if (canShareImageFiles()) {
    try {
      const file = new File([blob], fileName, { type: 'image/png' });
      await navigator.share({
        files: [file],
        title,
      });
      return { blob, url, fileName, shared: true };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const abortError = new Error('공유 창을 닫았어요. 원할 때 언제든 다시 저장할 수 있어요.');
        abortError.name = 'AbortError';
        throw abortError;
      }
      // If Web Share failed for an unexpected reason, fall through to download fallback
    }
  }

  // Fallback to standard anchor download for desktops and unsupported browsers
  if (typeof document !== 'undefined') {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    try {
      anchor.click();
    } finally {
      anchor.remove();
    }
  }
  return { blob, url, fileName, shared: false };
}

export async function downloadPowerCard(
  content: PowerCardContent,
  existingBlob?: Blob
): Promise<CardSaveResult> {
  const blob = existingBlob || await createPowerCardPng(content);
  const fileName = `MindGPS_${content.messageEmoji ? '오늘의긍정메시지' : '마음파워카드_앞뒷면'}_${content.character.replace(/[^\p{L}\p{N}_-]/gu, '')}.png`;
  const title = content.messageEmoji ? '오늘의 긍정 메시지' : '마음 파워카드';
  return saveOrShareCardImage(blob, fileName, title);
}

