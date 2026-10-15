# INDAS XBRL Tool v1.5.4

Local-first, browser-based preparation, validation and generation of MCA **Ind AS 2017** XBRL instance documents
(AOC-4 XBRL, commercial and industrial companies, **standalone and consolidated**). Taxonomy, dimensions, calculations,
formula linkbase and business rules are compiled from the MCA authority files in this repository; nothing is hard-coded.

**Open the app:** `index.html` (GitHub Pages serves it at the site root; it also opens from disk, offline). It is the built
app — rebuild with `npm run build` after changing any source file and commit the new `index.html`.

Flat repository: every file sits at the root (no folders to create when uploading).

## v1.5.4 — subsidiaries table: what the MCA validator requires beyond the workbook

**Reported:** a next-year consolidated filing prepared with v1.5.3 passed the tool's validation; the MCA validator raised
"All mandatory elements for table DisclosureOfDetailsOfSubsidiariesTable must be present for atleast one context as on
2026-03-31".

**Cause:** the tool required the 19 elements the workbook lists for this table (sheet "Mandatory Line Items", ML-105), and
the current-year rows had all 19. The MCA validator requires more. Evidence: the previous-year column of the same filing
(taken from the MCA-validated filing) passed and differs from the current year only by eleven elements reported as 0 —
current / non-current assets and liabilities, revenue and comprehensive income of the subsidiary, and the five
non-controlling-interest elements — plus the reason for a different reporting date ("-"). Both MCA-validated reference
instances with subsidiaries (standalone and consolidated) report the eleven for both years; the standalone one does not
report the reason.

**Fix:**

| Change | Where |
|---|---|
| The eleven elements are required for **at least one subsidiary per year** (the MCA message: "for atleast one context"); blocking. The reason for a different reporting date: a warning. The message names what is missing and links to the cell; the table tags them "Mandatory · at least one row" | `GOLDEN_CALIBRATION.json` (new entry kind `oneRow`), `compile.mjs`, `rules.js` (ML-105), `app.js`, `rule-audit.mjs`; regenerated `MCA_AUTHORITY.json`, `BUSINESS_RULE_COVERAGE.json`, `RULE_AUDIT.json` |
| A count that belongs to no calculation (e.g. number of subsidiary companies) keeps the unit the filing already uses for it — last year's imported unit first — and the health check puts both years into one unit (the MCA PDF printed "[pure] 2" next to last year's INR figure) | `model.js` |

**Your action:** in tab 611500, enter the eleven elements for at least one subsidiary (0 where there is nothing to
report) and the reason for a different reporting date ("NA"); generate the XML again.

The XML of every reference instance is byte-identical to v1.5.3 (directly and through the health check). The
standalone reference instance now shows the reason-for-different-date warning (it does not report that element).

## v1.5.3 — text blocks in the MCA PDF

Reported with the MCA PDF of the filing behind v1.5.2: text cut off at the right edge of the page, bulleted lists in a
grey box, and no way to choose a heading level. Only the rich-text editor, Tidy and the health check changed
(`richtext.js`, `upkeep.js`, `app.js`, `styles.css`); taxonomy, rules, engines and the XML writer are as in v1.5.2.

| Reported | Cause | Fix |
|---|---|---|
| Text cut off at the right edge of the page | A Word table with merged cells (an audit-report annexure: "(i) \| (a) \| (A) \| text", clause rows merged across the label columns). The MCA schema has no colspan; the tool kept a merged cell's text in the first column of the merge, so the long texts landed in four different columns. The MCA PDF does not shrink a table to the page: every column became wide and the table ran off the page | A merged cell's text now goes into the column that holds the table's text (`richtext.js`). For tables already flattened, **Tidy** moves long texts that end a row into that column and removes the columns left empty; the editor's status line names tables with long text in three or more columns |
| Bulleted lists in a grey box | Bulleted lists were written as `noteText2`, which the MCA PDF prints bold in a grey box with a dotted border; numbered lists (`noteText1`) print as normal, indented text | Both lists are written as `noteText1` (the bullet tells them apart); the health check moves existing bulleted lists over (class only) |
| Heading level | Only Heading 5 (the H button and automatic headings on paste) | **Paragraph style** list in the editor toolbar: Normal text, Heading 1–5 (header1–5). Pasted bold lines still become Heading 5 (your choice); Tidy keeps the levels you set |

Justified text: not changed (your choice) — the MCA HTML rules have no alignment setting, and the MCA PDF aligns text itself.

The XML of every reference instance is byte-identical to v1.5.2.

## v1.5.2 — five MCA validator errors on a next-year filing

A filing prepared for the next year with v1.5.1 passed the tool's own validation, but the MCA validator raised five
errors. Each was traced to its cause; four were the tool's, one is data the tool must ask for.

| # | MCA validator message (shortened) | Cause | Fix |
|---|---|---|---|
| 1, 2 | "as NumberOfShareOptionsExercised… is present, ChangesOfNumberOfShareOptionsOutstanding… is mandatory"; "Specified -64000, Expected -17750" (previous year) | Counts (data type *decimal*) may be in any unit. Last year's XML had the share-option counts in INR; the counts re-entered for the next year got the tool's default unit (pure). XBRL adds up only figures in the same unit, so the MCA validator left the exercised options out of the total; the tool added them anyway and saw no error | A new count takes the unit its family (calculation and roll-forward relatives) already uses in the filing; the health check (on opening / importing) puts a family reported in two units into one (the imported unit); the tool's calculation check now adds up only figures in the same unit and says when a part is in another unit (`units.js`, `model.js`, `upkeep.js`, `calculation.js`, `rules.js`) |
| 3 | "as GrossSalaryToKeyManagerialPersonnelOrDirector is present, at least one of [Perquisites…, ProfitsInLieu…, Salary…] is mandatory" | The workbook's exemption row "All elements are exempt except 'GrossSalaryToKeyManagerialPersonnelOrDirector'" was read as exempting the parts, so the total needed none | A total named as *not* exempt in such a row needs one of its parts (`rules.js`, GR-1). Enter the salary / perquisites split for each person |
| 4 | "'DescriptionOfPresentationCurrency' is not applicable for previous year" | The element is in general information (not for the previous year) and also in a note; the tool let the note decide | An element of a section not reported for the previous year that is also in another section without a table is not reported for the previous year (`applicability.js`): also NameOfParentEntity, NameOfUltimateParentOfGroup. It is left out of the XML (Hidden data shows it) |
| 5 | "Item(s) for DetailsOfMaterialContractsArrangementsTransactionsAtArmsLengthBasisTable should be present … as WhetherThereAreMaterialContracts…AtArmsLengthBasis is yes" | The workbook row names a question that does not exist ("…ContractsArrangementsTransactionsAtArmslengthbasis"); the tool matched it to the closest label — the *not* at arm's length question. With that answered No, the table stayed closed and was never required | The table now belongs to the material contracts question (`rule-indas.mjs`; one rule and one table condition in `MCA_AUTHORITY.json`). Fill the table (Copy from previous year offers last year's rows) |

