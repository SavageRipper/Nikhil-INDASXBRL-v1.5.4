// v1.3 (C&I v14): health check and the set-aside store, "Prepare next year's filing" (previous year locked as filed,
// first-time adoption answered No for the new year), Hidden data, comparison with last year's filed figures,
// one-click fixes. Runs on the example filing (always) and on every MCA-validated instance present (golden-*.xml).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import { authority, q } from './helpers.mjs';
import { exampleSession, exportUnchecked, TODAY } from './fixtures.mjs';
import { Session, PyLockedError } from './session.js';
import { Filing } from './model.js';
import { generateInstance } from './generator.js';
import { healthCheck, hiddenData, unshownFacts, restoreSetAside, restoreTarget, compareWithFiled, attachFiledXml, useFiledFigure, deleteSetAside, setAside } from './upkeep.js';
import { fixFor } from './fixes.js';
import { reachable } from './assurance.mjs';
import { addDays } from './periods.js';
import { statementNoteLinks } from './derived.js';

const A = authority();
const DIR = new URL('./', import.meta.url);
const goldens = readdirSync(DIR).filter((f) => /^golden-.*\.xml$/.test(f)).sort();
const BS = A.elrByCode(A.meta.profile.balanceSheet).uri;
const FTA = q('WhetherCompanyHasAdoptedIndAsFirstTime');
const load = (xml, yearMode) => { const S = new Session(A); S.importXml(xml, { DOMParserImpl: DOMParser, yearMode, fileName: 'last-year.xml' }); return S; };
const errors = (S) => S.validate({ today: '2030-03-31' }).issues.filter((i) => i.severity === 'ERROR');
const exampleXml = () => exportUnchecked(exampleSession());
const sources = () => [['example', exampleXml()], ...goldens.map((g) => [g, readFileSync(new URL(g, DIR), 'utf8')])];

test('prepare next year: last year\'s current year is the previous year (locked); the rest is set aside, not filing data', () => {
  for (const [name, xml] of sources()) {
    const S = load(xml, 'next'), B = load(xml, 'both');
    const P = S.filing.meta.periods;
    assert.deepEqual(P.py, B.filing.meta.periods.cy, name);
    assert.equal(S.filing.meta.pyLocked, true);
    assert.equal(S.filing.all().filter((f) => S.filing.scopeOf(f.period) === 'OTHER').length, 0, name);
    // every previous-year figure is last year's current-year figure
    for (const f of S.filing.all().filter((x) => S.filing.scopeOf(x.period) === 'PY' && x.origin === 'import')) assert.equal(B.filing.facts.get(f.key)?.value, f.value, `${name} ${f.key}`);
    const reasons = new Set(S.filing.setAside.map((x) => x.reason));
    assert.ok(reasons.has('yearBeforeLast'), name);
    assert.ok(reasons.has('notApplicablePreviousYear'), name);
    // this year's opening balances = last year's closing balances: the same fact (GR-6)
    const cash = q('CashAndCashEquivalents');
    if (B.getValue(cash, 'CY')) assert.equal(S.getValue(cash, 'CY', [], 'periodStartLabel')?.value, B.getValue(cash, 'CY').value, name);
    // nothing to compare: every previous-year figure is the filed one
    assert.deepEqual(compareWithFiled(S).items, [], name);
    // the previous-year column passes the rules (the current year is empty)
    // (apart from a data error in the reference instance's own figures: consolidated reference instance C — see
    // golden.test FILED_DATA_ERRORS; it is reported on the previous-year table, where the restated figure is entered)
    assert.deepEqual(errors(S).filter((i) => (i.scope === 'PY' || i.scope === 'PYO') && !(name === 'golden-ref-c-consolidated-2024-25.xml' && i.ruleId === 'SR-L663-1')).map((i) => i.message), [], name);
    // first-time adoption is reported once
    assert.equal(S.getValue(FTA, 'CY')?.value, 'false', name);
    // every message of the new (empty) year leads to a cell the user can open — a closed table whose condition is not
    // entered yet points to the condition's cell (gate.viaAnswer, v1.3)
    for (const i of errors(S)) assert.equal(reachable(S, i.location), null, `${name}: ${i.message} ${JSON.stringify(i.location)}`);
  }
});

