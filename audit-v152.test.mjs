// v1.5.2: the five MCA validator errors reported on a next-year filing made with v1.5.1 — each cause covered with
// synthetic data (no golden files needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { authority, q } from './helpers.mjs';
import { baseSession, consolidatedSession, runRule, T } from './fixtures.mjs';
import { Applicability } from './applicability.js';
import { decimalFamilies } from './units.js';

const A = authority();
const GRANTED = 'NumberOfShareOptionsGrantedInSharebasedPaymentArrangement', FORFEITED = 'NumberOfShareOptionsForfeitedInSharebasedPaymentArrangement';
const EXERCISED = 'NumberOfShareOptionsExercisedInSharebasedPaymentArrangement', CHANGES = 'ChangesOfNumberOfShareOptionsOutstandingInShareBasedPaymentArrangement';
const OUTSTANDING = 'NumberOfOutstandingShareOptions';
const imp = (s, local, scope, value, unit) => s.filing.setFact({ concept: q(local), period: s.filing.period(q(local), scope), value, decimals: 'INF', unit, origin: 'import' });

test('units of counts: one family (calculation + roll-forward) — a new count takes the unit its family already uses', () => {
  const fam = decimalFamilies(A);
  for (const x of [GRANTED, FORFEITED, EXERCISED, OUTSTANDING]) assert.equal(fam.get(q(x)), fam.get(q(CHANGES)), x);
  const s = baseSession();
  imp(s, FORFEITED, 'PY', '-17750', 'INR'); // last year's XML reported the share-option counts in INR
  assert.equal(s.filing.unitFor(q(EXERCISED)), 'INR');
  assert.equal(s.setValue(q(EXERCISED), 'PY', '-46250').unit, 'INR', 'typed into the previous year');
  assert.equal(s.setValue(q(EXERCISED), 'CY', '-41500').unit, 'INR', 'typed into the current year');
  assert.equal(baseSession().filing.unitFor(q(EXERCISED)), 'pure', 'no family member reported: the default');
  assert.equal(s.filing.unitFor(q('Rent')), 'INR');
});

test('units of counts: a family reported in two units is put into one (the imported unit); values unchanged', () => {
  const s = baseSession();
  imp(s, GRANTED, 'PY', '0', 'INR'); imp(s, FORFEITED, 'PY', '-17750', 'INR');
  s.filing.setFact({ concept: q(EXERCISED), period: s.filing.period(q(EXERCISED), 'PY'), value: '-46250', decimals: '0', unit: 'pure', origin: 'user' });
  s.filing.setFact({ concept: q(CHANGES), period: s.filing.period(q(CHANGES), 'PY'), value: '-64000', decimals: '0', unit: 'INR', origin: 'import' });
  // as the MCA validator: the part in another unit is not added up — the tool now reports it
  const before = runRule(s, 'GR-1', { scope: 'PY' });
  assert.ok(before.res.some((x) => x.status === 'FAIL' && /another unit/.test(x.message)), before.res.map((x) => x.message).join('\n'));
  const changed = s.filing.harmonizeUnits();
  assert.deepEqual(changed.map((x) => [x.concept, x.before, x.after]), [[q(EXERCISED), 'pure', 'INR']]);
  assert.equal(s.getValue(q(EXERCISED), 'PY').value, '-46250');
  assert.ok(!runRule(s, 'GR-1', { scope: 'PY' }).statuses.includes('FAIL'), 'consistent once in one unit');
  assert.deepEqual(s.filing.harmonizeUnits(), [], 'nothing left to change');
});

test('GR-1: gross salary of a key managerial person needs one of its parts ("all elements exempt except Gross salary")', () => {
  const s = baseSession();
  const KMP = T('DisclosureOfKeyManagerialPersonnelsAndDirectorsAndRemunerationToKeyManagerialPersonnelsAndDirectorsTable');
  const ax = A.table(KMP).axes.find((x) => x.typed).axis;
  const dims = [{ axis: ax, typed: '11' }];
  s.setTableValue(KMP, 'CY', dims, q('KeyManagerialPersonnelOrDirectorRemuneration'), '100000');
  s.setTableValue(KMP, 'CY', dims, q('GrossSalaryToKeyManagerialPersonnelOrDirector'), '100000');
  const r = runRule(s, 'GR-1', { scope: 'CY' });
  assert.ok(r.res.some((x) => x.status === 'FAIL' && /GrossSalaryToKeyManagerialPersonnelOrDirector is entered \(non-zero\) but none of its calculation children/.test(x.message)), r.res.map((x) => x.message).join('\n'));
  s.setTableValue(KMP, 'CY', dims, q('SalaryKeyManagerialPersonnelOrDirector'), '100000');
  assert.ok(!runRule(s, 'GR-1', { scope: 'CY' }).res.some((x) => x.status === 'FAIL' && /GrossSalary/.test(x.message)), 'with its salary part: no error');
  // a total whose parts are all exempt and that is not named as an exception still needs none (e.g. interest expense)
  const t = baseSession();
  t.setValue(q('InterestExpense'), 'CY', '500', { recalc: true }); t.setValue(q('InterestExpense'), 'PY', '400', { recalc: true });
  assert.ok(!runRule(t, 'GR-1', { scope: 'CY' }).res.some((x) => x.status === 'FAIL' && /InterestExpense is entered/.test(x.message)));
});

