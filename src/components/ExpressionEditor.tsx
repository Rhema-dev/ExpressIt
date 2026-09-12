import { useState } from 'react';
import type { AEProperty, ExpressionCompatibility, ExpressItExpression } from '../types/types';
import { compileExpression } from '../lib/compiler';
import { validateExpression } from '../lib/schema';

export function ExpressionEditor({
  initial,
  property,
  onSave,
  onCancel,
}: {
  initial: ExpressItExpression;
  property?: AEProperty;
  onSave: (expression: ExpressItExpression) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [tags, setTags] = useState(initial.tags.join(', '));
  const [parameters, setParameters] = useState(JSON.stringify(initial.parameters, null, 2));
  const [compatibility, setCompatibility] = useState(
    JSON.stringify(initial.compatibility, null, 2),
  );
  const [scope, setScope] = useState('saved');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  function validated() {
    return validateExpression({
      ...draft,
      name: draft.name.trim(),
      category: draft.category.trim(),
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      parameters: JSON.parse(parameters),
      compatibility: JSON.parse(compatibility),
      updatedAt: new Date().toISOString(),
    });
  }
  function preset(mode: string) {
    setScope(mode);
    if (mode === 'saved') {
      setCompatibility(JSON.stringify(initial.compatibility, null, 2));
      return;
    }
    let c: ExpressionCompatibility = {};
    if (property && mode === 'type') c = { valueTypes: [property.valueType] };
    if (property && mode === 'exact')
      c = { matchNames: [property.matchName], valueTypes: [property.valueType] };
    setCompatibility(JSON.stringify(c, null, 2));
  }
  const savedRule =
    initial.compatibility.matchNames?.join(', ').replace(/ADBE /g, '') ||
    initial.compatibility.valueTypes?.join(', ') ||
    'Any property';
  return (
    <form
      className="expression-editor"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          onSave(validated());
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }}
    >
      <label>
        Name
        <input
          data-autofocus
          required
          maxLength={100}
          placeholder="e.g. Soft camera shake"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </label>
      <label>
        Expression code
        <textarea
          aria-label="Expression code"
          className="code-editor"
          rows={7}
          spellCheck={false}
          required
          maxLength={65536}
          value={draft.template}
          onChange={(e) => setDraft({ ...draft, template: e.target.value })}
        />
      </label>
      <label>
        Works on
        <select value={scope} onChange={(e) => preset(e.target.value)}>
          <option value="saved">{savedRule}</option>
          {property && (
            <>
              <option value="exact">Selected property: {property.name}</option>
              <option value="type">Selected value type: {property.valueType}</option>
            </>
          )}
          <option value="any">Any property</option>
          {scope === 'custom' && <option value="custom">Custom rules</option>}
        </select>
      </label>
      <details className="editor-options">
        <summary>More options</summary>
        <label>
          Category
          <input
            required
            maxLength={60}
            list="categories"
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          />
        </label>
        <datalist id="categories">
          {['Motion', 'Loop', 'Text', 'Opacity', 'Timing', 'Utility'].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </datalist>
        <label>
          Description
          <textarea
            aria-label="Description"
            rows={2}
            maxLength={1000}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </label>
        <label>
          Tags
          <input
            placeholder="motion, shake"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </label>
        <details>
          <summary>Advanced: parameters & compatibility</summary>
          <p className="muted">
            Parameter keys use {'{{key}}'} in the code. Text values are quoted automatically.
          </p>
          <label>
            Parameters (JSON)
            <textarea
              aria-label="Parameters (JSON)"
              className="code-editor"
              rows={5}
              value={parameters}
              onChange={(e) => setParameters(e.target.value)}
            />
          </label>
          <label>
            Compatibility rules (JSON)
            <textarea
              aria-label="Compatibility rules (JSON)"
              className="code-editor"
              rows={3}
              value={compatibility}
              onChange={(e) => {
                setCompatibility(e.target.value);
                setScope('custom');
              }}
            />
          </label>
        </details>
        <button
          type="button"
          onClick={() => {
            try {
              setPreview(compileExpression(validated()));
              setError('');
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          Validate & preview
        </button>
        {preview && <pre className="code-preview">{preview}</pre>}
      </details>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary" type="submit">
          Save expression
        </button>
      </div>
    </form>
  );
}
