# INDAS XBRL Tool v1.5.1 — release notes

Base: v1.5. One fix, reported on the live v1.5 page. Details: README, section "v1.5.1".

## The problem

After **Prepare next year's filing** from a large instance, the bar showed **Not saved in browser** and Ctrl+S said
"This browser does not allow saving here — use “Save project” to download a project file."

## Cause (reproduced)

The tool autosaved the project in the browser's localStorage, which holds about 5 million characters per site. A filing
prepared for the next year also keeps last year's filing (for "Previous year vs last year's filing") and the set-aside
values; for the v1.5 reference instances that is about 5.8–5.9 million characters, so every autosave failed. Reproduced in
Chromium with the v1.5 build: the same instance imported with both years saved (about 4.8 million characters); prepared
for the next year it did not.

## Fix

- The autosave now uses the browser's **IndexedDB** (much larger); localStorage remains the fallback.
- A project autosaved by v1.5 or earlier is still restored, then moved to IndexedDB.
- If storage is really full, the message says so ("too large for this browser's storage").
- A change made just before the tab is hidden or closed is saved at once.

Only `app.js` changed (plus the built `index.html`, `indas-xbrl.html`, `artifact.html`, `BUILD_INFO.json`, the version
in `shell.html` / `package.json`, `README.md`, and two new checks in `browser-smoke.mjs`). Engines, rules, the compiled
authority and the XML are unchanged.

## Your existing project files

Nothing to do. The project saved in your browser by v1.5 opens automatically. **Save project** (the downloaded project
file) works as before — keep using it: a browser can still clear its stored data.

## Tests

| Suite | Result |
|---|---|
| Reproduction (Chromium, v1.5 build) | next-year filing of a large instance: *Not saved in browser*; with v1.5.1: *Saved* |
| Browser (`browser-smoke.mjs`, all reference instances present) | 173 / 173 (3 new: a 6.1-million-character next-year project saved and restored after a reload; a v1.5 autosave restored and moved over) |
| Unit (`npm run test:unit`) | 258 / 258 |
| Gate (`io.test.mjs`) | 11 / 11 |
| Clean unzip of the package (no golden files) | recompiles the authority identically, builds the same `index.html`; unit 222 / 222 (8 golden-only skipped), gate 10 / 10, browser 124 / 124 |

## Not run here

- The deployed GitHub Pages site; Firefox, Edge and Safari (the browser checks ran in Chromium).
- As before: `npm ci` with the pinned packages, the real XML parser, `xsd.test.mjs` / Arelle, the MCA validator.

## Manual check (5 minutes)

1. The title reads **INDAS XBRL Tool v1.5.1**.
2. Open the page: your project from v1.5 is restored ("Restored your last project from this browser").
3. **Import XML** → your large XML → **Prepare next year's filing**: within a few seconds the bar shows **Saved hh:mm**.
4. Press **Ctrl+S**: "Saved in this browser at …".
5. Reload the page (F5): the next-year filing comes back.