test('first-time adoption last year: the new year answers No; last year\'s opening balance sheet is set aside', () => {
  const E = exampleSession();
  E.setValue(FTA, 'CY', 'true', { recalc: true });
  const pyo = { type: 'instant', date: addDays(E.filing.meta.periods.py.start, -1) };
  E.setValue(q('CashAndCashEquivalents'), 'PYO', '77', { tab: BS, recalc: true });
  assert.equal(E.filing.get(q('CashAndCashEquivalents'), pyo, [])?.value, '77');
  const S = load(exportUnchecked(E), 'next');
  assert.equal(S.getValue(FTA, 'CY')?.value, 'false');
  assert.equal(S.getValue(FTA, 'PY')?.value, 'true', 'the previous year keeps last year\'s answer as filed');
  assert.ok(S.filing.setAside.some((x) => x.reason === 'openingBeforeLast' && x.concept === q('CashAndCashEquivalents') && x.period.date === pyo.date && x.value === '77'));
});

test('previous-year lock: entries refused until unlocked (also this year\'s opening balances); fixes respect it', () => {
  const S = load(exampleXml(), 'next');
  const TR = q('CurrentTaxAssets');
  assert.throws(() => S.setValue(TR, 'PY', '1', { tab: BS }), PyLockedError);
  assert.throws(() => S.setValue(q('CashAndCashEquivalents'), 'CY', '1', { preferredLabel: 'periodStartLabel' }), PyLockedError, 'CY opening = PY closing');
  assert.doesNotThrow(() => S.setValue(TR, 'CY', '1', { tab: BS, recalc: true }));
  const T = A.tables.find((t) => t.lineItems.includes(q('EquityShareCapital')) && t.axes.length);
  assert.throws(() => S.removeSlice(T.id, 'PY', []), PyLockedError);
  S.filing.meta.pyLocked = false;
  const before = S.getValue(TR, 'PY')?.value;
  S.setValue(TR, 'PY', '999', { tab: BS, recalc: true });
  const c = compareWithFiled(S);
  const item = c.items.find((x) => x.concept === TR);
  assert.equal(item?.kind, before ? 'changed' : 'added');
  if (before) {
    useFiledFigure(S, item);
    assert.deepEqual(compareWithFiled(S).items, [], 'restoring the part restores its totals');
  }
  S.filing.meta.pyLocked = true;
  const R = Filing.fromJSON(A, JSON.parse(JSON.stringify(S.filing.toJSON())));
  assert.equal(R.meta.pyLocked, true);
  assert.equal(R.setAside.length, S.filing.setAside.length);
  assert.equal(R.filedReference.facts.length, S.filing.filedReference.facts.length);
});

