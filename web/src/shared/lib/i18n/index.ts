import fr from "./fr.json";

// French only: the application's one language. Keys are `{feature}.{element}.{text}`; a plural is a pair
// of keys `{key}_one` / `{key}_other`, picked by `tn`.

export type MessageKey = keyof typeof fr;
type PluralKey = MessageKey extends infer K ? (K extends `${infer B}_one` ? B : never) : never;
type Vars = Record<string, string | number>;

const fill = (text: string, vars?: Vars) => (vars ? text.replace(/\{(\w+)\}/g, (all, name: string) => (name in vars ? String(vars[name]) : all)) : text);

export function t(key: MessageKey, vars?: Vars): string {
  return fill(fr[key], vars);
}

// French: 0 and 1 take the singular.
export function tn(key: PluralKey, count: number, vars?: Vars): string {
  const form = (count <= 1 ? `${key}_one` : `${key}_other`) as MessageKey;
  return fill(fr[form], { count, ...vars });
}
