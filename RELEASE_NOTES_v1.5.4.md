# INDAS XBRL Tool v1.5.4 — release notes

Base: v1.5.3. Reported: a next-year consolidated filing passed the tool's validation, but the MCA validator raised "All
mandatory elements for table DisclosureOfDetailsOfSubsidiariesTable must be present for atleast one context as on
2026-03-31". Details: README, section "v1.5.4".

## What changed

| Reported | Cause | In v1.5.4 |
|---|---|---|
| MCA error on the subsidiaries table (611500) | The tool required the 19 elements of MCA's workbook list; the current-year rows had all 19. The MCA validator requires more: last year's column (from the MCA-validated filing) passed and had, in addition, eleven elements reported as 0 — current / non-current assets and liabilities, revenue and comprehensive income of the subsidiary, and the five non-controlling-interest elements — and the reason for a different reporting date | The eleven are required for at least one subsidiary per year (an error, linked to the cell); the reason for a different reporting date is a warning (an MCA-validated standalone filing does not report it). The table tags them **Mandatory · at least one row** |
| "[pure] 2" next to last year's "1" (number of subsidiary companies) | Last year's figure came in with the unit INR; the new one got the default unit (pure) | A count keeps the unit the filing already uses for it; opening the project puts both years into one unit (last year's) |

## Files

New: `audit-v154.test.mjs`, `RELEASE_NOTES_v1.5.4.md`.

Changed: `GOLDEN_CALIBRATION.json`, `compile.mjs`, `rules.js`, `model.js`, `app.js`, `rule-audit.mjs`,
`browser-smoke.mjs`, `shell.html`, `package.json`, `README.md`, and the generated `MCA_AUTHORITY.json`,
`BUSINESS_RULE_COVERAGE.json`, `RULE_AUDIT.json`, `index.html`, `indas-xbrl.html`, `artifact.html`, `BUILD_INFO.json`.

## Your existing project files

1. Open the project. The health check puts counts reported in two units into last year's unit and says so.
2. Validate: one error for the subsidiaries table, naming the missing elements; click it to go to the cell.
3. In tab 611500, enter those elements for at least one subsidiary (0 where there is nothing to report), and NA for the
   reason for a different reporting date.
4. Generate the XML again and validate it with the MCA validator.

## Tests

| Suite | Result |
|---|---|
| Your project (opened with v1.5.4) | ML-105 error naming the eleven elements on subsidiary "One", current year; reason-for-different-date warning; 11 counts put into last year's unit (INR) |
| Unit (`npm run test:unit`) | 274 / 274 (5 new in `audit-v154.test.mjs`) |
| Gate / Golden / Assurance | 11 / 11, 35 / 35, 37 / 37 |
| Browser (`browser-smoke.mjs`) | 177 / 177 (new: the table tags) |
| Rule audit (`RULE_AUDIT.json`) | every rule's result unchanged (ML-105 verified with the new elements) |
| Reference instances' XML | byte-identical to v1.5.3 (all four, directly and through the health check) |
| Clean unzip of the package (no golden files) | recompiles the authority identically, builds the same `index.html`; unit 237 / 237 (9 golden-only skipped), gate 10 / 10 (1 golden-only skipped), browser 128 / 128 |

## Not run here

- The MCA validator on an XML from v1.5.4 with the eleven elements entered (the real check).
- As before: `npm ci` with the pinned packages, the real XML parser, `xsd.test.mjs` / Arelle, the deployed site.

## Manual check (10 minutes)

1. The title reads **INDAS XBRL Tool v1.5.4**.
2. Open your project: the health-check message mentions counts put into one unit.
3. Validate: one error on the subsidiaries table listing eleven elements, and one warning for the reason for a
   different reporting date. Click the error: tab 611500 opens at the cell.
4. Open the subsidiaries table (current year): the eleven rows are tagged "Mandatory · at least one row".
5. Enter them for subsidiary One (0 each; the two proportions 0%) and NA for the reason. Validate: the error and the
   warning are gone.
6. Generate the XML; number of subsidiary companies is in the same unit for both years.
7. Validate the XML with the MCA validator.
