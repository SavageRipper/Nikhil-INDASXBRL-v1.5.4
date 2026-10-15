// v1.4 (C&I v13 / v14.1 features ported): Fill empty totals (totals-fill.js), Recalculate current year, statement
// figures that differ from their notes. Runs on the example filing and on every MCA-validated instance present.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import { authority, q } from './helpers.mjs';
import { exampleSession, baseSession, exportUnchecked } from './fixtures.mjs';
import { Session, PyLockedError } from './session.js';
import { fillTotalsPlan, fillTotals } from './totals-fill.js';
import { additiveAxes } from './member-hints.js';
import { dimKey } from './model.js';

const A = authority();
const DIR = new URL('./', import.meta.url);
const goldens = readdirSync(DIR).filter((f) => /^golden-.*\.xml$/.test(f)).sort();
const BS = A.elrByCode(A.meta.profile.balanceSheet).uri;
const add = additiveAxes(A);
const sumTables = A.tables.filter((t) => t.axes.some((ax) => !ax.typed && add.has(ax.axis)));
const load = (g, yearMode = 'both') => { const S = new Session(A); S.importXml(readFileSync(new URL(g, DIR), 'utf8'), { DOMParserImpl: DOMParser, yearMode }); return S; };

test('Fill empty totals: nothing to fill in the MCA instances; a removed total is filled again with the filed figure', { skip: !goldens.length }, () => {
  for (const g of goldens) {
    const S = load(g);
    for (const t of sumTables) for (const sc of ['CY', 'PY']) assert.deepEqual(fillTotalsPlan(S, t.id, sc), [], `${g} ${t.id} ${sc}`);
    // remove one total at a time (a member that has reported parts, or the total column) and plan it back
    let back = 0;
    for (const t of sumTables) {
      for (const sc of ['CY', 'PY']) {
        const cands = S.filing.all().filter((f) => t.lineItems.includes(f.concept) && ['monetary', 'shares'].includes(A.dataType(f.concept)) && S.filing.scopeOf(f.period) === sc && f.origin === 'import');
        for (const f of cands.slice(0, 40)) {
          const T = new Session(A, S.filing.constructor.fromJSON(A, JSON.parse(JSON.stringify(S.filing.toJSON()))));
          T.filing.removeFact(f.key);
          const p = fillTotalsPlan(T, t.id, sc).find((x) => x.concept === f.concept && dimKey(x.dims) === dimKey(f.dims));
          if (!p) continue;
          assert.equal(p.value, f.value, `${g} ${t.id} ${f.key}`);
          back++;
          if (back % 7 === 0) { fillTotals(T, t.id, sc); assert.equal(T.filing.get(f.concept, f.period, f.dims)?.value, f.value); }
        }
      }
    }
    assert.ok(back >= 3, `${g}: ${back} totals planned back`);
  }
});

test('Fill empty totals never overwrites, and respects the previous-year lock of a prepared filing', { skip: !goldens.length }, () => {
  const S = load(goldens[0]);
  const before = JSON.stringify(S.filing.toJSON().facts);
  for (const t of sumTables) fillTotals(S, t.id, 'CY');
  assert.equal(JSON.stringify(S.filing.toJSON().facts), before);
  const N = load(goldens[0], 'next');
  const f = N.filing.all().find((x) => x.dims.length && N.filing.scopeOf(x.period) === 'PY' && A.isMonetary(x.concept) && sumTables.some((t) => t.lineItems.includes(x.concept)));
  const t = sumTables.find((x) => x.lineItems.includes(f.concept));
  N.filing.removeFact(f.key);
  const r = fillTotals(N, t.id, 'PY');
  assert.equal(r.filled, 0);
  if (r.skipped.length) assert.ok(r.skipped.every((x) => /locked/.test(x.reason)));
  assert.throws(() => N.setTableValue(t.id, 'PY', f.dims, f.concept, '1'), PyLockedError);
});

test('Recalculate current year: nothing to change in the MCA instances and the example; a stale total is listed and fixed; overrides kept', () => {
  for (const g of goldens) assert.equal(load(g).recalculateAll({ scopes: ['CY'], apply: false }).changes.length, 0, g);
  const E = exampleSession();
  assert.equal(E.recalculateAll({ scopes: ['CY'], apply: false }).changes.length, 0);
  const CA = q('CurrentAssets'), TR = q('TradeReceivablesCurrent');
  const tr = E.getValue(TR, 'CY'), json = JSON.stringify(E.filing.toJSON().facts);
  E.filing.setFact({ ...tr, value: String(Number(tr.value) + 10) }); // changed below the session (stale against its note)
  const before = JSON.stringify(E.filing.toJSON().facts);
  const preview = E.recalculateAll({ scopes: ['CY'], apply: false });
  assert.ok(preview.changes.some((c) => (c.after || c.before).concept === TR), 'the statement figure follows its note again');
  assert.equal(JSON.stringify(E.filing.toJSON().facts), before, 'preview changes nothing');
  E.recalculateAll({ scopes: ['CY'] });
  assert.equal(E.recalculateAll({ scopes: ['CY'], apply: false }).changes.length, 0);
  assert.equal(JSON.stringify(E.filing.toJSON().facts).length > 0 && E.getValue(TR, 'CY').value, tr.value);
  void json;
  // an override (Allow editing of calculated cells) is kept
  E.setValue(CA, 'CY', '9999999', { tab: BS, override: true, recalc: true });
  assert.equal(E.recalculateAll({ scopes: ['CY'], apply: false }).changes.length, 0);
});

test('statement figures that differ from their notes are listed (entered figure kept), none in the MCA instances', async () => {
  for (const g of goldens) assert.deepEqual(load(g).statementNoteDifferences(), []);
  const { statementNoteLinks } = await import('./derived.js');
  const s = new Session(A);
  s.setMeta({ name: 'Test Co', cin: 'U72200KA2010PTC123456', reportType: 'Standalone', level: 'Actual', displayPlaces: 0, periods: { cy: { start: '2017-04-01', end: '2018-03-31' }, py: { start: '2016-04-01', end: '2017-03-31' } } });
  const l = statementNoteLinks(A).get(q('BorrowingsNoncurrent'));
  const fx = Object.keys(l.spec.fixed)[0];
  const m0 = [...A.axisInfo(l.spec.axis).parents].filter(([, p]) => p === A.dimensionDefault(l.spec.axis)).map(([m]) => m)[0];
  s.setTableValue(l.tableId, 'CY', [{ axis: fx, member: l.spec.fixed[fx] }, { axis: l.spec.axis, member: m0 }], q('Borrowings'), '300', { recalc: true });
  s.filing.setFact({ ...s.getValue(q('BorrowingsNoncurrent'), 'CY'), value: '400', origin: 'import' });
  const d = s.statementNoteDifferences();
  assert.deepEqual(d.map((x) => [x.concept, x.scope, x.value, x.note]), [[q('BorrowingsNoncurrent'), 'CY', '400', '300']]);
  void BS; void baseSession; void exportUnchecked;
});
