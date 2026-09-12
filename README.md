# ExpressIt

A local expression library for **Adobe After Effects**, built with React, TypeScript, CEP, and ExtendScript.

Find an expression, adjust its controls, and inject it into one selected property. Capture your own expressions, organize them in Mine, and share collections as `.evpack` files. Everything runs on your computer.

## What ships in v1

- 23 core expressions across Motion, Loop, Text, Opacity, and Timing.
- Search across names, descriptions, categories, and tags.
- All, Core, Mine, and Favorites views, plus category and compatibility filters.
- Number, text, boolean, and select parameter controls with live code preview.
- Single-property injection with compatibility checks, replacement review, an undo group, and rollback on expression errors.
- Capture, create, edit, duplicate, and delete custom expressions.
- Validated pack imports with code review and skip / replace / keep-both conflict handling.
- Selectable pack exports, file-backed storage, previous-version backups, and recovery controls.
- A responsive dark panel, keyboard-accessible dialogs, and a separate browser preview.

No account, backend, telemetry, cloud sync, licensing service, or internet connection is needed for expression workflows. Footer profile links open your browser only when clicked. Recipes, multi-property injection, and animation-preset export are outside v1.

## Requirements and validation status

| Requirement       | Version / scope                                                       |
| ----------------- | --------------------------------------------------------------------- |
| After Effects     | 25.x; manifest deliberately excludes unverified future major versions |
| Extension runtime | CEP 12                                                                |
| Operating systems | Windows and macOS CEP installation paths are supported by the code    |
| Build tools       | Node.js 22.18+ or 24 LTS, npm                                         |
| Browser tests     | Google Chrome locally; Playwright Chromium in CI                      |

The build targets Chromium 99, matching CEP 12. Adobe lists After Effects 25.0 as a CEP 12 host in its [CEP cookbook](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/Documentation/CEP%2012%20HTML%20Extension%20Cookbook.md).

**Verified in this workspace:** TypeScript production build, ESLint, 30 automated logic/host-simulation/migration tests, and 8 browser workflow tests on Windows. The simulation suite runs the actual host file against a controlled AE-like DOM; it does not run Adobe's expression engine.

**Still required before a public release:** the real After Effects smoke test and manual undo/redo, docking, native file-dialog, and macOS checks below. An attempted external AE launch did not return a test report, so no native-host pass is claimed. The included ZIP is unsigned; it is not an Adobe-signed installer.

## Install from the release ZIP

1. Extract `expressit-1.0.0.zip`.
2. Copy its `ExpressIt` folder into your user CEP extensions folder:
   - Windows: `%APPDATA%\Adobe\CEP\extensions\ExpressIt`
   - macOS: `~/Library/Application Support/Adobe/CEP/extensions/ExpressIt`
3. Confirm the installed folder contains `CSXS/manifest.xml`, `host/expressit.jsx`, and `dist/index.html`. Do not install only `dist`.
4. For this unsigned local build, enable CEP's unsigned-extension setting:

   Windows PowerShell:

   ```powershell
   reg add HKCU\Software\Adobe\CSXS.12 /v PlayerDebugMode /t REG_SZ /d 1 /f
   ```

   macOS Terminal:

   ```sh
   defaults write com.adobe.CSXS.12 PlayerDebugMode 1
   ```

   This changes the user's CEP 12 debug setting, allowing unsigned extensions. To reverse it, set the same value to `0`. Adobe documents these settings under [Debugging Unsigned Extensions](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/Documentation/CEP%2012%20HTML%20Extension%20Cookbook.md#debugging-unsigned-extensions).

5. Restart After Effects and open **Window → Extensions → ExpressIt**.
6. Dock the panel by dragging its tab into your workspace.

The bundle retains the existing `com.khua.expressit` identity. Do not keep another ExpressIt installation with that identity in a second CEP folder; Adobe may load that copy instead.

## Build and install from source

From the repository root:

```sh
npm ci
npm run check
npm run test:ui
npm run package
```

`npm run package` runs the static/unit checks and build, then creates:

```text
release/
  expressit-1.0.0.zip
  expressit-1.0.0.zip.sha256
```

The ZIP contains the runtime files, these three documents, third-party notices, bundled licenses, and per-file SHA-256 hashes. It excludes source dependencies, test output, development caches, and signing material. Re-run the browser tests explicitly before packaging; CI runs them before producing its artifact.

When working directly inside a CEP extension directory, `npm run build` updates the installed panel. Close and reopen the panel after changes; restart AE after manifest changes. If AE keeps old assets cached, restart it before changing files again.

### Development commands

