// v1.1 correction (ported from C&I v13.1): Session.removeSlice re-derives what was calculated from the removed
// cells instead of leaving it stale, and Session.refreshCalculatedCells heals a calculated figure a project saved
// before this fix left stale (health check on opening a project). No XML parser needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Authority } from './authority.js';
import { Session } from './session.js';

const A = new Authority(JSON.parse(readFileSync(new URL('./MCA_AUTHORITY.json', import.meta.url))));
const q = (local) => { const r = A.qnameOfLocal(local); assert.ok(r, 'no concept ' + local); return r; };

// Equity share capital classes table: CallsUnpaid (parent) = CallsUnpaidByDirectorsAndOfficers + CallsUnpaidByOthers
// (children), a calculation network wholly inside this one dimensional table/slice.
const T = '400100:DisclosureOfClassesOfEquityShareCapitalTable';
const AX = q('ClassesOfEquityShareCapitalAxis');
const part = (n) => [{ axis: AX, member: q(`EquityShares${n}Member`) }];

function session() {
  const s = new Session(A);
  s.setMeta({ name: 'Test Co', cin: 'U72200KA2010PTC123456', reportType: 'Standalone', level: 'Actual', displayPlaces: 0,
    periods: { cy: { start: '2017-04-01', end: '2018-03-31' }, py: { start: '2016-04-01', end: '2017-03-31' } } });
  s.setValue(q('EquityShareCapital'), 'CY', '1000'); // the table applies when balance-sheet share capital is entered
  return s;
}

test('recalcFrom (the fix removeSlice now calls per removed cell): removing one part re-derives the total from what remains, instead of leaving it at the old sum', () => {
  const s = session();
  s.setTableValue(T, 'CY', part(1), q('CallsUnpaidByDirectorsAndOfficers'), '10', { recalc: true });
  s.setTableValue(T, 'CY', part(1), q('CallsUnpaidByOthers'), '5', { recalc: true });
  assert.equal(s.filing.value(q('CallsUnpaid'), 'CY', part(1)), '15');

  // simulate what removeSlice does to each removed cell: delete the fact, then recalc from it (same as the body of
  // the fix in Session.removeSlice)
  const f = s.filing.get(q('CallsUnpaidByOthers'), s.filing.period(q('CallsUnpaidByOthers'), 'CY'), part(1));
  s.filing.removeFact(f.key);
  s.recalcFrom(q('CallsUnpaidByOthers'), f.period, part(1), 0);

  assert.equal(s.filing.value(q('CallsUnpaid'), 'CY', part(1)), '10', 'total follows the remaining part, not the old sum of 15');
});

test('removeSlice: removing a whole column removes the total together with its parts (no stale total left behind at that column)', () => {
  const s = session();
  s.setTableValue(T, 'CY', part(1), q('CallsUnpaidByDirectorsAndOfficers'), '10', { recalc: true });
  s.setTableValue(T, 'CY', part(1), q('CallsUnpaidByOthers'), '5', { recalc: true });
  assert.equal(s.filing.value(q('CallsUnpaid'), 'CY', part(1)), '15');
  s.removeSlice(T, 'CY', part(1));
  assert.equal(s.filing.value(q('CallsUnpaidByDirectorsAndOfficers'), 'CY', part(1)), null);
  assert.equal(s.filing.value(q('CallsUnpaid'), 'CY', part(1)), null, 'the total is removed with its parts, not left behind holding the old sum');
});

