/// <reference types="vite/client" />

interface Window {
  __SALTBOUND__?: {
    getState: () => import('./game/types').GameState;
    dispatch: (action: import('./game/types').Action) => void;
    policyStep: () => import('./game/types').Action | null;
  };
}
