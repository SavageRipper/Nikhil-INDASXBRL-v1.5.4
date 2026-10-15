// "Copy from previous year": adds the previous-year columns (axis-member combinations) of a dimensional table to the
// current-year table and, optionally, copies their values. Existing current-year values are never overwritten;
// calculated cells are left to the calculation; every copy goes through Session.setTableValue (same checks as typing).
import { tableSlices } from './views.js';
import { reportingYear } from './periods.js';
import { dimKey } from './model.js';

export function carryForwardPlan(S, tableId) {
  const out = { available: false, reason: '', columns: [], newColumns: [], values: 0 };
  const cy = S.tableStatus(tableId, 'CY'), py = S.tableStatus(tableId, 'PY');
  if (!cy.applicable) { out.reason = 'The current-year table is not applicable.'; return out; }
  if (!py.applicable) { out.reason = 'The previous-year table is not applicable.'; return out; }
  const pyCols = tableSlices(S.A, S.filing, tableId, 'PY', reportingYear);
  if (!pyCols.length) { out.reason = 'The previous-year table has no columns.'; return out; }
  const have = new Set(tableSlices(S.A, S.filing, tableId, 'CY', reportingYear).map(dimKey));
  out.available = true; out.columns = pyCols; out.newColumns = pyCols.filter((d) => !have.has(dimKey(d)));
  out.values = valueCandidates(S, tableId, pyCols).length;
  return out;
}

function valueCandidates(S, tableId, cols) {
  const v = S.tableView(tableId);
  const rows = (v.lineItems || []).filter((l) => !l.abstract && !/periodStartLabel/.test(l.preferredLabel || ''));
  const out = [];
  for (const dims of cols) for (const l of rows) {
    const pyVal = S.getValue(l.concept, 'PY', dims);
    if (pyVal === null || pyVal === undefined) continue;
    if (S.getValue(l.concept, 'CY', dims) !== null) continue;
    try { if (S.calculatedCell(l.concept, 'CY', dims, v.presentationElr)) continue; } catch { /* not calculated */ }
    const pf = S.filing.get(l.concept, S.filing.period(l.concept, 'PY'), dims);
    if (!pf || pf.nil) continue;
    out.push({ dims, concept: l.concept, preferredLabel: l.preferredLabel || null, fact: pf });
  }
  return out;
}

export function carryForward(S, tableId, { values = false } = {}) {
  const plan = carryForwardPlan(S, tableId);
  const res = { columns: [], copied: 0, skipped: 0 };
  if (!plan.available) return res;
  res.columns = plan.newColumns.map((d) => S.validateSlice(tableId, d));
  if (values) for (const c of valueCandidates(S, tableId, plan.columns)) {
    try { S.setTableValue(tableId, 'CY', c.dims, c.concept, S.displayOf(c.fact), { preferredLabel: c.preferredLabel, recalc: true, lockCalculated: true }); res.copied++; }
    catch { res.skipped++; }
  }
  return res;
}

// ---- v1.2 (C&I v13): "Copy from previous year" on the disclosure tabs. The tabs are taken from the authority: the
// Disclosures group whose ELRs MCA reports for the current year only (the Ind AS generic rule on previous-year ELRs,
// GR-12 here) — [700300]–[700700]. Their "previous year" is last year's filing: previous-year values kept in the
// project, or the values that an import as "Roll forward to the next year" set aside as not applicable for the
// previous year (import report). Copied only into EMPTY current-year cells, through the normal entry path.
// Not copied (Ind AS choice, v1.2): amounts and other numbers, dates on or after the start of last year (meeting,
// signing and period dates belong to each year's filing), and the elements GR-12 keeps for both years (they have
// their own previous-year column, e.g. the reporting-period dates and the shareholding figures).
import { dimensionallyValid, tablesForFact } from './dimensions.js';
const keyOf = (concept, dims, period) => `${concept}#${dimKey(dims)}#${JSON.stringify(period)}`;
export function previousYearValues(S) {
  const f = S.filing, P = f.meta.periods, out = new Map();
  if (!P?.py?.end) return out;
  for (const x of f.all()) if (!x.nil && x.value != null && reportingYear(P, x.period) === 'PY') out.set(keyOf(x.concept, x.dims, x.period), x);
  // v1.3: the set-aside store of a filing prepared with "Prepare next year's filing" (last year's disclosures)
  for (const x of f.setAside || []) {
    if (x.value == null || reportingYear(P, x.period) !== 'PY' || !S.A.concept(x.concept)) continue;
    const k = keyOf(x.concept, x.dims || [], x.period);
    if (!out.has(k)) out.set(k, { concept: x.concept, dims: x.dims || [], period: x.period, value: x.value, nil: false });
  }
  for (const x of f.importReport?.notApplicable || []) {
    if (x.value == null || reportingYear(P, x.period) !== 'PY' || !S.A.concept(x.concept)) continue;
    const k = keyOf(x.concept, x.dims || [], x.period);
    if (!out.has(k)) out.set(k, { concept: x.concept, dims: x.dims || [], period: x.period, value: x.value, nil: false });
  }
  return out;
}
// the previous-year ELR rule is located by its handler, as Applicability does (the workbook numbering is not used)
const notPyRule = (A) => A.rules.rules.find((r) => r.status === 'EXECUTABLE' && r.ast?.handler === 'elr-not-for-prior-year')?.ast || {};
export function disclosureTab(A, uri) {
  const e = A.elr(uri);
  return e?.group === 'Disclosures' && (notPyRule(A).codes || []).includes(e.code.slice(0, 6));
}
function notCopied(S, elrUri, x) {
  const A = S.A, P = S.filing.meta.periods;
  if (A.isNumeric(x.concept)) return 'amounts and numbers belong to each year';
  if (A.dataType(x.concept) === 'date' && String(x.value) >= P.py.start) return "a date of last year's filing";
  const ex = notPyRule(A).exceptions?.[A.elr(elrUri).code.slice(0, 6)] || [];
  if (ex.includes(A.concept(x.concept).name)) return 'reported for both years (own previous-year column)';
  return null;
}

