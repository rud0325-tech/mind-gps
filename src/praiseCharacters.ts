import type { Student } from './types';
import stageStar from './assets/characters/praise/stage-star.svg';
import creator from './assets/characters/praise/creator.svg';
import comfortFriend from './assets/characters/praise/comfort-friend.svg';
import gameHero from './assets/characters/praise/game-hero.svg';
import musicMate from './assets/characters/praise/music-mate.svg';
import sportsAce from './assets/characters/praise/sports-ace.svg';
import artist from './assets/characters/praise/artist.svg';
import aiEngineer from './assets/characters/praise/ai-engineer.svg';
import animalGuardian from './assets/characters/praise/animal-guardian.svg';

// Completion cards have their own expressions. Never change the selected avatar
// or the original images used by character selection and learning activities.
const PRAISE_IMAGES: Record<string, string> = {
  'pin-stage-star': stageStar,
  'pin-creator': creator,
  'pin-comfort-friend': comfortFriend,
  'pin-game-hero': gameHero,
  'pin-music-mate': musicMate,
  'pin-sports-ace': sportsAce,
  'pin-artist': artist,
  'pin-ai-engineer': aiEngineer,
  'pin-animal-guardian': animalGuardian,
};

export function praiseCharacterImage(character: Student): string {
  return PRAISE_IMAGES[character.id] || character.image;
}
