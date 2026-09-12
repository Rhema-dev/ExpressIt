import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacyStorage } from '../src/lib/storage';
import { validatePack } from '../src/lib/schema';
import { LEGACY_PACK_FORMAT } from '../src/lib/legacy';

function fixture() {
  const files = new Map<string, string>();
  const old = new Map([
    ['library.json', 'original'],
    ['library.json.backup', 'backup'],
    ['settings.json', 'favorites'],
  ]);
  const storage = {
    location: 'test',
    read: (name: string) => files.get(name) ?? null,
    write: (name: string, text: string) => {
      files.set(name, text);
    },
  };
  const read = (name: string) => old.get(name) ?? null;
  return { files, old, storage, read };
}
test('rename copies library, backups and favorites without changing old files', () => {
  const { files, old, storage, read } = fixture();
  migrateLegacyStorage(storage, read);
  for (const [name, value] of old) assert.equal(files.get(name), value);
  assert.equal(old.get('library.json'), 'original');
  files.set('library.json', 'new edit');
  migrateLegacyStorage(storage, read);
  assert.equal(files.get('library.json'), 'new edit');
});
test('rename preserves existing new-brand groups including recovery files', () => {
  const { files, storage, read } = fixture();
  files.set('library.json.pending', 'recover me');
  migrateLegacyStorage(storage, read);
  assert.equal(files.has('library.json'), false);
  assert.equal(files.get('library.json.pending'), 'recover me');
  assert.equal(files.get('settings.json'), 'favorites');
});
test('interrupted migration resumes from its verified snapshot', () => {
  const { files, storage, read } = fixture();
  const original = storage.write;
  storage.write = (name, data) => {
    if (name === 'library.json') throw new Error('Disk full');
    original(name, data);
  };
  assert.throws(() => migrateLegacyStorage(storage, read), /Disk full/);
  assert.equal(files.has('migration-v1.done'), false);
  storage.write = original;
  migrateLegacyStorage(storage, read);
  assert.equal(files.get('library.json'), 'original');
  assert.equal(files.get('migration-v1.done'), '1');
});
test('no legacy data requires no startup writes', () => {
  const { storage } = fixture();
  storage.write = () => {
    throw new Error('Read only');
  };
  assert.doesNotThrow(() => migrateLegacyStorage(storage, () => null));
});
test('old packs import and normalize to the ExpressIt format', () => {
  const pack = validatePack({
    format: LEGACY_PACK_FORMAT,
    schemaVersion: 1,
    name: 'Older pack',
    exportedAt: '2026-09-11T00:00:00Z',
    expressions: [
      {
        id: 'user.old',
        version: 1,
        source: 'user',
        name: 'Older expression',
        description: '',
        category: 'Utility',
        tags: [],
        template: 'value;',
        parameters: [],
        compatibility: {},
      },
    ],
  });
  assert.equal(pack.format, 'expressit-pack');
  assert.equal(pack.expressions[0].id, 'user.old');
});