| Command                   | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `npm run dev`             | Browser development server with React refresh      |
| `npm run build`           | Type-check and build local CEP assets              |
| `npm run build:watch`     | Rebuild assets when source changes                 |
| `npm run lint`            | ESLint checks                                      |
| `npm test`                | Logic, storage, schema, and host-simulation tests  |
| `npm run check`           | Lint, tests, and production build                  |
| `npm run test:ui`         | Serve `dist` temporarily and run browser workflows |
| `npm run test:ae:prepare` | Generate the real AE smoke-test script             |
| `npm run package`         | Validate, build, and create the unsigned ZIP       |

Browser preview has working library features, but injection and capture remain disabled. Preview data lives in browser storage under `expressit.preview.*`, separate from the AE files. Export a preview pack and import it in AE if you want to move examples over.

If Chrome is unavailable, install it or use the bundled Playwright browser:

```sh
npx playwright install chromium
```

Set the `CI` environment variable to `1` when running `npm run test:ui` to select that browser. The test server binds only to `127.0.0.1:4173`.

## Usage

### Inject your first expression

1. Open a composition and create a shape layer.
2. Expand **Transform → Position** and select **Position** itself.
3. In ExpressIt, search for **Wiggle**.
4. Set **Frequency / sec** to `3` and **Amount** to `25`.
5. Open **Code** to inspect `wiggle(3, 25);`.
6. Click **Apply**.
7. Scrub the timeline. Use **Edit → Undo** / Ctrl+Z / Cmd+Z to undo.

An incompatible property disables injection and shows the reason. Loop expressions and Inertial Overshoot require at least two keyframes. Bounce can be applied to any expression-capable property and takes effect once it has usable keyframe velocity. Source Text, property groups, separated position dimensions, and other value types are checked explicitly rather than guessed from display names.

If the property already has code, a dialog shows both the old code and the proposed replacement. Changing the AE selection or its expression while the dialog is open invalidates the request. Review the new selection and try again.

AE checks the expression at the current composition time. This cannot prove that arbitrary code works at every frame or has acceptable performance; preview the animation across its duration.

### Build your personal library

- **Save from AE:** select a property containing an expression, then capture it. Review the name, description, category, tags, compatibility, and code before saving.
- **+ New:** create a custom entry from scratch.
- **Duplicate:** copy any entry, including Core, into an editable draft.
- **Edit / Delete:** available on Mine entries only. Deleting a library item does not change expressions already applied to a composition.
- **Star:** add an entry to Favorites. Favorites are stored separately from expression data.

Textareas provide plain-text editing. Under **More options**, **Validate & preview** checks the data and substitutes parameter defaults; actual AE expression syntax and semantics are evaluated on injection.

The editor starts with just Name, Expression code, and Works on. Open **More options** for category, description, and tags. Advanced authors can edit compatibility and parameter JSON under **More options → Advanced: parameters & compatibility**. For example:

```json
[
  {
    "key": "amount",
    "label": "Amount",
    "type": "number",
    "default": 50,
    "min": 0,
    "max": 1000,
    "step": 1
  }
]
```

Reference this control as `{{amount}}` in the template. Text/select controls already compile into quoted literals: use `{{prefix}}`, not `"{{prefix}}"`. Number `step` controls the input increment; it does not require a value to be an exact multiple.

### Share a pack

Choose **Export**, name the pack, and select entries. **Select Mine**, **Select all**, and **Clear** simplify selection. Favorites and filter settings are not exported.

Choose **Import**, select an `.evpack` or JSON pack, and inspect each expression before accepting. Packs contain executable expression code; schema validation is not a code sandbox. Imports cannot introduce host-side recipes or arbitrary JSX actions.

For conflicts by ID or case-insensitive name:

| Policy    | Result                                                                     |
| --------- | -------------------------------------------------------------------------- |
| Keep both | Keep the existing item and add a uniquely named copy                       |
| Skip      | Leave the existing item alone                                              |
| Replace   | Update Mine while retaining the existing user ID and advancing its version |

Imported Core entries become user-owned copies. File size is limited to 2 MiB, libraries to 1,000 expressions, templates to 65,536 characters, and an entry to 32 parameters.

## Compact docked workflow

The panel uses compact expression buttons and a single **Apply** action. **+ New** and **Save from AE** are at the top; code is collapsed until needed. Import/export and the creator links stay in the bottom bar while the panel body scrolls in short docks.

