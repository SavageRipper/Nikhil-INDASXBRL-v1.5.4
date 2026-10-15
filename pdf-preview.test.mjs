// v1.4: printable preview (pdf-preview.js) — display only; compared with the MCA validator's PDF of reference instance B
// 2024-25 (golden-ref-b-2024-25.pdf, kept out of the published repository; skipped when absent).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { DOMParser } from '@xmldom/xmldom';
import { authority, q } from './helpers.mjs';
import { baseSession, exampleSession } from './fixtures.mjs';
import { Session } from './session.js';
import { buildPreviewHtml, groupIN, formatValue, sectionOrder, SECTION_ORDER } from './pdf-preview.js';
import { addFootnote, linkFootnote } from './footnotes.js';

globalThis.DOMParser ||= DOMParser;
const A = authority();
const REFB = new URL('golden-ref-b-2024-25.xml', import.meta.url), REFBPDF = new URL('golden-ref-b-2024-25.pdf', import.meta.url);
const load = () => { const S = new Session(A); S.importXml(readFileSync(REFB, 'utf8'), { yearMode: 'both', DOMParserImpl: DOMParser }); return S; };
const pdfText = () => { try { return execFileSync('pdftotext', ['-layout', REFBPDF.pathname, '-'], { encoding: 'utf8', maxBuffer: 64e6 }); } catch { return null; } };
const haveRefB = existsSync(REFB);

test('number formats as in the MCA PDF: Indian grouping, Yes/No, dd/mm/yyyy', () => {
  assert.equal(groupIN('1000000'), '10,00,000');
  assert.equal(groupIN('-15289.49'), '-15,289.49');
  assert.equal(groupIN('703.64'), '703.64');
  const S = exampleSession();
  const d = S.getValue(q('DateOfEndOfReportingPeriod'), 'CY');
  if (d) assert.match(formatValue(S, d), /^\d{2}\/\d{2}\/\d{4}$/);
});

test('section order: the MCA PDF order; every taxonomy section placed once', () => {
  const order = sectionOrder(A).map((e) => e.code);
  assert.equal(order.length, A.elrs.length);
  assert.equal(new Set(order).size, order.length);
  assert.deepEqual(order.filter((c) => SECTION_ORDER.includes(c)), SECTION_ORDER);
  assert.ok(order.indexOf('210000a') === order.indexOf('210000') + 1);
});

test('reference instance B: the same sections, in the same order, as the MCA PDF; every balance-sheet value appears', { skip: !haveRefB }, () => {
  const S = load();
  const html = buildPreviewHtml(S, { build: 'test' });
  assert.match(html, /not the MCA rendering/);
  const name = /<in-ca:NameOfCompany[^>]*>([^<]+)</.exec(readFileSync(REFB, 'utf8'))?.[1];
  assert.ok(name && html.includes(name.replace(/&/g, '&amp;')), 'the company name from the instance');
  assert.match(html, /Standalone Financial Statements for period 01\/04\/2024 to 31\/03\/2025/);
  assert.match(html, /all monetary values are in Thousands of INR/);
  assert.ok(!/<h2>\[310000\]/.test(html), 'cash flow (direct) is not part of this filing');
  const text = existsSync(REFBPDF) ? pdfText() : null;
  if (!text) return;
  const seq = (s, re) => { const out = []; for (const m of s.matchAll(re)) if (!out.includes(m[1])) out.push(m[1]); return out; };
  assert.deepEqual(seq(html, /<h2>\[([0-9]{6}[a-z]?)\]/g), seq(text, /^ +\[([0-9]{6}[a-z]?)\] /gm));
  const bs = text.split('[110000] Balance sheet')[1].split('[210000]')[0];
  let n = 0;
  for (const m of bs.matchAll(/ {2,}(-?[\d,]+(?:\.\d+)?) {2,}(-?[\d,]+(?:\.\d+)?)(?: {2,}(-?[\d,]+(?:\.\d+)?))?\s*$/gm)) {
    for (const v of [m[1], m[2], m[3]].filter(Boolean)) assert.ok(html.includes(`>${v}<`), `${v} in ${m[0].trim()}`);
    n++;
  }
  assert.ok(n >= 30, `${n} balance-sheet lines compared`);
  // the third balance-sheet column of the MCA PDF (31/03/2023: share capital's opening balance)
  const sheet = html.split('<h2>[110000]')[1].split('</section>')[0];
  assert.match(sheet, /<th>31\/03\/2023<\/th>/);
  // footnotes as in the MCA PDF: "(A) value" in the cell and a Footnotes list
  assert.match(html, />\(A\) -?[\d,.]+</);
  assert.match(html, /<div class="fnh">Footnotes<\/div><div>\(A\) \S/);
  assert.match(html, /Textual information \(1\)<br>\[See below\]/);
});

