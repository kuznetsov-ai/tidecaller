import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/literata/cyrillic-600.css';
import '@fontsource/literata/cyrillic-600-italic.css';
import '@fontsource/literata/cyrillic-700.css';
import '@fontsource/literata/latin-600.css';
import '@fontsource/literata/latin-600-italic.css';
import '@fontsource/literata/latin-700.css';
import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/cyrillic-500.css';
import '@fontsource/manrope/cyrillic-700.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-700.css';
import App from './App';
import { setBusVolume, setPadTide, sfx, unlockAudio } from './audio';
import { getState, subscribe } from './state';
import './styles.css';

window.addEventListener('pointerdown', () => unlockAudio());

let prev = getState();
setBusVolume(prev.meta.settings.volume);
subscribe(() => {
  const next = getState();
  setBusVolume(next.meta.settings.volume);
  if (next.combat) setPadTide(next.combat.tide);
  if (next.fx !== prev.fx) {
    for (const fx of next.fx) {
      if (fx.t === 'log' && fx.code === 'play') sfx('play');
      else if (fx.t === 'dmg' && fx.who === 'p') sfx('hit');
      else if (fx.t === 'block' && fx.who === 'p') sfx('block');
      else if (fx.t === 'tide') sfx('tide');
      else if (fx.t === 'heal' && fx.who === 'p') sfx('heal');
      else if (fx.t === 'log' && fx.code === 'gold') sfx('coin');
    }
  }
  if (next.screen !== prev.screen) {
    if (next.screen === 'victory') sfx('win');
    else if (next.screen === 'defeat') sfx('lose');
    else sfx('click');
  }
  prev = next;
});

class Guard extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="screen story">
          <h1>SALTBOUND</h1>
          <p className="prose">{this.state.error}</p>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('saltbound-save-v1');
              location.reload();
            }}
          >
            Сбросить сохранение
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Guard>
      <App />
    </Guard>
  </StrictMode>,
);
