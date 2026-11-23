import { CARDS } from '../src/game/cards';
import { RELIC_LIST } from '../src/game/relics';
import { EVENT_LIST } from '../src/game/events';
import { ENEMY_LIST } from '../src/game/enemies';
const cards = Object.values(CARDS);
console.log('cards all', cards.length, 'playable non-token/curse/status', cards.filter(c => !c.token && c.rarity !== 'curse' && c.rarity !== 'status').length);
console.log('relics', RELIC_LIST.length, 'events', EVENT_LIST.length);
console.log('enemies', ENEMY_LIST.length, 'nontutor', ENEMY_LIST.filter((e: any) => !e.id.startsWith('tutor')).length, ENEMY_LIST.map((e: any) => e.id).join(','));
