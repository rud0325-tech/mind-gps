import type { Student } from './types';
import stageStar from './assets/characters/stage-star.svg';
import creator from './assets/characters/creator.svg';
import comfortFriend from './assets/characters/comfort-friend.svg';
import gameHero from './assets/characters/game-hero.svg';
import musicMate from './assets/characters/music-mate.svg';
import sportsAce from './assets/characters/sports-ace.svg';
import artist from './assets/characters/artist.svg';
import aiEngineer from './assets/characters/ai-engineer.svg';
import animalGuardian from './assets/characters/animal-guardian.svg';

// These are fictional companions, not student identities. New IDs preserve the
// meaning of historical records that used the earlier human character roster.
export const CHARACTERS: Student[] = [
  { id: 'pin-stage-star', name: '무대스타', image: stageStar },
  { id: 'pin-creator', name: '크리에이터', image: creator },
  { id: 'pin-comfort-friend', name: '토닥이', image: comfortFriend },
  { id: 'pin-game-hero', name: '게임히어로', image: gameHero },
  { id: 'pin-music-mate', name: '음악메이트', image: musicMate },
  { id: 'pin-sports-ace', name: '스포츠에이스', image: sportsAce },
  { id: 'pin-artist', name: '그림작가', image: artist },
  { id: 'pin-ai-engineer', name: 'AI공학자', image: aiEngineer },
  { id: 'pin-animal-guardian', name: '동물지킴이', image: animalGuardian },
];
