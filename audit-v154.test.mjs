// v1.5.4: MCA validator "All mandatory elements for table DisclosureOfDetailsOfSubsidiariesTable must be present for
// atleast one context" on a next-year filing whose current-year rows reported every element of the workbook's list
// (ML-105) — the elements the MCA validator also requires (evidence: MCA-validated filings) are now checked for at least
// one row per year; and a count in no family keeps the unit the filing already uses for it. Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { authority, q } from './helpers.mjs';
import { baseSession, runRule, placeholder, T } from './fixtures.mjs';

const A = authority();
const TID = T('DisclosureOfDetailsOfSubsidiariesTable', '611500:');
const AXIS = q('SignificantInvestmentsInSubsidiariesAxis');
const row = (v) => [{ axis: AXIS, typed: v }];
const EXTRA = ['CurrentAssetsOfSubsidiary', 'NoncurrentAssetsOfSubsidiary', 'CurrentLiabilitiesOfSubsidiary', 'NoncurrentLiabilitiesOfSubsidiary', 'RevenueOfSubsidiary', 'ComprehensiveIncomeOfSubsidiary', 'ProportionOfOwnershipInterestsHeldByNoncontrollingInterests', 'ProportionOfVotingRightsHeldByNoncontrollingInterests', 'ProfitLossAttributableToNoncontrollingInterests', 'NoncontrollingInterestsOfSubsidiary', 'DividendsPaidToNoncontrollingInterests'];
const REASON = 'DescriptionOfReasonWhyUsingDifferentReportingDateOrPeriodForSubsidiary';
const ML105 = A.rules.rules.find((r) => r.id === 'ML-105');

function fill(s, member, concepts, scope = 'CY') {
  for (const c of concepts) {
    const value = A.isNumeric(c) ? (A.dataType(c) === 'percent' ? '1' : '0') : placeholder(A, c);
    s.filing.setFact({ concept: c, period: s.filing.period(c, scope), dims: row(member), value, lang: A.isNumeric(c) || !A.langAllowed(c) ? null : 'en', origin: 'user' });
  }
}
function subsidiarySession() {
  const s = baseSession();
  s.setValue(q('WhetherCompanyHasSubsidiaryCompanies'), 'CY', 'true');
  s.setValue(q('NumberOfSubsidiaryCompanies'), 'CY', '2');
  fill(s, 'One', ML105.ast.concepts); // every element of the workbook's list (as in the reported XML)
  fill(s, 'Two', ML105.ast.concepts);
  return s;
}
const ml105 = (s) => runRule(s, 'ML-105', { scope: 'CY' }).res;

test('ML-105: the workbook list plus the elements the MCA validator requires for at least one row (compiled from GOLDEN_CALIBRATION.json)', () => {
  assert.equal(ML105.ast.tables[0], TID);
  assert.deepEqual(ML105.ast.oneRow.filter((x) => x.severity === 'ERROR').map((x) => x.concept), EXTRA.map(q));
  assert.deepEqual(ML105.ast.oneRow.filter((x) => x.severity === 'WARNING').map((x) => x.concept), [q(REASON)]);
  for (const x of ML105.ast.oneRow) assert.ok(A.table(TID).lineItems.includes(x.concept) && !ML105.ast.concepts.includes(x.concept), x.concept);
});

test('ML-105: rows with the whole workbook list but none of the further elements — blocking, as the MCA validator', () => {
  const s = subsidiarySession();
  const res = ml105(s);
  const fail = res.find((x) => x.status === 'FAIL');
  assert.ok(fail, res.map((x) => x.status + ' ' + x.message).join('\n'));
  assert.match(fail.message, /MCA validator requires \[CurrentAssetsOfSubsidiary, .*DividendsPaidToNoncontrollingInterests\] for at least one row/);
  assert.ok(res.some((x) => x.status === 'WARN' && x.message.includes(REASON)), 'the reason for a different reporting date: a warning');
  const g = s.validate({ today: '2026-10-15' });
  const issue = g.issues.find((i) => i.ruleId === 'ML-105' && i.severity === 'ERROR');
  assert.ok(issue, 'a gate error');
  assert.equal(issue.location?.tableId, TID, 'linked to the table');
});

test('ML-105: one row with every further element is enough (0 counts); the other row may leave them out', () => {
  const s = subsidiarySession();
  fill(s, 'One', EXTRA.map(q));
  let res = ml105(s);
  assert.ok(!res.some((x) => x.status === 'FAIL'), res.filter((x) => x.status === 'FAIL').map((x) => x.message).join('\n'));
  assert.ok(res.some((x) => x.status === 'WARN'), 'reason still missing: warning only');
  fill(s, 'Two', [q(REASON)]);
  res = ml105(s);
  assert.ok(!res.some((x) => x.status === 'FAIL' || x.status === 'WARN'), 'the reason may be on another row');
  // one element missing on the complete row: blocking again, naming only that element
  s.filing.removeFact(s.filing.get(q('RevenueOfSubsidiary'), s.filing.period(q('RevenueOfSubsidiary'), 'CY'), row('One')).key);
  const fail = ml105(s).find((x) => x.status === 'FAIL');
  assert.ok(fail && /requires \[RevenueOfSubsidiary\]/.test(fail.message), fail?.message);
});

test('ML-105: nothing required while the table has no rows (the table rules decide that)', () => {
  const s = baseSession();
  assert.ok(!ml105(s).some((x) => x.status === 'FAIL'));
});

test('units: a count in no family keeps the unit the filing uses for it (last year imported in INR → this year INR)', () => {
  const s = baseSession();
  const N = q('NumberOfSubsidiaryCompanies');
  assert.equal(s.filing.unitFor(N), 'pure', 'nothing reported: the default');
  s.setValue(q('WhetherCompanyHasSubsidiaryCompanies'), 'CY', 'true');
  s.filing.setFact({ concept: N, period: s.filing.period(N, 'PY'), value: '1', decimals: 'INF', unit: 'INR', origin: 'import' });
  assert.equal(s.filing.unitFor(N), 'INR');
  assert.equal(s.setValue(N, 'CY', '2').unit, 'INR');
  // a project saved before v1.5.4 (this year in pure): the health check puts it into last year's unit
  s.filing.get(N, s.filing.period(N, 'CY')).unit = 'pure';
  const changed = s.filing.harmonizeUnits();
  assert.deepEqual(changed.map((x) => [x.concept, x.before, x.after]), [[N, 'pure', 'INR']]);
  assert.equal(s.getValue(N, 'CY').value, '2');
  assert.deepEqual(s.filing.harmonizeUnits(), []);
});
