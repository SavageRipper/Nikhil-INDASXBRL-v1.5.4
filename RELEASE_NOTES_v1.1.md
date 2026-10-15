# INDAS XBRL Tool v1.1 — release notes

Base: the live repository `SavageRipper/Nikhil-INDASXBRL-v1` as uploaded on 5 October 2026 (commit e9f0abe).
Details of every change: README, section "v1.1".

## In short

- **Dates are typed day first** (dd-mm-yyyy) with a 📅 calendar button, and every date entered is confirmed in words.
  The old date field followed the browser's language and could store 5 September as 9 May.
- **Text blocks print tidily in the MCA PDF**: new filings save bold / italic / underline as plain text and make whole
  bold lines headings; a status line shows what would print badly; **Tidy** and **H** buttons; Word pastes are tidied.
- **Dark mode**: mandatory and error cells, dropdowns and their open lists are readable (contrast ≥ 4.5).
- **Opening values without totals** (first-time adoption): the message gives the date and opens the cell (the opening
  balance sheet column); a new tool removes only values whose total has no cell — never the GR-16 column.
- **Removing a note column** recalculates the totals that came from it; a **health check** on opening / importing
  recalculates stale totals the tool calculated itself (entered and imported figures are never changed).
- **Typing the same value again** no longer marks the filing as changed.
- **Fixed** the failing Yes/No test: the v1 rule that keeps reference instance B's OCI zeros also kept other zeros under a "No" answer.
- **Assurance harness** added: it measures, on the MCA-validated instances, whether every error can be fixed on screen.

## Files

New: `dates.js`, `assurance.mjs`, `ASSURANCE_BASELINE.json`, `RELEASE_NOTES_v1.1.md`, and tests `dates.test.mjs`,
`text-tidy.test.mjs`, `opening-values.test.mjs`, `removeslice-recalc.test.mjs`, `assurance.test.mjs`.

Changed: `app.js`, `richtext.js`, `styles.css`, `session.js`, `gate.js` (error locations only), `rules.js` (the GR-1
message text only), `applicability.js` (the zero rule above), `importer.js` (keeps the highlight setting), `model.js`
(new default text setting), `shell.html` (title), `browser-smoke.mjs`, `package.json`, `README.md`, and the built
`index.html`, `indas-xbrl.html`, `artifact.html`, `BUILD_INFO.json`.

Unchanged: `MCA_AUTHORITY.json` (taxonomy and rules), the generator, the taxonomy and rule workbook.

## Your existing project files

Nothing to do: they open as before (same browser storage key). On opening, the health check recalculates any stale
total the tool calculated itself and says so. Projects keep their text-block setting (v1's default, MCA highlight
classes); switch it in any text block editor.

**Re-check dates entered in v1** if the browser was set to English (United States): such a browser read 05/09/2026 as
9 May 2026. Dates are now shown day first, so a swapped date is easy to see.

## Tests (run in the environment that produced this package)

| Suite | Result |
|---|---|
| Unit (`npm run test:unit`) | 173 / 176 — the 3 not passing **could not run here** (they need the `xlsx` package to read the rule workbook: `rules-source.test.mjs`, provenance, compiler determinism) |
| Gate (`io.test.mjs`) | 11 / 11 |
| Golden (`golden.test.mjs`, reference instance A (2022-23)) | 8 / 8 |
| Assurance (`assurance.test.mjs`, reference instance A + reference instance B) | 11 pass, 6 todo (v1.2 targets); 0 regressions |
| Browser (`browser-smoke.mjs`, reference instance A present) | 93 / 93 (76 before, 17 new) |
| Golden XML byte-identity | reference instance A and reference instance B regenerate byte-identical to v1 (also through the UI import with the health check) |

Node tests that read XML used a stand-in XML parser (the npm registry is blocked in that environment); the browser run
used Chromium's own parser. The build used esbuild 0.28.2 (lockfile: 0.24.2).

## Not run here

- `npm ci` with the pinned packages; a build with esbuild 0.24.2.
- `npm run compile`, and the 3 unit tests above (need `xlsx`).
- `xsd.test.mjs` and the Arelle stage of `release-gate.mjs` (Arelle not installable here); the full `npm run release`.
- Node tests with the real `@xmldom/xmldom` parser.
- Mutation sweeps on your real project files (none supplied).
- The deployed GitHub Pages site; the MCA validator.

## Manual check on the live page (about 10 minutes)

1. Open the page, start a **New filing**, open the company page: the period dates are dd-mm-yyyy fields with 📅.
2. Type `1-4-2025` as the start date and press Tab: it shows `01-04-2025` and the message says "1 April 2025".
3. Type `31-02-2026` in a date: it is refused with a day-first hint.
4. Click 📅 next to a date and pick a day: it appears day first.
5. Open any text block: the setting reads "Plain text; whole bold lines become headings", B/I/U are hidden, H and Tidy shown.
6. Paste a few paragraphs from Word with a bold title and blank lines: the title becomes a heading, blank lines go, and a message says what was tidied.
7. Switch your system / browser to dark mode: open a tab with an empty mandatory Yes/No cell, open its list — readable.
8. Company page: First-time adoption = Yes. Balance sheet: enter an opening value in the third column; tick "Allow editing of calculated cells", clear the opening total; Validate. The GR-1 message gives the date; clicking it opens the opening-column cell. Re-enter the value.
9. Enter inventories in the inventories note (total column) and another current asset on the balance sheet; remove the note's total column: balance-sheet *Current assets* drops at once (v1 kept the old sum).
10. Type the same number again into a cell after saving: the bar still says "Saved".
11. Open a project saved in v1: it opens normally.
