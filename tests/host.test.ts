import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync('host/expressit.jsx', 'utf8');
function setup() {
  class CompItem {
    id = 5;
    name = 'Composition';
    time = 0;
    selectedProperties: unknown[] = [];
  }
  const layer = { id: 7, index: 1, name: 'Layer "one"' };
  const property = {
    name: 'Position',
    matchName: 'ADBE Position',
    propertyType: 1,
    propertyValueType: 3,
    propertyDepth: 1,
    propertyIndex: 1,
    parentProperty: layer,
    propertyGroup: () => layer,
    canSetExpression: true,
    expression: '',
    expressionEnabled: false,
    numKeys: 2,
    valueAtTime() {
      if (this.expression === 'throws') throw Error('Evaluation failed');
      return [0, 0];
    },
    get expressionError() {
      return this.expression === 'invalid' ? 'Expression error' : '';
    },
  };
  const comp = new CompItem();
  comp.selectedProperties = [property];
  let groups = 0,
    ended = 0;
  const app = {
    project: { activeItem: comp as CompItem | null },
    beginUndoGroup: () => {
      groups++;
    },
    endUndoGroup: () => {
      ended++;
    },
  };
  const ctx = vm.createContext({
    JSON: undefined,
    CompItem,
    PropertyType: { PROPERTY: 1 },
    PropertyValueType: {
      OneD: 1,
      TwoD: 2,
      TwoD_SPATIAL: 3,
      ThreeD: 4,
      ThreeD_SPATIAL: 5,
      COLOR: 6,
      TEXT_DOCUMENT: 7,
    },
    app,
  });
  vm.runInContext(source, ctx);
  function evalHost(command: string) {
    return JSON.parse(vm.runInContext(command, ctx));
  }
  function inject(
    code = 'value;',
    replace = false,
    token?: string,
    names = '',
    types = '',
    keys = 0,
  ) {
    const target = token ?? evalHost('ExpressIt.getSelectedProperty()').property.token;
    const args = [
      encodeURIComponent(code),
      encodeURIComponent(target),
      encodeURIComponent(names),
      encodeURIComponent(types),
      keys,
      replace,
    ];
    return evalHost(
      'ExpressIt.injectExpression(' + args.map((a) => JSON.stringify(a)).join(',') + ')',
    );
  }
  return { evalHost, inject, property, layer, comp, app, groups: () => groups, ended: () => ended };
}
test('host serializes quoted layer names without global JSON', () => {
  assert.equal(
    setup().evalHost('ExpressIt.getSelectedProperty()').property.layerName,
    'Layer "one"',
  );
});
test('host rejects no comp, no selection, group and multiple selections', () => {
  const h = setup();
  h.app.project.activeItem = null;
  assert.equal(h.evalHost('ExpressIt.getSelectedProperty()').reason, 'NO_ACTIVE_COMP');
  h.app.project.activeItem = h.comp;
  h.comp.selectedProperties = [];
  assert.equal(h.evalHost('ExpressIt.getSelectedProperty()').reason, 'NO_PROPERTY');
  h.comp.selectedProperties = [h.property, h.property];
  assert.equal(h.evalHost('ExpressIt.getSelectedProperty()').reason, 'MULTIPLE_PROPERTIES');
  h.comp.selectedProperties = [h.property];
  h.property.propertyType = 2;
  assert.equal(h.evalHost('ExpressIt.getSelectedProperty()').reason, 'NOT_PROPERTY');
});
test('injection succeeds and closes exactly one undo group', () => {
  const h = setup();
  assert.equal(h.inject().ok, true);
  assert.equal(h.property.expression, 'value;');
  assert.equal(h.property.expressionEnabled, true);
  assert.equal(h.groups(), 1);
  assert.equal(h.ended(), 1);
});
test('existing expressions require explicit replacement', () => {
  const h = setup();
  h.property.expression = 'old';
  assert.equal(h.inject().reason, 'EXPRESSION_EXISTS');
  assert.equal(h.groups(), 0);
  assert.equal(h.inject('new', true).ok, true);
});
test('stale identity and stale expression snapshots are rejected', () => {
  const h = setup();
  const token = h.evalHost('ExpressIt.getSelectedProperty()').property.token;
  h.layer.id = 8;
  assert.equal(h.inject('value;', true, token).reason, 'SELECTION_CHANGED');
  assert.equal(h.groups(), 0);
  h.layer.id = 7;
  h.property.expression = 'changed';
  assert.equal(h.inject('value;', true, token).reason, 'SELECTION_CHANGED');
});
test('host independently enforces compatibility and keyframe count', () => {
  const h = setup();
  assert.equal(h.inject('value;', false, undefined, 'ADBE Opacity').reason, 'INCOMPATIBLE');
  assert.equal(h.inject('value;', false, undefined, '', 'TEXT_DOCUMENT').reason, 'INCOMPATIBLE');
  assert.equal(h.inject('value;', false, undefined, '', '', 3).reason, 'INCOMPATIBLE');
  h.property.canSetExpression = false;
  assert.equal(h.inject().reason, 'CANNOT_SET_EXPRESSION');
});
test('invalid and throwing expressions restore old code and its disabled flag', () => {
  for (const code of ['invalid', 'throws']) {
    const h = setup();
    h.property.expression = 'old';
    h.property.expressionEnabled = false;
    assert.equal(h.inject(code, true).ok, false);
    assert.equal(h.property.expression, 'old');
    assert.equal(h.property.expressionEnabled, false);
    assert.equal(h.groups(), 1);
    assert.equal(h.ended(), 1);
  }
});
test('enabled expressions retain enabled state on rollback', () => {
  const h = setup();
  h.property.expression = 'old';
  h.property.expressionEnabled = true;
  h.inject('invalid', true);
  assert.equal(h.property.expressionEnabled, true);
});
test('capture guards selection and returns exact source', () => {
  const h = setup();
  let token = h.evalHost('ExpressIt.getSelectedProperty()').property.token;
  assert.equal(
    h.evalHost(
      'ExpressIt.captureSelectedExpression(' + JSON.stringify(encodeURIComponent(token)) + ')',
    ).reason,
    'NO_EXPRESSION',
  );
  h.property.expression = 'wiggle(2, 50)';
  token = h.evalHost('ExpressIt.getSelectedProperty()').property.token;
  assert.equal(
    h.evalHost(
      'ExpressIt.captureSelectedExpression(' + JSON.stringify(encodeURIComponent(token)) + ')',
    ).property.expressionText,
    'wiggle(2, 50)',
  );
});
test('code transport does not execute as ExtendScript', () => {
  const h = setup();
  const code = '"; app.project.activeItem=null; //\n"unicode: 🌀"';
  assert.equal(h.inject(code).ok, true);
  assert.equal(h.property.expression, code);
  assert.equal(h.app.project.activeItem, h.comp);
});
