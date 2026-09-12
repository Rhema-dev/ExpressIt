import type { CEPFileSystem } from '../types/cep';
import { isCEP } from './ae';
import { LEGACY_DIRECTORY, LEGACY_PREVIEW_PREFIX } from './legacy';
export interface StorageAdapter {
  read(name: string): string | null;
  write(name: string, text: string): void;
  location: string;
}
export function cepStorage(fs: CEPFileSystem, directory: string): StorageAdapter {
  const stat = fs.stat(directory);
  if (stat.err === 3) {
    const result = fs.makedir(directory);
    if (result.err) throw new Error('Could not create library folder (CEP ' + result.err + ').');
  } else if (stat.err || !stat.data.isDirectory())
    throw new Error('Library folder is inaccessible (CEP ' + stat.err + ').');
  return {
    location: directory,
    read(name) {
      const result = fs.readFile(directory + '/' + name);
      if (result.err === 3) return null;
      if (result.err) throw new Error('Could not read ' + name + ' (CEP ' + result.err + ').');
      return result.data;
    },
    write(name, text) {
      const result = fs.writeFile(directory + '/' + name, text);
      if (result.err)
        throw new Error(
          'Could not write ' +
            name +
            ' (CEP ' +
            result.err +
            '). Check disk space and permissions.',
        );
    },
  };
}
export function createStorage(): StorageAdapter {
  if (isCEP()) {
    if (!window.cep?.fs)
      throw new Error('CEP filesystem is unavailable. Reopen the panel in After Effects.');
    const base = new CSInterface().getSystemPath(SystemPath.USER_DATA).replace(/[\\/]+$/, '');
    const fs = window.cep.fs;
    const storage = cepStorage(fs, base + '/ExpressIt');
    migrateLegacyStorage(storage, (name) => {
      const result = fs.readFile(base + '/' + LEGACY_DIRECTORY + '/' + name);
      if (result.err === 3) return null;
      if (result.err)
        throw new Error('Could not read the previous library (CEP ' + result.err + ').');
      return result.data;
    });
    return storage;
  }
  const storage: StorageAdapter = {
    location: 'Browser preview storage (separate from your After Effects library)',
    read: (name) => localStorage.getItem('expressit.preview.' + name),
    write: (name, text) => localStorage.setItem('expressit.preview.' + name, text),
  };
  migrateLegacyStorage(storage, (name) => localStorage.getItem(LEGACY_PREVIEW_PREFIX + name));
  return storage;
}

// Snapshot the migration before copying. Interrupted copies resume from the
// snapshot; old files remain untouched, and existing new-brand groups win.
export function migrateLegacyStorage(
  storage: StorageAdapter,
  readLegacy: (name: string) => string | null,
) {
  if (storage.read('migration-v1.done') === '1') return;
  const names = [
    'library.json.backup',
    'library.json.pending',
    'library.json',
    'settings.json.backup',
    'settings.json.pending',
    'settings.json',
  ];
  const verify = (name: string, data: string) => {
    storage.write(name, data);
    if (storage.read(name) !== data)
      throw new Error('Could not verify library migration. The original files are preserved.');
  };
  let snapshot = storage.read('migration-v1.pending');
  if (snapshot === null) {
    const copies: Record<string, string> = {};
    for (const group of ['library.json', 'settings.json']) {
      const groupNames = names.filter((name) => name.startsWith(group));
      if (groupNames.some((name) => storage.read(name) !== null)) continue;
      for (const name of groupNames) {
        const data = readLegacy(name);
        if (data !== null) copies[name] = data;
      }
    }
    if (Object.keys(copies).length === 0) return;
    snapshot = JSON.stringify(copies);
    verify('migration-v1.pending', snapshot);
  }
  const copies: unknown = JSON.parse(snapshot);
  if (!copies || typeof copies !== 'object' || Array.isArray(copies))
    throw new Error('Invalid migration snapshot. Original files are preserved.');
  for (const [name, data] of Object.entries(copies)) {
    if (!names.includes(name) || typeof data !== 'string')
      throw new Error('Invalid migration snapshot. Original files are preserved.');
    verify(name, data);
  }
  verify('migration-v1.done', '1');
}
// CEP cannot promise atomic replacement or fsync. Staging, verified backup and
// readback make interrupted writes recoverable without deleting the primary.
export class SafeFile<T> {
  private loaded = false;
  private expected: string | null = null;
  private storage: StorageAdapter;
  public name: string;
  private validate: (data: unknown) => T;
  private parse: (raw: string) => unknown;
  constructor(
    storage: StorageAdapter,
    name: string,
    validate: (data: unknown) => T,
    parse: (raw: string) => unknown,
  ) {
    this.storage = storage;
    this.name = name;
    this.validate = validate;
    this.parse = parse;
  }
  load(fallback: T): T {
    const raw = this.storage.read(this.name);
    this.expected = raw;
    this.loaded = false;
    if (
      raw === null &&
      (this.storage.read(this.name + '.backup') !== null ||
        this.storage.read(this.name + '.pending') !== null)
    ) {
      throw new Error(
        this.name +
          ' is missing but recovery data exists. Restore the backup or recover the pending file before saving.',
      );
    }
    const result = raw === null ? fallback : this.validate(this.parse(raw));
    this.loaded = true;
    return result;
  }
  save(value: T): void {
    if (!this.loaded)
      throw new Error('Restore or reload the unreadable ' + this.name + ' before saving.');
    if (this.storage.read(this.name) !== this.expected)
      throw new Error(this.name + ' changed in another panel. Reload the library before saving.');
    const data = JSON.stringify(this.validate(value), null, 2);
    this.validate(this.parse(data));
    this.verifiedWrite(this.name + '.pending', data);
    if (this.expected !== null) this.verifiedWrite(this.name + '.backup', this.expected);
    // If primary write fails, lock writes until reload/recovery.
    this.loaded = false;
    this.verifiedWrite(this.name, data);
    this.expected = data;
    this.loaded = true;
  }
  restore(): T {
    const backup = this.storage.read(this.name + '.backup');
    if (backup === null) throw new Error('No backup exists yet for ' + this.name + '.');
    const result = this.validate(this.parse(backup));
    const current = this.storage.read(this.name);
    if (current !== null) this.verifiedWrite(this.name + '.recovery-' + Date.now(), current);
    this.loaded = false;
    this.verifiedWrite(this.name, backup);
    this.expected = backup;
    this.loaded = true;
    return result;
  }
  private verifiedWrite(name: string, text: string) {
    this.storage.write(name, text);
    if (this.storage.read(name) !== text)
      throw new Error('Could not verify ' + name + '. Your previous backup is retained.');
  }
}
