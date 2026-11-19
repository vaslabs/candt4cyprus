/** localStorage wrapper that never throws (private mode, quota, disabled storage). */
import type { StateStorage } from 'zustand/middleware';

const memory = new Map<string, string>();
export const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return globalThis.localStorage?.getItem(k) ?? memory.get(k) ?? null;
    } catch {
      return memory.get(k) ?? null;
    }
  },
  setItem: (k, v) => {
    try {
      globalThis.localStorage?.setItem(k, v);
    } catch {
      memory.set(k, v);
    }
  },
  removeItem: (k) => {
    try {
      globalThis.localStorage?.removeItem(k);
    } catch {
      memory.delete(k);
    }
  },
};
