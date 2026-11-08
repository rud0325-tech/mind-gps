import { rebtPracticeThought, type SimpleScenario } from './simpleRebt';

export interface RebtStory {
  situation: string;
  thought: string;
  helpful: string;
  check: string;
  pictureCheck: string;
}

/** The screen identifies fictional practice; narration starts with the actual
 * sentence and reuses its exact recording. Never infer the learner's thoughts. */
export function getRebtStory(scenario: SimpleScenario): RebtStory | undefined {
  if (scenario.custom) return undefined;
  const thought = rebtPracticeThought(scenario);
  const helpful = scenario.alternatives[0];
  if (!thought || !helpful) return undefined;
  return {
    situation: scenario.sentence,
    thought: thought.sentence,
    helpful: helpful.sentence,
    check: scenario.check,
    pictureCheck: scenario.pictureCheck,
  };
}