The XML of every reference instance is byte-identical to v1.5.1.

## v1.5.1 — the browser autosave holds large filings

**Reported:** after preparing next year's filing from a large instance, the bar showed *Not saved in browser* and Ctrl+S
said "This browser does not allow saving here".

**Cause:** the project was autosaved in the browser's localStorage, which holds about 5 million characters per site. A
filing prepared for the next year also keeps last year's filing (for the comparison with the filed XML) and the set-aside
values: for the reference instances of v1.5 that is about 5.8–5.9 million characters, so every save failed. (The same
filing with both years imported was about 4.8 million — just under the limit.) The message blamed the browser.

**Fix (`app.js` only):** the autosave now uses the browser's IndexedDB, which holds far more; localStorage stays the
fallback where IndexedDB is unavailable. A project autosaved by v1.5 or earlier is still restored and is then moved over.
If storage is really full, the message now says the project is too large for this browser's storage. A change made just
before the tab is hidden or closed is saved at once. Nothing else changed: the project file (*Save project*), the
engines, the rules and the XML are as in v1.5.

## v1.5 — audit on two more MCA-validated reference instances (standalone and consolidated)

A full audit of v1.4 on a further pair of MCA-validated reference instances (standalone and consolidated, amounts in
lakhs, share capital to the rupee) and the PDFs the MCA validator produced from them (`AUDIT_REPORT_v1.5.md` has every
finding with its evidence). v1.4 blocked both instances with errors the MCA validator had not raised (standalone 18,
consolidated 22), and three things went wrong when their figures were typed in again. All fixed at the cause; the
taxonomy, rule texts and XML writer are unchanged, and the XML of the earlier reference instances is byte-identical to
v1.4.

| # | Finding (v1.4) | Fix (v1.5) |
|---|---|---|
| 1 | **FM-14** (parent member required) ×12: the MCA workbook's sheet "Exempt parent member Dimension", S.No. 29, names the wrong axis for its three advances members, so the exemption never applied | An exemption row whose axis does not carry its member is matched by table and member (`rules.js`) |
| 2 | **FM-16** (members 1, 2, 3 … without gaps) ×4: CIN of shareholder given only for the shareholder that is a company | A **text** element left empty for a member that is itself reported is a warning; an amount stays an error |
| 3 | **SR-L1678-1 / SR-L1590-1**: the details table of other (non-)current assets, others reports amounts while the note figure is 0 | Calibrated as in v1.2 (`GOLDEN_CALIBRATION.json`): a warning while that figure is nil or 0, blocking once it has an amount |
| 4 | **SR-L6420-1** (consolidated): the principal products / services table was required although none of its cells can be filled in a consolidated filing | That table is not applicable in a consolidated filing (`applicability.js`); the rule is not applied there |
| 5 | **Decimals of typed figures**: with 4 places as presented (share capital to the rupee) every typed amount was declared accurate to ₹10, so totals of figures rounded to ₹1,000 could not agree (Equity and liabilities ≠ Assets, SR-L74-2) | New **Statement figures rounded to** (company page; set on import from the accuracy most amounts are reported at): typed amounts are declared at that accuracy; a figure with more places at the places as presented. Calculated totals are rounded to their least accurate part, never to fewer places than the statements |
| 6 | **Recalculate** would have replaced totals rounded to the statement accuracy with unrounded sums | A total that agrees with its parts at its own accuracy is kept |
| 7 | **Company page**: only 0–3 decimal places were offered; a filing at 4 showed 0, and *Apply* silently set it to 0 | The places offered go up to what the level of rounding allows; the filing's own value is always selected |
| 8 | **Preview PDF**: sections the earlier MCA PDF did not have (210000a, 400300, 400400, 400500, 400800, 611400, 613400) were placed by code, not where the MCA PDF puts them | Section order completed from the new MCA PDFs: same sections, same order; every number the MCA PDF shows appears in the preview (except a 0.00% rate under a "No" answer, which the tool does not file) |
| 9 | An instance whose dates disagree made the import stop with "Invalid time value" | Read without an exception |

**Kept as an error:** in the consolidated reference instance, the shareholders holding more than 5% add up to more than
100% (SR-L663-1). That is an error in the instance's own data, not a tool error: the tool reports it on import, and in a
next-year filing prepared from it the error appears in the previous-year column (unlock the previous year to correct it).

**Not filed (as before):** zeros reported under a "No" answer (e.g. borrowing costs capitalised, first-time adoption
reconciliations) are not applicable (the business rules apply them only under "Yes") and are left out of the
regenerated XML, as since v1.0.

Changed: `rules.js`, `applicability.js`, `session.js`, `model.js`, `importer.js`, `periods.js`, `compile.mjs`,
`GOLDEN_CALIBRATION.json` (+2 entries), `pdf-preview.js`, `app.js`, `shell.html`. Tests: `audit-v15.test.mjs` (new, runs
without golden files), `golden.test.mjs`, `assurance.test.mjs` + `ASSURANCE_BASELINE.json` (new ceilings,
`knownDataErrors`), `pdf-preview.test.mjs`, `browser-smoke.mjs`, and adjusted expectations in `numeric.test.mjs`,
`disclosure-carry.test.mjs`, `mca-html.test.mjs`, `v13.test.mjs`, `fixtures.mjs`, `assurance.mjs`.