Creator: [TikTok @madebykhua](https://www.tiktok.com/@madebykhua), [Instagram @madebykhua](https://www.instagram.com/madebykhua/), [YouTube @madebykhua](https://www.youtube.com/@madebykhua). In CEP these open the system browser; browser preview uses a separate tab.

## Storage and recovery

On first opening after the rename, ExpressIt copies the previous product's library, settings, and backups into its new storage namespace. Existing ExpressIt files take priority; original files remain untouched. Interrupted migrations resume from a verified snapshot. Old .evpack files still import, and new exports use expressit-pack as their format identifier. The .evpack extension is retained for compatibility.

The AE library is stored below `CSInterface.getSystemPath(SystemPath.USER_DATA)` in `ExpressIt`. Use **Settings & backups** to see the resolved location.

```text
ExpressIt/
  library.json
  library.json.backup
  library.json.pending
  settings.json
  settings.json.backup
  settings.json.pending
  *.recovery-<timestamp>
```

A save validates the data, verifies a staged file, verifies a backup of the current file, writes the primary file, and reads it back. This is a recoverable write protocol, not a promise of atomic replacement or protection against disk failure.

Unreadable or malformed files are preserved and block writes. A missing primary with recovery data is also treated as an error. Use **Reload from disk** after an external change, or **Restore library backup / Restore settings backup** to restore the previous version. Restoration preserves current bytes in a timestamped recovery file.

If no backup exists but a `.pending` file does, copy the storage folder to a safe place, close the panel, validate the pending JSON, and copy the verified file to the matching primary path. Then reopen the panel. Export packs regularly to another location; local backups on the same disk are not disaster recovery.

Multiple panel instances are not a supported editing workflow. A stale-file comparison catches ordinary conflicting saves, but CEP's synchronous file APIs provide no cross-process compare-and-swap lock.

## Release validation

Run `npm run test:ae:prepare`, then in a scratch AE project use **File → Scripts → Run Script File…** and select `artifacts/ae-smoke.jsx`. For this test report, enable **Allow Scripts to Write Files and Access Network** in AE's Scripting & Expressions preferences. The panel's normal storage uses CEP APIs instead.

The script creates temporary items, tests the core library on compatible properties at multiple times, checks capture/replacement/rollback, removes its own items, and writes `artifacts/ae-smoke.json`. It does not save the project. It can affect project dirty/undo state, so use a scratch project.

Then manually verify:

- Docking and reopening; library/favorites surviving an AE restart.
- Wiggle on Position, Scale, Rotation, and separated X/Y; Counter on Source Text; Auto Fade on Opacity.
- No selection, groups, multiple selection, closed/switching compositions, renamed/deleted layers, and 3D properties.
- Replace/cancel, enabled and disabled originals, invalid expressions, undo and redo.
- Native import/export cancel, overwrite review, Unicode paths, read-only storage, and backup restoration.
- Each supported OS and AE version before claiming support.

For broad distribution, sign a verified package using your own certificate and Adobe's [packaging and signing workflow](https://github.com/Adobe-CEP/Getting-Started-guides/tree/master/Package%20Distribute%20Install). Signing keys and certificates are not included.

## Troubleshooting

| Symptom                       | Check                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| Panel missing                 | AE 25.x, CEP 12, folder nesting, unsigned debug setting, duplicate bundle IDs; restart AE                |
| Empty or outdated panel       | Build from the root; verify `dist/index.html`; reopen the panel                                          |
| “Host script failed”          | Verify manifest `ScriptPath` and `host/expressit.jsx`; restart AE                                        |
| “Select exactly one property” | Select a leaf property rather than a group or multiple rows                                              |
| No results                    | Clear search/category, change the library tab, or disable Compatible                                     |
| Host timeout                  | Close AE dialogs; do not assume a timed-out mutation was cancelled; inspect the property before retrying |
| Storage error                 | Check disk space and folder permissions; restore/reload through Settings                                 |
| Import rejected               | Check format/schema, unique IDs, supported fields, parameter definitions, and file limits                |

## Project map and learning material

```text
CSXS/manifest.xml              CEP registration and host/runtime compatibility
host/expressit.jsx      ES3 selection, capture, guarded injection
public/data/expressions-core.json
public/lib/CSInterface.js      Adobe's bridge
src/components/               Editor, detail view, accessible modal
src/lib/                      Compiler, schema, compatibility, bridge, storage
src/types/                    Shared data and CEP types
tests/                        Logic and host simulations; browser workflows
scripts/                      Packaging, UI test runner, native test generator
.github/workflows/ci.yml       Build, test, and package artifact
```

The local BUILD_TUTORIAL.md and INTERVIEW_PREP.md contain the architecture walkthrough and project-specific questions and answers. They are intentionally gitignored; the packager includes them only when present.

Third-party licenses are listed in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt). The owner has not selected an open-source license for project-specific code; publishing to GitHub alone does not grant one.
