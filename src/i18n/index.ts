import { create } from 'zustand';
import type { AppLanguage } from '@shared/types';
import zhCN, { type Translations } from './locales/zh-CN';
import en from './locales/en';
import zhTW from './locales/zh-TW';

const locales: Record<AppLanguage, Translations> = {
  'zh-CN': zhCN,
  'en': en,
  'zh-TW': zhTW,
};

interface I18nState {
  lang: AppLanguage;
  t: Translations;
  setLang: (lang: AppLanguage) => void;
}

export const useI18n = create<I18nState>((set) => ({
  lang: 'zh-CN',
  t: zhCN,
  setLang: (lang) => set({ lang, t: locales[lang] }),
}));

export function useT(): Translations {
  return useI18n((s) => s.t);
}