/** what a copy would do on a disclosure tab (or one of its tables): { available, reason, items, notCopied } (no changes) */
export function disclosureCarryPlan(S, elrUri, { tableId = null } = {}) {
  const A = S.A;
  const out = { available: false, reason: '', items: [], notCopied: 0 };
  if (!disclosureTab(A, elrUri)) { out.reason = 'Not a disclosure tab.'; return out; }
  if (!S.elrStatus(elrUri, 'CY').applicable) { out.reason = 'This tab is not applicable for the current year.'; return out; }
  const prev = previousYearValues(S);
  if (!prev.size) { out.reason = "No values from last year: prepare this filing from last year's XML (Import XML → “Prepare next year's filing”)."; return out; }
  const display = (x) => S.displayOf({ concept: x.concept, value: x.value, nil: false });
  const empty = (x) => !x || x.nil;
  if (!tableId) for (const r of S.elrView(elrUri).rows) {
    if (r.kind !== 'item' || r.abstract || r.preferredLabel === 'periodStartLabel') continue;
    if (!S.cellStatus(elrUri, r.concept, 'CY').applicable || !empty(S.getValue(r.concept, 'CY', [], r.preferredLabel))) continue;
    const pp = S.periodForCell(r.concept, 'PY', r.preferredLabel);
    const x = pp && prev.get(keyOf(r.concept, [], pp));
    if (!x) continue;
    if (notCopied(S, elrUri, x)) { out.notCopied++; continue; }
    out.items.push({ kind: 'row', concept: r.concept, dims: [], preferredLabel: r.preferredLabel || null, display: display(x) });
  }
  const tables = tableId ? [tableId] : S.elrView(elrUri).rows.filter((r) => r.kind === 'table').map((r) => r.tableId);
  for (const id of tables) {
    const t = A.table(id);
    if (!t || !S.tableStatus(id, 'CY').applicable) continue;
    const lines = (S.tableView(id).lineItems || []).filter((l) => !l.abstract && l.preferredLabel !== 'periodStartLabel' && l.preferredLabel !== 'periodEndLabel');
    for (const x of prev.values()) {
      if (!t.lineItems.includes(x.concept)) continue;
      if (x.dims.length ? !tablesForFact(A, x).some((y) => y.id === id) : t.axes.length) continue;
      const l = lines.find((li) => li.concept === x.concept && JSON.stringify(S.periodForCell(x.concept, 'PY', li.preferredLabel)) === JSON.stringify(x.period));
      if (!l || !empty(S.getValue(x.concept, 'CY', x.dims, l.preferredLabel))) continue;
      if (!dimensionallyValid(A, x.concept, x.dims).valid || !S.conceptStatus(x.concept, 'CY').applicable) continue;
      if (notCopied(S, elrUri, x)) { out.notCopied++; continue; }
      try { S.validateSlice(id, x.dims); } catch { continue; }
      out.items.push({ kind: 'cell', tableId: id, concept: x.concept, dims: x.dims, preferredLabel: l.preferredLabel || null, display: display(x) });
    }
  }
  out.available = true;
  if (!out.items.length) out.reason = 'Every current-year cell that last year reported is already filled (amounts and this year\'s dates are not copied).';
  return out;
}

/** copy last year's values into empty current-year cells of a disclosure tab; Yes/No answers and choices first (they
 *  open dependent cells and tables), repeated while something new becomes applicable. @returns {{ copied, skipped }} */
export function disclosureCarry(S, elrUri, { tableId = null } = {}) {
  const A = S.A;
  const res = { copied: 0, skipped: [] };
  const answer = (it) => ['boolean', 'enum'].includes(A.dataType(it.concept));
  const tried = new Set();
  for (let pass = 0; pass < 4; pass++) {
    const plan = disclosureCarryPlan(S, elrUri, { tableId });
    const todo = plan.items.filter((it) => !tried.has(keyOf(it.concept, it.dims, it.preferredLabel)));
    if (!todo.length) break;
    todo.sort((a, b) => answer(b) - answer(a));
    for (const it of todo) {
      tried.add(keyOf(it.concept, it.dims, it.preferredLabel));
      try {
        if (it.kind === 'row') S.setValue(it.concept, 'CY', it.display, { preferredLabel: it.preferredLabel, tab: elrUri, recalc: true });
        else S.setTableValue(it.tableId, 'CY', it.dims, it.concept, it.display, { preferredLabel: it.preferredLabel, recalc: true, lockCalculated: true });
        res.copied++;
      } catch (e) { res.skipped.push({ concept: it.concept, reason: e.message }); }
    }
  }
  return res;
}
