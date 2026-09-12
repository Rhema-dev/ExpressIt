import type { ExpressItExpression } from '../types/types';

// One pass prevents text containing {{anotherKey}} becoming a second substitution.
export function compileExpression(
  expression: ExpressItExpression,
  values: Record<string, unknown> = {},
): string {
  const literals = new Map<string, string>();
  for (const p of expression.parameters) {
    const raw = Object.hasOwn(values, p.key) ? values[p.key] : p.default;
    let value: string | number | boolean;
    if (p.type === 'number') {
      if ((typeof raw !== 'number' && typeof raw !== 'string') || String(raw).trim() === '')
        throw new Error(`${p.label} needs a number.`);
      value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`${p.label} needs a finite number.`);
      if (p.min !== undefined && value < p.min)
        throw new Error(`${p.label} must be at least ${p.min}.`);
      if (p.max !== undefined && value > p.max)
        throw new Error(`${p.label} must be at most ${p.max}.`);
    } else if (p.type === 'boolean') {
      if (typeof raw !== 'boolean') throw new Error(`${p.label} must be true or false.`);
      value = raw;
    } else {
      if (typeof raw !== 'string' || raw.length > 4096)
        throw new Error(`${p.label} must be text under 4,097 characters.`);
      if (p.type === 'select' && !p.options?.includes(raw))
        throw new Error(`Choose a valid ${p.label}.`);
      value = raw;
    }
    literals.set(
      p.key,
      JSON.stringify(value)
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029'),
    );
  }
  const code = expression.template.replace(/\{\{([^{}]+)\}\}/g, (_match, key: string) => {
    if (!literals.has(key)) throw new Error(`Unknown parameter: ${key}.`);
    return literals.get(key)!;
  });
  if (!code.trim() || code.length > 65536)
    throw new Error('Expression must contain 1–65,536 characters.');
  return code;
}
