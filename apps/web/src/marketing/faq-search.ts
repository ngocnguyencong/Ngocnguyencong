import type { FaqItem } from "./site-config";

export function filterFaqItems(items: readonly FaqItem[], query: string): FaqItem[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    return [...items];
  }
  return items.filter((item) =>
    `${item.question} ${item.answer}`.toLocaleLowerCase().includes(normalized),
  );
}
