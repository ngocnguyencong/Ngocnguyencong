export type ShowcaseEntry = {
  name: string;
  href: string;
  summary: string;
};

export const showcaseEntries: readonly ShowcaseEntry[] = [];

export function hasShowcaseEntries(entries: readonly ShowcaseEntry[]): boolean {
  return entries.length > 0;
}
