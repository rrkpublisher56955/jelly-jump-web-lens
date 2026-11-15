export type GameState =
  | { tag: 'BOOT' }
  | { tag: 'IDLE' }
  | { tag: 'AIMING'; pull: number }
  | { tag: 'FLYING' }
  | { tag: 'PAUSED'; previous: 'IDLE' | 'AIMING' | 'FLYING' }
  | { tag: 'GAMEOVER'; finalScore: number };

export type GameEvent =
  | { type: 'READY' }
  | { type: 'AIM_START' }
  | { type: 'AIM_UPDATE'; pull: number }
  | { type: 'AIM_CANCEL' }
  | { type: 'LAUNCH' }
  | { type: 'LAND' }
  | { type: 'POP'; score: number }
  | { type: 'REPLAY' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' };

export function transition(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'READY': return state.tag === 'BOOT' ? { tag: 'IDLE' } : state;
    case 'AIM_START': return state.tag === 'IDLE' ? { tag: 'AIMING', pull: 0 } : state;
    case 'AIM_UPDATE': return state.tag === 'AIMING' ? { tag: 'AIMING', pull: Math.max(0, event.pull) } : state;
    case 'AIM_CANCEL': return state.tag === 'AIMING' ? { tag: 'IDLE' } : state;
    case 'LAUNCH': return state.tag === 'AIMING' ? { tag: 'FLYING' } : state;
    case 'LAND': return state.tag === 'FLYING' ? { tag: 'IDLE' } : state;
    case 'POP': return state.tag === 'FLYING' || state.tag === 'AIMING' ? { tag: 'GAMEOVER', finalScore: Math.max(0, Math.floor(event.score)) } : state;
    case 'REPLAY': return state.tag === 'GAMEOVER' ? { tag: 'IDLE' } : state;
    case 'PAUSE': return state.tag === 'IDLE' || state.tag === 'AIMING' || state.tag === 'FLYING' ? { tag: 'PAUSED', previous: state.tag } : state;
    case 'RESUME': return state.tag === 'PAUSED' ? (state.previous === 'AIMING' ? { tag: 'IDLE' } : { tag: state.previous }) : state;
    default: return state;
  }
}
