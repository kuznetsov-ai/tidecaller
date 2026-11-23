import { createContext, useContext } from 'react';
import type { Lang } from '../game/types';
import { tx } from './tx';

export const PauseApi = createContext({ toggle: () => {}, close: () => {} });

/** The voyage menu (resume / park / abandon) on every in-run screen, not only via Esc. */
export function RunMenuButton({ lang }: { lang: Lang }) {
  const pause = useContext(PauseApi);
  return (
    <button type="button" className="ghost run-menu" data-testid="run-menu" onClick={() => pause.toggle()}>
      {tx(lang, 'Меню', 'Menu')}
    </button>
  );
}
