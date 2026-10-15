# INDAS XBRL Tool v1.3 — release notes

Base: v1.2 (`indas-xbrl-flat_v1.2.zip`). Details of every change: README, section "v1.3".

## In short

- **Prepare next year's filing** (Import XML, or a button on the company page): last year's figures become the
  previous-year column, **locked as filed** (Unlock / Lock in the tab tools). Your decisions are built in: the previous
  year's opening balances come from last year's filing (locked too), and first-time adoption is answered **No** for the
  new year, with last year's opening balance sheet set aside. Everything else from earlier years is **set aside** —
  kept in the project, never filed, restorable.
- **Health check** on opening, importing and saving: out-of-date figures the tool calculated are recalculated; values
  no tab can show go to Hidden data. Your entered and imported figures are never changed; nothing is deleted; the opening
  balance sheet column (GR-16) is never touched.
- **Hidden data** page (with a count in the menu): set-aside values (restore / delete), values made not applicable,
  values no tab shows.
- **Fix buttons** on validation messages (also in the separate window): enter a missing total, set a total to the sum of
  its parts, take a figure from its note, report nil, set aside an opening value without a cell. Each fix shows what
  else it would raise before you confirm, and **Undo last fix** puts the filing back.
- **Previous year vs last year's filing** on the Validation page, with **Use the filed figure**; for an older project,
  attach last year's filed XML.
- **Live check**: about a second after an edit, the open tab is checked and the bar shows "This tab · N errors (live)".
- **Keyboard**: Ctrl+Q tab switcher, Alt+V, Ctrl+Shift+S, Ctrl+O, Ctrl+G, Ctrl+I, Alt+Shift+N, Ctrl+H; ↓ / ↑ stop on
  Go to note / Nil; Tab stays in the tab; a Keyboard shortcuts page.
- **Found and fixed by the new sweep on prepared filings**: in a fresh next year, a few messages pointed into the
  equity-changes and related-party tables before they could open; they now point to the cell that opens them.

## Files

New: `upkeep.js`, `fixes.js`, `v13.test.mjs`, `RELEASE_NOTES_v1.3.md`.

Changed: `importer.js` (new 'next' mode only), `model.js` (set-aside store and filed reference in the project file),
`session.js` (previous-year lock and three helpers), `gate.js` (error locations only), `carry-forward.js`, `app.js`,
`styles.css`, `shell.html`, `assurance.mjs`, `assurance.test.mjs`, `browser-smoke.mjs`, `package.json`, `README.md`, and
the built `index.html`, `indas-xbrl.html`, `artifact.html`, `BUILD_INFO.json`.

Unchanged: the taxonomy and rule authority (`MCA_AUTHORITY.json`), the rule engine, applicability, the generator.

## Your existing project files

Nothing to do: projects saved with v1.0–v1.2 open as before (no set-aside store, no lock). On opening, the health check
may recalculate an out-of-date calculated figure or move a value no tab can show to Hidden data, and says so; your own
figures are never changed. Projects made with "Current year only" or "Roll forward" still open; the import dialog now
offers "Both years" and "Prepare next year's filing".

For next year: import last year's **filed** XML with "Prepare next year's filing" (or, in last year's project, use the
button on the company page — save the project first, it is replaced).

## Tests (run in the environment that produced this package)

| Suite | Result |
|---|---|
| Unit (`npm run test:unit`) | 223 / 223 (12 new in `v13.test.mjs`) |
| Gate (`io.test.mjs`) | 11 / 11 |
| Golden (`golden.test.mjs`, reference instance A (2022-23) + reference instance B 2024-25) | 16 / 16 |
| Assurance (`assurance.test.mjs`, both instances) | 19 / 19 — all targets 0, incl. 60 mistakes on each prepared next-year filing |
| Mutation sweeps | 600 mistakes per instance (new seed) and 400 per prepared next-year filing: 0 unreachable, 0 inexact undos, 0 refused |
| Browser (`browser-smoke.mjs`, both instances present) | 135 / 135 (19 new) |
| Golden XML byte-identity | both instances byte-identical to v1.2, directly and through the import + health check path |
| Clean unzip of the package (no golden files) | recompiles the authority identically, builds the same `index.html`; unit 207 / 207 (2 golden-only skipped), gate 10 / 10, browser 117 / 117 |

As before: Node tests that read XML used a stand-in XML parser (npm registry blocked here); the browser run used
Chromium's own parser; the build used esbuild 0.28.2 (lockfile: 0.24.2).

## Not run here

- `npm ci` with the pinned packages; a build with esbuild 0.24.2; `npm run compile` with the real `xlsx` package.
- Node tests with the real `@xmldom/xmldom` parser.
- `xsd.test.mjs` and the Arelle stage of `release-gate.mjs`; the full `npm run release`.
- Mutation sweeps on your real project files (none supplied).
- The deployed GitHub Pages site; the MCA validator on XML produced by v1.3.
- The keyboard shortcuts on a Mac, and in Firefox (where Ctrl+Q may close the browser on Windows / Linux).

## Manual check on the live page (about 15 minutes)

1. Open the page: the title reads **INDAS XBRL Tool v1.3**; the menu shows **Hidden data** and **Keyboard shortcuts**.
2. **Import XML** → last year's filed XML: the dialog offers **Both years** and **Prepare next year's filing** only.
   Choose Prepare next year's filing: the bar shows the next year.
3. Balance sheet: the previous-year column is read-only, with **Previous year locked** and **Unlock previous year** in
   the tab tools. Unlock: the cells become editable; **Lock previous year** locks them again.
4. Menu → **Hidden data**: last year's previous year and disclosures are listed by reason, with Restore / Delete.
5. [700300] General information → **Copy from previous year (n)**: names and Yes/No answers are filled.
6. Validation → "Previous year vs last year's filing" says all previous-year figures equal the filed ones. Unlock the
   previous year, change one previous-year figure, validate: it is listed as DIFFERS; **Use the filed figure** restores it.
7. In any filing, empty a mandatory amount and wait a second: the bar shows **This tab · 1 error(s) (live)**.
8. Validate: the message has **Fix: Report nil (0)**. Click it — the dialog says what else it would raise — Apply.
   **Undo last fix** brings the message back.
9. Press **Ctrl+Q** and keep Ctrl held: the tab list opens on the current tab; press Q or ↓, release Ctrl: that tab opens.
10. On the balance sheet, put the cursor on a cell above a figure with **Go to note**; press ↓: the cursor stops on the button.
11. Press **Alt+V**: validation runs and the messages open in a separate window. **Ctrl+H** opens MCA error help.
12. Company page: change the year dates by one year and Apply: a dialog offers to set aside the values outside the new
    years (choose Keep them, and put the dates back).
13. Open a project saved with v1.2: it opens normally.
