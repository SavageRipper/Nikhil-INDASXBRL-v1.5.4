// v1.1 (C&I v13.2, adapted to Ind AS first-time adoption): previous-year opening values (dated the day before the
// previous year starts) without their total for that date (MCA generic rule GR-1). The message gives the date; the
// location is the cell that shows the value; "Remove opening values without totals" removes exactly the values whose
// total has no cell — never a value of the GR-16 opening balance sheet column.
import test from 'node:test';
import assert from 'node:assert/strict';
import { exampleSession } from './fixtures.mjs';
import { q } from './helpers.mjs';
import { addDays } from './periods.js';

const TODAY = '2018-09-30';
function ftaSession() {
  const s = exampleSession();
  s.setValue(q('WhetherCompanyHasAdoptedIndAsFirstTime'), 'CY', 'true', { recalc: true });
  assert.ok(s.app.ftaActive(s.filing), 'first-time adoption active');
  return s;
}
const pyoOf = (s) => ({ type: 'instant', date: addDays(s.filing.meta.periods.py.start, -1) });
// a value as an import would leave it (no recalculation of its totals)
const put = (s, local, value, period) => s.filing.setFact({ concept: q(local), period, dims: [], value, decimals: '0', unit: 'INR', origin: 'import' });
const gr1 = (s, local) => s.validate({ today: TODAY }).issues.filter((i) => i.ruleId === 'GR-1' && i.severity === 'ERROR' && i.factKey && s.filing.facts.get(i.factKey)?.concept === q(local));

test('GR-16: an opening balance sheet value without its total — message gives the date, location is the opening column cell, never removed', () => {
  const s = ftaSession();
  const P = pyoOf(s);
  for (const f of s.filing.all().filter((x) => x.period.type === 'instant' && x.period.date === P.date)) s.filing.removeFact(f.key);
  put(s, 'Inventories', '500', P); // shown in the opening balance sheet column; its total (current assets) is too
  const [e] = gr1(s, 'Inventories');
  assert.ok(e, 'GR-1 error for the opening value');
  assert.match(e.message, new RegExp(`previous-year opening value \\(dated ${P.date}\\)`));
  assert.equal(e.location.kind, 'cell');
  assert.equal(e.location.scope, 'PYO', 'the GR-16 opening balance sheet column');
  assert.equal(e.location.tabId, s.A.meta.profile.balanceSheet);
  assert.equal(e.location.cellId, e.factKey);
  assert.deepEqual(s.pyOpeningOrphans(), [], 'its total can be entered in the opening column: not an orphan');
  assert.deepEqual(s.removePyOpeningOrphans(), []);
  assert.equal(s.filing.value(q('Inventories'), 'PYO'), '500', 'the GR-16 value is kept');
});

test('an opening value whose total has no cell for that date: no tab shows it — offered for removal; removal takes exactly it', () => {
  const s = ftaSession();
  const P = pyoOf(s);
  put(s, 'Inventories', '500', P); // a GR-16 value, kept whatever happens below
  put(s, 'Guarantees', '70', P); // neither it nor its total (contingent liabilities) has a cell at that date
  const [e] = gr1(s, 'Guarantees');
  assert.ok(e, 'GR-1 error');
  assert.match(e.message, new RegExp(`dated ${P.date}`));
  assert.equal(e.location.kind, 'pyo', 'no cell shows it: the message offers to remove it');
  const orphans = s.pyOpeningOrphans();
  assert.deepEqual(orphans.map((f) => s.A.concept(f.concept).name), ['Guarantees']);
  const before = s.filing.all().length;
  const removed = s.removePyOpeningOrphans();
  assert.deepEqual(removed.map((f) => s.A.concept(f.concept).name), ['Guarantees']);
  assert.equal(s.filing.all().length, before - 1, 'nothing else removed');
  assert.equal(s.filing.value(q('Inventories'), 'PYO'), '500', 'GR-16 value kept');
  assert.equal(gr1(s, 'Guarantees').length, 0);
});

test('without first-time adoption, opening values are not checked by GR-1 (Ind AS) and nothing is an orphan', () => {
  const s = exampleSession();
  assert.ok(!s.app.ftaActive(s.filing));
  const P = pyoOf(s);
  s.filing.setFact({ concept: q('Guarantees'), period: P, dims: [], value: '70', decimals: '0', unit: 'INR', origin: 'import' });
  assert.equal(gr1(s, 'Guarantees').length, 0);
  assert.deepEqual(s.pyOpeningOrphans(), []);
});

test('removeFacts re-derives what was calculated from the removed value', () => {
  const s = ftaSession();
  const P = pyoOf(s);
  s.setValue(q('Inventories'), 'PYO', '500', { recalc: true });
  assert.equal(s.filing.value(q('CurrentAssets'), 'PYO'), '500', 'total calculated in the opening column');
  s.removeFacts([s.filing.get(q('Inventories'), P, [])]);
  assert.equal(s.filing.value(q('CurrentAssets'), 'PYO'), null, 'calculated total follows the removal');
});
