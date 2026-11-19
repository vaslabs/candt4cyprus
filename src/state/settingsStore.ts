import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '../lib/storage';

export type Theme = 'light' | 'dark' | 'system';
interface SettingsState {
  readonly theme: Theme;
  setTheme: (t: Theme) => void;
}

export const useSettings = create<SettingsState>()(
  persist((set) => ({ theme: 'system', setTheme: (theme) => set({ theme }) }), {
    name: 'cy-ai-si-settings',
    storage: createJSONStorage(() => safeStorage),
  }),
);

export function resolvedDark(theme: Theme): boolean {
  if (theme === 'system')
    return (
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
    );
  return theme === 'dark';
}
