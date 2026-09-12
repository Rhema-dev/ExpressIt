import { useCallback, useEffect, useRef, useState } from 'react';
import coreData from '../public/data/expressions-core.json';
import {
  captureSelectedExpression,
  getSelectedProperty,
  hostBusy,
  hostError,
  injectExpression,
  isCEP,
} from './lib/ae';
import { incompatibility, searchExpressions } from './lib/compatibility';
import {
  createId,
  createRepository,
  defaultSettings,
  duplicateExpression,
  emptyLibrary,
  exportPack,
  mergePack,
  readNativePack,
} from './lib/library';
import type { ConflictPolicy, Repository } from './lib/library';
import { MAX_FILE_SIZE, parseJson, validateLibrary, validatePack } from './lib/schema';
import type {
  AEProperty,
  ExpressionPack,
  SelectedPropertyResult,
  Settings,
  ExpressItExpression,
} from './types/types';
import { Modal } from './components/Modal';
import { ExpressionEditor } from './components/ExpressionEditor';
import { ExpressionDetail } from './components/ExpressionDetail';
import { SocialLinks } from './components/SocialLinks';
import './App.css';
const core = validateLibrary(coreData).expressions;
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
type Dialog =
  | { kind: 'editor'; expression: ExpressItExpression }
  | { kind: 'delete'; expression: ExpressItExpression }
  | { kind: 'replace'; expression: ExpressItExpression; code: string; property: AEProperty }
  | { kind: 'import'; pack: ExpressionPack }
  | { kind: 'export' }
  | { kind: 'settings' }
  | null;
