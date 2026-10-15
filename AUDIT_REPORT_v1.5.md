# Audit of v1.4 on two more MCA-validated reference instances — report (v1.5)

Inputs: a pair of MCA-validated XBRL reference instances (C), **standalone** and **consolidated**, FY 2024-25, and the
PDFs the MCA validator produced from them. Level of rounding Lakhs; most amounts to 2 places of a lakh (decimals -3) and
share capital to the rupee (decimals INF); not a first-time adoption; MCA V3 schema reference. Kept as
`golden-ref-c-standalone-2024-25.xml` / `.pdf` and `golden-ref-c-consolidated-2024-25.xml` / `.pdf` — outside the package
and the published repository.

The earlier reference instances stay in every run: reference instance A (2022-23) and reference instance B (2024-25).

## How the audit was done

| # | Audit | What was checked |
|---|---|---|
| 1 | Import, validation, regeneration | Each instance imported (both years), validated with the full rule set, XML regenerated and compared fact by fact with the source XML (independent comparer `golden-diff.mjs`: concept, period, dimensions, unit, decimals, value) |
| 2 | Re-key through the screen | Every source fact typed into its screen cell in a new filing — in taxonomy order, reverse order and random order — then compared with the source values, and validated (`assurance.mjs`) |
| 3 | Mistakes | Random wrong entries (blank, +1, +1000, flipped Yes/No, wrong choice, changed text and date): every error the tool raises must point to a cell the user can reach, and typing the right value back must restore the filing exactly |
| 4 | Read-only (calculated) cells | Every locked cell must show exactly its calculation |
| 5 | Next year's filing | "Prepare next year's filing" from each instance: previous-year column = current year of the source, lock, set-aside store, comparison with the source XML, disclosure copy, every error reachable; then the whole new year typed in, validated, generated and read back |
| 6 | Preview PDF | The preview of each instance against its MCA PDF: the sections, their order, and every number the MCA PDF shows |
| 7 | Browser | The built `index.html` in Chromium with all four instances: import, every tab, company page, validation, Generate XML, preview |

## Findings and fixes

### 1. FM-14 "parent member should be present" — 12 false errors in each instance (fixed)

*Evidence:* both instances report children of **Other advances** (Prepaid expenses, Advance tax, Deposits with statutory
authorities …) in the advances table without the parent member. The MCA workbook (sheet "Exempt parent member Dimension",
S.No. 29, rows 72–74) exempts exactly these parents for `DetailsOfAdvancesTable`, but names the axis
`ClassificationOfAssetsBasedOnSecurityAxis`, which does not carry these members (they belong to
`ClassificationOfAdvancesAxis`). v1.4 matched the axis literally, so the exemption never applied.

*Fix:* an exemption row whose axis does not carry its member is matched by table and member (`rules.js`,
`fm14RequiredParent`). Rows with a correct axis are matched as before; other tables still require the parent.

### 2. FM-16 "members 1, 2, 3 … without gaps" — 4 false errors in each instance (fixed)

*Evidence:* in the shareholders-above-5% table, "CIN of shareholder" is given only for Shareholder 3 (the shareholder that
is a company); individuals have no CIN. v1.4 read the empty CIN of Shareholders 1 and 2 as a gap in the numbering.

