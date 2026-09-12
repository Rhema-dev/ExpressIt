import type { ExpressionPack, LibraryFile, Settings, ExpressItExpression } from '../types/types';
import { parseJson, validateLibrary, validatePack, validateSettings } from './schema';
import { createStorage, SafeFile } from './storage';
import { isCEP } from './ae';
export const emptyLibrary: LibraryFile = { schemaVersion: 1, expressions: [] };
export const defaultSettings: Settings = { schemaVersion: 1, favorites: [], compatibleOnly: false };
export function createRepository() {
  const storage = createStorage();
  return {
    location: storage.location,
    library: new SafeFile(storage, 'library.json', (v) => validateLibrary(v, true), parseJson),
    settings: new SafeFile(storage, 'settings.json', validateSettings, parseJson),
  };
}
export type Repository = ReturnType<typeof createRepository>;
export function createId() {
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  return 'user.' + Array.from(bytes, (n) => n.toString(16)).join('-');
}
export function duplicateExpression(e: ExpressItExpression): ExpressItExpression {
  const now = new Date().toISOString();
  return {
    ...JSON.parse(JSON.stringify(e)),
    id: createId(),
    source: 'user',
    version: 1,
    name: (e.name + ' copy').slice(0, 100),
    createdAt: now,
    updatedAt: now,
  };
}
export type ConflictPolicy = 'skip' | 'replace' | 'keep';
export function mergePack(
  existing: ExpressItExpression[],
  pack: ExpressionPack,
  policy: ConflictPolicy,
): ExpressItExpression[] {
  const next = [...existing];
  for (const item of pack.expressions) {
    const index = next.findIndex(
      (e) => e.id === item.id || e.name.toLowerCase() === item.name.toLowerCase(),
    );
    if (index >= 0 && policy === 'skip') continue;
    const now = new Date().toISOString();
    const imported = { ...item, source: 'user' as const, updatedAt: now };
    if (index >= 0 && policy === 'replace')
      next[index] = {
        ...imported,
        id: next[index].id,
        createdAt: next[index].createdAt ?? now,
        version: next[index].version + 1,
      };
    else {
      let name = item.name;
      let suffix = 2;
      while (next.some((e) => e.name.toLowerCase() === name.toLowerCase()))
        name = item.name.slice(0, 90) + ' (' + suffix++ + ')';
      next.push({
        ...imported,
        id: item.source === 'user' && !next.some((e) => e.id === item.id) ? item.id : createId(),
        name,
        createdAt: item.createdAt ?? now,
      });
    }
  }
  return validateLibrary({ schemaVersion: 1, expressions: next }, true).expressions;
}
export function readNativePack(): ExpressionPack | null {
  const fs = window.cep!.fs;
  const result = fs.showOpenDialogEx(false, false, 'Import ExpressIt Pack', '', ['evpack', 'json']);
  if (result.err) throw new Error('Could not open the import dialog (CEP ' + result.err + ').');
  if (!result.data.length) return null;
  const file = fs.readFile(result.data[0]);
  if (file.err) throw new Error('Could not read the selected pack (CEP ' + file.err + ').');
  return validatePack(parseJson(file.data));
}
export function exportPack(expressions: ExpressItExpression[], name: string): boolean {
  const pack = validatePack({
    format: 'expressit-pack',
    schemaVersion: 1,
    name,
    exportedAt: new Date().toISOString(),
    expressions,
  });
  const text = JSON.stringify(pack, null, 2);
  parseJson(text);
  const filename = name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'expressions';
  if (isCEP()) {
    const fs = window.cep!.fs;
    const result = fs.showSaveDialogEx(
      'Export ExpressIt Pack',
      '',
      ['evpack'],
      filename + '.evpack',
    );
    if (result.err) throw new Error('Could not open the export dialog.');
    if (!result.data) return false;
    // Keep the exact path confirmed by the OS dialog, including any overwrite confirmation.
    const saved = fs.writeFile(result.data, text);
    if (saved.err || fs.readFile(result.data).data !== text)
      throw new Error('Could not verify the exported pack. Check disk space and permissions.');
  } else {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename + '.evpack';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return true;
}
