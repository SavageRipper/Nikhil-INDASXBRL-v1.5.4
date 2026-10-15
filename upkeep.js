// v1.3 (C&I v14) UI helper: keeping a project healthy. No compliance logic of its own — every value goes through the
// Session (setValue / setTableValue: applicability, dimensions, locks, recalculation); the gate and the rule engine
// decide what is an error.
//
//   healthCheck      on opening / importing / saving: re-derive values the tool calculated itself that are out of date
//                    (statement figures taken from notes, totals, carrying amounts, closing balances) and move values
//                    that no tab can show (other dates; previous-year opening values without a cell) to the set-aside
//                    store. Entered, imported and manual figures are never changed; nothing is deleted.
//   hiddenData       everything in the project that is not shown as filing data: the set-aside store, values made not
//                    applicable (kept, excluded from the filing — e.g. after a Yes/No answer), values no tab shows
//   restore / delete set-aside values (restore = the normal entry path into the cell that shows that date)
//   compareWithFiled the previous-year column against last year's filed figures (from the filed XML)
//
// Ind AS (first-time adoption, GR-16): a value of the opening balance sheet of the previous year (a balance-sheet
// element without dimensions at the day before the previous year starts) is NEVER "unshown": the opening balance sheet
// column shows it while first-time adoption is Yes, and while it is No the value is only "not applicable" (kept; it
// comes back with Yes). The health check never moves it.
import { Gate } from './gate.js';
import { scopeOf } from './periods.js';
import { tablesForFact, dimensionallyValid, nondimAllowed } from './dimensions.js';
import { factKey, normDims } from './model.js';
import { totalColumnAllowed, buildElrView } from './views.js';
import { importInstance } from './importer.js';
import * as Dec from './decimal.js';

export const SET_ASIDE_REASONS = {
  yearBeforeLast: "Last year's previous-year figures (the year before last — not part of this filing)",
  openingBeforeLast: "Last year's previous-year opening balances, or its opening balance sheet under first-time adoption (not part of this filing)",
  notApplicablePreviousYear: 'Last year\'s values of elements reported for the current year only (disclosures, GR-12) — see "Copy from previous year" on their tab',
  notApplicable: "Last year's values whose cell does not apply to this filing",
  otherDate: "Dated outside this filing's two years",
  openingNoCell: 'Previous-year opening values that no tab shows (no opening-balance row for them)',
};

const samePeriod = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// balance-sheet elements the opening balance sheet column (GR-16) shows (no dimensions, instant, not an opening row)
function openingSheetConcepts(A) {
  const bs = A.elrByCode(A.meta.profile?.balanceSheet);
  if (!bs) return new Set();
  return new Set(buildElrView(A, bs.uri).rows.filter((r) => r.kind === 'item' && r.preferredLabel !== 'periodStartLabel' && A.concept(r.concept)?.periodType === 'instant').map((r) => r.concept));
}

// an "at beginning of period" row for the element exists on a tab or in a table that can carry its members (structure
// only: a row that is merely not applicable now — e.g. after a Yes/No answer — still shows the value when it applies)
function openingRowExists(S, x) {
  const A = S.A;
  if (!x.dims.length && A.elrs.some((e) => S.elrView(e.uri).rows.some((r) => r.kind === 'item' && r.concept === x.concept && r.preferredLabel === 'periodStartLabel'))) return true;
  const ts = x.dims.length ? tablesForFact(A, x) : A.tables.filter((t) => t.lineItems.includes(x.concept));
  return ts.some((t) => S.tableView(t.id).lineItems.some((l) => l.concept === x.concept && l.preferredLabel === 'periodStartLabel'));
}
// values in the filing that no tab can show: other dates; previous-year opening values that neither an "at beginning of
// period" row nor the opening balance sheet column (GR-16) can show. Not among them: values the tool calculated itself,
// opening values that are the totals (GR-1) of opening values that ARE shown, and opening-balance-sheet values (above).
export function unshownFacts(S) {
  const A = S.A, g = new Gate(A), f = S.filing, out = [];
  const sheet = openingSheetConcepts(A);
  const pyo = f.all().filter((x) => f.scopeOf(x.period) === 'PYO');
  const shown = new Set(pyo.filter((x) => x.origin === 'calculated' || (!x.dims.length && sheet.has(x.concept)) || g.openingCell(f, x.concept, x.period, x.dims) || openingRowExists(S, x)).map((x) => x.key));
  const needed = new Set();
  const up = (x, depth = 0) => {
    if (depth > 30) return;
    for (const p of S.calcParentsOf(x.concept, x.period, x.dims)) {
      const px = f.get(p, x.period, x.dims);
      if (px && !needed.has(px.key)) { needed.add(px.key); up(px, depth + 1); }
    }
  };
  for (const x of pyo) if (shown.has(x.key)) up(x);
  for (const x of f.all()) {
    const sc = f.scopeOf(x.period);
    if (sc === 'OTHER') out.push({ fact: x, reason: 'otherDate' });
    else if (sc === 'PYO' && !shown.has(x.key) && !needed.has(x.key)) out.push({ fact: x, reason: 'openingNoCell' });
  }
  return out;
}

