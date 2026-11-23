import { useEffect, useState } from 'react';
import { CARDS } from './game/cards';
import { cardCost } from './game/combat';
import { dispatch, useGame } from './state';
import { EventScreen, RestScreen, RewardScreen, ShopScreen, StoryScreen } from './ui/camp';
import { CodexScreen, DrydockScreen, EndScreen, HelpScreen, MenuScreen, SelectScreen, SettingsScreen } from './ui/home';
import { CombatScreen, MapScreen } from './ui/play';
import { PauseApi } from './ui/shell';
import { tx } from './ui/tx';

export default function App() {
  const state = useGame();
  const [pause, setPause] = useState(false);
  const lang = state.meta.settings.lang;
  const inRun = ['combat', 'map', 'event', 'shop', 'rest', 'reward', 'story'].includes(state.screen);

  useEffect(() => {
    document.body.classList.toggle('reduced', state.meta.settings.reduced);
    document.documentElement.lang = lang;
  }, [state.meta.settings.reduced, lang]);

  useEffect(() => {
    setPause(false);
  }, [state.screen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (event.key === 'Escape') {
        if (inRun) setPause((v) => !v);
        return;
      }
      if (!state.combat || state.combat.phase !== 'player' || pause) return;
      if (event.key === 'e' || event.key === 'E' || event.key === ' ') {
        event.preventDefault();
        dispatch({ type: 'endTurn' });
      }
      if (event.key >= '1' && event.key <= '9') {
        const card = state.combat.hand[Number(event.key) - 1];
        const def = card && CARDS[card.id];
        if (card && def && !def.unplayable && cardCost(card, state.combat) <= state.combat.energy) {
          dispatch({ type: 'playCard', uid: card.uid });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.combat, state.screen, pause, inRun]);

  const screen = (() => {
    switch (state.screen) {
      case 'menu':
        return <MenuScreen />;
      case 'select':
        return <SelectScreen />;
      case 'combat':
        return <CombatScreen />;
      case 'map':
        return <MapScreen />;
      case 'story':
        return <StoryScreen />;
      case 'reward':
        return <RewardScreen />;
      case 'rest':
        return <RestScreen />;
      case 'shop':
        return <ShopScreen />;
      case 'event':
        return <EventScreen />;
      case 'drydock':
        return <DrydockScreen />;
      case 'codex':
        return <CodexScreen />;
      case 'help':
        return <HelpScreen />;
      case 'settings':
        return <SettingsScreen />;
      case 'victory':
      case 'defeat':
        return <EndScreen />;
      default:
        return <MenuScreen />;
    }
  })();

  return (
    <PauseApi.Provider value={{ toggle: () => setPause((v) => !v), close: () => setPause(false) }}>
      <div className="app" data-testid="app" data-screen={state.screen} data-shake={state.fx.some((fx) => fx.t === 'shake') ? '1' : '0'}>
        {screen}
        {pause && inRun && (
          <div className="modal" data-testid="pause">
            <div className="sheet">
              <h2>{tx(lang, 'Пауза', 'Paused')}</h2>
              <div className="choices">
                <button type="button" onClick={() => setPause(false)}>
                  {tx(lang, 'Вернуться', 'Resume')}
                </button>
                <button type="button" className="ghost" onClick={() => { setPause(false); dispatch({ type: 'park' }); }}>
                  {tx(lang, 'В меню, рейс сохранится', 'Menu, voyage kept')}
                </button>
                <button type="button" className="ghost" onClick={() => dispatch({ type: 'abandon' })}>
                  {tx(lang, 'Бросить рейс', 'Abandon voyage')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PauseApi.Provider>
  );
}