test('compare with last year\'s filed XML for an existing project; a different year is refused', () => {
  const xml = exampleXml();
  const N = load(xml, 'next');
  const S = new Session(A, Filing.fromJSON(A, JSON.parse(JSON.stringify(N.filing.toJSON()))));
  S.filing.filedReference = null; S.filing.meta.pyLocked = false;
  assert.deepEqual(attachFiledXml(S, xml, { fileName: 'filed.xml', DOMParserImpl: DOMParser }).items, []);
  assert.equal(S.filing.filedReference.file, 'filed.xml');
  assert.throws(() => attachFiledXml(load(xml, 'both'), xml, { DOMParserImpl: DOMParser }), /not this filing's previous year/);
});

test('prepare next year from a project = from its XML', () => {
  const B = load(exampleXml(), 'both');
  const { xml: x } = generateInstance(A, B.filing, B.filing.all());
  const N = load(x, 'next'), X = load(exampleXml(), 'next');
  const vals = (S) => S.filing.all().filter((f) => S.filing.scopeOf(f.period) !== 'CY').map((f) => `${f.key}=${f.value}`).sort();
  assert.deepEqual(vals(N), vals(X));
});

test('health check: MCA instances and the example unchanged; a stale tool-calculated value is re-derived', () => {
  for (const [name, xml] of sources()) {
    const S = load(xml, 'both');
    const before = JSON.stringify(S.filing.toJSON().facts);
    const h = healthCheck(S);
    assert.equal(h.changed, 0, `${name}: ${JSON.stringify({ s: h.statements.length, c: h.cells.length, m: h.moved.map((x) => x.concept) })}`);
    assert.equal(JSON.stringify(S.filing.toJSON().facts), before, name);
  }
  const S = exampleSession();
  const CA = q('CurrentAssets'), TR = q('TradeReceivablesCurrent');
  const ca = S.getValue(CA, 'CY');
  assert.equal(ca.origin, 'calculated');
  // a part changed below the session (as an older version could leave it)
  const tr = S.getValue(TR, 'CY');
  S.filing.setFact({ ...tr, value: String(Number(tr.value) + 1000) });
  const h = healthCheck(S);
  assert.ok(h.cells.some((c) => c.concept === CA));
  assert.equal(Number(S.getValue(CA, 'CY').value), Number(ca.value) + 1000);
  // a statement figure taken from its note that no longer equals it (the note changed below the session)
  const L = statementNoteLinks(A).get(q('BorrowingsNoncurrent'));
  const fx = Object.keys(L.spec.fixed)[0];
  const m0 = [...A.axisInfo(L.spec.axis).parents].filter(([, p]) => p === A.dimensionDefault(L.spec.axis)).map(([m]) => m)[0];
  const dims = [{ axis: fx, member: L.spec.fixed[fx] }, { axis: L.spec.axis, member: m0 }];
  const N = new Session(A);
  N.setMeta({ name: 'Test Co', cin: 'U72200KA2010PTC123456', reportType: 'Standalone', level: 'Actual', displayPlaces: 0, periods: { cy: { start: '2017-04-01', end: '2018-03-31' }, py: { start: '2016-04-01', end: '2017-03-31' } } });
  N.setTableValue(L.tableId, 'CY', dims, q('Borrowings'), '300', { recalc: true });
  assert.equal(N.getValue(q('BorrowingsNoncurrent'), 'CY')?.value, '300');
  const b = N.filing.all().find((f) => f.concept === q('Borrowings') && f.dims.length === 2 && N.filing.scopeOf(f.period) === 'CY');
  N.filing.setFact({ ...b, value: '350' });
  const h2 = healthCheck(N);
  assert.ok(h2.statements.some((x) => x.concept === q('BorrowingsNoncurrent') && x.after === '350'), JSON.stringify(h2.statements));
});

test('health check sets aside a value no tab shows; never a value of the opening balance sheet column (GR-16)', () => {
  const S = exampleSession();
  const pyo = { type: 'instant', date: addDays(S.filing.meta.periods.py.start, -1) };
  // a previous-year opening value of an element without an opening row (e.g. a note element), and one outside the years
  const OI = q('TradeReceivablesCurrent');
  S.filing.setFact({ concept: q('Inventories'), period: { type: 'instant', date: '2010-03-31' }, dims: [], value: '5', decimals: '0', unit: 'INR', origin: 'user' });
  // opening balance sheet value entered under first-time adoption, then the answer switched to No
  S.setValue(FTA, 'CY', 'true', { recalc: true });
  S.setValue(OI, 'PYO', '33', { tab: BS, recalc: true });
  S.setValue(FTA, 'CY', 'false', { recalc: true });
  const un = unshownFacts(S);
  assert.ok(un.some((x) => x.reason === 'otherDate'));
  assert.ok(!un.some((x) => x.fact.concept === OI && x.fact.period.date === pyo.date), 'GR-16 value never unshown');
  const h = healthCheck(S);
  assert.equal(h.moved.length, 1);
  assert.equal(S.filing.get(OI, pyo, [])?.value, '33', 'kept in the filing (not applicable while No)');
  assert.ok(hiddenData(S).notApplicable.some((x) => x.fact.concept === OI));
  S.setValue(FTA, 'CY', 'true', { recalc: true });
  assert.ok(!hiddenData(S).notApplicable.some((x) => x.fact.concept === OI), 'shown again with Yes');
});

test('hidden data: restore a set-aside value into its cell (unlocking the previous year), delete; the project file keeps the store', () => {
  const S = load(exampleXml(), 'next');
  const i = S.filing.setAside.findIndex((x) => x.reason === 'notApplicablePreviousYear');
  assert.ok(i >= 0);
  assert.ok(restoreTarget(S, S.filing.setAside[i]).why, 'a current-year-only disclosure has no previous-year cell');
  // a value set aside from the current year comes back into its cell
  const TR = q('CurrentTaxAssets');
  S.setValue(TR, 'CY', '12', { tab: BS, recalc: true });
  setAside(S, [{ fact: S.getValue(TR, 'CY'), reason: 'otherDate' }], 'test');
  assert.equal(S.getValue(TR, 'CY'), null);
  const j = S.filing.setAside.findIndex((x) => x.concept === TR && x.source === 'test');
  assert.equal(restoreSetAside(S, [j]).restored, 1);
  assert.equal(S.getValue(TR, 'CY')?.value, '12');
  // a previous-year value: refused while the previous year is locked
  const PY = S.filing.all().find((f) => S.filing.scopeOf(f.period) === 'PY' && !f.dims.length && f.concept === TR) || S.filing.all().find((f) => S.filing.scopeOf(f.period) === 'PY' && !f.dims.length && A.isMonetary(f.concept) && f.origin === 'import' && restoreTarget(S, { ...f, value: null, period: f.period, dims: [] }).why === 'the cell already has a value');
  setAside(S, [{ fact: PY, reason: 'otherDate' }], 'test2');
  const k = S.filing.setAside.findIndex((x) => x.source === 'test2');
  assert.equal(restoreSetAside(S, [k]).restored, 0, 'locked');
  assert.equal(restoreSetAside(S, [S.filing.setAside.findIndex((x) => x.source === 'test2')], { unlockPY: true }).restored, 1);
  const n = S.filing.setAside.length;
  assert.equal(deleteSetAside(S, [0, 1]), 2);
  assert.equal(Filing.fromJSON(A, JSON.parse(JSON.stringify(S.filing.toJSON()))).setAside.length, n - 2);
});

test('the disclosure copy reads last year\'s disclosures from the set-aside store', async () => {
  const { disclosureCarryPlan, previousYearValues } = await import('./carry-forward.js');
  const S = load(exampleXml(), 'next');
  S.filing.importReport = null; // the store alone
  assert.ok(previousYearValues(S).size > 0);
  const gi = A.elrByCode('700300').uri;
  assert.ok(disclosureCarryPlan(S, gi).items.length > 0);
});

test('fixes: each offered fix removes its message; every error location stays reachable; Report nil, totals, note figures', () => {
  const S = exampleSession();
  const CA = q('CurrentAssets'), TR = q('CurrentTaxAssets');
  // a total entered that differs from its parts (Allow editing of calculated cells), a part without its total,
  // a mandatory amount removed, one year without the other (GR-5)
  S.setValue(CA, 'PY', String(Number(S.getValue(CA, 'PY').value) + 500), { tab: BS, override: true, recalc: true });
  const nca = q('NoncurrentAssets');
  const removed = S.getValue(q('Assets'), 'CY');
  S.filing.removeFact(removed.key);
  S.filing.removeFact(S.getValue(q('RevenueFromOperations'), 'CY')?.key || '');
  S.setValue(TR, 'CY', '0', { tab: BS, recalc: true });
  S.filing.removeFact(S.getValue(TR, 'PY')?.key || '');
  const errs = errors(S);
  for (const i of errs) assert.equal(reachable(S, i.location), null, `${i.message} ${JSON.stringify(i.location)}`);
  const kinds = new Set();
  let fixed = 0;
  for (const i of errs) {
    const T = new Session(A, Filing.fromJSON(A, JSON.parse(JSON.stringify(S.filing.toJSON()))));
    const j = errors(T).find((x) => x.message === i.message && x.factKey === i.factKey);
    const fx = fixFor(T, j);
    if (!fx || fx.disabled) continue;
    fx.apply();
    kinds.add(fx.label.replace(/^Enter .* = sum of parts$/, 'Enter total'));
    assert.ok(!errors(T).some((x) => x.message === i.message), `${fx.label}: ${i.message}`);
    for (const x of errors(T)) assert.equal(reachable(T, x.location), null, `${x.message} after ${fx.label}`);
    fixed++;
  }
  assert.ok(fixed >= 3, String(fixed));
  for (const k of ['Set total = sum of parts', 'Enter total', 'Report nil (0)']) assert.ok(kinds.has(k), `${k} in ${[...kinds]}`);
  void nca;
});

test('fixes in a prepared next-year filing: nil for a mandatory amount; previous-year fixes are disabled while locked', () => {
  const S = load(exampleXml(), 'next');
  const errs = errors(S);
  const nil = errs.map((i) => [i, fixFor(S, i)]).filter(([, f]) => f && !f.disabled);
  assert.ok(nil.length > 0);
  S.filing.meta.pyLocked = true;
  const TR = q('CurrentTaxAssets');
  const issue = { severity: 'ERROR', ruleId: A.rules.rules.find((r) => r.ast?.handler === 'cy-py-pairing').id, scope: 'PY', concept: TR, dims: [], message: `[x] Since 'CurrentTaxAssets' is entered for the current year, the corresponding previous-year value should be entered` };
  assert.ok(fixFor(S, issue)?.disabled, 'locked previous year');
});

test('an old project (v1.2 file without set-aside store or lock) opens unchanged', () => {
  const E = exampleSession();
  const json = JSON.parse(JSON.stringify(E.filing.toJSON()));
  delete json.setAside; delete json.filedReference;
  const R = Filing.fromJSON(A, json);
  assert.deepEqual(R.setAside, []);
  assert.equal(R.filedReference, null);
  assert.ok(!R.meta.pyLocked);
  const S = new Session(A, R);
  assert.equal(healthCheck(S).changed, 0);
  assert.doesNotThrow(() => S.setValue(q('CurrentTaxAssets'), 'PY', '5', { tab: BS, recalc: true }));
});
