// v1.5 audit on MCA-validated reference instances (standalone + consolidated). Every fix is covered
// here with synthetic data, so these tests run without the golden files (which are kept out of the package).
import test from 'node:test';
import assert from 'node:assert/strict';
import { authority, q, importSession, XMLParser } from './helpers.mjs';
import { Session } from './session.js';
import { baseSession, exampleSession, consolidatedSession, runRule, set, T, exportUnchecked } from './fixtures.mjs';
import { sumDecimals, roundToDecimals } from './session.js';
import { fm14RequiredParent } from './rules.js';
import * as Dec from './decimal.js';

const A = authority();
const P = (v, d) => ({ value: v, decimals: d });
const X = 'AmountOfContributionsMadeToPoliticalPartyOrForPoliticalPurpose'; // outside every calculation network

test('decimals of a derived total: least accurate part, zero parts ignored, never fewer places than the statements', () => {
  // the least accurate part decides (XBRL) and the total is rounded to it (Filing Manual #13)
  assert.equal(sumDecimals([P('1234567000', '-3'), P('98765520', '-1')], Dec.parse('1333332520')), '-3');
  assert.equal(Dec.toString(roundToDecimals(Dec.parse('1333332520'), '-3')), '1333333000');
  // a part that is 0 carries no accuracy (−0.64 share options would have become −1)
  assert.equal(sumDecimals([P('0', '0'), P('-64', '2')], Dec.parse('-64')), '2');
  assert.equal(sumDecimals([P('5', 'INF')], Dec.parse('5')), 'INF');
  // never fewer places than the statements (floor): a gross figure at -4 less a figure at -3
  assert.equal(sumDecimals([P('3520000', '-4'), P('-1268000', '-3')], Dec.parse('2252000')), '-4', 'no floor: the least accurate part');
  assert.equal(sumDecimals([P('3520000', '-4'), P('-1268000', '-3')], Dec.parse('2252000'), -3), '-3', 'floor: the statement accuracy');
  // the floor never makes a total finer than its exact digits, nor finer than all its parts
  assert.equal(sumDecimals([P('1234567000', '-3'), P('98765520', '-1')], Dec.parse('1333332520'), -3), '-3');
  assert.equal(sumDecimals([P('1000', '-3'), P('2000', '-3')], Dec.parse('3000'), -1), '-3');
  assert.equal(sumDecimals([P('98303020', '-1'), P('462500', '-1')], Dec.parse('98765520'), -3), '-1');
});

test('typed figures: declared at the statement accuracy; a figure with more places at the places as presented', () => {
  const s = baseSession({ level: 'Lakhs', displayPlaces: 4 });
  assert.equal(s.setValue(q(X), 'CY', '12.34').decimals, '-1', 'statement places not set: the places as presented');
  s.setMeta({ statementPlaces: 2 });
  assert.equal(s.filing.statementDecimals(q(X)), -3);
  assert.equal(s.filing.statementDecimals(q('NumberOfSharesPaidUp')), null, 'not an amount');
  assert.equal(s.setValue(q(X), 'CY', '12.35').decimals, '-3');
  assert.equal(s.setValue(q(X), 'CY', '987.6552').decimals, '-1', 'share capital to the rupee');
  // 4.625 lakh fits decimals -2, but is declared at the places as presented: a total of it with a figure to the rupee
  // keeps the rupees (share capital 983.0302 + 4.625 = 987.6552, not 987.655)
  const f = s.setValue(q(X), 'CY', '4.625');
  assert.equal(f.value, '462500'); assert.equal(f.decimals, '-1');
  assert.equal(sumDecimals([P('98303020', '-1'), f], Dec.parse('98765520'), -3), '-1');
});

test('statement places: set on import from the accuracy most amounts are reported at; kept by Prepare next year', () => {
  const s = exampleSession({ level: 'Lakhs', displayPlaces: 2 });
  // the example's amounts are whole lakhs: give Rent two places (12.34 lakh at decimals -3)
  const xml = exportUnchecked(s).replace(/(<ind-as:Rent contextRef="D2018" unitRef="INR" decimals="-3">)\d+</, '$11234000<');
  const { s: b } = importSession(xml);
  assert.equal(b.filing.meta.displayPlaces, 2);
  assert.equal(b.filing.meta.statementPlaces, 2);
  // one amount reported to the rupee raises the places as presented, not the statement places
  const fine = xml.replace(/(<ind-as:Rent contextRef="D2018" unitRef="INR" decimals=)"-3">(\d+)</, (m, a, v) => `${a}"0">${String(Number(v) + 7)}<`);
  assert.notEqual(fine, xml);
  const { s: c } = importSession(fine);
  assert.equal(c.filing.meta.statementPlaces, 2);
  assert.ok(c.filing.meta.displayPlaces > 2);
  // a project saved and opened again keeps it
  assert.equal(JSON.parse(JSON.stringify(c.filing.toJSON())).meta.statementPlaces, 2);
  // Prepare next year's filing: the new year's typed figures get the same accuracy
  const n = new Session(A);
  n.importXml(fine, { DOMParserImpl: XMLParser, yearMode: 'next' });
  assert.equal(n.filing.meta.statementPlaces, 2);
  assert.equal(n.setValue(q(X), 'CY', '1.23').decimals, '-3');
});

