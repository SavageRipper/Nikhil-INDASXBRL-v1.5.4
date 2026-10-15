// v1.2 (C&I v13): main-statement figures taken from their notes (derived.js statementNoteLinks, Session.noteLink /
// noteValue / deriveStatements / nilAllowed). Links are discovered from the Ind AS rules and checked here against every
// MCA-validated instance: the filed statement figure must equal its note wherever the note reports the element.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import { authority, q } from './helpers.mjs';
import { Session, CalculatedCellError } from './session.js';
import { statementNoteLinks } from './derived.js';

const A = authority();
const DIR = new URL('./', import.meta.url);
const L = statementNoteLinks(A);
const BS = A.elrs.find((e) => e.code === A.meta.profile.balanceSheet).uri;
function session() {
  const s = new Session(A);
  s.setMeta({ name: 'Test Co', cin: 'U72200KA2010PTC123456', reportType: 'Standalone', level: 'Actual', displayPlaces: 0,
    periods: { cy: { start: '2017-04-01', end: '2018-03-31' }, py: { start: '2016-04-01', end: '2017-03-31' } } });
  return s;
}

test('links are discovered from the Ind AS rules: sum links name an MCA rule, a note table and an axis', () => {
  const sums = [...L.values()].filter((l) => l.kind === 'sum');
  assert.ok(sums.length >= 10, String(sums.length));
  for (const l of sums) {
    assert.ok(A.rules.rules.some((r) => r.id === l.ruleId), l.ruleId);
    assert.equal(A.elr(A.table(l.tableId).presentationElr).group, 'Notes');
    assert.ok(A.table(l.tableId).axes.some((x) => x.axis === l.spec.axis));
  }
  for (const c of ['BorrowingsNoncurrent', 'BorrowingsCurrent', 'PropertyPlantAndEquipment', 'EquityShareCapital']) assert.equal(L.get(q(c))?.kind, 'sum', c);
});

for (const g of readdirSync(DIR).filter((f) => /^golden-.*\.xml$/.test(f))) {
  test(`${g}: every statement figure with a sum link equals its note (where the note reports it)`, () => {
    const s = new Session(A); s.importXml(readFileSync(new URL(g, DIR), 'utf8'), { DOMParserImpl: DOMParser });
    assert.deepEqual(s.statementNoteDifferences().map((d) => `${d.concept} ${d.scope} ${d.value} ≠ ${d.note}`), []);
    for (const l of L.values()) if (l.kind === 'sum') for (const sc of ['CY', 'PY']) assert.ok(!s.noteValue(l, sc)?.undetermined, `${l.concept} ${sc} undetermined`);
  });
}

test('a statement figure follows its note, is read-only on the statement, accepts Nil while the note is empty', () => {
  const s = session();
  const l = L.get(q('BorrowingsNoncurrent'));
  const fixedAx = Object.keys(l.spec.fixed)[0];
  const first = [...A.axisInfo(l.spec.axis).parents].filter(([, p]) => p === A.dimensionDefault(l.spec.axis)).map(([m]) => m);
  const col = (m) => [{ axis: fixedAx, member: l.spec.fixed[fixedAx] }, { axis: l.spec.axis, member: m }];
  // empty note: locked on the statement (enter it in the note), but a nil balance may be reported there
  assert.ok(s.calculatedCell(q('BorrowingsNoncurrent'), 'CY', [], BS)?.note);
  assert.throws(() => s.setValue(q('BorrowingsNoncurrent'), 'CY', '500', { tab: BS }), CalculatedCellError);
  assert.equal(s.setValue(q('BorrowingsNoncurrent'), 'CY', '0', { tab: BS, recalc: true }).value, '0', 'Nil');
  s.filing.removeFact(s.getValue(q('BorrowingsNoncurrent'), 'CY').key);
  s.setTableValue(l.tableId, 'CY', col(first[0]), q('Borrowings'), '300', { recalc: true });
  assert.equal(s.getValue(q('BorrowingsNoncurrent'), 'CY').value, '300');
  assert.equal(s.getValue(q('BorrowingsNoncurrent'), 'CY').origin, 'calculated');
  assert.throws(() => s.setValue(q('BorrowingsNoncurrent'), 'CY', '0', { tab: BS }), CalculatedCellError, 'no Nil once the note has a value');
  assert.equal(s.setValue(q('BorrowingsNoncurrent'), 'CY', '300', { tab: BS }).value, '300', 'typing the value it shows is accepted');
  // "Allow editing of calculated cells": a manual figure, kept; the MCA rule reports the difference
  s.setValue(q('BorrowingsNoncurrent'), 'CY', '999', { tab: BS, override: true, recalc: true });
  s.setTableValue(l.tableId, 'CY', col(first[1]), q('Borrowings'), '50', { recalc: true });
  assert.equal(s.getValue(q('BorrowingsNoncurrent'), 'CY').value, '999');
  assert.equal(s.statementNoteDifferences().length, 1);
});

test('an entered statement figure that differs from its note stays editable and is kept; it follows once it agreed', () => {
  const s = session();
  const l = L.get(q('BorrowingsNoncurrent'));
  const fixedAx = Object.keys(l.spec.fixed)[0];
  const first = [...A.axisInfo(l.spec.axis).parents].filter(([, p]) => p === A.dimensionDefault(l.spec.axis)).map(([m]) => m);
  const col = (m) => [{ axis: fixedAx, member: l.spec.fixed[fixedAx] }, { axis: l.spec.axis, member: m }];
  s.setTableValue(l.tableId, 'CY', col(first[0]), q('Borrowings'), '300', { recalc: true });
  s.filing.setFact({ ...s.getValue(q('BorrowingsNoncurrent'), 'CY'), value: '400', origin: 'import' }); // an imported different figure
  assert.equal(s.calculatedCell(q('BorrowingsNoncurrent'), 'CY', [], BS), null, 'editable');
  s.setTableValue(l.tableId, 'CY', col(first[1]), q('Borrowings'), '50', { recalc: true });
  assert.equal(s.getValue(q('BorrowingsNoncurrent'), 'CY').value, '400', 'kept (it did not agree with the note)');
  s.setTableValue(l.tableId, 'CY', col(first[1]), q('Borrowings'), '100', { recalc: true }); // note now 400 = figure
  s.setTableValue(l.tableId, 'CY', col(first[1]), q('Borrowings'), '120', { recalc: true });
  assert.equal(s.getValue(q('BorrowingsNoncurrent'), 'CY').value, '420', 'follows once it agreed with the note');
});
