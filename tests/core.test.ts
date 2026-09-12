import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { compileExpression } from '../src/lib/compiler';
import { incompatibility, searchExpressions } from '../src/lib/compatibility';
import { validateExpression, validateLibrary, validatePack, parseJson } from '../src/lib/schema';
import { mergePack } from '../src/lib/library';
import { SafeFile, cepStorage } from '../src/lib/storage';
import type { StorageAdapter } from '../src/lib/storage';
import type { AEProperty, ExpressItExpression } from '../src/types/types';
const core = validateLibrary(
  JSON.parse(readFileSync('public/data/expressions-core.json', 'utf8')),
).expressions;
const wiggle = core[0];
const position = {
  name: 'Position',
  matchName: 'ADBE Position',
  valueType: 'TwoD_SPATIAL',
  canSetExpression: true,
  numKeys: 0,
} as AEProperty;
const user = {
  ...wiggle,
  id: 'user.test',
  source: 'user',
  name: 'Custom wiggle',
} as ExpressItExpression;
function memory() {
  const files = new Map<string, string>();
  const storage: StorageAdapter = {
    location: 'memory',
    read: (name) => files.get(name) ?? null,
    write: (name, data) => {
      files.set(name, data);
    },
  };
  return { files, storage };
}
const pack = (expressions: ExpressItExpression[]) =>
  validatePack({
    format: 'expressit-pack',
    schemaVersion: 1,
    name: 'Tests',
    exportedAt: new Date().toISOString(),
    expressions,
  });
