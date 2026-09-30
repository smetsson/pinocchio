import { en, type Strings } from './en';

// Add more languages here, e.g. `import { nl } from './nl';` and `{ en, nl }`.
const LANGUAGES: Record<string, Strings> = { en };

function pick(): Strings {
  const forced = new URLSearchParams(location.search).get('lang');
  if (forced && LANGUAGES[forced]) return LANGUAGES[forced];
  return en; // Default UI language: English.
}

export const t: Strings = typeof location === 'undefined' ? en : pick();
