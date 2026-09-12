import { useState } from 'react';
import type { AEProperty, ExpressItExpression } from '../types/types';
import { compileExpression } from '../lib/compiler';
import { incompatibility } from '../lib/compatibility';

export function ExpressionDetail({
  expression: e,
  property,
  busy,
  writable,
  onInject,
  onEdit,
  onDuplicate,
  onDelete,
  onMessage,
}: {
  expression: ExpressItExpression;
  property?: AEProperty;
  busy: boolean;
  writable: boolean;
  onInject: (e: ExpressItExpression, code: string) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMessage: (message: string) => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  let code = '';
  let error = '';
  try {
    code = compileExpression(e, values);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const reason = incompatibility(e, property);
  function copy() {
    const previous = document.activeElement as HTMLElement | null;
    const area = document.createElement('textarea');
    area.value = code;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      if (!document.execCommand('copy')) throw new Error();
      onMessage('Code copied.');
    } catch {
      onMessage('Select the code preview and copy it manually.');
    } finally {
      area.remove();
      previous?.focus();
    }
  }
  return (
    <section className="detail" aria-label="Expression controls">
      <div className="detail-heading">
        <h2>{e.name}</h2>
        <button
          className="text-button"
          onClick={() => setValues({})}
          disabled={!e.parameters.length}
        >
          Reset
        </button>
      </div>
      <p className="description">{e.description}</p>
      <div className="parameters">
        {e.parameters.map((p) => (
          <label key={p.key} className="parameter">
            <span>{p.label}</span>
            {p.type === 'boolean' ? (
              <input
                type="checkbox"
                checked={Boolean(values[p.key] ?? p.default)}
                onChange={(event) => setValues({ ...values, [p.key]: event.target.checked })}
              />
            ) : p.type === 'select' ? (
              <select
                value={String(values[p.key] ?? p.default)}
                onChange={(event) => setValues({ ...values, [p.key]: event.target.value })}
              >
                {p.options!.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input
                type={p.type === 'number' ? 'number' : 'text'}
                min={p.min}
                max={p.max}
                step={p.step ?? 'any'}
                maxLength={4096}
                value={String(values[p.key] ?? p.default)}
                onChange={(event) => setValues({ ...values, [p.key]: event.target.value })}
              />
            )}
          </label>
        ))}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {reason && property && <p className="compatibility">{reason}</p>}
      <button
        className="primary apply-button"
        disabled={!!reason || !!error || busy}
        title={reason ?? 'Apply to the selected property'}
        onClick={() => onInject(e, code)}
      >
        {busy ? 'Applying…' : 'Apply'}
      </button>
      <div className="detail-tools">
        <details className="code-section">
          <summary>Code</summary>
          <pre className="code-preview" tabIndex={0}>
            {code}
          </pre>
          <button disabled={!!error} onClick={copy}>
            Copy code
          </button>
        </details>
        <div className="item-actions">
          <button disabled={!writable} onClick={onDuplicate}>
            Duplicate
          </button>
          {e.source === 'user' && (
            <>
              <button disabled={!writable} onClick={onEdit}>
                Edit
              </button>
              <button className="danger-text" disabled={!writable} onClick={onDelete}>
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
