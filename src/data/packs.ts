import type { PromptPack } from '../logic/types';

// Every JSON file in /prompts is picked up automatically at build time.
const modules = import.meta.glob<{ default: PromptPack }>('../../prompts/*.json', { eager: true });

export const PACKS: PromptPack[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => (a.id === 'general' ? -1 : b.id === 'general' ? 1 : a.name.localeCompare(b.name)));

export function getPack(id: string): PromptPack {
  return PACKS.find((p) => p.id === id) ?? PACKS[0];
}
