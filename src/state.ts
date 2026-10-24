import { sanitizeSlots, type Slot } from './schedule';
import { config, type Config } from '../config';

export type Step = 1 | 2 | 3 | 4 | 5;
export const TOTAL_STEPS = 4;

export interface State {
  step: Step;
  slots: Slot[];
  activities: string[];
  note: string;
  neinCount: number;
}

export const NOTE_MAX = 1000;
export const STORAGE_KEY = 'fuer-charlie:v1';

export const initialState = (): State => ({
  step: 1,
  slots: [],
  activities: [],
  note: '',
  neinCount: 0,
});

/**
 * Parses persisted state defensively: storage may hold an older shape, or
 * slots that have since become past / blocked. Anything unusable is dropped
 * rather than failing the whole restore.
 */
export function restore(raw: string | null, now: Date, cfg: Config = config): State {
  const base = initialState();
  if (!raw) return base;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return base;
  }
  if (typeof parsed !== 'object' || parsed === null) return base;
  const data = parsed as Partial<Record<keyof State, unknown>>;

  const slots = Array.isArray(data.slots) ? sanitizeSlots(cfg, now, data.slots, cfg.maxSlots) : [];
  const knownIds = new Set(cfg.activities.map((a) => a.id));
  const activities = Array.isArray(data.activities)
    ? data.activities.filter((id): id is string => typeof id === 'string' && knownIds.has(id))
    : [];
  const note = typeof data.note === 'string' ? data.note.slice(0, NOTE_MAX) : '';
  const neinCount =
    typeof data.neinCount === 'number' && Number.isFinite(data.neinCount)
      ? Math.max(0, Math.floor(data.neinCount))
      : 0;

  // Never resume past a step whose prerequisites were invalidated.
  let step: Step = data.step === 2 || data.step === 3 || data.step === 4 ? data.step : 1;
  if (step >= 3 && slots.length === 0) step = 2;
  if (step === 4 && activities.length === 0) step = 3;

  if (!cfg.allowMultiple) activities.splice(1);
  return { step, slots, activities, note, neinCount };
}

type Listener = (state: State, prev: State) => void;

export interface Store {
  get(): State;
  set(patch: Partial<State>): void;
  subscribe(fn: Listener): () => void;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // Disabled storage (e.g. some privacy modes) throws on access.
  }
}

export function createStore(now: Date = new Date()): Store {
  let state = restore(readRaw(), now);
  const listeners = new Set<Listener>();

  function readRaw(): string | null {
    try {
      return storage()?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  function persist() {
    try {
      // Step 5 = submitted: progress is forgotten so the next visit starts fresh.
      if (state.step === 5) storage()?.removeItem(STORAGE_KEY);
      else storage()?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota or privacy mode: progress just won't survive a reload.
    }
  }

  return {
    get: () => state,
    set(patch) {
      const prev = state;
      state = { ...state, ...patch };
      persist();
      for (const fn of listeners) fn(state, prev);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
