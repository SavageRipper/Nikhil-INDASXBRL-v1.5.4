// v1.2 — the v12 rules that prevent dead ends (handoff section B, C&I README v12), on the Ind AS authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import { authority, q } from './helpers.mjs';
import { baseSession, exampleSession, TODAY } from './fixtures.mjs';
import { Session, CalculatedCellError } from './session.js';
import { Gate } from './gate.js';
import { buildTableView, buildElrView } from './views.js';
import { addDays } from './periods.js';

const A = authority();
const uri = (code) => A.elrs.find((e) => e.code === code).uri;
const BS = uri('110000');

test('a total typed before its parts keeps the filer figure when the parts differ; follows them when it agreed — order-independent outcome', () => {
  const fresh = () => { const s = baseSession(); s.filing.removeFact(s.getValue(q('CurrentAssets'), 'CY').key); return s; };
  // total first, different parts: the entered figure is kept (GR-1 reports it) and stays editable
  const a = fresh();
  a.setValue(q('CurrentAssets'), 'CY', '500', { tab: BS, recalc: true });
  a.setValue(q('CurrentTaxAssets'), 'CY', '120', { tab: BS, recalc: true });
  assert.equal(a.getValue(q('CurrentAssets'), 'CY').value, '500');
  assert.equal(a.calculatedCell(q('CurrentAssets'), 'CY', [], BS), null, 'editable');
  assert.ok(a.validate({ today: TODAY }).issues.some((i) => i.ruleId === 'GR-1' && /CurrentAssets|Current assets/.test(i.message)));
  // parts first: the total is calculated and locked (typing another figure is refused — correct the parts instead)
  const b = fresh();
  b.setValue(q('CurrentTaxAssets'), 'CY', '120', { tab: BS, recalc: true });
  assert.equal(b.getValue(q('CurrentAssets'), 'CY').value, '120');
  assert.throws(() => b.setValue(q('CurrentAssets'), 'CY', '500', { tab: BS }), CalculatedCellError);
  // the same figures in either order give the same filing
  const c1 = fresh(), c2 = fresh();
  c1.setValue(q('CurrentAssets'), 'CY', '120', { tab: BS, recalc: true }); c1.setValue(q('CurrentTaxAssets'), 'CY', '120', { tab: BS, recalc: true });
  c2.setValue(q('CurrentTaxAssets'), 'CY', '120', { tab: BS, recalc: true }); c2.setValue(q('CurrentAssets'), 'CY', '120', { tab: BS, recalc: true });
  const vals = (x) => x.filing.all().map((f) => `${f.key}=${f.value}`).sort().join('\n');
  assert.equal(vals(c1), vals(c2));
  // a total that agreed with its parts follows them, and stays the filer's figure
  c1.setValue(q('CurrentTaxAssets'), 'CY', '130', { tab: BS, recalc: true });
  assert.equal(c1.getValue(q('CurrentAssets'), 'CY').value, '130');
  assert.equal(c1.getValue(q('CurrentAssets'), 'CY').origin, 'user');
});

test('MCA "Parent child exempt calculation": the total is filled while empty, never locked, and an entered figure is kept', () => {
  const s = baseSession();
  const elr = uri('401200');
  s.setValue(q('EquityShareWarrantsForExistingMembers'), 'CY', '10', { tab: elr, recalc: true });
  assert.equal(s.getValue(q('EquityShareWarrants'), 'CY').value, '10', 'filled while empty');
  assert.equal(s.calculatedCell(q('EquityShareWarrants'), 'CY', [], elr), null, 'never locked');
  s.setValue(q('EquityShareWarrants'), 'CY', '25', { tab: elr, recalc: true });
  s.setValue(q('EquityShareWarrantsForOthers'), 'CY', '5', { tab: elr, recalc: true });
  assert.equal(s.getValue(q('EquityShareWarrants'), 'CY').value, '25', 'entered figure kept');
});

test('table views: a reconciliation shows its closing row; an opening total shows its parts\' opening rows', () => {
  const soce = buildTableView(A, '400200:StatementOfChangesInEquityTable').lineItems.filter((l) => l.concept === q('OtherEquityBalances')).map((l) => l.preferredLabel);
  assert.deepEqual(soce.sort(), ['periodEndLabel', 'periodStartLabel']);
  const ppe = buildTableView(A, '400600:DisclosureOfPropertyPlantAndEquipmentTable').lineItems.filter((l) => l.concept === q('PropertyPlantAndEquipment')).map((l) => l.preferredLabel);
  assert.deepEqual(ppe.sort(), ['periodEndLabel', 'periodStartLabel'], 'compiler keeps both arcs (XBRL 2.1 §3.5.3.9.7.4)');
  const dt = buildTableView(A, '612700:DisclosureOfTemporaryDifferenceUnusedTaxLossesAndUnusedTaxCreditsTable').lineItems;
  for (const c of ['DeferredTaxAssets', 'DeferredTaxLiabilities']) assert.ok(dt.some((l) => l.concept === q(c) && l.preferredLabel === 'periodStartLabel' && l.openingPart), c);
  const w = buildElrView(A, uri('401200')).rows.filter((r) => r.concept === q('EquityShareWarrantsForOthers')).map((r) => r.preferredLabel);
  assert.ok(w.includes('periodStartLabel'));
});