test('text blocks are rendered from the MCA-subset markup only (no scripts or styles from the source)', () => {
  const s = baseSession();
  const tb = A.elrs.flatMap((e) => s.elrView(e.uri).rows.filter((r) => r.kind === 'item' && A.dataType(r.concept) === 'textBlock' && s.conceptStatus(r.concept, 'CY').applicable && s.cellStatus(e.uri, r.concept, 'CY').applicable).map((r) => ({ e, r })))[0];
  s.setValue(tb.r.concept, 'CY', '<p>Hello</p><script>alert(1)</script><p style="color:red" onclick="x()">World</p><table><tr><td class="bordered">1</td></tr></table>', { tab: tb.e.uri });
  const html = buildPreviewHtml(s);
  const i = html.indexOf(`<div class="til">${tb.r.label.replace(/&/g, '&amp;')}</div>`);
  assert.ok(i > 0, 'text block shown as Textual information');
  const block = html.slice(i, html.indexOf('</div></div>', i));
  assert.ok(!/<script|onclick=|style=/.test(block), block);
  assert.match(block, /<p>Hello<\/p>/);
});

test('a footnote linked to a cell shows as "(A) value" and in the Footnotes list after its block', () => {
  const s = exampleSession();
  const f = s.getValue(q('TradeReceivablesCurrent'), 'CY');
  const id = addFootnote(s.filing, 'Net of allowance', []);
  linkFootnote(s.filing, id.id ?? id, f.key);
  const html = buildPreviewHtml(s);
  assert.match(html, /\(A\) [\d,]+</);
  assert.match(html, /<div class="fnh">Footnotes<\/div><div>\(A\) Net of allowance<\/div>/);
});

// v1.5: the MCA PDFs of reference instance C (standalone and consolidated; kept out of the published repository,
// skipped when absent): the same sections in the same order, and every number the MCA PDF shows in a section appears in
// that section of the preview — except values the tool does not file (zeros under a "No" answer, not applicable)
for (const k of ['standalone', 'consolidated']) {
  const X = new URL(`golden-ref-c-${k}-2024-25.xml`, import.meta.url), PDF = new URL(`golden-ref-c-${k}-2024-25.pdf`, import.meta.url);
  test(`reference instance C ${k}: sections, order and values as in the MCA PDF`, { skip: !existsSync(X) || !existsSync(PDF) }, () => {
    const S = new Session(A); S.importXml(readFileSync(X, 'utf8'), { yearMode: 'both', DOMParserImpl: DOMParser });
    const html = buildPreviewHtml(S, { build: 'test' });
    let text; try { text = execFileSync('pdftotext', ['-layout', PDF.pathname, '-'], { encoding: 'utf8', maxBuffer: 64e6 }); } catch { return; }
    assert.match(html, new RegExp(`${k === 'standalone' ? 'Standalone' : 'Consolidated'} Financial Statements for period 01/04/2024 to 31/03/2025`));
    assert.match(html, /all monetary values are in Lakhs of INR/);
    const seq = (s, re) => { const out = []; for (const m of s.matchAll(re)) if (!out.includes(m[1])) out.push(m[1]); return out; };
    const codes = seq(text, /^ +\[([0-9]{6}[a-z]?)\] /gm);
    assert.deepEqual(seq(html, /<h2>\[([0-9]{6}[a-z]?)\]/g), codes);
    const miss = []; let n = 0;
    for (const code of codes) {
      const part = (text.split(new RegExp(`\\[${code}\\] `))[1]?.split(/\n +\[[0-9]{6}[a-z]?\] /)[0] || '').split('\n').filter((l) => !/^\s*\d+\s*$/.test(l)).join('\n');
      const sec = html.split(`<h2>[${code}]`)[1]?.split('</section>')[0] || '';
      for (const m of part.matchAll(/(?<![\w./-])(-?\d{1,3}(?:,\d{2,3})*(?:\.\d+)?)(?![\w/-])/g)) { if (/^\d{1,2}$/.test(m[1])) continue; n++; if (!sec.includes(m[1])) miss.push(`${code} ${m[1]}`); }
    }
    assert.ok(n > 2000, `${n} numbers compared`);
    // the capitalisation rate of borrowing costs (0.00%) is reported under "No borrowing costs capitalised": not filed
    assert.deepEqual(miss, ['612800 0.00', '612800 0.00']);
  });
}
