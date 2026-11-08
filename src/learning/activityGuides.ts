/** Approved Korean recordings and the existing English instructions, grouped by task. */
export const I_MESSAGE_GUIDES = [
  {
    ko: '상황을 하나 골라요.',
    en: 'Choose a situation. You can also add your own situation.',
    clipIds: ['mgps-011'],
  },
  {
    ko: '그 상황에서 어떤 마음이 들지 골라요.',
    en: 'Choose how you feel. All feelings are okay.',
    clipIds: ['mgps-012'],
  },
  {
    ko: '원하는 부탁을 하나 골라요.',
    en: 'Choose what you want to ask for. You can also add your own words.',
    clipIds: ['mgps-013'],
  },
  {
    ko: '상황과 마음, 부탁을 연결해 내 마음을 전해 봐요. 말하거나, 보여 주거나, 가리켜도 좋아요.',
    en: 'This is your I-message. It tells what happened, how you feel, and what you need. You can speak, listen, point, or show your message.',
    clipIds: ['mgps-014', 'mgps-015'],
  },
] as const;

export function getIMessageGuide(step: number) {
  return I_MESSAGE_GUIDES[step] ?? I_MESSAGE_GUIDES[0];
}
