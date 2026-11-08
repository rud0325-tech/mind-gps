import { makeIMessageParts, type IMessageScenario, type LearningChoice } from '../learning/content';
import { translateText } from './translate';
import { getLearningLanguage, type LearningLanguage } from './language';

/** Personal situations and requests remain the learner's exact words. */
export function displayedIMessageParts(scenario: IMessageScenario, feeling: LearningChoice, request: LearningChoice, language: LearningLanguage = getLearningLanguage()): readonly [string,string,string] {
  const parts = makeIMessageParts(scenario,feeling,request);
  return [scenario.custom ? parts[0] : translateText(parts[0],language), translateText(parts[1],language), request.custom ? parts[2] : translateText(parts[2],language)];
}
