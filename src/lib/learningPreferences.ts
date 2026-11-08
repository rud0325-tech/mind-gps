export const LEARNING_PREFERENCES_KEY = 'mindgps-learning-preferences-v1';
export type StudentTextSize = 'normal' | 'large';
export interface LearningPreferences { confirmEmotion: boolean; textSize: StudentTextSize; language: 'ko' | 'en'; }
export function parseLearningPreferences(raw: string | null): LearningPreferences {
  try {
    const value = raw ? JSON.parse(raw) : null;
    return { confirmEmotion: value?.confirmEmotion === true, textSize: value?.textSize === 'large' ? 'large' : 'normal', language: value?.language === 'en' ? 'en' : 'ko' };
  } catch { return { confirmEmotion: false, textSize: 'normal', language: 'ko' }; }
}