test('GR-11: presentation currency (general information and a note, no table) is not reported for the previous year', () => {
  const ap = new Applicability(A);
  assert.deepEqual(ap.pyExcludedShared.map((x) => A.concept(x).name).sort(), ['DescriptionOfPresentationCurrency', 'NameOfParentEntity', 'NameOfUltimateParentOfGroup']);
  const s = baseSession();
  assert.equal(s.conceptStatus(q('DescriptionOfPresentationCurrency'), 'CY').applicable, true);
  assert.equal(s.conceptStatus(q('DescriptionOfPresentationCurrency'), 'PY').applicable, false);
  s.filing.setFact({ concept: q('DescriptionOfPresentationCurrency'), period: s.filing.period(q('DescriptionOfPresentationCurrency'), 'PY'), value: 'INR', origin: 'import', lang: 'en' });
  const xml = s.exportXml({ today: '2018-09-30' }).xml;
  assert.ok(!/<in-ca:DescriptionOfPresentationCurrency contextRef="D2017"/.test(xml), 'not written for the previous year');
  // elements inside tables keep their table's decision (shareholders, related parties: both years)
  assert.ok(!ap.pyExcludedShared.includes(q('NameOfShareholder')));
});

test('SR-L6567-1: the material contracts table belongs to the material contracts question, not the not-at-arm\'s-length one', () => {
  const MAT = T('DetailsOfMaterialContractsArrangementsTransactionsAtArmsLengthBasisTable');
  const NOT = q('WhetherThereAreContractsArrangementsTransactionsNotAtArmsLengthBasis'), YES = q('WhetherThereAreMaterialContractsArrangementsTransactionsAtArmsLengthBasis');
  const s = baseSession();
  s.setValue(NOT, 'CY', 'false'); s.setValue(YES, 'CY', 'true');
  assert.equal(s.tableStatus(MAT, 'CY').applicable, true, 'the table opens on Yes to material contracts');
  assert.ok(runRule(s, 'SR-L6567-1', { scope: 'CY' }).statuses.includes('FAIL'), 'and is required while empty');
  const t = baseSession();
  t.setValue(NOT, 'CY', 'true'); t.setValue(YES, 'CY', 'false');
  assert.equal(t.tableStatus(MAT, 'CY').applicable, false, 'No to material contracts: the table stays closed');
  assert.ok(!runRule(t, 'SR-L6567-1', { scope: 'CY' }).statuses.includes('FAIL'));
  void consolidatedSession;
});

// with reference instance C present (kept out of the package): its share-option counts are in INR; in a filing prepared
// for the next year, counts typed for either year join them in INR, and the calculation holds
import { readFileSync, existsSync } from 'node:fs';
import { Session } from './session.js';
import { XMLParser } from './helpers.mjs';
const REFC = new URL('golden-ref-c-standalone-2024-25.xml', import.meta.url);
test('reference instance C, next year: share-option counts typed for both years stay in the unit of last year\'s XML', { skip: !existsSync(REFC) }, () => {
  const N = new Session(A);
  N.importXml(readFileSync(REFC, 'utf8'), { DOMParserImpl: XMLParser, yearMode: 'next' });
  N.filing.meta.pyLocked = false;
  const units = () => new Set(N.filing.all().filter((f) => decimalFamilies(A).get(f.concept) === decimalFamilies(A).get(q(CHANGES))).map((f) => f.unit));
  assert.deepEqual([...units()], ['INR']);
  N.setValue(q(FORFEITED), 'PY', '-17750', { recalc: true });
  N.setValue(q(EXERCISED), 'PY', '', { recalc: true }); // cleared, then typed again (a new fact)
  N.setValue(q(EXERCISED), 'PY', '-46250', { recalc: true });
  N.setValue(q(EXERCISED), 'CY', '-41500', { recalc: true });
  N.setValue(q('NumberOfShareOptionsExpiredInSharebasedPaymentArrangement'), 'CY', '-1000', { recalc: true });
  assert.deepEqual([...units()], ['INR']);
  const r = runRule(N, 'GR-1');
  assert.ok(!r.res.some((x) => x.status === 'FAIL' && /ShareOption/.test(x.message)), r.res.filter((x) => x.status === 'FAIL').map((x) => x.message).join('\n'));
});
