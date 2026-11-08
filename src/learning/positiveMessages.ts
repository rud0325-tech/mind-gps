export interface PositiveMessage {
  id: string;
  sentence: string;
  /** Reading units preserve the supplied wording when joined with a space. */
  lines: readonly string[];
  word: string;
  theme: 'grow' | 'steps' | 'help' | 'retry' | 'voice' | 'rest';
  emoji: string;
  emojiLabel: string;
}

type MessageDraft = Omit<PositiveMessage, 'sentence' | 'word'>;
const message = (draft: MessageDraft): PositiveMessage => {
  const sentence = draft.lines.join(' ');
  return { ...draft, sentence, word: sentence };
};

/** User-selected encouragement, separate from measured learning or emotional outcomes.
 * This set replaces the previous collection. Short supplied sentences stay verbatim
 * in both text modes; versioned IDs keep earlier usage records distinguishable. */
export const POSITIVE_MESSAGES: readonly PositiveMessage[] = [
  message({ id: 'encouragement-20261007-01', lines: ['너는 있는 그대로 소중해'], theme: 'grow', emoji: '✨', emojiLabel: '소중하게 빛나는 별' }),
  message({ id: 'encouragement-20261007-02', lines: ['너의 웃음은 모두를 밝게 해'], theme: 'help', emoji: '😊', emojiLabel: '밝은 미소' }),
  message({ id: 'encouragement-20261007-03', lines: ['너는 세상에 하나뿐이야'], theme: 'grow', emoji: '⭐', emojiLabel: '특별하게 빛나는 별' }),
  message({ id: 'encouragement-20261007-04', lines: ['너는 사랑받는 사람이야'], theme: 'help', emoji: '🥰', emojiLabel: '사랑을 전하는 미소' }),
  message({ id: 'encouragement-20261007-05', lines: ['너의 마음은 참 따뜻해'], theme: 'help', emoji: '☀️', emojiLabel: '따뜻한 햇살' }),
  message({ id: 'encouragement-20261007-06', lines: ['너는 좋은 친구야'], theme: 'help', emoji: '🤝', emojiLabel: '함께하는 친구' }),
  message({ id: 'encouragement-20261007-07', lines: ['네 이야기는 소중해'], theme: 'voice', emoji: '💬', emojiLabel: '소중한 이야기를 담은 말풍선' }),
  message({ id: 'encouragement-20261007-08', lines: ['너는 누군가에게 힘이 돼'], theme: 'help', emoji: '💪', emojiLabel: '서로에게 주는 힘' }),
  message({ id: 'encouragement-20261007-09', lines: ['네 곁에는', '응원하는 사람이 있어'], theme: 'help', emoji: '👏', emojiLabel: '응원하는 박수' }),
  message({ id: 'encouragement-20261007-10', lines: ['너의 하루는 소중해'], theme: 'grow', emoji: '☀️', emojiLabel: '하루를 비추는 햇살' }),
  message({ id: 'encouragement-20261007-11', lines: ['실수해도 괜찮아'], theme: 'retry', emoji: '🌱', emojiLabel: '다시 자라나는 새싹' }),
  message({ id: 'encouragement-20261007-12', lines: ['네 마음을 말해 줘서 고마워'], theme: 'voice', emoji: '💬', emojiLabel: '마음을 전하는 말풍선' }),
  message({ id: 'encouragement-20261007-13', lines: ['네가 느끼는 마음은', '다 소중해'], theme: 'voice', emoji: '✨', emojiLabel: '소중하게 빛나는 별' }),
  message({ id: 'encouragement-20261007-14', lines: ['완벽하지 않아도 괜찮아'], theme: 'rest', emoji: '🌿', emojiLabel: '편안한 푸른 잎' }),
  message({ id: 'encouragement-20261007-15', lines: ['쉬는 것도 잘하는 거야'], theme: 'rest', emoji: '😌', emojiLabel: '편안한 표정' }),
  message({ id: 'encouragement-20261007-16', lines: ['너는 잘하고 있어'], theme: 'grow', emoji: '👍', emojiLabel: '잘하고 있다는 응원' }),
  message({ id: 'encouragement-20261007-17', lines: ['어제보다 한 걸음 나아갔어'], theme: 'steps', emoji: '👟', emojiLabel: '한 걸음을 내딛는 운동화' }),
  message({ id: 'encouragement-20261007-18', lines: ['작은 것도 해낸 거야'], theme: 'steps', emoji: '👏', emojiLabel: '해낸 일을 칭찬하는 박수' }),
  message({ id: 'encouragement-20261007-19', lines: ['끝까지 해 본 네가 멋져'], theme: 'retry', emoji: '💪', emojiLabel: '끝까지 해 본 힘' }),
  message({ id: 'encouragement-20261007-20', lines: ['노력하는 모습이', '정말 멋져'], theme: 'grow', emoji: '🌟', emojiLabel: '빛나는 노력' }),
  message({ id: 'encouragement-20261007-21', lines: ['오늘 해낸 일을 칭찬해'], theme: 'grow', emoji: '👏', emojiLabel: '오늘의 노력을 칭찬하는 박수' }),
  message({ id: 'encouragement-20261007-22', lines: ['오늘도 최선을 다했어'], theme: 'grow', emoji: '👍', emojiLabel: '노력을 응원하는 손' }),
  message({ id: 'encouragement-20261007-23', lines: ['너의 노력은 사라지지 않아'], theme: 'grow', emoji: '🌱', emojiLabel: '노력으로 자라는 새싹' }),
  message({ id: 'encouragement-20261007-24', lines: ['실수에서도 배울 수 있어'], theme: 'retry', emoji: '🌱', emojiLabel: '배우며 자라는 새싹' }),
  message({ id: 'encouragement-20261007-25', lines: ['너의 성장이 자랑스러워'], theme: 'grow', emoji: '🌳', emojiLabel: '튼튼하게 자라는 나무' }),
  message({ id: 'encouragement-20261007-26', lines: ['오늘은 좋은 일이 생길 거야'], theme: 'grow', emoji: '☀️', emojiLabel: '밝은 하루의 햇살' }),
  message({ id: 'encouragement-20261007-27', lines: ['웃으면 마음도 밝아져'], theme: 'rest', emoji: '😊', emojiLabel: '밝은 미소' }),
  message({ id: 'encouragement-20261007-28', lines: ['오늘도 나는 네 편이야'], theme: 'help', emoji: '🤝', emojiLabel: '곁에서 응원하는 손' }),
  message({ id: 'encouragement-20261007-29', lines: ['너의 하루를 응원해'], theme: 'help', emoji: '👏', emojiLabel: '하루를 응원하는 박수' }),
  message({ id: 'encouragement-20261007-30', lines: ['오늘도 멋지게 해낼 거야'], theme: 'grow', emoji: '💪', emojiLabel: '힘찬 응원' }),
  message({ id: 'encouragement-20261007-31', lines: ['천천히 해도 다 잘될 거야'], theme: 'rest', emoji: '🌿', emojiLabel: '천천히 자라는 잎' }),
  message({ id: 'encouragement-20261007-32', lines: ['오늘 하루, 충분히 잘했어'], theme: 'rest', emoji: '👏', emojiLabel: '하루를 마친 박수' }),
  message({ id: 'encouragement-20261007-33', lines: ['크게 숨 쉬고,', '다시 웃자!'], theme: 'rest', emoji: '😊', emojiLabel: '다시 짓는 미소' }),
  message({ id: 'encouragement-20261007-34', lines: ['너의 꿈을 응원해'], theme: 'steps', emoji: '⭐', emojiLabel: '꿈을 비추는 별' }),
  message({ id: 'encouragement-20261007-35', lines: ['너의 미래는 밝아'], theme: 'grow', emoji: '☀️', emojiLabel: '미래를 비추는 햇살' }),
  message({ id: 'encouragement-20261007-36', lines: ['작은 걸음이', '큰 변화를 만들어'], theme: 'steps', emoji: '👟', emojiLabel: '변화를 만드는 한 걸음' }),
  message({ id: 'encouragement-20261007-37', lines: ['비가 그치면 무지개가 떠'], theme: 'rest', emoji: '🌈', emojiLabel: '비가 그친 뒤의 무지개' }),
  message({ id: 'encouragement-20261007-38', lines: ['오늘의 노력이', '내일의 힘이 돼'], theme: 'grow', emoji: '💪', emojiLabel: '노력이 모인 힘' }),
  message({ id: 'encouragement-20261007-39', lines: ['너에게는', '좋은 일이 기다리고 있어'], theme: 'grow', emoji: '✨', emojiLabel: '반짝이는 기대' }),
  message({ id: 'encouragement-20261007-40', lines: ['꿈은 조금씩 가까워지고 있어'], theme: 'steps', emoji: '⭐', emojiLabel: '가까워지는 꿈의 별' }),
  message({ id: 'encouragement-20261007-41', lines: ['너는 앞으로 더 멋져질 거야'], theme: 'grow', emoji: '🌟', emojiLabel: '더 밝게 빛나는 별' }),
  message({ id: 'encouragement-20261007-42', lines: ['언제든 다시 시작할 수 있어'], theme: 'retry', emoji: '🌱', emojiLabel: '새로 시작하는 새싹' }),
  message({ id: 'encouragement-20261007-43', lines: ['네가 가는 길을 응원해'], theme: 'steps', emoji: '👟', emojiLabel: '너의 길을 걷는 운동화' }),
  message({ id: 'encouragement-20261007-44', lines: ['함께라면 더 멀리 갈 수 있어'], theme: 'help', emoji: '🤝', emojiLabel: '함께 나아가는 손' }),
  message({ id: 'encouragement-20261007-45', lines: ['너는 세상에', '꼭 필요한 사람이야'], theme: 'help', emoji: '✨', emojiLabel: '소중하게 빛나는 별' }),
  message({ id: 'encouragement-20261007-46', lines: ['희망은 항상 네 곁에 있어'], theme: 'help', emoji: '🌈', emojiLabel: '희망을 담은 무지개' }),
  message({ id: 'encouragement-20261007-47', lines: ['내일은 오늘보다 더 웃을 거야'], theme: 'grow', emoji: '😊', emojiLabel: '내일의 밝은 미소' }),
  message({ id: 'encouragement-20261007-48', lines: ['너의 내일이 기대돼'], theme: 'grow', emoji: '☀️', emojiLabel: '내일의 밝은 햇살' }),
  message({ id: 'encouragement-20261007-49', lines: ['너는 무엇이든 배울 수 있어'], theme: 'grow', emoji: '🌱', emojiLabel: '배우며 자라는 새싹' }),
  message({ id: 'encouragement-20261007-50', lines: ['너는 충분히 잘 해낼 거야'], theme: 'grow', emoji: '💪', emojiLabel: '할 수 있다는 응원' }),
];

export function drawPositiveMessage(previousId?: string, random: () => number = Math.random): PositiveMessage {
  const available = POSITIVE_MESSAGES.filter(message => message.id !== previousId);
  const index = Math.max(0, Math.min(available.length - 1, Math.floor(random() * available.length)));
  return available[index];
}
