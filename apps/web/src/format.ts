/**
 * Client-safe string helpers. This module must stay free of locale-file
 * imports so client islands can use it without pulling every translation
 * into the browser bundle.
 */

/** Renders a `{placeholder}` template. */
export function formatTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    // Own properties only — `key in vars` would resolve Object.prototype
    // members ("toString", "constructor") and substitute function source.
    Object.hasOwn(vars, key) ? String(vars[key]) : match,
  );
}

/**
 * Splits a template on a single `{placeholder}` and returns
 * [before, after] — for embedding a JSX node (e.g. <code>) at the slot.
 */
export function splitTemplate(template: string, key: string): [string, string] {
  const index = template.indexOf(`{${key}}`);
  if (index === -1) {
    return [template, ""];
  }
  return [template.slice(0, index), template.slice(index + key.length + 2)];
}
