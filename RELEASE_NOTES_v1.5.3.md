# INDAS XBRL Tool v1.5.3 — release notes

Base: v1.5.2. Reported with the MCA PDF of a filing: the text of a table is cut off at the right edge of the page,
bulleted lists print in a grey box, and a heading level cannot be chosen. Only the text editor, Tidy and the health
check changed; taxonomy, rules, engines and the XML writer are as in v1.5.2. Details: README, section "v1.5.3".

## What changed

| Reported | Cause | In v1.5.3 |
|---|---|---|
| Table text cut off at the right edge | A Word table with merged cells (e.g. an audit-report annexure with clause numbers "(i) \| (a) \| (A) \| text"). The MCA HTML has no merged cells; the tool left a merged cell's text in the first column of the merge, so the long texts were spread over four columns. The MCA PDF does not shrink a table to the page, so the table ran off it | A merged cell's text goes into the column that holds the table's text. **Tidy** repairs tables already in a project: long texts go into one column, empty columns are removed. The editor's status line points out such tables |
| Bulleted lists in a grey box | Bulleted lists were saved with the MCA class `noteText2`, which the MCA PDF prints bold in a grey dotted box | Bulleted lists use `noteText1`, like numbered lists (normal, indented text). Opening a project converts existing bulleted lists |
| Heading level | Only Heading 5 | **Paragraph style** list in the editor toolbar: Normal text, Heading 1–5 (MCA classes header1–header5). Bold lines pasted from Word still become Heading 5; Tidy keeps the levels you set |

Justified text: not changed, as you chose — the MCA HTML rules have no alignment setting; the MCA PDF lays out the text
itself.

## Files

New: `audit-v153.test.mjs`, `RELEASE_NOTES_v1.5.3.md`.

Changed: `richtext.js`, `upkeep.js`, `app.js`, `styles.css`, `shell.html`, `package.json`, `README.md`,
`richtext.test.mjs`, `text-tidy.test.mjs`, `browser-smoke.mjs`, and the generated `index.html`, `indas-xbrl.html`,
`artifact.html`, `BUILD_INFO.json`.

## Your existing project files

1. Open the project as usual. The health check converts bulleted lists to the plain style and says in how many text
   blocks.
2. Open each text block with a table that was cut off (e.g. the annexure to the auditor's report) and press **Tidy**. The
   message says how many texts were moved and how many empty columns were removed.
3. Where a heading should be larger or smaller, put the cursor on it and choose the level in **Paragraph style**.
4. Generate the XML again.

## Tests

| Suite | Result |
|---|---|
| Your project (opened with v1.5.3) | bulleted lists converted in 3 text blocks, no grey-box class left; auditor's report annexure: Tidy moved 45 texts into the text column and removed 2 empty columns — no table with long text spread over several columns remains |
| Unit (`npm run test:unit`) | 269 / 269 (5 new in `audit-v153.test.mjs`) |
| Gate / Golden / Assurance | 11 / 11, 35 / 35, 37 / 37 |
| Browser (`browser-smoke.mjs`) | 176 / 176 (Paragraph style, heading class in the XML, bullets as noteText1) |
| Reference instances' XML | byte-identical to v1.5.2 (all four, direct and through the health check) |
| Clean unzip of the package (no golden files) | recompiles the authority identically, builds the same `index.html`; unit 232 / 232 (9 golden-only skipped), gate 10 / 10 (1 golden-only skipped), browser 127 / 127 |

## Not run here

- The MCA validator and its PDF on an XML from v1.5.3 (the real check that the table now fits the page).
- As before: `npm ci` with the pinned packages, the real XML parser, `xsd.test.mjs` / Arelle, the deployed site.

## Manual check (10 minutes)

1. The title reads **INDAS XBRL Tool v1.5.3**.
2. Open your project: the health-check message says bulleted lists were converted.
3. Open a text block with a bulleted list: the list looks as before in the editor.
4. Open the auditor's report annexure text block; the status line names the wide table. Press **Tidy**: the message gives
   the texts moved and the empty columns removed; the clause texts now sit in one column.
5. Put the cursor on a heading, choose **Heading 3** in Paragraph style: the line grows; choose **Normal text**: it is
   plain again. The list shows the style of the line under the cursor.
6. Press **Tidy** again: the levels you chose stay.
7. Save Text, generate the XML, validate it with the MCA validator and open its PDF: tables inside the page, bulleted
   lists without the grey box, headings at the chosen sizes.
