/**
 * Control bindings (packages/shared/data/controls.json) can be marked per
 * input context (docs/design/controls.md): Combat while a hostile is awake,
 * Calm everything else. A binding is a key name, a list of alternates, or an
 * object with the keys of each context (`{ "combat": [...], "calm": "..." }`;
 * a context left out is unbound). The client resolves a press to an action
 * with the context the sim reports, so Cross can dodge in Combat and
 * interact in Calm; the sim's input log records the resolved action.
 */
export const INPUT_CONTEXTS = ['combat', 'calm'] as const;
export type BindingContext = (typeof INPUT_CONTEXTS)[number];

export type KeyNames = string | string[];
export type ControlBinding = KeyNames | Partial<Record<BindingContext, KeyNames>>;

const list = (k: KeyNames | undefined): string[] => (k === undefined ? [] : Array.isArray(k) ? k : [k]);

/** True when the binding names keys per context. */
export function isContextual(b: ControlBinding | undefined): b is Partial<Record<BindingContext, KeyNames>> {
  return typeof b === 'object' && !Array.isArray(b);
}

/** The key names a binding fires on in a context (empty when unbound there). */
export function bindingKeys(b: ControlBinding | undefined, context: BindingContext): string[] {
  if (b === undefined) return [];
  return isContextual(b) ? list(b[context]) : list(b);
}

/** Every key name a binding fires on in any context, each once, in order of first appearance. */
export function bindingKeysAll(b: ControlBinding | undefined): string[] {
  const out: string[] = [];
  for (const context of INPUT_CONTEXTS) for (const k of bindingKeys(b, context)) if (!out.includes(k)) out.push(k);
  return out;
}

/** The contexts a binding fires in (both for a plain binding). */
export function bindingContexts(b: ControlBinding | undefined): BindingContext[] {
  return INPUT_CONTEXTS.filter((c) => bindingKeys(b, c).length > 0);
}