// move values out of the filing into the set-aside store (each removal re-derives what was calculated from it)
export function setAside(S, items, source = 'health check') {
  const at = new Date().toISOString().slice(0, 10);
  const list = items.map(({ fact, reason }) => ({ concept: fact.concept, period: fact.period, dims: fact.dims, value: fact.nil ? null : fact.value, nil: !!fact.nil, decimals: fact.decimals ?? null, unit: fact.unit ?? null, lang: fact.lang ?? null, reason, source, at }));
  S.removeFacts(items.map((i) => i.fact));
  S.filing.setAside.push(...list);
  S.filing.revision++;
  return list;
}

export function healthCheck(S, { move = true } = {}) {
  // v1.5.2: counts / ratios of one family in one unit before anything is recalculated (model.js harmonizeUnits)
  const units = S.filing.harmonizeUnits();
  // v1.5.3: bulleted lists written by v1.5.1 and earlier as noteText2 (the MCA PDF prints it bold in a grey box) take
  // the list style numbered lists use (noteText1: normal text, indented) — the class only, the text is unchanged
  const lists = [];
  for (const f of S.filing.all()) {
    if (f.nil || typeof f.value !== 'string' || !f.value.includes('class="noteText2"') || S.A.dataType(f.concept) !== 'textBlock') continue;
    const v = f.value.replace(/<div class="noteText2">(?=<p>\u2022)/g, '<div class="noteText1">');
    if (v !== f.value) { lists.push({ concept: f.concept, period: f.period, dims: f.dims }); f.value = v; S.filing.revision++; }
  }
  const statements = S.refreshDerivedStatements();
  const cells = S.refreshCalculatedCells();
  const moved = move ? setAside(S, unshownFacts(S)) : [];
  return { statements, cells, moved, units, lists, changed: statements.length + cells.length + moved.length + units.length + lists.length };
}

export function hiddenData(S) {
  const f = S.filing;
  const notApplicable = S.app.planFacts(f).excluded.map((x) => ({ fact: x.fact, reasons: x.reasons }));
  const na = new Set(notApplicable.map((x) => x.fact.key));
  return { setAside: f.setAside.map((x, i) => ({ ...x, index: i })), notApplicable, unshown: unshownFacts(S).filter((x) => !na.has(x.fact.key)) };
}
export const hiddenCount = (S) => { const h = hiddenData(S); return h.setAside.length + h.notApplicable.length + h.unshown.length; };

// the cell a set-aside value would go back into (same element, date and members), or why there is none
export function restoreTarget(S, x) {
  if (S.filing.get(x.concept, x.period, normDims(x.dims || []))) return { why: 'the cell already has a value' };
  return cellFor(S, x);
}
// the cell (tab row or table cell) that shows an element at a date with members, or why there is none
export function cellFor(S, x) {
  const A = S.A, f = S.filing, g = new Gate(A);
  const sc = scopeOf(f.meta.periods, x.period);
  const dims = normDims(x.dims || []);
  if (!A.concept(x.concept)) return { why: 'element unknown to the taxonomy' };
  if (sc === 'OTHER' || !sc) return { why: "dated outside this filing's years" };
  if (sc === 'PYO') {
    const loc = g.openingCell(f, x.concept, x.period, dims);
    if (!loc) return { why: 'no tab shows a cell for this date' };
    if (loc.scope === 'PYO') return { kind: 'row', scope: 'PYO', elrUri: loc.elrUri, dims: [], preferredLabel: null };
    return { kind: loc.tableId ? 'cell' : 'row', scope: 'PY', elrUri: loc.elrUri, tableId: loc.tableId, dims, preferredLabel: 'periodStartLabel' };
  }
  const plOk = (pl) => samePeriod(S.periodForCell(x.concept, sc, pl), x.period);
  if (!dims.length) {
    for (const e of A.elrs) {
      const r = S.elrView(e.uri).rows.find((y) => y.kind === 'item' && y.concept === x.concept && plOk(y.preferredLabel));
      if (r && S.cellStatus(e.uri, x.concept, sc).applicable) return { kind: 'row', scope: sc, elrUri: e.uri, dims: [], preferredLabel: r.preferredLabel || null };
    }
  }
  const ts = dims.length ? tablesForFact(A, { concept: x.concept, dims }) : A.tables.filter((t) => t.lineItems.includes(x.concept) && (!t.axes.length || totalColumnAllowed(A, t.id)) && nondimAllowed(A, x.concept));
  for (const t of ts) {
    if (!S.tableStatus(t.id, sc).applicable) continue;
    const l = S.tableView(t.id).lineItems.find((y) => y.concept === x.concept && plOk(y.preferredLabel));
    if (!l) continue;
    try { S.validateSlice(t.id, dims); } catch { continue; }
    if (dims.length && !dimensionallyValid(A, x.concept, dims).valid) continue;
    return { kind: 'cell', scope: sc, tableId: t.id, elrUri: t.presentationElr, dims, preferredLabel: l.preferredLabel || null };
  }
  return { why: S.conceptStatus(x.concept, sc).applicable ? 'no tab shows a cell for it' : 'not applicable to this filing' };
}