test('derived totals of figures typed at the statement accuracy are rounded to it; Recalculate keeps agreeing filed totals', () => {
  const s = exampleSession({ level: 'Lakhs', displayPlaces: 4, statementPlaces: 2 });
  s.setValue(q('Rent'), 'CY', '4.0002', { recalc: true }); // a figure to the rupee
  assert.equal(s.getValue(q('Rent'), 'CY').decimals, '-1');
  const tot = s.getValue(q('OtherExpenses'), 'CY');
  assert.equal(tot.decimals, '-3');
  assert.match(tot.value, /000$/, 'rounded to the thousand (non-significant digits 0)');
  assert.equal(s.recalculateAll({ scopes: ['CY'], apply: false }).changes.length, 0);
  // a filed total rounded coarser that agrees at its own accuracy is not replaced by Recalculate
  const coarse = Dec.toString(Dec.round(Dec.parse(tot.value), -4));
  s.filing.setFact({ ...tot, value: coarse, decimals: '-4', origin: 'import' });
  assert.ok(!s.recalculateAll({ scopes: ['CY'], apply: false }).changes.some((c) => (c.after || c.before).concept === q('OtherExpenses')));
  // one that does not agree is listed
  s.filing.setFact({ ...tot, value: String(Number(tot.value) + 100000), decimals: '-3', origin: 'import' });
  assert.ok(s.recalculateAll({ scopes: ['CY'], apply: false }).changes.some((c) => (c.after || c.before).concept === q('OtherExpenses')));
});

test('FM-14: the workbook exemption rows with a wrong axis (S.No. 29, DetailsOfAdvancesTable) apply to their table', () => {
  const AX = 'ind-as:ClassificationOfAdvancesAxis';
  assert.equal(fm14RequiredParent(A, AX, 'ind-as:PrepaidExpensesMember', ['DetailsOfAdvancesTable']), null);
  assert.equal(fm14RequiredParent(A, AX, 'ind-as:PrepaidExpensesMember', ['SomeOtherTable']), 'ind-as:OtherAdvancesMember', 'other tables: still required');
});

test('FM-16: a text element left empty for a reported shareholder is a warning; a missing amount stays an error', () => {
  const s = baseSession();
  s.setValue(q('WhetherThereAreAnyShareholdersHoldingMoreThanFivePerCentSharesInCompany'), 'CY', 'true');
  const SH = T('DisclosureOfShareholdingMoreThanFivePerCentInCompanyTable');
  const dims = (n) => [{ axis: q('ClassesOfEquityShareCapitalAxis'), member: q('EquityShares1Member') }, { axis: q('NameOfShareholderAxis'), member: q(`Shareholder${n}Member`) }];
  for (const n of [1, 2]) {
    s.setTableValue(SH, 'CY', dims(n), q('NameOfShareholder'), `Holder ${n}`);
    s.setTableValue(SH, 'CY', dims(n), q('NumberOfSharesHeldInCompany'), String(1000 * n));
    s.setTableValue(SH, 'CY', dims(n), q('PercentageOfShareholdingInCompany'), '0.1');
  }
  s.setTableValue(SH, 'CY', dims(2), q('CINOfShareholder'), 'U72200KA2010PTC123456'); // only the company holder has a CIN
  let r = runRule(s, 'FM-16', { scope: 'CY' });
  assert.ok(r.statuses.includes('WARN') && !r.statuses.includes('FAIL'), r.statuses.join());
  assert.match(r.res.find((x) => x.status === 'WARN').message, /text element/);
  s.filing.removeFact(s.filing.get(q('NumberOfSharesHeldInCompany'), s.filing.period(q('NumberOfSharesHeldInCompany'), 'CY'), dims(1)).key);
  r = runRule(s, 'FM-16', { scope: 'CY' });
  assert.ok(r.statuses.includes('FAIL'), 'an amount missing for Shareholder1: blocking');
});