*Fix:* a **text** element left empty for a member that is itself reported (the row has other values) is a warning. A
member that is missing altogether, or a missing amount, stays an error (the Filing Manual's own example is an amount).

### 3. SR-L1678-1 / SR-L1590-1 — "details total = note figure" — 2 + 2 errors (calibrated)

*Evidence:* both instances fill the details tables of **other current assets, others** and (consolidated) **other
non-current assets, others** with amounts while the note figure itself is 0, in both years; the MCA validator accepted them.

*Fix:* the principle you approved in v1.2 for SR-L1097-1 / SR-L1304-1, applied to these two rules
(`GOLDEN_CALIBRATION.json`, 2 new entries, with the evidence): a **warning while the note figure is nil or 0**, an
**error once it has an amount** that differs from the details. `compile.mjs` now accepts such a calibration for this kind
of rule too.

### 4. SR-L6420-1 (consolidated) — a table that could not be filled was required (fixed)

*Evidence:* the rule requires the principal products / services table when revenue is reported. In a consolidated filing
none of that table's elements may be reported (the consolidated general-information rule), so v1.4 showed the table with
every cell disabled — an error the user could not resolve. The consolidated MCA instance does not have the table.

*Fix:* that table is not applicable in a consolidated filing, and its table rule is not applied there
(`applicability.js`, `rules.js`). Standalone filings: unchanged.

### 5. Accuracy (decimals) of typed figures — totals could not agree (fixed)

*Evidence:* reference instance C presents share capital to the rupee, so the tool shows **4 decimal places**. In v1.4
every typed amount was then declared accurate to ₹10 (decimals -1), although the statements are rounded to ₹1,000.
Typing the instance in again gave total equity to the rupee instead of the reported figure rounded to ₹1,000, and
"Equity and liabilities = Assets" (SR-L74-2) failed — in both years and both instances (v1.4 re-key: 6 figures
differing, 21 / 24 errors, among them SR-L74-2 and the CSR 2% rule SR-L6328-3). Even without typing, two read-only
equity cells of each imported instance showed the reported total while the tool's own calculation gave the unrounded
sum — the figure Recalculate would have put in (finding 6).

*Fix:*
- New setting **Statement figures rounded to** (company page), set on import from the accuracy most amounts are reported at
  (reference instances C and A: 2 places; B: 0) and kept by "Prepare next year's filing". Typed amounts are declared at
  that accuracy; a figure that needs more places (share capital) is declared at the places as presented.
- A calculated total is as accurate as its least accurate part and is rounded to it (Filing Manual #13: digits beyond
  the declared accuracy are 0), but never to fewer places than the statements; a part that is 0 does not limit it.
- A value typed again unchanged keeps its accuracy.

New filings without the setting work exactly as before ("Same as presented").

### 6. Recalculate current year would have replaced reported totals (fixed)

*Evidence:* on reference instance C, *Recalculate* listed the reported total equity (rounded to ₹1,000) to be replaced by
the unrounded sum.

*Fix:* a figure you entered or imported that agrees with its parts at its own accuracy is kept (totals, statement
figures taken from notes, carrying amounts).

### 7. Company page reset 4 decimal places to 0 (fixed)

*Evidence:* the "Decimal places as presented" list offered 0–3 only. For reference instance C (4) nothing matched, the list showed 0, and
pressing **Apply** on the company page — the page "Prepare next year's filing" opens on — silently set the filing to 0
places: every typed figure would have been rounded to whole lakhs.

*Fix:* the list offers the places the level of rounding allows (Lakhs: up to 7) and always the filing's own value. A
browser check now presses Apply on reference instance C and confirms 4 and 2 are kept.

### 8. Preview PDF section order (fixed)

*Evidence:* reference instance C has seven sections reference instance B's PDF lacks (210000a, 400300, 400400, 400500, 400800, 611400, 613400); v1.4
placed them by code. The MCA PDFs put them elsewhere (e.g. 400400 and 400500 after 611100).

*Fix:* the order is completed from both reference instance C PDFs. Now standalone 55 / 55 and consolidated 51 / 51 sections in the MCA
order; every number the MCA PDF shows in a section (2,585 and 2,351 numbers) appears in that section of the preview —
except one: "Capitalisation rate of borrowing costs 0.00%" (both years), reported under "No borrowing costs capitalised",
which the tool does not file (see below). Reference instance B: unchanged (49 / 49, every number).

### 9. Import of an instance whose dates disagree stopped with "Invalid time value" (fixed)

Found while typing a whole new year in Audit 5 (dates typed unchanged from the old year). The import now reads such a
file without an exception.

## Not a tool error

### SR-L663-1 — consolidated reference instance C: shareholders above 5% total more than 100% (kept blocking)

In the consolidated instance the holdings reported for the equity shares add up to more than 100% in the current year;
one shareholder's percentage differs from the standalone instance. The rule ("summation of all shareholders … less than
or equal to 100%") is right; the figure is an error in the instance's own data, which the MCA validator did not catch.

The tool keeps this an **error**: importing the consolidated XML shows it, and *Generate XML* is refused until it is
corrected. In a next-year filing prepared from it, the error sits in the **previous-year column**: unlock the previous
year (tab tools), correct the percentage, lock again; "Previous year vs last year's filing" then lists that one figure
as different from last year's XML, as it should. A calibration to a warning would be a one-line change.

### Zeros under "No" answers are not regenerated (as before, harmless)

Each reference instance C XML reports facts with value 0 under a "No" answer — borrowing costs capitalised, construction contracts,
government grants, exploration of mineral resources, first-time adoption reconciliations (Indian GAAP vs Ind AS) and
similar. They are not applicable, so the tool leaves them out of the regenerated XML (`golden-diff.mjs`: these only in the
source XML, all 0; nothing changed, nothing added). The business rules apply these elements only under a "Yes" answer;
leaving them out has been the tool's behaviour since v1.0. The MCA validator was not run on the regenerated XML.

## Results after the fixes

| Check | reference instance C standalone | reference instance C consolidated | reference instance A (2022-23) | reference instance B 2024-25 |
|---|---|---|---|---|
| Errors on import + validation (v1.4 → v1.5) | 18 → **0** | 22 → **1** (SR-L663-1, the instance's own data) | 0 → 0 | 0 → 0 |
| Regenerated XML vs source | identical except those zeros | identical except those zeros | byte-identical to v1.4 | byte-identical to v1.4 |
| Re-key, 3 orders: values differing / errors | 6 / 21 (v1.4) → **0 / 0** | 6 / 24 (v1.4) → **0 / 1** (SR-L663-1) | 0 / 0 | 0 / 0 |
| 60 mistakes: unreachable / inexact undo | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Large sweep, both years (300 tries, new seed): unreachable / inexact undo | 197 made: 0 / 0 | 207 made: 0 / 0 | 224 made: 0 / 0 | 247 made: 0 / 0 |
| Large sweep, prepared next year (200 tries): unreachable / inexact undo | 127 made: 0 / 0 | 132 made: 0 / 0 | 156 made: 0 / 0 | 161 made: 0 / 0 |
| Read-only cells showing their calculation | 2,375 of 2,377 (v1.4) → **all 2,377** | 2,370 of 2,372 (v1.4) → **all 2,372** | 913 / 913 | 194 / 194 |

Next year's filing (Audit 5):

| | Standalone | Consolidated |
|---|---|---|
| New previous-year column = current year of the source | 3,230 of 3,230 values and decimals | 3,390 of 3,390 |
| Not carried (current-year-only tables: stock exchanges, secretarial auditor, auditors, entities consolidated …) | 343, set aside | 80, set aside |
| Comparison with the source XML | 0 differences | 0 differences |
| Errors in the fresh next year pointing to a cell you cannot reach | 0 | 0 |
| Whole new year typed in (last year's figures as stand-ins) | 3,573 / 3,573 cells accepted | 3,470 / 3,470 |
| Generated XML read back | 6,943 facts, none lost or changed | 7,003 facts, none lost or changed |

After typing last year's figures as this year's, the remaining errors are the ones such stand-in data must raise (opening
+ movements ≠ closing, signing dates later than the test date, three-year profit table) — data errors, not tool errors.