test('22 bundled expressions validate and compile to syntactically valid JavaScript', () => {
  assert.equal(core.length, 22);
  for (const e of core) {
    assert.ok(compileExpression(e).trim());
    new vm.Script(compileExpression(e));
  }
});
test('compiler applies overrides without mutating library data', () => {
  assert.equal(compileExpression(wiggle, { frequency: 3, amount: 25 }), 'wiggle(3, 25);');
  assert.equal(wiggle.parameters[0].default, 2);
});
test('compiler rejects blank, nonfinite, out of range and wrong primitive inputs', () => {
  for (const amount of ['', ' ', NaN, Infinity, -1, 2001, true, null, {}])
    assert.throws(() => compileExpression(wiggle, { amount }));
});
test('text literals escape quotes, newlines, unicode separators and replacement metacharacters', () => {
  const e = {
    ...user,
    template: '{{text}} + {{text}}',
    parameters: [{ key: 'text', label: 'Text', type: 'text' as const, default: '' }],
  };
  const value = '"\n\\$& {{text}}\u2028' + '$' + String.fromCharCode(96);
  const output = compileExpression(e, { text: value });
  assert.equal(vm.runInNewContext(output), value + value);
  assert.ok(!output.includes('\u2028'));
});
test('compiler rejects invalid boolean and select values and unresolved tokens', () => {
  assert.throws(() =>
    compileExpression(
      core.find((e) => e.id === 'core.cursor')!,
      { enabled: 'true' },
    ),
  );
  assert.throws(() =>
    compileExpression(
      core.find((e) => e.id === 'core.cursor')!,
      { cursor: 'arbitrary' },
    ),
  );
  assert.throws(() => compileExpression({ ...user, template: '{{missing}}' }));
});
test('schema rejects duplicate IDs, unknown versions, script actions and malicious parameter keys', () => {
  assert.throws(() => validateLibrary({ schemaVersion: 2, expressions: [] }));
  assert.throws(() => validateLibrary({ schemaVersion: 1, expressions: [user, user] }));
  assert.throws(() => validateExpression({ ...user, actions: [{ type: 'evalScript' }] }));
  for (const key of ['__proto__', 'constructor', 'x.*', 'same-key'])
    assert.throws(() =>
      validateExpression({
        ...user,
        parameters: [{ key, label: 'x', type: 'number', default: 1 }],
      }),
    );
  assert.throws(() =>
    validateExpression({ ...user, compatibility: { matchNames: ['ADBE Position\nADBE Opacity'] } }),
  );
});
test('schema rejects malformed bounds, nonnumeric defaults, unknown types and oversized files', () => {
  assert.throws(() =>
    validateExpression({
      ...user,
      parameters: [{ key: 'x', label: 'x', type: 'number', default: '2' }],
    }),
  );
  assert.throws(() =>
    validateExpression({
      ...user,
      parameters: [{ key: 'x', label: 'x', type: 'number', default: 2, min: 5, max: 1 }],
    }),
  );
  assert.throws(() => validateExpression({ ...user, compatibility: { valueTypes: ['Bogus'] } }));
  assert.throws(() => parseJson('x'.repeat(2 * 1024 * 1024 + 1)));
  assert.deepEqual(parseJson('\uFEFF{"a":1}'), { a: 1 });
});
test('compatibility checks both constraints, expression support and keyframes', () => {
  assert.equal(incompatibility(wiggle, position), null);
  assert.ok(
    incompatibility(
      core.find((e) => e.id === 'core.counter')!,
      position,
    ),
  );
  assert.ok(incompatibility(wiggle, { ...position, canSetExpression: false }));
  const loop = core.find((e) => e.id === 'core.loop-out')!;
  assert.ok(incompatibility(loop, position));
  assert.equal(incompatibility(loop, { ...position, numKeys: 2 }), null);
  assert.ok(incompatibility(wiggle));
});
test('search matches all query terms across metadata', () => {
  assert.equal(searchExpressions(core, 'camera random')[0].id, 'core.wiggle');
  assert.equal(searchExpressions(core, '  ').length, 22);
});
test('pack conflicts skip, replace stable IDs and keep both uniquely', () => {
  const imported = { ...user, id: 'user.other', template: 'value;' };
  assert.deepEqual(mergePack([user], pack([imported]), 'skip'), [user]);
  const replaced = mergePack([user], pack([imported]), 'replace');
  assert.equal(replaced[0].id, user.id);
  assert.equal(replaced[0].version, 2);
  const kept = mergePack([user], pack([user]), 'keep');
  assert.equal(kept.length, 2);
  assert.notEqual(kept[0].id, kept[1].id);
  assert.notEqual(kept[0].name, kept[1].name);
  assert.equal(mergePack([], pack([wiggle]), 'keep')[0].source, 'user');
  assert.equal(user.template, wiggle.template);
});
test('safe storage retains previous valid version and verifies every write', () => {
  const { files, storage } = memory();
  const f = new SafeFile(storage, 'library.json', (v) => validateLibrary(v, true), parseJson);
  f.load({ schemaVersion: 1, expressions: [] });
  f.save({ schemaVersion: 1, expressions: [user] });
  f.save({ schemaVersion: 1, expressions: [] });
  assert.equal(validateLibrary(parseJson(files.get('library.json.backup')!)).expressions.length, 1);
  assert.equal(f.restore().expressions.length, 1);
  assert.ok([...files.keys()].some((n) => n.includes('.recovery-')));
});
test('corruption is never treated as an empty library or overwritten on load', () => {
  const { files, storage } = memory();
  files.set('library.json', 'broken');
  const f = new SafeFile(storage, 'library.json', validateLibrary, parseJson);
  assert.throws(() => f.load({ schemaVersion: 1, expressions: [] }));
  assert.throws(() => f.save({ schemaVersion: 1, expressions: [] }));
  assert.equal(files.get('library.json'), 'broken');
});
test('stale writers are rejected before backup or primary changes', () => {
  const { files, storage } = memory();
  const f = new SafeFile(storage, 'library.json', validateLibrary, parseJson);
  f.load({ schemaVersion: 1, expressions: [] });
  files.set('library.json', 'external contents');
  assert.throws(() => f.save({ schemaVersion: 1, expressions: [] }), /another panel/);
  assert.equal(files.get('library.json'), 'external contents');
  assert.equal(files.has('library.json.backup'), false);
});
test('failed primary writes retain a valid backup and lock further writes until recovery', () => {
  const { files, storage } = memory();
  const f = new SafeFile(storage, 'library.json', validateLibrary, parseJson);
  f.load({ schemaVersion: 1, expressions: [] });
  f.save({ schemaVersion: 1, expressions: [user] });
  const write = storage.write;
  storage.write = (name, data) => {
    if (name === 'library.json') {
      files.set(name, 'partial');
      throw new Error('Disk full');
    }
    write(name, data);
  };
  assert.throws(() => f.save({ schemaVersion: 1, expressions: [] }), /Disk full/);
  assert.throws(() => f.save({ schemaVersion: 1, expressions: [] }), /Restore or reload/);
  storage.write = write;
  assert.equal(f.restore().expressions[0].id, user.id);
});
test('CEP adapter only treats ERR_NOT_FOUND as missing; permission errors propagate', () => {
  const fs = {
    stat: () => ({ err: 0, data: { isDirectory: () => true } }),
    readFile: () => ({ err: 4, data: '' }),
  };
  const storage = cepStorage(fs as Parameters<typeof cepStorage>[0], '/test');
  assert.throws(() => storage.read('library.json'), /CEP 4/);
});
