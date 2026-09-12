/* ExpressIt host. ES3 only; no dependence on a global JSON polyfill. */
var ExpressIt = ExpressIt || {};
ExpressIt.stringify = function (value) {
    var parts = [], key, i, c, hex;
    if (value === null) return 'null';
    if (typeof value === 'string') {
        var out = '"';
        for (i = 0; i < value.length; i++) {
            c = value.charAt(i);
            if (c === '"' || c === '\\') out += '\\' + c;
            else if (value.charCodeAt(i) < 32 || value.charCodeAt(i) === 8232 || value.charCodeAt(i) === 8233) {
                hex = value.charCodeAt(i).toString(16);
                out += '\\u' + ('0000' + hex).slice(-4);
            } else out += c;
        }
        return out + '"';
    }
    if (typeof value === 'boolean' || typeof value === 'number') return String(value);
    if (value instanceof Array) {
        for (i = 0; i < value.length; i++) parts.push(ExpressIt.stringify(value[i]));
        return '[' + parts.join(',') + ']';
    }
    for (key in value) if (value.hasOwnProperty(key)) parts.push(ExpressIt.stringify(key) + ':' + ExpressIt.stringify(value[key]));
    return '{' + parts.join(',') + '}';
};
ExpressIt.failure = function (reason, message) { return { ok: false, reason: reason, message: message || '' }; };
ExpressIt.valueTypeName = function (prop) {
    var names = ['OneD', 'TwoD', 'TwoD_SPATIAL', 'ThreeD', 'ThreeD_SPATIAL', 'COLOR', 'TEXT_DOCUMENT', 'SHAPE', 'MARKER', 'LAYER_INDEX', 'MASK_INDEX', 'CUSTOM_VALUE'];
    for (var i = 0; i < names.length; i++) if (prop.propertyValueType === PropertyValueType[names[i]]) return names[i];
    return 'UNKNOWN';
};
ExpressIt.selection = function () {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) return ExpressIt.failure('NO_ACTIVE_COMP');
    var selected = comp.selectedProperties;
    if (!selected || !selected.length) return ExpressIt.failure('NO_PROPERTY');
    if (selected.length !== 1) return ExpressIt.failure('MULTIPLE_PROPERTIES');
    var prop = selected[0];
    if (prop.propertyType !== PropertyType.PROPERTY) return ExpressIt.failure('NOT_PROPERTY');
    var layer = prop.propertyGroup(prop.propertyDepth), cursor = prop, path = [];
    while (cursor && cursor !== layer) { path.unshift(cursor.propertyIndex); cursor = cursor.parentProperty; }
    var code = prop.canSetExpression ? prop.expression : '';
    var enabled = prop.canSetExpression ? prop.expressionEnabled : false;
    var info = {
        name: prop.name, matchName: prop.matchName, valueType: ExpressIt.valueTypeName(prop),
        canSetExpression: prop.canSetExpression, hasExpression: code !== '', expressionEnabled: enabled,
        expressionText: code, layerName: layer.name, compName: comp.name, numKeys: prop.numKeys,
        token: ExpressIt.stringify([comp.id, layer.id, layer.index, path.join('.'), prop.matchName, code, enabled])
    };
    return { ok: true, property: info, prop: prop, comp: comp };
};
ExpressIt.getSelectedProperty = function () {
    try { var s = ExpressIt.selection(); return ExpressIt.stringify(s.ok ? { ok: true, property: s.property } : s); }
    catch (e) { return ExpressIt.stringify(ExpressIt.failure('ERROR', e.toString())); }
};
ExpressIt.captureSelectedExpression = function (encodedToken) {
    try {
        var s = ExpressIt.selection();
        if (!s.ok) return ExpressIt.stringify(s);
        if (s.property.token !== decodeURIComponent(encodedToken)) return ExpressIt.stringify(ExpressIt.failure('SELECTION_CHANGED'));
        if (!s.property.hasExpression) return ExpressIt.stringify(ExpressIt.failure('NO_EXPRESSION'));
        return ExpressIt.stringify({ ok: true, property: s.property });
    } catch (e) { return ExpressIt.stringify(ExpressIt.failure('ERROR', e.toString())); }
};
ExpressIt.injectExpression = function (encodedCode, encodedToken, encodedNames, encodedTypes, minKeys, replace) {
    var opened = false, prop = null, oldCode = '', oldEnabled = false, changed = false;
    try {
        var s = ExpressIt.selection();
        if (!s.ok) return ExpressIt.stringify(s);
        prop = s.prop;
        if (!prop.canSetExpression) return ExpressIt.stringify(ExpressIt.failure('CANNOT_SET_EXPRESSION'));
        if (s.property.token !== decodeURIComponent(encodedToken)) return ExpressIt.stringify(ExpressIt.failure('SELECTION_CHANGED'));
        var names = decodeURIComponent(encodedNames), types = decodeURIComponent(encodedTypes);
        if ((names && ('\n' + names + '\n').indexOf('\n' + prop.matchName + '\n') < 0) ||
            (types && ('\n' + types + '\n').indexOf('\n' + s.property.valueType + '\n') < 0) || prop.numKeys < minKeys) {
            return ExpressIt.stringify(ExpressIt.failure('INCOMPATIBLE'));
        }
        if (s.property.hasExpression && replace !== true) return ExpressIt.stringify(ExpressIt.failure('EXPRESSION_EXISTS'));
        var code = decodeURIComponent(encodedCode);
        if (!code.replace(/\s/g, '') || code.length > 65536) return ExpressIt.stringify(ExpressIt.failure('INVALID_EXPRESSION', 'Expression is empty or too large.'));
        oldCode = prop.expression; oldEnabled = prop.expressionEnabled;
        app.beginUndoGroup('ExpressIt: Inject Expression'); opened = true;
        changed = true;
        prop.expression = code;
        prop.expressionEnabled = true;
        prop.valueAtTime(s.comp.time, false);
        if (prop.expressionError) throw new Error(prop.expressionError);
        return ExpressIt.stringify({ ok: true, propertyName: prop.name });
    } catch (e) {
        var message = e.toString();
        if (changed && prop) {
            try { prop.expression = oldCode; if (oldCode !== '') prop.expressionEnabled = oldEnabled; }
            catch (restoreError) { message += '\nRestoration failed: ' + restoreError.toString() + '. Use Edit > Undo.'; }
        }
        return ExpressIt.stringify(ExpressIt.failure(changed ? 'INVALID_EXPRESSION' : 'ERROR', message));
    } finally { if (opened) app.endUndoGroup(); }
};