## v1.4 — preview PDF, footnotes from the cell, fill empty totals, recalculate, statement-note differences

The remaining C&I v14.2 features the Ind AS tool lacked (master prompt section F), found by comparing the two READMEs and
file lists. Architecture unchanged: new UI helper modules (`pdf-preview.js`, `totals-fill.js`) act only through the
Session; the taxonomy, rules, rule engine, applicability and generator are untouched; the XML of both MCA-validated
instances is byte-identical to v1.3.

| # | Feature | How it works |
|---|---|---|
| 1 | **Preview PDF** (Generate XML tab: *Preview PDF (not the MCA rendering)*, *Download preview (.html)*) | A printable preview of the facts the XML contains (Print → Save as PDF), labelled **not the MCA rendering** on every page. Laid out as **measured on the MCA validator's PDF of reference instance B (2024-25)**: the sections in the MCA PDF's own order (general information and the disclosures first, then the statements and notes — `SECTION_ORDER`; a section that PDF does not show sits after the nearest preceding code), Times throughout at the measured sizes (labels 8.2pt, values 7.5pt, headings bold), "Unless otherwise specified, all monetary values are in …", every date that holds a value as a column (e.g. the third balance-sheet column at the previous-year opening date, or the opening balance sheet under first-time adoption), Indian digit grouping, dimensional tables in blocks of columns "..(n)", text blocks as "Textual information (n) [See below]", footnotes as "(A) value" with a Footnotes list after the block. Checked against that PDF: the same 49 sections in the same order, every balance-sheet value, the footnote "(A) 484 … Payables". |
| 2 | **Footnotes from the cell** | Click a cell that has a value and press **Alt+N** (or *Footnote…* in the tab tools): add a footnote, reuse an existing footnote's text (one footnote per cell, as in MCA-validated instances), or remove one from the cell. Cells with footnotes show an **fn** mark. The Footnotes page stays as it was. |
| 3 | **Fill empty totals** (per table in the table header, and *Fix tools → Fill empty totals* for all current-year tables) | Empty total cells (the table's total column, parent-member columns) = the sum of their part columns, only on the axes the MCA business rules add up, only amounts and share counts; shows the cells and values first; never overwrites; calculated cells and opening balances are left alone; not offered on a locked previous year. On both MCA instances: nothing to fill; a removed total is planned back to the filed figure. |
| 4 | **Recalculate current year** (*Fix tools*) | Every calculated cell of the current year re-derived from its parts (totals, carrying amounts, closing balances, statement figures taken from their notes). Shows the changes first and names any **figure you entered or imported** that it would replace; overrides and previous-year figures are not changed; *Undo last fix* reverses it. On both MCA instances and the example: nothing to change. |
| 5 | **Statement figures that differ from their notes** (Validation page) | A balance-sheet / P&L figure entered or imported that differs from the note it is taken from is listed with the note's figure and the difference; click to open it. |

Kept as they are (an Ind AS equivalent exists): mandatory marking (live, in `app.js`), MCA error help, the Mismatches
panel (Ind AS only). C&I's own audit tests concern C&I instances and rules.

Changed: `app.js`, `styles.css`, `shell.html`; new `pdf-preview.js`, `totals-fill.js`. Tests: `pdf-preview.test.mjs`,
`v14.test.mjs` (new); `browser-smoke.mjs` (+8 checks).

## v1.3 — keeping a project healthy, next year's filing, one-click fixes, live check, keyboard

Architecture unchanged: the taxonomy, rules, rule engine, applicability decisions and XML generator are untouched (the
generated XML of both MCA-validated instances is byte-identical to v1.2, also through an import on screen with the
health check). New UI helper modules `upkeep.js` and `fixes.js` act only through the Session (the normal entry path).

| # | Feature | How it works |
|---|---|---|
| 1 | **Health check** on opening, importing and saving a project | Values the tool calculated itself that are out of date are re-derived (statement figures taken from notes, totals, carrying amounts — `Session.refreshDerivedStatements`, `refreshCalculatedCells`); values no tab can show (dates outside the two years; previous-year opening values without an opening row) are moved to the **set-aside store** (`filing.setAside`, kept in the project file, never generated or checked, restorable). Entered and imported figures are never changed; nothing is deleted. **Ind AS:** a value of the opening balance sheet column (first-time adoption, GR-16) is never moved — while first-time adoption is No it is only "not applicable" and comes back with Yes. The message on opening lists what changed. |
| 2 | **Prepare next year's filing** (Import XML, or from the open project on the company page) | Replaces "Current year only" and "Roll forward" in the import dialog (hidden; projects made with them still open). Last year's current year becomes the previous-year column — **locked as filed** (Unlock / Lock previous year in the tab tools; the Session refuses previous-year entries while locked, `PyLockedError`). **Release owner's decisions:** last year's previous-year closing balances become the previous-year **opening** balances of the reconciliations (share capital, reserves, PPE …), locked with the previous year; this year's opening balances are last year's closing balances (one common figure, also locked); **first-time adoption is reported once** — the new year answers No, and last year's opening balance sheet is set aside. Last year's previous year, balances of the year before last that no cell shows, and the current-year-only disclosures (GR-12) are set aside; "Copy from previous year" on the disclosure tabs reads them. Company identity answers are carried into the new year. Changing the dates by hand offers to set aside the values left outside the new years. |
| 3 | **Fix buttons** on validation messages (page and separate window) | Where the remedy is unambiguous: enter a missing total as the sum of its parts (GR-1); set an entered total to the sum of its parts; set aside a previous-year opening value whose total has no cell (never one the GR-16 column shows); take a statement figure from its note; report nil (0) for a mandatory amount or for the missing year of GR-5. Each fix is tried on a copy first: the confirmation says what else it would raise. **Undo last fix**. Fixes on the previous year are disabled while it is locked. The rules are recognised by their handler, never by a C&I rule number. |
| 4 | **Previous year vs last year's filing** (Validation page) | Every previous-year figure (with its opening balances) compared with last year's filed figure — kept when the year is prepared, or attached later ("Compare with last year's filed XML…"): differs / missing / not filed, with **Use the filed figure**. |
| 5 | **Live check** | About a second after an edit (and on opening a tab) the rules of the open tab run in the background: cell marks and the bar ("This tab · N errors (live)") follow without pressing Validate. |
| 6 | **Hidden data** (menu, with a count) | The set-aside store by reason (restore into its cell where this filing has one, or delete), values made not applicable (kept, excluded — e.g. after a Yes/No answer), values no tab shows. |

**Found by the new mutation sweep on prepared next-year filings** (not visible on the MCA instances themselves): in a
fresh next year, the equity-changes table and the related-party table cannot open until the balance-sheet figure or the
Yes/No answer that decides them is entered, yet GR-5 / SR-L3010-1 already point into them. Such a message now points to
the cell that opens the table ("… opens once this is entered", `gate.js viaAnswer`, error locations only). Sweep after
the change: 0 unreachable errors, 0 inexact undos (400 mistakes per instance on prepared filings, 600 on the instances).

**Keyboard** (the keys chosen by the release owner): ↓ / ↑ also stop at the buttons under a cell (Go to note, Nil); Tab /
Shift+Tab stay inside the open tab; **Ctrl+Q** tab switcher (hold Ctrl; Q or ↓ / ↑; release Ctrl to open; Esc cancels);
**Ctrl+Shift+S** save project; **Ctrl+O** open project; **Alt+V** validate and open the messages window; **Ctrl+G**
generate XML; **Ctrl+I** import XML; **Alt+Shift+N** new filing; **Ctrl+H** MCA error help (Ctrl+V and Ctrl+N stay with the
browser: paste and new window). All shortcuts: menu → Keyboard shortcuts.

Changed: `importer.js` (the 'next' mode; the other modes unchanged), `model.js` (set-aside store, filed reference),
`session.js` (previous-year lock, `calcParentsOf`, `setTotalFromParts`, `refreshDerivedStatements`), `gate.js` (error
locations only), `carry-forward.js` (reads the set-aside store), `assurance.mjs` (sweeps prepared filings), `app.js`,
`styles.css`, `shell.html`; new `upkeep.js`, `fixes.js`. Tests: `v13.test.mjs` (new), `assurance.test.mjs` (+2),
`browser-smoke.mjs` (+19 checks; the import-mode checks now use Prepare next year's filing).

## v1.2 — no dead ends (the v12 rules), statement figures from notes, validation window, resizable tables, disclosures copied from last year

Architecture unchanged: the rule engine, applicability decisions and XML generator keep their design; the taxonomy and
business rules are compiled from the same MCA files. The generated XML of both MCA-validated instances is
byte-identical to v1.1 (reference instance A (2022-23)), and reference instance B (2024-25) now keeps its own schemaRef (below) and
is otherwise identical — also after an import through the screen.

**Release owner's decisions (2026-10-09)**

| # | Decision | How it works |
|---|---|---|
| 1 | **SR-L1097-1 / SR-L1304-1** (revaluation flags of the PPE and intangibles notes) are a **warning** while the note's balance — *Property, plant and equipment* / *Other intangible assets* — is absent, nil or 0, and **blocking** once it is reported with an amount. | `GOLDEN_CALIBRATION.json` (new kind of entry: `whenNilOrAbsent`, with the reference instance B evidence), compiled into the rule (`compile.mjs`) and applied by `rules.js`; the message says it is calibrated and when it becomes required. The two pending entries left `APPROVED_LIMITATIONS.json`. reference instance B now passes the internal gate. |
| 2 | **Both schemaRef addresses are accepted** on import: the Filing Manual address (`http://www.mca.gov.in/XBRL/2017/…`) and the MCA V3 address (`https://www.mca.gov.in/V3XBRL/2017/07/16/Taxonomy/Ind/in-ci-ent-2017-03-31.xsd`). An imported filing keeps its own; **new filings are written with the V3 address**. | `compile.mjs` (`acceptedSchemaRefs`, default V3); the company page shows the filing's own address. |

**Compiler fix (XBRL 2.1 §3.5.3.9.7.4).** Two presentation arcs between the same elements that differ only in their
preferred label (e.g. *opening* and *closing* balance rows of a reconciliation) are not equivalent; the compiler kept
only one of them, so 53 closing-balance rows (and 41 definition arcs of the same kind) were missing from the screen.
`dts.mjs` now compares every non-exempt attribute. Calculation, tables, hypercubes and rules compile exactly as before.
The authority was recompiled (`MCA_AUTHORITY.json`, `BUSINESS_RULE_COVERAGE.json`).

**B — the v12 rules: an error can always be fixed on screen** (C&I v12, on the Ind AS rules)

| Rule | Behaviour |
|---|---|
| A total is locked only while the tool maintains it | Read-only means: calculated by the tool, or entered and still equal to its parts. **An empty cell is never locked.** Typing the value a calculated cell already shows is accepted. |
| A typed total follows its parts only if it agreed with them | Enter a total first and its parts later: a total that differs from its parts is **kept** (GR-1 reports the difference and the cell stays editable); one that agreed follows the parts. The same figures in any order give the same filing. |
| "Parent child exempt calculation" totals | Filled while empty, never locked; an entered figure is kept. |
| No totals of zeros | Parts that are all 0 do not create a total; a 0 total the tool made is removed when its parts return to 0 (except a total that feeds a carrying amount). Undo restores the filing exactly. |
| No balance-sheet totals at the opening of the previous year | Only under first-time adoption (the GR-16 opening balance sheet column); roll-forward opening balances are unaffected. |
| Rows for every reconciliation | A reconciliation shows its closing row; an opening total shows the opening rows of its parts. |
| Every error points to something editable | A rule about a table, an axis or a member points to the table; a rule on a table element to its total column; an error inside a table or cell that a **Yes/No answer** switched off points to that answer ("this answer closes it"). |
| A conditional table stays open | while it holds values, or while the statement figure that decides it is still undetermined or derived. |

**C1 — statement figures taken from their notes.** 38 links between a main-statement figure and its note, discovered from
the Ind AS business rules (14 sums over a note's columns — e.g. borrowings, PPE, investments, trade receivables, loans,
provisions, share capital — 21 note rows and 3 note columns) and checked on both MCA-validated instances (**0
differences**). On the statements such a figure is read-only and follows its note (**Go to note ›** opens it); while the
note is empty, **Nil** reports a nil balance from the statement. A figure that was entered or imported and differs from
its note is kept and stays editable (the MCA rule reports the difference); it follows the note once it agrees.
"Allow editing of calculated cells" still allows a manual figure. Because the inventories, trade-receivables and other
figures now come from their notes, **removing a note's total column no longer removes the balance-sheet figure** (the
total column of a note shows the statement figure; v1.1 lowered *Current assets*).

**C2 — validation messages in a separate window.** Validation → **Open in separate window ↗**: the messages in a pop-up
window (for a second screen) with the error / warning / review / all filters; clicking a message opens its cell in the
main window; the list is marked out of date when the filing changes; **Validate again** refreshes it. Pop-ups must be
allowed for the page.

**C3 — larger, resizable tables.** Drag the bottom-right corner of a tab's or table's grid to make it larger or smaller
(desktop). The size is kept per tab / table in this browser; **Reset table size** forgets it. Nothing of the filing is
stored with it.

**C4 — copy from previous year on the disclosure tabs.** The disclosure tabs [700300]–[700700] (general information,
auditors' report, signatories, directors' report, secretarial audit report) are filed for the current year only
(the Ind AS rule on previous-year ELRs), so their "previous year" is last year's filing: import last year's XML with
**Roll forward to the next year** (since v1.3: **Prepare next year's filing**), open a disclosure tab and click **Copy from previous year (n)** — on the tab or in
one of its tables. Values are copied only into **empty** current-year cells, Yes/No answers first (they open the cells
that depend on them), through the normal entry path. **Not copied** (an Ind AS choice): amounts and other numbers,
dates on or after the start of last year (meeting, signing and reporting-period dates), and the elements the rule keeps
for both years (they have their own previous-year column). Validation then asks for this year's signing dates and
figures. The disclosure tabs are taken from the authority (the Disclosures group, current year only); the tables of
other tabs keep their own "Copy from previous year" (columns and values of the previous-year column).

**Assurance** (`assurance.mjs`) is now **0 on every count** on both instances: re-key in three orders — 0 values
differing, 0 extra, 0 facts without a cell, 0 errors (reference instance B: 10 imported OCI zeros under a "No" answer are kept and cannot be
typed, by design); 60 mistakes — 0 unreachable errors, 0 inexact undos; 0 locked cells that are empty or show another
value; 13,608 rule locations, 0 missing. A 600-mistake sweep with another seed: 0 / 0 / 0. `ASSURANCE_BASELINE.json`
records the new ceilings and the target tests are strict.

Changed: `compile.mjs`, `dts.mjs`, `rules.js` (calibration only), `GOLDEN_CALIBRATION.json`,
`APPROVED_LIMITATIONS.json`, `MCA_AUTHORITY.json`, `BUSINESS_RULE_COVERAGE.json`, `session.js`, `applicability.js`
(table "open" rules), `gate.js` (error locations), `views.js` (rows), `expr.js` (export), `carry-forward.js`
(disclosures), `app.js`, `styles.css`, `shell.html`, `assurance.mjs`, `ASSURANCE_BASELINE.json`; new `derived.js`.
Tests: `decisions-v12.test.mjs`, `statement-notes.test.mjs`, `v12-rules.test.mjs`, `disclosure-carry.test.mjs`
(new); `workbench.test.mjs`, `removeslice-recalc.test.mjs`, `taxonomy.test.mjs`, `io.test.mjs`, `golden.test.mjs`,
`assurance.test.mjs` updated for the rules above; 15 new browser checks (`browser-smoke.mjs`: 107 with one MCA instance present, 116 with both).

## v1.1 — the six defects shared with C&I v14.2, the assurance harness

Architecture unchanged: the taxonomy, dimensions, calculation and formula linkbases, MCA business rules, rule engine
logic, applicability decisions and XML generator are untouched; the generated XML of both MCA-validated instances
(reference instance A (2022-23), reference instance B (2024-25)) is byte-identical to v1, also after an import through the screen.
New behaviour sits in the UI and acts through the Session's normal entry path.

| # | Change | How it works |
|---|---|---|
| 1 | **Dates are typed day first** (C&I v14.2) | The browser's own date field follows the browser's language: a browser set to English (United States) stored 05/09/2026 as **9 May**. Every date cell and the four period dates on the company page are now a **dd-mm-yyyy** text field with a 📅 calendar button (`dates.js`): `-` `/` `.` or a space as separator, `ddmmyyyy`, and `yyyy-mm-dd` as it is; an impossible date (31-02-2026) is refused with a day-first hint; the date is confirmed in words ("Date entered: 5 September 2026") and shown in words on hover. The XML still holds `yyyy-mm-dd` (xs:date). **Re-check dates entered in v1 in a browser set to English (United States).** |
| 2 | **Text blocks print tidily in the MCA PDF** (C&I v14.1) | The MCA PDF prints bold / italic / underline as white text on a grey box (highlightedText1/2/3), `header2` at 18 pt and every blank line as a large gap. New setting (default for new filings): **plain text, whole bold lines become headings** (`header5`). `richtext.js tidy` / `layoutReport`; the editor shows the text as the MCA PDF prints it, a status line lists what would print untidily, **Tidy** fixes it, **H** makes a heading; Word pastes are tidied automatically (empty paragraphs and empty table columns / rows removed). B / I / U (and Ctrl+B/I/U) are used only with the MCA highlight setting. A project saved in v1 keeps its setting (highlight); an imported instance whose text blocks use highlight classes keeps highlight. |
| 3 | **Dark mode** | Mandatory, error and refused cells, Yes/No dropdowns **and their opened lists**, and error messages keep a contrast of at least 4.5 in dark and light mode (measured in the browser test). The open list of a dropdown had no colour of its own and was painted by the operating system. |
| 4 | **Opening values without totals** (C&I v13.2, adapted to GR-16) | In Ind AS, GR-1 checks values at the opening of the previous year only under first-time adoption. The message now says it is a previous-year opening value and gives its date; clicking it opens the cell that shows it — the **opening balance sheet column** (GR-16) or the "at beginning of period" row of the previous year; a value no tab shows offers to remove it. **Validation → Remove opening values without totals** removes only opening values whose total has **no cell** for that date (a dead end) — never a value of the GR-16 opening balance sheet column, never a value whose total can be entered. |
| 5 | **Removing a note column re-derives what was calculated from it** (C&I v13.1) | `Session.removeSlice` treats the removal as an edit of each cell: e.g. removing a note column now lowers the totals that were calculated from it (v1 kept the old sum; since v1.2 a note's total column shows the statement figure itself, which is kept). **Health check** on opening a project, restoring it in the browser and importing XML: a value the tool calculated itself that no longer equals its parts is recalculated (`Session.refreshCalculatedCells`); entered, imported and manual figures are never changed, nothing is deleted, and the message says what changed. |
| 6 | **Typing the same value again** no longer marks the filing as changed (nor discards the last validation). | |

Also: the Yes/No dependency test (`workbench.test.mjs`) failed since v1. Cause: the v1 rule that keeps reference instance B's OCI zeros
(`Applicability.sourceZeroStatement`) kept every imported numeric zero under a "No" answer, e.g. *number of subsidiary
companies = 0* while *Whether company has subsidiary companies* is No. It now keeps only monetary zeros of the main
statements (balance sheet, profit and loss, cash flow), which is what reference instance B needs; both instances' XML is unchanged.

**Assurance harness** (`assurance.mjs`, `assurance.test.mjs`, from C&I v12): on every MCA-validated instance —
re-key every fact through the screen in three orders; 60 mistakes through the screen (each error must point to a cell
the user can open; typing the original back must restore the filing exactly); every locked cell shows its calculation;
every element of every executable rule locates to a cell or table (13,608 checks: **0 missing**). The other counts are
not yet 0 — the v12 rules (handoff section B) are v1.2 — and are recorded as ceilings in `ASSURANCE_BASELINE.json`: a
version that makes any of them worse fails the tests; v1.2 must bring them to 0 (the "todo" tests). Measured on v1 and
v1.1 alike: reference instance A — 115 accepted facts without a screen cell, ~20 errors after re-keying, 6 unreachable errors in 60
mistakes, 398 locked-and-empty cells; reference instance B — 7 facts without a cell, 28 errors after re-keying (4 of them the standing
SR-L1097-1 / SR-L1304-1), 1 undo not exact, 324 locked-and-empty cells.

Tests: `dates.test.mjs`, `text-tidy.test.mjs`, `opening-values.test.mjs`, `removeslice-recalc.test.mjs`,
`assurance.test.mjs`; 17 new browser checks (`browser-smoke.mjs`, 93 in all).

## Authority inputs

| Input | File |
|---|---|
| Taxonomy Ind AS V1.2 (entry point `in-ci-ent-2017-03-31.xsd`: ind-as + in-ca) | `Taxonomy_for_IND-AS_V1.2_31-03-2017.zip` (kept zipped; unpacked to `.taxonomy/` by `npm run compile`) |
| Business rules Ind AS V1.2 (all 10 sheets) | `Business_Rules_IndAS_Taxonomy_V1.2.xlsx` |
| Filing Manual Ind AS V1.0 | `Filing_Manual_IndAS_V1.0.pdf` |
| MCA-validated reference instances (kept out of the published repository) | `golden-ref-a-2022-23.xml` (standalone, FY 2022-23), `golden-ref-b-2024-25.xml` (FY 2024-25); more as `golden-<name>.xml` (+ optional `golden-<name>.pdf`) |
| Calibration against validated instances | `GOLDEN_CALIBRATION.json` (element-level warnings, with evidence; since v1.5.4 also elements the MCA validator requires for at least one row of a table) |

schemaRef `http://www.mca.gov.in/XBRL/2017/07/16/Taxonomy/Ind/in-ci-ent-2017-03-31.xsd`, identifier scheme
`http://www.mca.gov.in/CIN` (Filing Manual §1.1.3.1).

## Run

```
npm ci
pip install -r requirements.txt   # Arelle — offline XML Schema / XBRL 2.1 / Dimensions / Formula validator (tests, release gate)
npm run release                   # compile → tests → rule audit → build → release gate
```

| Stage | Command | What it does |
|---|---|---|
| authority compile | `npm run compile` | DTS from the entry point (5,647 concepts, 60 ELRs, 175 tables, 71 notAll, 70 defaults, 98 typed axes, 1,269 calculation arcs, 36 formula assertions) + the rule workbook → `MCA_AUTHORITY.json`, `BUSINESS_RULE_COVERAGE.json` |
| unit tests | `npm run test:unit` | taxonomy counts against the raw files, dimensions, typed members, rule corpus, rule engine, hand tests for every rule family, the rule-by-rule audit, calculations, roll-forwards, scaling/decimals/units, applicability, rich text, import modes, workbench, copy from previous year, footnotes, column guidance |
| gate tests | `npm run test:gate` | importer / generator / internal gate, Filing Manual technical specifications |
| Arelle | `npm run test:xsd` | generated instances (example, consolidated, first year, first-time adoption) validated offline by Arelle incl. the formula linkbase; Arelle's formula results cross-checked against the FX-* rules |
| golden | `npm run test:golden` | every `golden-*.xml`: import → 0 gate errors → regenerate → independent fact-level diff (`golden-diff.mjs`) → every fact reachable in the UI → edit round trip (+ PDF cross-check when supplied) |
| rule audit | `npm run audit` | `RULE_AUDIT.json`: for every executable rule a compliant filing (PASS) and a one-mutation violating filing (FAIL), each checked by running only that rule through the production engine |
| build | `npm run build` | `index.html` (= `indas-xbrl.html`): the single-file app with the compiled authority embedded |
| release gate | `node release-gate.mjs` | all of the above + build integrity + headless-browser UI regression → `RELEASE_REPORT.json` |

## What the app does

* **Statements and notes** for all 60 ELRs; tables show their rows and a *total* column (every axis at its default member), rendered from the taxonomy (presentation, tables, axes, members, typed axes,
  notAll exclusions, defaults). Current / previous year; **first-time adoption** adds the opening balance sheet of the
  previous year (third balance-sheet column, GR-16 / Annexure II #21).
* **Mandatory marking:** fields the MCA business rules require are tagged *Mandatory* (live: conditions such as "mandatory if Yes" or "mandatory for consolidated" are evaluated as you type), conditional ones *Conditional*; table line items show *Mandatory · every row* / *one complete row* / *one of these*; empty mandatory cells are outlined; hover a tag for the rule text. The taxonomy itself declares no element mandatory.
* **Auto-calculation:** totals from the calculation linkbase (read-only, per-tab override, cascading), roll-forwards
  from the formula linkbase (closing = opening + changes: PPE, intangibles, goodwill, investment property, share capital,
  other equity, cash, provisions, …), opening of the current year = closing of the previous year (one fact).
  **Mismatches** panel: every calculated-vs-reported difference and every manual override, with jump-to-cell.
* **Validation:** internal gate (Filing Manual technical specifications, contexts, units, decimals, dimensions,
  calculations) + every executable MCA rule (specific, generic GR-1…GR-16, mandatory line items, formula FX-*,
  Annexure II FM-9/14/15/16). Results carry their location (tab, table, year, cell); click to jump. Validate the
  current tab or the whole filing; XML generation always validates the whole filing and is blocked on any error.
* **Applicability** (one decision for UI, import, validation and XML): standalone / consolidated ELRs (GR-10, GR-12,
  GR-13), previous-year exclusions (GR-11), cash-flow method (direct [310000] / indirect [320000]), Yes/No dependencies
  from the MCA conditional rules (Yes → No asks first; values kept but excluded), conditional tables.
* **Usability (display only — no filing semantics):** column headings and the row-label column stay in view (the grid
  scrolls in its own box); alternate-row shading and row highlight on hover/focus; **Enter / Shift+Enter** (and ↑/↓ in
  text cells and on Text Block buttons) move to the same column of the next/previous editable row; **Ctrl+S** saves in
  the browser now (the bar shows *Saved hh:mm*); dialogs: **Esc** cancels, **Tab** stays inside, **Ctrl+Enter** saves a
  text block, confirmations start on Cancel and focus returns afterwards; grid cells have accessible names (row —
  column), `aria-required` on mandatory cells and `aria-invalid` on cells with errors; "Skip to the sheet" link;
  *New filing* and removing a table row that holds values ask first; a Text Block button shows ⚠ and its issue count
  after validation, and the editor lists that text block's issues (last validation + the gate's HTML check).
* **Copy from previous year** (current-year dimensional tables, toolbar button): adds the previous-year columns the table
  does not have yet and copies their values into empty cells. Nothing entered is overwritten, calculated cells are left
  to the calculation, and every copy goes through the same checks as typing. The confirmation states the counts first.
* **Footnotes** (Filing › Footnotes): write the text, choose a cell from the list and link it — or click a cell and press
  **Alt+N** (v1.4); cells with footnotes show an *fn* mark. Footnotes are written to
  the XML with their linked cells only; an unlinked footnote is flagged here instead of silently disappearing.
* **Preview PDF** (Generate XML; v1.4): a printable preview laid out like the MCA PDF (measured on reference instance B
  2024-25) — not the MCA rendering.
* **Fill empty totals** and **Recalculate current year** (v1.4): explicit actions that show the changes first.
* **Column guidance** (tool guidance, not MCA rules): total columns sit before their parts, TOTAL / *part of …* badges,
  *Needs … column (FM-14)* prompts, and a warning under a total that differs from its parts on the axes the MCA business
  rules add up.
* **Import:** preview first, then *Both years* or *Prepare next year's filing* (last year's filing becomes the locked
  previous year of the next filing; v1.3). Projects made with the older *Current year only* / *Roll forward* modes
  still open. Cash-flow method from the XML or
  chosen. Non-applicable facts go to the import report, not into the filing.
* **Rich text:** Text Block popup editor; stored in the Filing Manual HTML subset (highlightedText / noteText classes).
  Pasted Word/Excel tables are rebuilt for the MCA Validator's HTML schema: no colgroup/col/caption, no
  colspan/rowspan (a merged cell's text goes into the column that holds the table's text, the rest become empty cells,
  every row the same number of cells — v1.5.3), `tbody` around rows, only the
  `class` attribute, number padding (&nbsp; right-alignment that widens columns until the MCA PDF cuts them) and
  empty paragraphs removed; pasted cells get `class="bordered"`, ▦ toggles borders for the table at the cursor; a
  filing-wide option saves bold/italic/underline as plain text instead of highlightedText (shaded in the MCA PDF).
  Since v1.5.3: a **Paragraph style** list (Normal text, Heading 1–5 → header1–5); numbered and bulleted lists both as
  noteText1 (the MCA PDF prints noteText2 bold in a grey box); Tidy keeps chosen heading levels and moves the long texts
  of a flattened Word table into one column.
  The gate blocks schema-rejected HTML and XML-illegal control characters (e.g. a Word line break) before generation.
* **xml:lang** (Filing Manual #28) only on `xbrli:stringItemType` / `nonnum:textBlockItemType`: the in-ca restricted
  types (PAN, CIN, DIN, SRN, ITC codes, drop-down lists) forbid the attribute (#29 schema validity; MCA Validator
  `cvc-complex-type.3.2.2`).
* **Build id** in the header and in the first comment of every generated XML (`<!-- Generated by Ind AS XBRL Studio
  build … -->`): a different id in an XML means a cached page — press Ctrl+F5 and generate again.
* **MCA error help** tab: paste the MCA Validator's error list; each message is explained (meaning, likely cause, fix in
  this tool), identical messages grouped, element names link to the cell; includes a guide to reading validator messages.
* **Entry scale:** Actual, Hundreds, Thousands, Lakhs, Millions, Crores, Billions; the XML carries rupees with matching
  `decimals` (non-significant digits always 0).
* Autosave in the browser, project file save/open, example filing (clearly marked), rule coverage viewer.

## Status semantics

* **Internal gate** (in app): pass / errors. Generation is blocked on any error.
* **Official MCA validation:** always shown as *not run*. Only the MCA XBRL Validation Tool (Ind AS) can change that.
* Arelle (tests) is not the MCA tool and does not run MCA business rules.

## Rule coverage and audit

1,541 ledger entries (one status per clause): EXECUTABLE 1,462 · REVIEW_ONLY_EXTERNAL_DATA 60 (MCA21 master data,
ICAI/ICSI databases, the other instance document — never auto-passed) · NOT_APPLICABLE 18 · UNIMPLEMENTED 1 (`ML-43-b`).
Rule-by-rule audit: 1,114 rules VERIFIED (engine accepted a compliant filing and rejected a violating one), 35 covered by
named hand tests (`rule-families.test.mjs`), 313 data rows consumed by generic rules. See `AUDIT_REPORT.md`.

## Known limitations

1. **`ML-43-b` UNIMPLEMENTED** — Mandatory Line Items row 46 ([610800] related parties): "In
   OutstandingBalancesForRelatedPartyTransactionsAbstract- Element for amount shall be mandatory for various transactions"
   does not identify the required elements. **Approved by the release owner (2026-10-03)** as a known limitation: shown
   as **APPROVED LIMITATION / NOT EXECUTED** (warning), never as a pass. The rest of that row (`ML-43`) is executed.
   Revisit if MCA clarifies the clause.
2. **Golden regression** runs on `golden-ref-a-2022-23.xml` (MCA-validated) and
   `golden-ref-b-2024-25.xml` (MCA-validated): 0 gate errors, regenerated XML identical fact for fact (reference instance A:
   Arelle PASS incl. formulas). Calibrated in `GOLDEN_CALIBRATION.json`: two V1.2 mandatory line items the validated
   instance omits (warnings), and since v1.2 SR-L1097-1 / SR-L1304-1 (warnings while PPE / intangibles are nil or absent —
   decision of the release owner). ⚠ **Keep the golden files out of the published repository.**
3. Annexure II #14/#15 for non-numeric elements are warnings; FX-* (formula linkbase) are blocking errors as listed in
   the Filing Manual (#19, missing item = 0).
4. Rules needing data outside the instance are review-only. Official MCA validation: **NOT RUN**. GitHub Pages smoke test
   of the deployed site: **NOT RUN** (`browser-smoke.mjs` runs the same checks on the built `index.html`).
5. **Copy from previous year in a table and column guidance** are unit-tested and built into `index.html`, but
   `browser-smoke.mjs` has no checks of their own yet (the disclosure-tab copy and, since v1.4, footnotes have).
6. **Preview PDF** imitates the MCA PDF's layout as measured on MCA PDFs of the reference instances (since v1.5 also a
   standalone and a consolidated one); it is not the MCA rendering, and page breaks and column widths differ.
7. **Golden files since v1.5** also include `golden-ref-c-standalone-2024-25.xml` / `.pdf` and
   `golden-ref-c-consolidated-2024-25.xml` / `.pdf` (MCA-validated — keep them out of the published repository, like the
   others). The consolidated one breaks SR-L663-1 itself (shareholders above 100%): the tests expect that error
   (`FILED_DATA_ERRORS` in `golden.test.mjs`, `knownDataErrors` in `ASSURANCE_BASELINE.json`).

## Build note

`npm run build` bundles the app with esbuild into `index.html` (GitHub Pages entry point), `indas-xbrl.html` and
`artifact.html`, and writes `BUILD_INFO.json`. The v1.1–v1.5 `index.html` were built with **esbuild 0.28.2** (the version
installed in the environment that produced the package; `package-lock.json` pins 0.24.2) — a real esbuild build, unlike
v1's stand-in bundler. Rebuilding with `npm run build` after `npm ci` gives the pinned version.

## Files

| Role | Files |
|---|---|
| Authority compiler | `compile.mjs`, `taxonomy-source.mjs`, `dts.mjs`, `tables.mjs`, `formula-source.mjs`, `rules-source.mjs`, `rule-formalizer.mjs`, `rule-indas.mjs` |
| Runtime engines | `member-hints.js`, `carry-forward.js`, `derived.js`, `upkeep.js`, `fixes.js`, `totals-fill.js`, `pdf-preview.js`, `footnotes.js`, `authority.js`, `dimensions.js`, `calculation.js`, `rules.js`, `expr.js`, `applicability.js`, `model.js`, `periods.js`, `scaling.js`, `units.js`, `decimal.js`, `importer.js`, `generator.js` (only XML writer), `gate.js`, `views.js`, `session.js` |
| UI | `app.js`, `richtext.js`, `dates.js`, `mca-errors.js`, `example.js`, `shell.html`, `styles.css`, built `index.html` / `indas-xbrl.html` |
| Build / release / audit | `build.mjs`, `release-gate.mjs`, `rule-audit.mjs`, `audit.mjs`, `xsd-validate.mjs`, `browser-smoke.mjs`, `golden-diff.mjs`, `assurance.mjs`, `ASSURANCE_BASELINE.json`, `requirements.txt`, `APPROVED_LIMITATIONS.json`, `GOLDEN_CALIBRATION.json`, `AUDIT_REPORT.md` |
| Tests | `*.test.mjs`, `helpers.mjs`, `fixtures.mjs` |

Generated (git-ignored): `.taxonomy/`, `node_modules/`, `MCA_AUTHORITY.json`, `BUSINESS_RULE_COVERAGE.json`,
`RULE_AUDIT.json`, `RELEASE_REPORT.json`, `BUILD_INFO.json`, `artifact.html`.