test('refreshCalculatedCells (health check on opening a project): a calculated total a project saved before this fix left stale is re-derived; entered/imported/manual values are never touched', () => {
  const s = session();
  s.setTableValue(T, 'CY', part(1), q('CallsUnpaidByDirectorsAndOfficers'), '10', { recalc: true });
  s.setTableValue(T, 'CY', part(1), q('CallsUnpaidByOthers'), '5', { recalc: true });
  assert.equal(s.filing.value(q('CallsUnpaid'), 'CY', part(1)), '15');

  // corrupt the stored total directly (as if saved by a project from before this fix, e.g. a part was removed
  // without recalculating) — still origin 'calculated', but no longer the sum of its current parts
  const totalFact = s.filing.get(q('CallsUnpaid'), s.filing.period(q('CallsUnpaid'), 'CY'), part(1));
  s.filing.setFact({ ...totalFact, value: '999' });
  assert.equal(s.filing.value(q('CallsUnpaid'), 'CY', part(1)), '999');

  const changed = s.refreshCalculatedCells();
  assert.equal(s.filing.value(q('CallsUnpaid'), 'CY', part(1)), '15', 'healed back to the sum of its current parts');
  assert.ok(changed.some((c) => c.concept === q('CallsUnpaid') && c.before === '999' && c.after === '15'));

  // an entered figure that happens to disagree with the sum of its parts is never touched by the health check
  const s2 = session();
  s2.setTableValue(T, 'CY', part(2), q('CallsUnpaidByDirectorsAndOfficers'), '10');
  s2.setTableValue(T, 'CY', part(2), q('CallsUnpaidByOthers'), '5');
  s2.setTableValue(T, 'CY', part(2), q('CallsUnpaid'), '40', { override: true, lockCalculated: true }); // entered, differs from the sum
  assert.equal(s2.filing.value(q('CallsUnpaid'), 'CY', part(2)), '40');
  s2.refreshCalculatedCells();
  assert.equal(s2.filing.value(q('CallsUnpaid'), 'CY', part(2)), '40', 'an entered figure is left as it is, even though it disagrees with its parts');
});

// the health check run on opening / importing never changes an MCA-validated instance (only the tool's own stale values)
import { readdirSync } from 'node:fs';
import { importSession } from './helpers.mjs';
for (const g of readdirSync(new URL('./', import.meta.url)).filter((x) => /^golden-.*\.xml$/.test(x))) {
  test(`${g}: health check on import changes nothing`, () => {
    const { s } = importSession(readFileSync(new URL(g, import.meta.url), 'utf8'));
    const before = JSON.stringify(s.filing.toJSON());
    assert.deepEqual(s.refreshCalculatedCells(), []);
    assert.equal(JSON.stringify(s.filing.toJSON()), before);
  });
}

// the statement-figure case (C&I v13.1): removing a column of a note re-derives the balance-sheet figure taken from the
// note (borrowings: SR-L878-1, BorrowingsNoncurrent = Σ Borrowings over the classification of borrowings, non-current).
// v1.2: removing the note's TOTAL column never deletes the balance-sheet figure, which is the same fact (C&I v11).
import { statementNoteLinks } from './derived.js';
test('removing a note column re-derives the balance-sheet figure taken from the note; the total column keeps it', () => {
  const s = session();
  const l = statementNoteLinks(A).get(q('BorrowingsNoncurrent'));
  const T = l.tableId, fixedAx = Object.keys(l.spec.fixed)[0], fixedM = l.spec.fixed[fixedAx];
  const info = A.axisInfo(l.spec.axis), root = A.dimensionDefault(l.spec.axis);
  const first = [...info.parents].filter(([, p]) => p === root).map(([m]) => m);
  const col = (m) => [{ axis: fixedAx, member: fixedM }, { axis: l.spec.axis, member: m }];
  assert.ok(s.tableStatus(T, 'CY').applicable, 'note open while the statement figure is undetermined');
  s.setTableValue(T, 'CY', col(first[0]), q('Borrowings'), '100', { recalc: true });
  s.setTableValue(T, 'CY', col(first[1]), q('Borrowings'), '50', { recalc: true });
  assert.equal(s.filing.value(q('BorrowingsNoncurrent'), 'CY'), '150', 'taken from the note');
  s.removeSlice(T, 'CY', col(first[1]));
  assert.equal(s.filing.value(q('BorrowingsNoncurrent'), 'CY'), '100', 'follows the note (v1 kept 150)');
  // the total column of the inventories note is the balance-sheet figure itself: removing that column keeps it
  const TI = '401100f:ClassificationOfInventoriesTable';
  s.setValue(q('Inventories'), 'CY', '70');
  s.removeSlice(TI, 'CY', []);
  assert.equal(s.filing.value(q('Inventories'), 'CY'), '70');
});