function bootstrap() {
  let repo: Repository | null = null;
  let users: ExpressItExpression[] = [];
  let settings = defaultSettings;
  let libraryError = '';
  let settingsError = '';
  try {
    repo = createRepository();
    try {
      users = repo.library.load(emptyLibrary).expressions;
    } catch (e) {
      libraryError = messageOf(e);
    }
    try {
      settings = repo.settings.load(defaultSettings);
    } catch (e) {
      settingsError = messageOf(e);
    }
  } catch (e) {
    libraryError = messageOf(e);
    settingsError = libraryError;
  }
  return { repo, users, settings, libraryError, settingsError };
}
export default function App() {
  const [initial] = useState(bootstrap);
  const repository = useRef(initial.repo);
  const [storageLocation, setStorageLocation] = useState(initial.repo?.location ?? '');
  const [users, setUsers] = useState(initial.users);
  const [settings, setSettings] = useState(initial.settings);
  const [libraryError, setLibraryError] = useState(initial.libraryError);
  const [settingsError, setSettingsError] = useState(initial.settingsError);
  const [selected, setSelected] = useState<SelectedPropertyResult>({
    ok: false,
    reason: isCEP() ? 'NO_PROPERTY' : 'PREVIEW',
  });
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('All');
  const [category, setCategory] = useState('All categories');
  const [activeId, setActiveId] = useState('core.wiggle');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [policy, setPolicy] = useState<ConflictPolicy>('keep');
  const [packName, setPackName] = useState('My expression pack');
  const [exportIds, setExportIds] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  const writable = !!storageLocation && !libraryError;
  const property = selected.ok ? selected.property : undefined;
  const all = [...core, ...users];
  const categories = ['All categories', ...Array.from(new Set(all.map((e) => e.category))).sort()];
  const filtered = searchExpressions(all, search).filter(
    (e) =>
      (tab === 'All' ||
        (tab === 'Core' && e.source === 'core') ||
        (tab === 'Mine' && e.source === 'user') ||
        (tab === 'Favorites' && settings.favorites.includes(e.id))) &&
      (category === 'All categories' || e.category === category) &&
      (!settings.compatibleOnly || !incompatibility(e, property)),
  );
  const active = filtered.find((e) => e.id === activeId) ?? filtered[0];

  useEffect(() => {
    if (!isCEP()) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!document.hidden && !hostBusy()) {
        try {
          const result = await getSelectedProperty();
          if (alive) setSelected(result);
        } catch (e) {
          if (alive) setSelected({ ok: false, reason: 'ERROR', message: messageOf(e) });
        }
      }
      if (alive) timer = setTimeout(poll, 800);
    };
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && !dialog) {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [dialog]);

  function notify(text: string, error = false) {
    setNotice({ text, error });
  }
  function saveUsers(next: ExpressItExpression[]) {
    if (!repository.current || libraryError)
      throw new Error('Restore or reload the library before changing it.');
    repository.current.library.save({ schemaVersion: 1, expressions: next });
    setUsers(next);
  }
  function saveSettings(next: Settings) {
    try {
      if (!repository.current || settingsError)
        throw new Error('Restore settings before changing them.');
      repository.current.settings.save(next);
      setSettings(next);
    } catch (e) {
      notify(messageOf(e), true);
    }
  }
  function favorite(id: string) {
    saveSettings({
      ...settings,
      favorites: settings.favorites.includes(id)
        ? settings.favorites.filter((x) => x !== id)
        : [...settings.favorites, id],
    });
  }
  async function performInject(
    e: ExpressItExpression,
    code: string,
    target: AEProperty,
    replace: boolean,
  ) {
    setBusy(true);
    try {
      const result = await injectExpression(code, e, target.token, replace);
      if (!result.ok) throw new Error(hostError(result));
      notify('Injected into ' + result.propertyName + '. Use Edit → Undo to revert.');
      setSelected(await getSelectedProperty());
    } catch (err) {
      notify(messageOf(err), true);
    } finally {
      setBusy(false);
    }
  }
  function beginInject(e: ExpressItExpression, code: string) {
    if (!property) return;
    if (property.hasExpression) setDialog({ kind: 'replace', expression: e, code, property });
    else void performInject(e, code, property, false);
  }
  function freshExpression(): ExpressItExpression {
    const now = new Date().toISOString();
    return {
      id: createId(),
      version: 1,
      source: 'user',
      name: '',
      description: '',
      category: 'Utility',
      tags: [],
      template: 'value;',
      parameters: [],
      compatibility: property
        ? { matchNames: [property.matchName], valueTypes: [property.valueType] }
        : {},
      createdAt: now,
      updatedAt: now,
    };
  }
  async function capture() {
    if (!property) return;
    setBusy(true);
    try {
      const result = await captureSelectedExpression(property.token);
      if (!result.ok) throw new Error(hostError(result));
      setDialog({
        kind: 'editor',
        expression: {
          ...freshExpression(),
          name: result.property.name + ' expression',
          template: result.property.expressionText,
          compatibility: {
            matchNames: [result.property.matchName],
            valueTypes: [result.property.valueType],
          },
        },
      });
    } catch (e) {
      notify(messageOf(e), true);
    } finally {
      setBusy(false);
    }
  }
  function saveExpression(expression: ExpressItExpression) {
    const existing = users.find((e) => e.id === expression.id);
    const saved = { ...expression, version: existing ? existing.version + 1 : 1 };
    saveUsers(existing ? users.map((e) => (e.id === saved.id ? saved : e)) : [...users, saved]);
    setTab('Mine');
    setCategory('All categories');
    setSearch('');
    setActiveId(saved.id);
    setDialog(null);
    notify('Saved ' + saved.name + ' to Mine.');
  }
  function importFile() {
    if (!isCEP()) {
      fileInput.current?.click();
      return;
    }
    try {
      const pack = readNativePack();
      if (pack) {
        setPolicy('keep');
        setDialog({ kind: 'import', pack });
      }
    } catch (e) {
      notify(messageOf(e), true);
    }
  }
  function reload() {
    try {
      if (!repository.current) repository.current = createRepository();
      setStorageLocation(repository.current.location);
      try {
        setUsers(repository.current.library.load(emptyLibrary).expressions);
        setLibraryError('');
      } catch (e) {
        setLibraryError(messageOf(e));
      }
      try {
        setSettings(repository.current.settings.load(defaultSettings));
        setSettingsError('');
      } catch (e) {
        setSettingsError(messageOf(e));
      }
    } catch (e) {
      notify(messageOf(e), true);
    }
  }
  function restore(kind: 'library' | 'settings') {
    try {
      if (!repository.current)
        throw new Error('Storage is unavailable. Fix folder permissions and reload.');
      if (kind === 'library') {
        setUsers(repository.current.library.restore().expressions);
        setLibraryError('');
      } else {
        setSettings(repository.current.settings.restore());
        setSettingsError('');
      }
      notify('Previous ' + kind + ' restored. The replaced file was preserved for recovery.');
    } catch (e) {
      notify(messageOf(e), true);
    }
  }
  return (
    <main className="app">
      <header className="topbar">
        <h1>ExpressIt</h1>
        <button
          className="text-button settings-button"
          aria-label="Settings and backups"
          onClick={() => setDialog({ kind: 'settings' })}
        >
          Settings
        </button>
      </header>
      <div className="panel-body">
        <section
          className={'selection ' + (property?.canSetExpression ? 'ready' : '')}
          aria-label="Selected After Effects property"
        >
          <span className="selection-dot" aria-hidden="true" />
          {property ? (
            <p title={property.compName + ' / ' + property.layerName + ' / ' + property.name}>
              <strong>{property.name}</strong>
              <span> · {property.layerName}</span>
            </p>
          ) : (
            <p>
              {isCEP()
                ? selected.ok
                  ? ''
                  : hostError(selected)
                : 'Preview · Open in After Effects to apply'}
            </p>
          )}
        </section>
        <div className="create-actions">
          <button
            disabled={!writable}
            onClick={() => setDialog({ kind: 'editor', expression: freshExpression() })}
          >
            + New
          </button>
          <button
            disabled={!writable || !property?.hasExpression || busy}
            onClick={() => void capture()}
            title={
              property?.hasExpression
                ? 'Save the expression on the selected property to Mine'
                : 'Select an AE property that already has an expression'
            }
          >
            Save from AE
          </button>
        </div>
        {(libraryError || settingsError) && (
          <div className="notice error" role="alert">
            <strong>Local storage needs attention.</strong>
            <p>{libraryError || settingsError}</p>
            <button onClick={() => setDialog({ kind: 'settings' })}>Recovery options</button>
          </div>
        )}
        {notice && (
          <div
            className={'notice toast ' + (notice.error ? 'error' : 'success')}
            role={notice.error ? 'alert' : 'status'}
          >
            <span>{notice.text}</span>
            <button
              className="icon-button"
              aria-label="Dismiss message"
              onClick={() => setNotice(null)}
            >
              ×
            </button>
          </div>
        )}
        <label className="search">
          <span className="sr-only">Search expressions</span>
          <input
            ref={searchInput}
            aria-label="Search expressions"
            type="search"
            placeholder="Search expressions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <nav className="tabs" aria-label="Library">
          {['All', 'Core', 'Mine', 'Favorites'].map((t) => (
            <button
              key={t}
              aria-pressed={tab === t}
              className={tab === t ? 'active' : ''}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="filters">
          <label>
            <span className="sr-only">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              disabled={!!settingsError}
              checked={settings.compatibleOnly}
              onChange={(e) => saveSettings({ ...settings, compatibleOnly: e.target.checked })}
            />
            Compatible
          </label>
        </div>
        <div className="workspace">
          <section className="expression-list" aria-label="Expressions">
            {filtered.map((e) => {
              const unavailable = !!property && !!incompatibility(e, property);
              return (
                <div
                  key={e.id}
                  className={
                    'expression-row ' +
                    (active?.id === e.id ? 'selected ' : '') +
                    (unavailable ? 'incompatible' : '')
                  }
                >
                  <button
                    className="expression-pick"
                    title={
                      e.name + ': ' + (unavailable ? incompatibility(e, property) : e.description)
                    }
                    aria-pressed={active?.id === e.id}
                    onClick={() => setActiveId(e.id)}
                  >
                    {e.name}
                  </button>
                  <button
                    className={
                      'favorite icon-button ' +
                      (settings.favorites.includes(e.id) ? 'is-favorite' : '')
                    }
                    disabled={!!settingsError}
                    aria-label={
                      (settings.favorites.includes(e.id) ? 'Unfavorite ' : 'Favorite ') + e.name
                    }
                    aria-pressed={settings.favorites.includes(e.id)}
                    onClick={() => favorite(e.id)}
                  >
                    {settings.favorites.includes(e.id) ? '★' : '☆'}
                  </button>
                </div>
              );
            })}
            {!filtered.length && (
              <div className="empty">
                <h2>{tab === 'Mine' ? 'Your expressions go here' : 'No expressions found'}</h2>
                <p>
                  {tab === 'Mine'
                    ? 'Choose New or save an expression from AE.'
                    : 'Try another search or filter.'}
                </p>
                <button
                  onClick={() => {
                    setSearch('');
                    setCategory('All categories');
                    setTab('All');
                    saveSettings({ ...settings, compatibleOnly: false });
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </section>
          {active && (
            <ExpressionDetail
              key={active.id + ':' + active.version}
              expression={active}
              property={property}
              busy={busy}
              writable={writable}
              onInject={beginInject}
              onEdit={() => setDialog({ kind: 'editor', expression: active })}
              onDuplicate={() =>
                setDialog({ kind: 'editor', expression: duplicateExpression(active) })
              }
              onDelete={() => setDialog({ kind: 'delete', expression: active })}
              onMessage={notify}
            />
          )}
        </div>
      </div>
      <footer className="bottom-bar">
        <div className="pack-actions">
          <button disabled={!writable} onClick={importFile}>
            Import
          </button>
          <button
            onClick={() => {
              setExportIds(users.map((e) => e.id));
              setDialog({ kind: 'export' });
            }}
          >
            Export
          </button>
        </div>
        <SocialLinks onError={notify} />
      </footer>
      <input
        ref={fileInput}
        type="file"
        accept=".evpack,.json"
        className="sr-only"
        tabIndex={-1}
        aria-label="Import pack file"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            if (file.size > MAX_FILE_SIZE) throw new Error('File exceeds the 2 MB limit.');
            const pack = validatePack(parseJson(await file.text()));
            setPolicy('keep');
            setDialog({ kind: 'import', pack });
          } catch (err) {
            notify(messageOf(err), true);
          }
        }}
      />
      {dialog && (
        <Modal
          title={
            dialog.kind === 'editor'
              ? users.some((e) => e.id === dialog.expression.id)
                ? 'Edit expression'
                : 'Save expression'
              : dialog.kind === 'replace'
                ? 'Replace existing expression?'
                : dialog.kind === 'delete'
                  ? 'Delete expression?'
                  : dialog.kind === 'import'
                    ? 'Review expression pack'
                    : dialog.kind === 'export'
                      ? 'Export expression pack'
                      : 'Settings & backups'
          }
          onClose={closeDialog}
        >
          {notice?.error && (
            <p role="alert" className="notice error">
              {notice.text}
            </p>
          )}
          {dialog.kind === 'editor' && (
            <ExpressionEditor
              initial={dialog.expression}
              property={property}
              onSave={saveExpression}
              onCancel={closeDialog}
            />
          )}
          {dialog.kind === 'replace' && (
            <>
              <p>
                <strong>{dialog.property.name}</strong> on {dialog.property.layerName} already has
                an expression{!dialog.property.expressionEnabled ? ' (disabled)' : ''}.
              </p>
              <div className="section-label">CURRENT EXPRESSION</div>
              <pre className="code-preview">{dialog.property.expressionText}</pre>
              <div className="section-label">
                REPLACE WITH {dialog.expression.name.toUpperCase()}
              </div>
              <pre className="code-preview">{dialog.code}</pre>
              <p className="muted">
                The replacement is enabled immediately. Undo in After Effects restores the previous
                expression.
              </p>
              <div className="dialog-actions">
                <button onClick={closeDialog}>Cancel</button>
                <button
                  className="primary"
                  onClick={() => {
                    const d = dialog;
                    closeDialog();
                    void performInject(d.expression, d.code, d.property, true);
                  }}
                >
                  Replace expression
                </button>
              </div>
            </>
          )}
          {dialog.kind === 'delete' && (
            <>
              <p>
                Delete <strong>{dialog.expression.name}</strong> from Mine? This does not remove
                expressions already applied in After Effects. Export a pack if you want to keep a
                separate copy.
              </p>
              <div className="dialog-actions">
                <button onClick={closeDialog}>Cancel</button>
                <button
                  className="danger"
                  onClick={() => {
                    try {
                      saveUsers(users.filter((e) => e.id !== dialog.expression.id));
                      closeDialog();
                      notify('Expression deleted.');
                    } catch (e) {
                      notify(messageOf(e), true);
                    }
                  }}
                >
                  Delete expression
                </button>
              </div>
            </>
          )}
          {dialog.kind === 'import' && (
            <>
              <p>
                <strong>{dialog.pack.name}</strong> · {dialog.pack.expressions.length} expressions
              </p>
              <p className="notice warning">
                Packs contain executable After Effects expression code. Review the code and import
                only packs you trust. Importing saves entries; code runs only when you inject it.
              </p>
              <div className="pack-review">
                {dialog.pack.expressions.map((e) => (
                  <details key={e.id}>
                    <summary>
                      {e.name} <span className="muted">· {e.category}</span>
                    </summary>
                    <p>{e.description}</p>
                    <pre className="code-preview">{e.template}</pre>
                    <pre className="example">
                      {JSON.stringify(
                        { compatibility: e.compatibility, parameters: e.parameters },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                ))}
              </div>
              <label>
                When an ID or name already exists
                <select
                  value={policy}
                  onChange={(e) => setPolicy(e.target.value as ConflictPolicy)}
                >
                  <option value="keep">Keep both (create a separate copy)</option>
                  <option value="skip">Skip the imported expression</option>
                  <option value="replace">Replace the version in Mine</option>
                </select>
              </label>
              <div className="dialog-actions">
                <button onClick={closeDialog}>Cancel</button>
                <button
                  className="primary"
                  onClick={() => {
                    try {
                      const next = mergePack(users, dialog.pack, policy);
                      saveUsers(next);
                      closeDialog();
                      setTab('Mine');
                      setCategory('All categories');
                      setSearch('');
                      notify('Pack imported. ' + next.length + ' expressions in Mine.');
                    } catch (e) {
                      notify(messageOf(e), true);
                    }
                  }}
                >
                  Import pack
                </button>
              </div>
            </>
          )}
          {dialog.kind === 'export' && (
            <>
              <label>
                Pack name
                <input
                  value={packName}
                  maxLength={100}
                  onChange={(e) => setPackName(e.target.value)}
                />
              </label>
              <div className="button-row">
                <button onClick={() => setExportIds(users.map((e) => e.id))}>Select Mine</button>
                <button onClick={() => setExportIds(all.map((e) => e.id))}>Select all</button>
                <button onClick={() => setExportIds([])}>Clear</button>
              </div>
              <div className="export-list">
                {all.map((e) => (
                  <label className="checkbox-label" key={e.id}>
                    <input
                      type="checkbox"
                      checked={exportIds.includes(e.id)}
                      onChange={(event) =>
                        setExportIds(
                          event.target.checked
                            ? [...exportIds, e.id]
                            : exportIds.filter((id) => id !== e.id),
                        )
                      }
                    />
                    {e.name}
                    <span className="muted">{e.source}</span>
                  </label>
                ))}
              </div>
              <div className="dialog-actions">
                <button onClick={closeDialog}>Cancel</button>
                <button
                  className="primary"
                  disabled={!exportIds.length || !packName.trim()}
                  onClick={() => {
                    try {
                      if (
                        exportPack(
                          all.filter((e) => exportIds.includes(e.id)),
                          packName.trim(),
                        )
                      ) {
                        closeDialog();
                        notify('Exported ' + exportIds.length + ' expressions.');
                      }
                    } catch (e) {
                      notify(messageOf(e), true);
                    }
                  }}
                >
                  Export {exportIds.length} expressions
                </button>
              </div>
            </>
          )}
          {dialog.kind === 'settings' && (
            <>
              <p>
                Your expressions stay on this computer. No accounts, telemetry, or network services.
              </p>
              <label>
                Storage location
                <input readOnly value={storageLocation || 'Unavailable; reload to reconnect'} />
              </label>
              <p className="muted">
                Every successful update keeps the previous file as a backup. Restore replaces the
                current file with that previous version and preserves the current contents in a
                timestamped recovery file.
              </p>
              {libraryError && <p className="notice error">Library: {libraryError}</p>}
              {settingsError && <p className="notice error">Settings: {settingsError}</p>}
              <div className="button-row">
                <button onClick={reload}>Reload from disk</button>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        'Restore the previous library version? Current contents will be preserved in a recovery file.',
                      )
                    )
                      restore('library');
                  }}
                >
                  Restore library backup
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Restore previous favorites and filter settings?'))
                      restore('settings');
                  }}
                >
                  Restore settings backup
                </button>
              </div>
              <hr />
              <h3>Using the panel</h3>
              <p className="muted">
                Select a property, choose an expression, then Apply. Use New to write your own or
                Save from AE to keep the selected property's expression. Duplicate a core entry to
                customize it.
              </p>
              <p className="muted">
                Version 1.0.0 · CEP 12 · After Effects 25.x
                <br />
                Injection validates at the current composition time. Preview the full animation to
                check time-dependent code.
              </p>
              <div className="dialog-actions">
                <button onClick={closeDialog}>Done</button>
              </div>
            </>
          )}
        </Modal>
      )}
    </main>
  );
}
