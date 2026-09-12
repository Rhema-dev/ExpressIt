import type { AEProperty, ExpressItExpression } from '../types/types';
export function incompatibility(
  expression: ExpressItExpression,
  property?: AEProperty,
): string | null {
  if (!property) return 'Select one property in After Effects.';
  if (!property.canSetExpression) return 'This property cannot accept expressions.';
  const c = expression.compatibility;
  if (c.matchNames?.length && !c.matchNames.includes(property.matchName))
    return `Requires ${c.matchNames.map((n) => n.replace('ADBE ', '')).join(' or ')}.`;
  if (c.valueTypes?.length && !c.valueTypes.includes(property.valueType))
    return `Requires ${c.valueTypes.join(', ')}.`;
  if (c.minKeys && property.numKeys < c.minKeys)
    return `Add at least ${c.minKeys} keyframes first.`;
  return null;
}
export function searchExpressions(
  expressions: ExpressItExpression[],
  query: string,
): ExpressItExpression[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return expressions.filter((e) => {
    const text = [e.name, e.description, e.category, ...e.tags].join(' ').toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
