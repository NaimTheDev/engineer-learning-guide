import { onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { validateProgress } from './backup';
import { STATE_DOC } from './firebase';
import type { ProgressState } from './progress';

/**
 * Listen for the server copy of progress. Cached snapshots and our own
 * unconfirmed writes are skipped: localStorage is the local cache.
 */
export function subscribeRemote(
  onState: (state: ProgressState | undefined) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    STATE_DOC,
    (snap) => {
      if (snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
      if (!snap.exists()) return onState(undefined);
      try {
        onState(validateProgress(snap.data().progress));
      } catch (e) {
        onError(e as Error);
      }
    },
    onError,
  );
}

export function pushRemote(state: ProgressState): Promise<void> {
  return setDoc(STATE_DOC, { progress: state, savedAt: serverTimestamp() });
}
