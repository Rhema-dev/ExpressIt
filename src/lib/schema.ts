import { VALUE_TYPES } from '../types/types';
import { LEGACY_PACK_FORMAT } from './legacy';
import type { ExpressionPack, LibraryFile, Settings, ExpressItExpression } from '../types/types';
import { compileExpression } from './compiler';
export const MAX_FILE_SIZE = 2 * 1024 * 1024;
const reserved = new Set(['__proto__', 'prototype', 'constructor']);
function fail(message: string): never {
  throw new Error(message);
}
function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(label + ' must be an object.');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[], label: string) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) fail(label + ': unsupported field "' + key + '".');
}
function str(value: unknown, label: string, max: number, empty = false): string {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max)
    fail(label + ' is missing or too long.');
  // Lone surrogates cannot pass encodeURIComponent across the host boundary.
  try {
    encodeURIComponent(value);
  } catch {
    fail(label + ' contains invalid Unicode.');
  }
  return value;
}
function strings(value: unknown, label: string, maxItems = 32): string[] {
  if (!Array.isArray(value) || value.length > maxItems) fail(label + ' must be a short array.');
  return value.map((v) => str(v, label, 120));
}
export function parseJson(raw: string): unknown {
  if (raw.length > MAX_FILE_SIZE || new TextEncoder().encode(raw).length > MAX_FILE_SIZE)
    fail('File exceeds the 2 MB limit.');
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch {
    return fail('File contains invalid JSON.');
  }
}
export function validateExpression(input: unknown): ExpressItExpression {
  const e = record(input, 'Expression');
  keys(
    e,
    [
      'id',
      'version',
      'source',
      'name',
      'description',
      'category',
      'tags',
      'template',
      'compatibility',
      'parameters',
      'createdAt',
      'updatedAt',
    ],
    'Expression',
  );
  str(e.id, 'ID', 160);
  if (!/^(core|user)\.[a-zA-Z0-9._-]+$/.test(e.id as string))
    fail(
      'ID must start with core. or user. and contain letters, numbers, dots, dashes or underscores.',
    );
  if (!Number.isInteger(e.version) || Number(e.version) < 1)
    fail('Expression version must be a positive integer.');
  if (e.source !== 'core' && e.source !== 'user') fail('Invalid expression source.');
  if (!(e.id as string).startsWith(e.source + '.')) fail('Expression ID and source disagree.');
  str(e.name, 'Name', 100);
  str(e.description, 'Description', 1000, true);
  str(e.category, 'Category', 60);
  strings(e.tags, 'Tags');
  str(e.template, 'Template', 65536);
  for (const field of ['createdAt', 'updatedAt'])
    if (e[field] !== undefined) {
      const date = str(e[field], field, 40);
      if (!Number.isFinite(Date.parse(date))) fail('Invalid ' + field + '.');
    }
  const c = record(e.compatibility, 'Compatibility');
  keys(c, ['valueTypes', 'matchNames', 'minKeys'], 'Compatibility');
  if (
    c.valueTypes !== undefined &&
    strings(c.valueTypes, 'Value types').some(
      (v) => !(VALUE_TYPES as readonly string[]).includes(v),
    )
  )
    fail('Unknown property value type.');
  if (
    c.matchNames !== undefined &&
    strings(c.matchNames, 'Match names').some((n) => /[\r\n]/.test(n))
  )
    fail('Match names cannot contain line breaks.');
  if (
    c.minKeys !== undefined &&
    (!Number.isInteger(c.minKeys) || Number(c.minKeys) < 0 || Number(c.minKeys) > 10000)
  )
    fail('Invalid minimum keyframe count.');
  if (!Array.isArray(e.parameters) || e.parameters.length > 32)
    fail('At most 32 parameters are supported.');
  const seen = new Set<string>();
  for (const item of e.parameters) {
    const p = record(item, 'Parameter');
    keys(p, ['key', 'label', 'type', 'default', 'min', 'max', 'step', 'options'], 'Parameter');
    const key = str(p.key, 'Parameter key', 64);
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) || reserved.has(key) || seen.has(key))
      fail('Parameter keys must be safe, unique identifiers.');
    seen.add(key);
    str(p.label, 'Parameter label', 80);
    if (!['number', 'boolean', 'select', 'text'].includes(String(p.type)))
      fail('Unknown parameter type.');
    for (const bound of ['min', 'max', 'step'])
      if (p[bound] !== undefined) {
        if (p.type !== 'number' || typeof p[bound] !== 'number' || !Number.isFinite(p[bound]))
          fail('Numeric bounds require finite numbers.');
      }
    if (p.step !== undefined && Number(p.step) <= 0) fail('Step must be positive.');
    if (p.min !== undefined && p.max !== undefined && Number(p.min) > Number(p.max))
      fail('Minimum exceeds maximum.');
    if (p.type === 'number' && typeof p.default !== 'number')
      fail('Numeric defaults must be numbers.');
    if (p.type === 'select') {
      const options = strings(p.options, 'Options', 64);
      if (!options.length || new Set(options).size !== options.length)
        fail('Select options must be nonempty and unique.');
    } else if (p.options !== undefined) fail('Only select parameters have options.');
  }
  const result = JSON.parse(JSON.stringify(e)) as ExpressItExpression;
  compileExpression(result);
  return result;
}
export function validateLibrary(input: unknown, userOnly = false): LibraryFile {
  const data = record(input, 'Library');
  keys(data, ['schemaVersion', 'expressions'], 'Library');
  if (data.schemaVersion !== 1) fail('Unsupported library schema version.');
  if (!Array.isArray(data.expressions) || data.expressions.length > 1000)
    fail('A library supports at most 1,000 expressions.');
  const expressions = data.expressions.map(validateExpression);
  if (new Set(expressions.map((e) => e.id)).size !== expressions.length)
    fail('Duplicate expression IDs in file.');
  if (userOnly && expressions.some((e) => e.source !== 'user'))
    fail('The user library cannot contain core entries.');
  return { schemaVersion: 1, expressions };
}
export function validatePack(input: unknown): ExpressionPack {
  const p = record(input, 'Pack');
  keys(p, ['format', 'schemaVersion', 'name', 'exportedAt', 'expressions'], 'Pack');
  if (p.format !== 'expressit-pack' && p.format !== LEGACY_PACK_FORMAT)
    fail('This is not an ExpressIt pack.');
  const name = str(p.name, 'Pack name', 100);
  const exportedAt = str(p.exportedAt, 'Export date', 40);
  if (!Number.isFinite(Date.parse(exportedAt))) fail('Invalid pack export date.');
  const library = validateLibrary({ schemaVersion: p.schemaVersion, expressions: p.expressions });
  if (!library.expressions.length) fail('This pack contains no expressions.');
  return { ...library, format: 'expressit-pack', name, exportedAt };
}
export function validateSettings(input: unknown): Settings {
  const p = record(input, 'Settings');
  keys(p, ['schemaVersion', 'favorites', 'compatibleOnly'], 'Settings');
  if (p.schemaVersion !== 1 || typeof p.compatibleOnly !== 'boolean')
    fail('Unsupported settings format.');
  return {
    schemaVersion: 1,
    favorites: [...new Set(strings(p.favorites, 'Favorites', 2000))],
    compatibleOnly: p.compatibleOnly,
  };
}
