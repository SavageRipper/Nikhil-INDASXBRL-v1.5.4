# INDAS XBRL Tool v1.4 — release notes

Base: v1.3 (`indas-xbrl-flat_v1.3.zip`). Details: README, section "v1.4". This completes the plan of the master prompt
(sections A–F): every C&I v14.2 feature is now in the Ind AS tool or has an Ind AS equivalent.

## In short

- **Preview PDF** (Generate XML): a printable preview of what the XML contains, laid out like the MCA PDF — measured on
  the MCA PDF of reference instance B (2024-25) (section order, fonts and sizes, columns, footnotes). Checked against that PDF:
  the same 49 sections in the same order and every balance-sheet value. Labelled "not the MCA rendering".
- **Footnotes from the cell**: click a cell, press **Alt+N** (or *Footnote…* in the tab tools); cells with footnotes show
  an **fn** mark.
- **Fill empty totals** (per table, or for all current-year tables) and **Recalculate current year** (Validation → Fix
  tools): both show the changes first; Fill never overwrites; Recalculate names any figure you entered that it would
  replace, and *Undo last fix* reverses it.
- **Statement figures that differ from their notes** are listed on the Validation page.

## Files

New: `pdf-preview.js`, `totals-fill.js`, `pdf-preview.test.mjs`, `v14.test.mjs`, `RELEASE_NOTES_v1.4.md`.

Changed: `app.js`, `styles.css`, `shell.html`, `browser-smoke.mjs`, `package.json`, `README.md`, and the built
`index.html`, `indas-xbrl.html`, `artifact.html`, `BUILD_INFO.json`.

Unchanged: every engine (taxonomy, rules, applicability, session, gate, importer, generator) and `MCA_AUTHORITY.json`.

## Your existing project files

Nothing to do: they open as before. Footnotes already in a project show their fn mark.

## Tests (run in the environment that produced this package)

| Suite | Result |
|---|---|
| Unit (`npm run test:unit`) | 232 / 232 (9 new) |
| Gate (`io.test.mjs`) | 11 / 11 |
| Golden (`golden.test.mjs`, reference instance A (2022-23) + reference instance B 2024-25) | 17 / 17 |
| Assurance (`assurance.test.mjs`) | 19 / 19, all targets 0 |
| Mutation sweeps (new seeds) | 500 mistakes per instance and 300 per prepared next-year filing: 0 unreachable, 0 inexact undos |
| Browser (`browser-smoke.mjs`, both instances present) | 143 / 143 (8 new) |
| Golden XML byte-identity | both instances byte-identical to v1.3 (and v1.2), directly and through the import + health check path |
| Clean unzip of the package (no golden files) | recompiles the authority identically, builds the same `index.html`; unit 213 / 213 (5 golden-only skipped), gate 10 / 10, browser 123 / 123 |

As before: Node tests that read XML used a stand-in XML parser; the browser run used Chromium's parser; esbuild 0.28.2.

## Not run here

- `npm ci` with the pinned packages; a build with esbuild 0.24.2; `npm run compile` with the real `xlsx` package.
- Node tests with the real `@xmldom/xmldom` parser; `xsd.test.mjs`, Arelle and the full `npm run release`.
- Mutation sweeps on your real project files (none supplied).
- The deployed GitHub Pages site; the MCA validator on XML produced by v1.4.
- Printing the preview to PDF (the browser's print dialog) — the preview page itself was checked, not the printed file.
- The preview against an MCA PDF of a consolidated filing or a first-time adoption filing (only reference instance B's PDF was available).

## Manual check on the live page (about 10 minutes)

1. The title reads **INDAS XBRL Tool v1.4**.
2. Import the reference instance B XML (Both years). Generate XML → **Preview PDF (not the MCA rendering)**: a new tab opens;
   the first section is [700300] General information, then the disclosures, then the balance sheet with three columns
   (31/03/2025, 31/03/2024, 31/03/2023) — compare a few figures with the MCA PDF.
3. In the preview, find a footnote mark "(A) …" in a cell and its Footnotes list after the block; click **Print / Save as PDF**.
4. Balance sheet: click a cell that has a value, press **Alt+N**, type a footnote, Save: the cell shows **fn**.
5. Click *Footnote…* in the tab tools: remove it from the cell — the mark goes.
6. Validation: **Fix tools** shows Recalculate current year and Fill empty totals; Recalculate says all cells agree.
7. Open the share-capital or PPE table (current year), clear a total-column figure, then **Fill empty totals (1)**:
   the dialog lists the value; Fill restores it.
8. Keyboard shortcuts page lists Alt+N.
