// Generates a standalone, ES3 smoke test. Run it in a scratch AE project.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileExpression } from '../src/lib/compiler.ts';
import { validateLibrary } from '../src/lib/schema.ts';
const root = resolve('.');
const expressions = validateLibrary(
  JSON.parse(readFileSync('public/data/expressions-core.json', 'utf8')),
).expressions.map((e) => ({ ...e, code: compileExpression(e) }));
mkdirSync('artifacts', { recursive: true });
const script = [
  '(function () {',
  'var root = ' + JSON.stringify(root.replaceAll('\\', '/')) + ';',
  '$.evalFile(File(root + "/host/expressit.jsx"));',
  'var cases = ' + JSON.stringify(expressions) + ';',
  'var report = {version: app.version, checks: [], errors: []};',
  'var previous = app.project.activeItem, folder = null;',
  'function check(name, ok, detail) { report.checks.push({name: name, ok: !!ok, detail: detail || ""}); }',
  'function result(raw) { return eval("(" + raw + ")"); }',
  'app.beginSuppressDialogs();',
  'try {',
  '  folder = app.project.items.addFolder("ExpressIt temporary smoke test");',
  '  var comp = app.project.items.addComp("ExpressIt Smoke", 640, 360, 1, 6, 30); comp.parentFolder = folder;',
  '  comp.openInViewer();',
  '  var shape = comp.layers.addShape(); shape.name = "ExpressIt Shape";',
  '  var shape3 = comp.layers.addShape(); shape3.name = "ExpressIt 3D"; shape3.threeDLayer = true;',
  '  var text = comp.layers.addText("ExpressIt");',
  '  function clearSelection() { var selected = comp.selectedProperties; for(var j=selected.length-1;j>=0;j--) selected[j].selected=false; for(var k=1;k<=comp.numLayers;k++) comp.layer(k).selected=false; }',
  '  function choose(prop) { clearSelection(); prop.selected=true; }',
  '  var targets=[shape.property("ADBE Transform Group").property("ADBE Position"),shape3.property("ADBE Transform Group").property("ADBE Position"),shape.property("ADBE Transform Group").property("ADBE Scale"),shape.property("ADBE Transform Group").property("ADBE Rotate Z"),shape.property("ADBE Transform Group").property("ADBE Opacity"),text.property("ADBE Text Properties").property("ADBE Text Document")];',
  '  for (var t=0;t<targets.length;t++) { var p=targets[t]; if(ExpressIt.valueTypeName(p)!=="TEXT_DOCUMENT"){var initial=p.value, end=p.value;if(typeof end==="number")end+=20;else {end=[];for(var v=0;v<initial.length;v++)end[v]=initial[v]+20;}p.setValueAtTime(1,initial);p.setValueAtTime(2,end);} }',
  '  for(var i=0;i<cases.length;i++) {',
  '    var e=cases[i];',
  '    for(var t=0;t<targets.length;t++) {',
  '      var p=targets[t], c=e.compatibility, type=ExpressIt.valueTypeName(p);',
  '      if(c.matchNames && ("|"+c.matchNames.join("|")+"|").indexOf("|"+p.matchName+"|")<0)continue;',
  '      if(c.valueTypes && ("|"+c.valueTypes.join("|")+"|").indexOf("|"+type+"|")<0)continue;',
  '      choose(p); p.expression=""; comp.time=1.5;',
  '      var s=ExpressIt.selection();',
  '      if(!s.ok){check(e.name+" selection",false,ExpressIt.stringify(s));continue;}',
  '      var r=result(ExpressIt.injectExpression(encodeURIComponent(e.code),encodeURIComponent(s.property.token),encodeURIComponent((c.matchNames||[]).join("\\n")),encodeURIComponent((c.valueTypes||[]).join("\\n")),c.minKeys||0,false));',
  '      check(e.name+" on "+p.name+" "+type,r.ok,r.message);',
  '      if(r.ok){var times=[0,1.5,2.5,5.9];for(var q=0;q<times.length;q++){try{p.valueAtTime(times[q],false);check(e.name+" at "+times[q]+" / "+type,!p.expressionError,p.expressionError);}catch(err){check(e.name+" evaluation",false,err.toString());}}}',
  '      p.expression="";',
  '    }',
  '  }',
  '  var pos=targets[0]; choose(pos); pos.expression="value + [1, 2]";pos.expressionEnabled=false;',
  '  var selected=ExpressIt.selection();',
  '  var captured=result(ExpressIt.captureSelectedExpression(encodeURIComponent(selected.property.token)));',
  '  check("Capture disabled expression",captured.ok && captured.property.expressionText==="value + [1, 2]");',
  '  var denied=result(ExpressIt.injectExpression(encodeURIComponent("value;"),encodeURIComponent(selected.property.token),"","",0,false));',
  '  check("Replacement requires confirmation",denied.reason==="EXPRESSION_EXISTS");',
  '  var invalid=result(ExpressIt.injectExpression(encodeURIComponent("notDefinedFunction();"),encodeURIComponent(selected.property.token),"","",0,true));',
  '  check("Invalid expression restores disabled original",!invalid.ok && pos.expression==="value + [1, 2]" && !pos.expressionEnabled,invalid.message);',
  '  pos.expression="value;";',
  '  var stale=result(ExpressIt.injectExpression(encodeURIComponent("wiggle(2,50)"),encodeURIComponent(selected.property.token),"","",0,true));',
  '  check("Stale expression rejected",stale.reason==="SELECTION_CHANGED");',
  '  clearSelection();check("No property rejected",result(ExpressIt.getSelectedProperty()).reason==="NO_PROPERTY");',
  '} catch(error) { report.errors.push(error.toString()); }',
  'finally { if(folder)folder.remove();if(previous instanceof CompItem)previous.openInViewer();app.endSuppressDialogs(false); }',
  'var output=File(root+"/artifacts/ae-smoke.json");output.encoding="UTF-8";if(output.open("w")){output.write(ExpressIt.stringify(report));output.close();}',
  '}());',
].join('\n');
writeFileSync('artifacts/ae-smoke.jsx', script);
console.log(
  'Run artifacts/ae-smoke.jsx in a scratch After Effects project. Results: artifacts/ae-smoke.json',
);
