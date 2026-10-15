# INDAS XBRL Tool v1.5 — release notes

Base: v1.4 (`indas-xbrl-flat_v1.4.zip`). An audit release: v1.4 tested on a further pair of MCA-validated reference
instances (standalone and consolidated) and their MCA PDFs. Every finding, with its evidence: `AUDIT_REPORT_v1.5.md`.
Details: README, section "v1.5".

## In short

- **No more false errors on these instances.** v1.4 blocked the standalone instance with 18 errors and the consolidated
  one with 22 that the MCA validator had not raised. Now: standalone 0; consolidated 1 — an error in that instance's own
  data (shareholders above 5% add up to more than 100%), which stays an error.
- **Figures typed in agree with the reported ones.** New on the company page: **Statement figures rounded to** (set from
  the imported XML — e.g. 2 places while share capital needs 4). Typed amounts and calculated totals now get the accuracy
  of the statements, so totals equal the reported totals (Equity and liabilities = Assets).
- **Recalculate** keeps a reported total that agrees with its parts at its own rounding.
- **Company page**: a filing with 4 decimal places is no longer reset to 0 by *Apply*.
- **Preview PDF**: the section order now also matches the new MCA PDFs (standalone and consolidated).
- Two business rules calibrated with the evidence, on the principle you approved in v1.2 (warning while the note figure
  is 0): SR-L1678-1, SR-L1590-1.

## Files

New: `audit-v15.test.mjs`, `import-rule-fixes.test.mjs` (an existing test file under a new name),
`AUDIT_REPORT_v1.5.md`, `RELEASE_NOTES_v1.5.md`.

Changed: `rules.js`, `applicability.js`, `session.js`, `model.js`, `importer.js`, `periods.js`, `compile.mjs`,
`GOLDEN_CALIBRATION.json`, `pdf-preview.js`, `app.js`, `shell.html`, `assurance.mjs`, `assurance.test.mjs`,
`ASSURANCE_BASELINE.json`, `golden.test.mjs`, `pdf-preview.test.mjs`, `browser-smoke.mjs`, `numeric.test.mjs`,
`disclosure-carry.test.mjs`, `mca-html.test.mjs`, `v13.test.mjs`, `fixtures.mjs`, `package.json`, `README.md`, and the
generated `MCA_AUTHORITY.json`, `BUSINESS_RULE_COVERAGE.json`, `RULE_AUDIT.json`, `index.html`, `indas-xbrl.html`,
`artifact.html`, `BUILD_INFO.json`.

Unchanged: the taxonomy and rule texts, the XML writer (`generator.js`), the gate.

## Your existing project files

Nothing to do: they open as before. A project saved before v1.5 has no "Statement figures rounded to" — it shows
"Same as presented" and works exactly as in v1.4. For a filing imported from XML before v1.5, open the company page and
choose the places the statements are rounded to, then Apply — or simply import the XML again with v1.5, which sets it.

For next year: import last year's **filed** XML with **Prepare next year's filing** (Import XML), as in v1.3.

## Tests (run in the environment that produced this package)

| Suite | Result |
|---|---|
| Unit (`npm run test:unit`) | 258 / 258 (10 new in `audit-v15.test.mjs`, 2 new preview checks) |
| Gate (`io.test.mjs`) | 11 / 11 |
| Golden (`golden.test.mjs`: reference instances A, B and C standalone + consolidated) | 35 / 35 |
| Assurance (`assurance.test.mjs`, four instances) | 37 / 37 — all targets 0; the consolidated instance C reports only its own SR-L663-1 |
| Mutation sweeps (new seeds) | 300 tries per instance (both years) and 200 per prepared next-year filing: 0 unreachable errors, 0 inexact undos |
| Browser (`browser-smoke.mjs`, four instances present) | 170 / 170 (27 new) |
| Golden XML byte-identity | reference instances A and B byte-identical to v1.4 (and v1.2), directly and through the import + health check path |
| Reference instance C regenerated XML | equal to the source XML fact for fact except the zeros not filed under a "No" answer (and identical to v1.4's output) |
| Clean unzip of the package (no golden files) | recompiles the authority identically, builds the same `index.html`; unit 222 / 222 (8 golden-only skipped), gate 10 / 10, browser 123 / 123 |

As before: Node tests that read XML used a stand-in XML parser; the browser run used Chromium's parser; esbuild 0.28.2.

## Not run here

- `npm ci` with the pinned packages; a build with esbuild 0.24.2; `npm run compile` with the real `xlsx` package.
- Node tests with the real `@xmldom/xmldom` parser; `xsd.test.mjs`, Arelle and the full `npm run release`.
- The MCA validator on XML produced by v1.5.
- The deployed GitHub Pages site; printing the preview to PDF.
- Real next-year figures (the next-year audit typed last year's figures as stand-ins).

## Manual check on the live page (about 15 minutes)

1. The title reads **INDAS XBRL Tool v1.5**.
2. **Import XML** → a standalone XML presented in lakhs with share capital to the rupee (Both years). Company page: *Decimal places as presented* **4**, *Statement
   figures rounded to* **2 decimal place(s)**. Press **Apply**: both stay.
3. Validate: **INTERNAL GATE · PASS**; the warnings include FM-16 (CIN of individual shareholders) and SR-L1678-1.
4. Generate XML: it is produced.
5. Balance sheet: type a current-year figure again unchanged (e.g. trade receivables) — nothing else changes.
   Validation → Fix tools → **Recalculate current year**: all cells agree, nothing to change.
6. Import a consolidated XML: only errors in its own data remain, each pointing to its cell or table.
7. Generate XML → **Preview PDF**: compare the order of the sections with the MCA PDF (e.g. [400400] and [400500] come
   after [611100]).
8. **Import XML** → the standalone XML → **Prepare next year's filing**: the bar shows the next year; the company page keeps 4
   and 2; the balance sheet's previous-year column shows last year's figures, locked.
9. In the new year, type a few current-year amounts with 2 places (e.g. trade receivables) and the share capital with 4:
   the totals they feed are rounded to 2 places; the share capital keeps its 4.
10. Validation → "Previous year vs last year's filing": all equal.
11. Prepared from an XML with an error in its own data, validation lists it for the **previous year**; unlock the
    previous year, correct the figure, lock again: the error goes, and "Previous year vs last year's filing" lists that
    one figure.
