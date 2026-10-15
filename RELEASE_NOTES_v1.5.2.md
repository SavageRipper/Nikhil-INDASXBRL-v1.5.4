# INDAS XBRL Tool v1.5.2 — release notes

Base: v1.5.1. Reported: a filing prepared for the next year with v1.5.1 passed the tool's validation, but the MCA
validator raised five errors. All five are now found by the tool; four causes were in the tool and are fixed. Details:
README, section "v1.5.2".

## The five errors

| # | MCA validator | Cause | In v1.5.2 |
|---|---|---|---|
| 1, 2 | Share options, previous year: "Changes… is mandatory" and "Specified -64000, Expected -17750" | Last year's XML had the share-option counts in INR; counts typed again got the unit *pure*. XBRL adds up only figures in one unit, so the MCA validator left the exercised options out; the tool added them | Counts follow the unit their group already uses; opening the project puts the group into one unit (INR, as last year's XML); the tool's check adds up only figures in one unit |
| 3 | "as GrossSalaryToKeyManagerialPersonnelOrDirector is present, at least one of Perquisites / ProfitsInLieu / Salary is mandatory" | The workbook's exemption row for gross salary was read the wrong way round | The tool now requires the split. **Your action:** enter Salary (and Perquisites / Profits in lieu, if any) for each person whose gross salary is entered alone |
| 4 | "'DescriptionOfPresentationCurrency' is not applicable for previous year" | The element is also in a note, and the tool let the note decide | Left out for the previous year (also NameOfParentEntity, NameOfUltimateParentOfGroup) |
| 5 | "Item(s) for DetailsOfMaterialContractsArrangementsTransactionsAtArmsLengthBasisTable should be present" | The workbook names a question that does not exist; the tool picked the *not* at arm's length question, so the table stayed closed | The table opens on Yes to material contracts and is required. **Your action:** fill it (Copy from previous year offers last year's rows — update the description and amounts) |

## Files

New: `audit-v152.test.mjs`, `RELEASE_NOTES_v1.5.2.md`.

Changed: `units.js`, `model.js`, `upkeep.js`, `calculation.js`, `rules.js`, `applicability.js`, `rule-indas.mjs`,
`app.js`, `shell.html`, `package.json`, `README.md`, and the generated `MCA_AUTHORITY.json`,
`BUSINESS_RULE_COVERAGE.json`, `RULE_AUDIT.json`, `index.html`, `indas-xbrl.html`, `artifact.html`, `BUILD_INFO.json`.

## Your existing project files

Open the project as usual. The health check puts the share-option counts into one unit and says so. Then validate: the
gross-salary split and the material contracts table are listed as errors with links to the cells; fill them and
generate the XML again.

## Tests

| Suite | Result |
|---|---|
| Your project, opened with v1.5.2 | the tool now reports the gross-salary and material-contracts errors (MCA errors 3, 5); share-option counts in one unit and consistent (MCA errors 1, 2); presentation currency left out for the previous year (MCA error 4) |
| Unit (`npm run test:unit`) | 264 / 264 (6 new in `audit-v152.test.mjs`) |
| Gate / Golden / Assurance | 11 / 11, 35 / 35, 37 / 37 |
| Browser (`browser-smoke.mjs`) | 173 / 173 |
| Reference instances' XML | byte-identical to v1.5.1 (all four) |
| Clean unzip of the package (no golden files) | recompiles the authority identically, builds the same `index.html`; unit 227 / 227 (9 golden-only skipped), gate 10 / 10, browser 124 / 124 |

## Not run here

- The MCA validator on the XML from v1.5.2 (your corrected filing is the real check).
- As before: `npm ci` with the pinned packages, the real XML parser, `xsd.test.mjs` / Arelle, the deployed site.

## Manual check (10 minutes)

1. The title reads **INDAS XBRL Tool v1.5.2**.
2. Open your project: the health-check message mentions counts put into one unit.
3. Validate: errors for the gross salary without its split (each person concerned) and for the material contracts
   table; no share-option errors.
4. Key managerial personnel table: enter Salary for those persons. The gross salary errors go.
5. Directors' report tab: the material contracts table opens; **Copy from previous year (n)**, update the rows. The
   table error goes.
6. Generate XML, validate it with the MCA validator.
