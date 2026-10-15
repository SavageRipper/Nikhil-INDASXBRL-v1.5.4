# INDAS XBRL Tool v1.2 — release notes

Base: v1.1 (`indas-xbrl-flat_v1.1.zip`, built on the live repository `SavageRipper/Nikhil-INDASXBRL-v1`, commit e9f0abe).
Details of every change: README, section "v1.2".

## In short

- **Your two decisions**: SR-L1097-1 / SR-L1304-1 are warnings while PPE / intangibles are nil or absent (blocking once
  reported with an amount); both schemaRef addresses are accepted, an imported filing keeps its own, new filings use V3.
  reference instance B (2024-25) now passes the internal gate.
- **No dead ends** (the v12 rules): an empty cell is never locked; a total you typed is kept when it differs from its
  parts and follows them when it agreed; no totals made of zeros; every error points to a cell, a table or the Yes/No
  answer that closes it.
- **Statement figures from their notes**: 38 balance-sheet / P&L figures follow their notes, with **Go to note** and
  **Nil**; checked on both MCA instances (0 differences).
- **Validation in a separate window** (for a second screen); click a message to open its cell.
- **Resizable tables**: drag the bottom-right corner; the size is remembered per tab; **Reset table size**.
- **Copy from previous year on the disclosure tabs** [700300]–[700700] after importing last year's XML with
  "Roll forward to the next year" — empty cells only, Yes/No answers first; amounts and last year's dates are not copied.
- **Compiler fix**: 53 closing-balance rows of reconciliations were missing from the screen (XBRL 2.1 arc equivalence).
- **Assurance harness: 0 on every count** on both MCA instances (was 6–177 per count in v1.1).

## Files

New: `derived.js`, `RELEASE_NOTES_v1.2.md`, and tests `decisions-v12.test.mjs`, `statement-notes.test.mjs`,
`v12-rules.test.mjs`, `disclosure-carry.test.mjs`.

Changed: `compile.mjs`, `dts.mjs`, `rules.js` (calibration only), `session.js`, `applicability.js`, `gate.js`,
`views.js`, `expr.js`, `carry-forward.js`, `app.js`, `styles.css`, `shell.html`, `GOLDEN_CALIBRATION.json`,
`APPROVED_LIMITATIONS.json`, `ASSURANCE_BASELINE.json`, `assurance.mjs`, `assurance.test.mjs`, `browser-smoke.mjs`,
`golden.test.mjs`, `io.test.mjs`, `taxonomy.test.mjs`, `workbench.test.mjs`, `removeslice-recalc.test.mjs`,
`package.json`, `README.md`, the recompiled `MCA_AUTHORITY.json` and `BUSINESS_RULE_COVERAGE.json`, and the built
`index.html`, `indas-xbrl.html`, `artifact.html`, `BUILD_INFO.json`.

Unchanged: `generator.js`, `importer.js`, the rule workbook and taxonomy files, every other engine.

## Your existing project files

Nothing to do: they open as before (same browser storage key, same project format). What you may notice:

- Cells that were read-only and **empty** are now editable; a balance-sheet figure that has a note (borrowings, PPE,
  investments, trade receivables, loans, provisions, share capital, inventories …) is now read-only and follows its
  note **when the note has values**. A figure you entered that differs from its note is kept and stays editable;
  validation reports the difference.
- A project you **started fresh** in v1 / v1.1 will be written with the **V3 schemaRef**; a project that came from an
  imported XML keeps that XML's address.
- reference instance B-type filings (PPE / intangibles nil): the revaluation flags are now warnings, not errors.

## Tests (run in the environment that produced this package)

| Suite | Result |
|---|---|
| Unit (`npm run test:unit`) | 211 / 211 (incl. the compiler tests, run with a stand-in for the `xlsx` reader — see below) |
| Gate (`io.test.mjs`) | 11 / 11 |
| Golden (`golden.test.mjs`, reference instance A (2022-23) + reference instance B 2024-25) | 16 / 16 |
| Assurance (`assurance.test.mjs`, reference instance A + reference instance B) | 17 / 17 — every target now strict and met (0) |
| Larger mistake sweep (600 mistakes, new seed, both instances) | 0 unreachable, 0 inexact undos, 0 refused |
| Browser (`browser-smoke.mjs`, reference instance A + reference instance B present) | 116 / 116 (15 new) |
| Golden XML byte-identity | reference instance A byte-identical to v1.1; reference instance B identical except that it keeps its own (V3) schemaRef; same through the UI import |
| Clean unzip of the package (no golden files) | recompiles the authority identically, builds the same `index.html`; unit 195 / 195 (2 golden-only skipped), gate 10 / 10, browser 98 / 98 |

The npm registry is blocked in that environment: Node tests that read XML used a stand-in XML parser, and the authority
was recompiled with a stand-in reader for the rule workbook; the stand-in recompiles the v1.1 authority byte for byte
(only a stale provenance hash differed, already stale in v1). The browser run used Chromium's own parser. The build
used esbuild 0.28.2 (lockfile: 0.24.2).

## Not run here

- `npm ci` with the pinned packages; a build with esbuild 0.24.2; `npm run compile` with the real `xlsx` package.
- Node tests with the real `@xmldom/xmldom` parser.
- `xsd.test.mjs` and the Arelle stage of `release-gate.mjs` (Arelle not installable here); the full `npm run release`.
- Mutation sweeps on your real project files (none supplied).
- The deployed GitHub Pages site; the MCA validator (V5.1) on XML produced by v1.2.
- The pop-up window and the resize handle on a phone or tablet (desktop browser only; resizing is a desktop feature).

## Manual check on the live page (about 15 minutes)

1. Open the page: the title reads **INDAS XBRL Tool v1.2**; the company page shows the V3 schemaRef for the example.
2. Balance sheet: *Borrowings (non-current)* is read-only with **Go to note ›** under it. Click it: the borrowings note opens.
3. In the borrowings note, enter an amount in a class column: back on the balance sheet the figure shows that amount.
4. Start a **New filing**: on the balance sheet a figure whose note is empty shows **Nil**; click it — 0 is entered.
5. In that new filing, type *Current assets* = 500 first, then *Current tax assets* = 120: the total stays 500 and
   editable; validation reports the difference (GR-1). Type 120 as the total: from now on it follows its parts.
6. Validate, then **Open in separate window ↗** (allow pop-ups if the browser asks): the messages appear in a new window.
7. Click a message in that window: the main window opens the cell. Change any cell: the window says it is out of date;
   **Validate again** refreshes it.
8. On any tab, scroll to the bottom-right corner of the table and drag it: the table grows or shrinks; open another
   tab and come back — the size is kept; **Reset table size** restores it.
9. Import last year's MCA-validated XML with **Roll forward to the next year**; open [700300] General information:
   **Copy from previous year (n)** — click it and confirm: company name, CIN and the Yes/No answers are filled; dates of
   last year (board meeting, reporting period) are not.
10. Open [700500] Signatories, a table: its own **Copy from previous year** fills the signatories' names; validation
    asks for this year's signing dates.
11. Import the reference instance B (2024-25) XML (both years) and validate: no blocking errors; SR-L1097-1 / SR-L1304-1 are
    warnings. Generate XML: the schemaRef is the V3 address.
12. Open a project saved in v1.1: it opens normally.
