// v1.2 (C&I v13): "Copy from previous year" on the disclosure tabs [700300]–[700700] (current year only — the Ind AS
// generic rule on previous-year ELRs). Last year's values come from an import as "Roll forward to the next year" (kept
// in the import report as not applicable for the previous year) or from previous-year values in the project.
// Runs on every MCA-validated instance present (golden-*.xml, kept out of the published repository).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import { authority, q } from './helpers.mjs';
import { Session } from './session.js';
import { disclosureCarryPlan, disclosureCarry, previousYearValues, disclosureTab } from './carry-forward.js';

const A = authority();
const DIR = new URL('./', import.meta.url);
const goldens = readdirSync(DIR).filter((f) => /^golden-.*\.xml$/.test(f));
const discs = A.elrs.filter((e) => disclosureTab(A, e.uri));
const errors = (S) => S.validate({ today: '2026-09-30' }).issues.filter((i) => i.severity === 'ERROR').length;
const load = (g, yearMode) => { const S = new Session(A); S.importXml(readFileSync(new URL(g, DIR), 'utf8'), { DOMParserImpl: DOMParser, yearMode }); return S; };

test('the disclosure tabs come from the authority: the Disclosures group, current year only', () => {
  assert.deepEqual(discs.map((e) => e.code), ['700300', '700400', '700500', '700600', '700700']);
  for (const e of A.elrs.filter((x) => x.group !== 'Disclosures')) assert.equal(disclosureTab(A, e.uri), false, e.code);
});

for (const g of goldens) {
  test(`${g}: rolled forward — last year's disclosures are copied into empty current-year cells only`, () => {
    const S = load(g, 'rollforward');
    assert.ok(previousYearValues(S).size > 0);
    const before = errors(S);
    let copied = 0;
    for (const e of discs) {
      if (!S.elrStatus(e.uri, 'CY').applicable) { assert.equal(disclosureCarryPlan(S, e.uri).available, false); continue; } // e.g. not part of a consolidated filing
      const plan = disclosureCarryPlan(S, e.uri);
      assert.ok(plan.available, plan.reason);
      const r = disclosureCarry(S, e.uri);
      for (const s of r.skipped) assert.match(s.reason, /not applicable/, `${e.code} ${s.concept}`); // an answer copied first closed it
      copied += r.copied;
      assert.equal(disclosureCarryPlan(S, e.uri).items.length, 0, 'nothing left to copy');
    }
    assert.ok(copied > (S.filing.meta.reportType === 'Consolidated' ? 20 : 50), String(copied)); // a consolidated filing has fewer disclosures
    // the copied values are last year's current-year values
    const G = load(g, 'both');
    for (const l of ['NameOfCompany', 'CorporateIdentityNumber', 'WhetherCompanyIsListedCompany', 'NameOfAuditFirm']) {
      const c = A.qnameOfLocal(l);
      if (!c) continue;
      const v = S.getValue(c, 'CY'), w = G.getValue(c, 'CY');
      if (w && G.conceptStatus(c, 'CY').applicable && S.conceptStatus(c, 'CY').applicable) assert.equal(v?.value, w.value, l);
    }
    // amounts and this year's dates are never copied
    const P = S.filing.meta.periods;
    for (const f of S.filing.all()) {
      if (S.filing.scopeOf(f.period) !== 'CY' || f.origin === 'import' || !discs.some((e) => A.conceptElrs(f.concept).includes(e.uri))) continue;
      assert.ok(!A.isNumeric(f.concept), `${f.concept} is a number`);
      if (A.dataType(f.concept) === 'date') assert.ok(f.value < P.py.start, `${f.concept} ${f.value}`);
    }
    assert.ok(errors(S) <= before, 'copying never adds errors overall');
  });
}

test('existing current-year values are never overwritten; other tabs are not offered', { skip: !goldens.length }, () => {
  const S = load(goldens[0], 'rollforward');
  const gi = discs.find((e) => e.code === '700300').uri;
  const plan = disclosureCarryPlan(S, gi);
  const row = plan.items.find((i) => i.kind === 'row' && A.dataType(i.concept) === 'string');
  S.setValue(row.concept, 'CY', 'MY OWN VALUE', { tab: gi, preferredLabel: row.preferredLabel });
  disclosureCarry(S, gi);
  assert.equal(S.getValue(row.concept, 'CY', [], row.preferredLabel).value, 'MY OWN VALUE');
  assert.equal(disclosureCarryPlan(S, A.elrs.find((e) => e.code === '110000').uri).available, false);
});

test('a filing without last year\'s values offers nothing (with the reason)', { skip: !goldens.length }, () => {
  const S = load(goldens[0], 'both');
  for (const e of discs) {
    const p = disclosureCarryPlan(S, e.uri);
    assert.equal(p.items.length, 0, e.code);
    assert.ok(p.reason);
  }
});
