import { useSyncExternalStore } from 'react';
import { policyAction } from './game/policy';
import { freshState, reduce, sanitize } from './game/reducer';
import type { Action, GameState } from './game/types';

const KEY = 'tidecaller-save-v1';

const BACKUP = 'tidecaller-save-v1-backup';
const timeSeed = () => (Date.now() ^ 0x9e3779b9) >>> 0;

function backup(raw: string): void {
  try {
    localStorage.setItem(BACKUP, raw);
  } catch {
    /* quota */
  }
}

function parse(raw: string | null): GameState {
  if (!raw) return freshState(timeSeed());
  try {
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed?.meta || parsed.meta.version !== 1) {
      backup(raw); // an unknown or broken save is kept aside, never silently lost
      return freshState(timeSeed());
    }
    return sanitize(parsed);
  } catch {
    backup(raw);
    return freshState(timeSeed());
  }
}

function load(): GameState {
  try {
    return parse(localStorage.getItem(KEY));
  } catch {
    return freshState(timeSeed());
  }
}

let state: GameState = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    const saved: GameState = { ...state, fx: [] };
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* private mode / quota */
  }
}

export function getState(): GameState {
  return state;
}

function notify(): void {
  // One failing subscriber (e.g. audio without WebAudio) must not stop React from rendering.
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn(error);
    }
  });
}

export function dispatch(action: Action): void {
  state = reduce(state, action);
  persist();
  notify();
}

// Another tab saved: pick its state up instead of overwriting it with ours later.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY || event.newValue == null) return;
    state = parse(event.newValue);
    notify();
  });
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGame(): GameState {
  return useSyncExternalStore(subscribe, getState, getState);
}

declare global {
  interface Window {
    __TIDECALLER__?: {
      getState: () => GameState;
      dispatch: (action: Action) => void;
      policyStep: () => Action | null;
    };
  }
}

window.__TIDECALLER__ = {
  getState,
  dispatch,
  policyStep() {
    const action = policyAction(getState());
    if (action) dispatch(action);
    return action;
  },
};