test('consolidated: a general-information table none of whose elements a consolidated instance reports is not required', () => {
  const PP = T('DisclosureOfPrincipalProductOrServicesTable');
  const c = consolidatedSession();
  const st = c.tableStatus(PP, 'CY');
  assert.equal(st.applicable, false);
  assert.match(st.reasons.join(), /consolidated/);
  set(c, 'RevenueFromSaleOfProducts', 1000, 900);
  assert.ok(!runRule(c, 'SR-L6420-1').statuses.includes('FAIL'));
  const s = baseSession();
  assert.equal(s.tableStatus(PP, 'CY').applicable, true, 'standalone: unchanged');
  set(s, 'RevenueFromSaleOfProducts', 1000, 900);
  assert.ok(runRule(s, 'SR-L6420-1', { scope: 'CY' }).statuses.includes('FAIL'), 'standalone: still required');
});

for (const [id, local, axis, table] of [['SR-L1678-1', 'OtherCurrentAssetsOthers', 'OtherCurrentAssetsOthersAxis', 'OtherCurrentAssetsOthersTable'], ['SR-L1590-1', 'OtherNoncurrentAssetsOthers', 'OtherNoncurrentAssetsOthersAxis', 'OtherNoncurrentAssetsOthersTable']]) {
  test(`${id}: details reported while ${local} is 0 — a warning (calibrated); a different amount — an error`, () => {
    const s = baseSession();
    for (const f of s.filing.all().filter((x) => x.concept === q(local))) s.filing.removeFact(f.key);
    s.setTableValue(T(table), 'CY', [{ axis: q(axis), typed: 'Item 1' }], q(local), '500');
    for (const f of s.filing.all().filter((x) => x.concept === q(local) && !x.dims.length)) s.filing.removeFact(f.key);
    assert.ok(!runRule(s, id, { scope: 'CY' }).statuses.includes('FAIL'), 'absent');
    s.filing.setFact({ concept: q(local), period: s.filing.period(q(local), 'CY'), value: '0', decimals: '0' });
    const r = runRule(s, id, { scope: 'CY' });
    assert.deepEqual(r.statuses, ['WARN'], '0 (as in the reference instances)');
    assert.match(r.res[0].message, /calibrated: not blocking while/);
    s.filing.setFact({ concept: q(local), period: s.filing.period(q(local), 'CY'), value: '300', decimals: '0' });
    assert.deepEqual(runRule(s, id, { scope: 'CY' }).statuses, ['FAIL'], 'an amount that differs: blocking');
    s.filing.setFact({ concept: q(local), period: s.filing.period(q(local), 'CY'), value: '500', decimals: '0' });
    assert.deepEqual(runRule(s, id, { scope: 'CY' }).statuses, ['PASS']);
  });
}

// with the consolidated reference instance C present (kept out of the package): its own shareholding error (holders
// above 100%, SR-L663-1) is reported next year in the previous-year column, reachable; corrected after unlocking, it is
// listed against last year's XML
import { readFileSync, existsSync } from 'node:fs';
import { errorsOf, reachable } from './assurance.mjs';
import { compareWithFiled } from './upkeep.js';
const REFC = new URL('golden-ref-c-consolidated-2024-25.xml', import.meta.url);
test('reference instance C consolidated, next year: shareholders above 100% is a previous-year error; corrected after unlocking', { skip: !existsSync(REFC) }, () => {
  const N = new Session(A);
  N.importXml(readFileSync(REFC, 'utf8'), { DOMParserImpl: XMLParser, yearMode: 'next' });
  const e = errorsOf(N).filter((x) => x.ruleId === 'SR-L663-1');
  assert.deepEqual(e.map((x) => x.scope), ['PY']);
  assert.equal(reachable(N, e[0].location), null);
  const pct = N.filing.all().filter((x) => x.concept === q('PercentageOfShareholdingInCompany') && N.filing.scopeOf(x.period) === 'PY' && x.dims.some((d) => d.member === q('EquityShares1Member')));
  const sum = Dec.sum(pct.map((x) => Dec.parse(x.value)));
  const f = pct.reduce((a, b) => (Number(a.value) >= Number(b.value) ? a : b));
  const nv = Dec.toString(Dec.sub(Dec.parse(f.value), Dec.sub(sum, Dec.parse('1')))); // brings the total to 100%
  assert.throws(() => N.setTableValue(e[0].location.tableId, 'PY', f.dims, f.concept, nv), /lock/i);
  N.filing.meta.pyLocked = false;
  N.setTableValue(e[0].location.tableId, 'PY', f.dims, f.concept, nv);
  assert.equal(errorsOf(N).filter((x) => x.ruleId === 'SR-L663-1').length, 0);
  const items = compareWithFiled(N).items;
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'changed');
  assert.equal(Number(items[0].filed), Number(f.value)); assert.equal(Number(items[0].now), Number(nv));
});