test('error locations: a rule about a table, an axis or a member points to the table; a rule on a table element to its total column', () => {
  const s = exampleSession();
  const g = new Gate(A);
  const t = A.table('400100:DisclosureOfClassesOfEquityShareCapitalTable');
  for (const c of [t.hypercube, t.axes[0].axis, t.axes[0].members.find((m) => m.member !== A.dimensionDefault(t.axes[0].axis)).member]) {
    const l = g.checked(g.locate(s.filing, { concept: c, scope: 'CY' }));
    assert.equal(l.kind, 'table', c);
    const lt = A.table(l.tableId); // a table that carries it (the share-class axis is also on the earnings-per-share table)
    assert.ok(lt.hypercube === c || lt.axes.some((x) => x.axis === c || (x.members || []).some((m) => m.member === c)), c);
  }
  const l = g.checked(g.locate(s.filing, { concept: q('ValueOfSharesAuthorised'), scope: 'CY', ruleId: 'SR-L541-1' }));
  assert.equal(l.kind, 'cell'); assert.equal(l.tableId, t.id); assert.deepEqual(l.dims, []);
});

test('an error inside a place a Yes/No answer switched off points to that answer', () => {
  const s = exampleSession();
  const g = new Gate(A);
  const T = A.tables.find((x) => x.lineItems.includes(q('DescriptionOfNatureOfRelatedPartyRelationship')));
  s.setValue(q('WhetherThereAreAnyRelatedPartyTransactionsDuringYear'), 'PY', 'false', { recalc: true });
  assert.equal(s.tableStatus(T.id, 'PY').applicable, false);
  const l = g.checked(g.locate(s.filing, { tableId: T.id, scope: 'PY' }), s.filing);
  assert.equal(l.kind, 'cell');
  assert.equal(l.conceptQName, q('WhetherThereAreAnyRelatedPartyTransactionsDuringYear'));
  assert.ok(l.via);
});

test('parts that are all 0 do not create a total; a total of 0 the tool made is removed when its parts return to 0', () => {
  const s = baseSession();
  const P = uri('110000');
  for (const f of s.filing.all().filter((x) => x.concept === q('CurrentAssets') && x.period.type === 'instant')) s.filing.removeFact(f.key);
  for (const f of s.filing.all().filter((x) => ['Inventories', 'TradeReceivablesCurrent', 'CurrentFinancialAssets', 'CashAndCashEquivalents', 'CurrentTaxAssets', 'OtherCurrentAssets'].includes(A.concept(x.concept).name) && !x.dims.length)) s.filing.removeFact(f.key);
  s.setValue(q('CurrentTaxAssets'), 'CY', '0', { tab: P, recalc: true });
  assert.equal(s.getValue(q('CurrentAssets'), 'CY'), null, 'no total of zeros');
  s.setValue(q('CurrentTaxAssets'), 'CY', '7', { tab: P, recalc: true });
  assert.equal(s.getValue(q('CurrentAssets'), 'CY').value, '7');
  s.setValue(q('CurrentTaxAssets'), 'CY', '0', { tab: P, recalc: true });
  assert.equal(s.getValue(q('CurrentAssets'), 'CY'), null, 'undo restores the filing exactly');
});

test('no balance-sheet total is derived at the opening of the previous year without first-time adoption', () => {
  const s = exampleSession();
  const pyo = { type: 'instant', date: addDays(s.filing.meta.periods.py.start, -1) };
  // a roll-forward opening balance is legitimate at that date (cash and cash equivalents at the beginning of the year)
  s.filing.setFact({ concept: q('CashAndCashEquivalents'), period: pyo, dims: [], value: '90', decimals: '0', unit: 'INR', origin: 'user' });
  s.recalcFrom(q('CashAndCashEquivalents'), pyo, [], 0, { before: null, after: '90' });
  for (const c of ['CurrentFinancialAssets', 'CurrentAssets', 'Assets']) assert.equal(s.filing.get(q(c), pyo, []), null, c);
});