function enter(S, t, concept, display, { unlockPY = false, override = false } = {}) {
  if (t.kind === 'row') return S.setValue(concept, t.scope, display, { preferredLabel: t.preferredLabel, tab: t.elrUri, recalc: true, unlockPY, override: true });
  return S.setTableValue(t.tableId, t.scope, t.dims, concept, display, { preferredLabel: t.preferredLabel, recalc: true, unlockPY, override });
}

// put set-aside values back into their cells (normal entry path); those restored leave the store
export function restoreSetAside(S, indexes, { unlockPY = false } = {}) {
  const f = S.filing, res = { restored: 0, skipped: [] };
  const done = new Set();
  for (const i of indexes) {
    const x = f.setAside[i];
    if (!x) continue;
    const t = restoreTarget(S, x);
    if (t.why) { res.skipped.push({ concept: x.concept, reason: t.why }); continue; }
    const display = x.nil ? '' : S.displayOf({ concept: x.concept, value: x.value, nil: false });
    try { enter(S, t, x.concept, display, { unlockPY }); done.add(i); res.restored++; }
    catch (e) { res.skipped.push({ concept: x.concept, reason: e.message }); }
  }
  f.setAside = f.setAside.filter((_, i) => !done.has(i));
  f.revision++;
  return res;
}
export function deleteSetAside(S, indexes) {
  const drop = new Set(indexes);
  const n = S.filing.setAside.length;
  S.filing.setAside = S.filing.setAside.filter((_, i) => !drop.has(i));
  S.filing.revision++;
  return n - S.filing.setAside.length;
}

// ---- last year's filed figures (previous-year column)
const valueEq = (A, concept, a, b) => {
  if (a == null || b == null) return a == null && b == null;
  if (A.isNumeric(concept) && Dec.isDecimalString(String(a)) && Dec.isDecimalString(String(b))) return Dec.eq(Dec.parse(String(a)), Dec.parse(String(b)));
  return String(a).trim() === String(b).trim();
};
// differences between the previous-year column (with its opening balances) and last year's filed figures
export function compareWithFiled(S) {
  const A = S.A, f = S.filing, ref = f.filedReference;
  if (!ref?.facts?.length) return null;
  const out = [];
  const keys = new Set();
  for (const r of ref.facts) {
    if (!r.concept || !A.concept(r.concept)) continue;
    const dims = normDims(r.dims || []);
    const key = factKey(r.concept, r.period, dims);
    keys.add(key);
    const x = f.facts.get(key);
    const sc = f.scopeOf(r.period) === 'PYO' ? 'PY' : f.scopeOf(r.period);
    // a filed balance of the year before last that no previous-year cell shows (set aside) is not part of the column
    if ((!x || x.nil) && f.scopeOf(r.period) === 'PYO' && cellFor(S, { concept: r.concept, period: r.period, dims }).why) continue;
    if (!x || x.nil) { if (r.value != null && (sc === 'PY' || sc === 'CY') && S.conceptStatus(r.concept, sc).applicable) out.push({ kind: 'missing', concept: r.concept, period: r.period, dims, filed: r.value, now: null, key }); continue; }
    if (!valueEq(A, r.concept, x.value, r.value)) out.push({ kind: 'changed', concept: r.concept, period: r.period, dims, filed: r.value, now: x.value, key });
  }
  for (const x of f.all()) {
    if (!['PY', 'PYO'].includes(f.scopeOf(x.period)) || keys.has(x.key) || x.nil || ['calculated', 'import', 'meta', 'carried', 'derived'].includes(x.origin)) continue;
    out.push({ kind: 'added', concept: x.concept, period: x.period, dims: x.dims, filed: null, now: x.value, key: x.key });
  }
  return { file: ref.file, items: out };
}
// attach last year's filed XML as the reference for an existing project (its current year must be this filing's
// previous year)
export function attachFiledXml(S, text, { fileName = 'filed.xml', DOMParserImpl } = {}) {
  const { filing: g } = importInstance(S.A, text, { fileName, yearMode: 'next', DOMParserImpl });
  const py = S.filing.meta.periods.py, gpy = g.meta.periods.py;
  if (!py?.end || py.start !== gpy.start || py.end !== gpy.end) throw new Error(`This XML reports the year ${gpy.start || '?'} → ${gpy.end || '?'}, not this filing's previous year (${py?.start || '?'} → ${py?.end || '?'}).`);
  S.filing.filedReference = { ...g.filedReference, file: fileName };
  S.filing.revision++;
  return compareWithFiled(S);
}
// put the filed figure back into the previous-year column (the previous year is unlocked for this one entry)
export function useFiledFigure(S, item) {
  const display = S.displayOf({ concept: item.concept, value: item.filed, nil: false });
  const t = cellFor(S, { concept: item.concept, period: item.period, dims: item.dims });
  if (t.why) throw new Error(t.why);
  return enter(S, t, item.concept, display, { unlockPY: true, override: true });
}

// a date change that leaves values outside the filing (setup page): the values that no tab would show
export const leftAfterDateChange = (S) => unshownFacts(S);
