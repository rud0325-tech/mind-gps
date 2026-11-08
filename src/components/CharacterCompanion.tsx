import { localizeView } from '../i18n/localizeView';
import type { Student } from '../types';

/** A quiet, familiar companion beside the activity title, without extra controls. */
export default function CharacterCompanion({ character }: { character?: Student | null }) {
  if (!character) return null;
  return localizeView(<img className="character-companion" src={character.image}
    alt={`${character.name}와 함께`} width={44} height={44} />);
}
