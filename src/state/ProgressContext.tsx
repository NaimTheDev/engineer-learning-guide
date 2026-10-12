import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { CURRICULUM } from '@/data/curriculum';
import type { Lesson } from '@/data/types';
import { loadProgress } from '@/lib/backup';
import { createInitialState, progressReducer, type ProgressAction, type ProgressState } from '@/lib/progress';
import { readJSON, STORAGE_KEYS, writeJSON } from '@/lib/storage';

interface ProgressContextValue {
  state: ProgressState;
  dispatch: (action: ProgressAction) => void;
  lessons: readonly Lesson[];
  /** False when the last write to localStorage failed (private mode, quota). */
  persisted: boolean;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

function reducer(state: ProgressState, action: ProgressAction) {
  return progressReducer(state, action);
}

function init(): ProgressState {
  const raw = readJSON<unknown>(STORAGE_KEYS.progress);
  return loadProgress(raw, () => {
    if (raw !== undefined) {
      // Stored data exists but is unreadable: keep a copy instead of silently
      // overwriting it on the next save.
      writeJSON(`${STORAGE_KEYS.progress}:unreadable:${Date.now()}`, raw);
    }
    return createInitialState();
  });
}

export function ProgressProvider({
  children,
  lessons = CURRICULUM,
}: {
  children: ReactNode;
  lessons?: readonly Lesson[];
}) {
  const [state, rawDispatch] = useReducer(reducer, undefined, init);
  const [persisted, setPersisted] = useState(true);
  // Skip writing on mount and when the state was just read from another tab.
  const skipWrite = useRef(true);

  useEffect(() => {
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    setPersisted(writeJSON(STORAGE_KEYS.progress, state));
  }, [state]);

  // Pick up changes made in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEYS.progress || e.newValue == null) return;
      try {
        const next = loadProgress(JSON.parse(e.newValue), () => state);
        if (next === state) return;
        skipWrite.current = true;
        rawDispatch({ type: 'replaceState', state: next });
      } catch {
        // ignore malformed cross-tab writes
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [state]);

  const dispatch = useCallback((a: ProgressAction) => rawDispatch(a), []);
  const value = useMemo(() => ({ state, dispatch, lessons, persisted }), [state, dispatch, lessons, persisted]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside <ProgressProvider>');
  return ctx;
}
