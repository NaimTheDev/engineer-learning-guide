import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
});

afterEach(() => {
  cleanup();
});

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom defines scrollTo but only logs "not implemented".
window.scrollTo = (() => {}) as typeof window.scrollTo;
Element.prototype.scrollIntoView ??= function () {};

// Keep tests off the network: the Firestore copy never connects.
vi.mock('@/lib/sync', () => ({
  subscribeRemote: () => () => {},
  pushRemote: () => Promise.resolve(),
}));
