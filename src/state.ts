import { useSyncExternalStore } from 'react';
import { policyAction } from './game/policy';
import { freshState, reduce, sanitize } from './game/reducer';
import type { Action, GameState } from './game/types';

const KEY = 'saltbound-save-v1';

function load(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState((Date.now() ^ 0x9e3779b9) >>> 0);
    return sanitize(JSON.parse(raw) as GameState);
  } catch {
    return freshState();
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

export function dispatch(action: Action): void {
  state = reduce(state, action);
  persist();
  listeners.forEach((listener) => listener());
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
    __SALTBOUND__?: {
      getState: () => GameState;
      dispatch: (action: Action) => void;
      policyStep: () => Action | null;
    };
  }
}

window.__SALTBOUND__ = {
  getState,
  dispatch,
  policyStep() {
    const action = policyAction(getState());
    if (action) dispatch(action);
    return action;
  },
};
