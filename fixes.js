// v1.3 (C&I v14) UI helper: a one-click remedy for a validation message, where the remedy is unambiguous. The gate and
// the MCA rules decide what is an error; a fix only performs an ordinary edit through the Session (the same path as
// typing: applicability, locks, recalculation), after the user confirms it. Messages without an unambiguous remedy
// have no fix (the message still opens its cell).
//
//   GR-1 a part entered, its total missing              → enter the total = the sum of its parts
//   GR-1 a previous-year opening value whose total has  → set it aside (Hidden data, restorable) — never a value of the
//        no cell for that date                             opening balance sheet column (first-time adoption, GR-16)
//   GR-1 total ≠ Σ parts (an entered / imported total)  → set the total to the sum of its parts
//   statement figure ≠ its note (the MCA rule tying them, e.g. borrowings) → take the figure from the note
//   a mandatory amount not present                      → report nil (0)
//   GR-5 one year entered, the other not                → report nil (0) for the other year
//   a value no tab shows (location 'pyo')               → set it aside
// The rules are recognised by their handler or by the statement-note link, never by a C&I rule number.
import { statementNoteLinks } from './derived.js';
import * as Dec from './decimal.js';
import { cellFor, setAside } from './upkeep.js';
import { Gate } from './gate.js';

const PL = { CY: 'current year', PY: 'previous year', PYO: 'opening balance sheet of the previous year' };
const esc = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LOCKED = 'The previous year is locked (last year\'s filed figures) — unlock it first (tab tools).';
const handlerOf = (A, id) => A.rules.rules.find((r) => r.id === id)?.ast?.handler || null;

export function fixFor(S, issue) {
  if (!issue || issue.severity !== 'ERROR') return null;
  const A = S.A, f = S.filing;
  const fact = issue.factKey ? f.facts.get(issue.factKey) : null;
  const msg = String(issue.message || '').replace(/^\[[^\]]+\]\s*/, '');
  const handler = issue.ruleId ? handlerOf(A, issue.ruleId) : null;
  // a value no tab shows (dated outside the filing's years, or a previous-year opening value without its cell)
  if (issue.location?.kind === 'pyo' && fact) {
    const other = f.scopeOf(fact.period) === 'OTHER';
    return { label: 'Set it aside', confirm: `Set aside <b>${esc(A.label(fact.concept))}</b> dated ${esc(fact.period.date || `${fact.period.start} → ${fact.period.end}`)}? ${other ? "It is outside this filing's two years" : 'No tab shows a cell for it'}; it stays in the project under Hidden data (restorable) and is no longer part of the filing.`, apply: () => setAside(S, [{ fact, reason: other ? 'otherDate' : 'openingNoCell' }], 'fix') };
  }
  // GR-1: a part entered, its total missing
  if (handler === 'calc-parent-child' && fact && /is entered but its calculation parent/.test(msg)) {
    const sc = f.scopeOf(fact.period);
    const parents = S.calcParentsOf(fact.concept, fact.period, fact.dims);
    const g = new Gate(A);
    for (const p of parents) {
      if (sc === 'PYO' && !g.openingCell(f, p, fact.period, fact.dims)) continue; // no cell for this total at that date
      const t = S.totalFromParts(p, fact.period, fact.dims);
      if (!t) continue;
      if (S.periodLocked(fact.period)) return { label: 'Enter the total', disabled: LOCKED };
      return { label: `Enter ${A.label(p)} = sum of parts`, confirm: `Enter <b>${esc(A.label(p))}</b> (${PL[sc] || sc}) as the sum of its parts reported here: <b>${esc(S.displayOf({ concept: p, value: t.value, nil: false }))}</b>.`, apply: () => S.setTotalFromParts(p, fact.period, fact.dims) };
    }
    // a previous-year opening value whose totals have no cell for that date (never one the GR-16 column shows)
    const inSheet = g.openingCell(f, fact.concept, fact.period, fact.dims)?.scope === 'PYO';
    if (sc === 'PYO' && !inSheet && !parents.some((p) => g.openingCell(f, p, fact.period, fact.dims))) {
      if (S.periodLocked(fact.period)) return { label: 'Set this opening value aside', disabled: LOCKED };
      return { label: 'Set this opening value aside', confirm: `Set aside the previous-year opening value <b>${esc(A.label(fact.concept))}</b> dated ${esc(fact.period.date)}? Its total has no cell for that date. It stays in the project under Hidden data (restorable) and is no longer part of the filing.`, apply: () => setAside(S, [{ fact, reason: 'openingNoCell' }], 'fix') };
    }
    return null;
  }
  // GR-1: total ≠ Σ parts, the total was entered or imported (a calculated total follows its parts by itself)
  if (handler === 'calc-parent-child' && fact && /^Calculation inconsistency/.test(msg) && fact.origin !== 'calculated') {
    const t = S.totalFromParts(fact.concept, fact.period, fact.dims);
    if (!t) return null;
    const sc = f.scopeOf(fact.period);
    if (S.periodLocked(fact.period)) return { label: 'Set total = sum of parts', disabled: LOCKED };
    return { label: 'Set total = sum of parts', confirm: `Replace <b>${esc(A.label(fact.concept))}</b> (${PL[sc] || sc}) ${esc(S.displayOf(fact))} by the sum of its parts <b>${esc(S.displayOf({ concept: fact.concept, value: t.value, nil: false }))}</b>? Only if the parts are right — otherwise correct the parts.`, apply: () => S.setTotalFromParts(fact.concept, fact.period, fact.dims) };
  }
  // a statement figure that differs from its note (the MCA rule tying them)
  for (const l of statementNoteLinks(A).values()) {
    if (l.kind !== 'sum' || l.ruleId !== issue.ruleId) continue;
    const sc = issue.scope === 'PY' ? 'PY' : 'CY';
    const v = S.noteValue(l, sc);
    const p = f.period(l.concept, sc);
    const x = p && f.get(l.concept, p, []);
    if (!v || v.undetermined || !x) continue;
    if (S.periodLocked(p)) return { label: 'Take the figure from the note', disabled: LOCKED };
    const total = Dec.toString(v.total);
    return { label: 'Take the figure from the note', confirm: `Set <b>${esc(A.label(l.concept))}</b> (${PL[sc]}) to the note's figure <b>${esc(S.displayOf({ concept: l.concept, value: total, nil: false }))}</b> (now ${esc(S.displayOf(x))})? Only if the note is right — otherwise correct the note.`, apply: () => { f.setFact({ concept: l.concept, period: p, dims: [], value: total, decimals: v.decimals, unit: v.unit || x.unit, origin: 'calculated' }); S.recalcFrom(l.concept, p, [], 0, { before: x.value, after: total }); } };
  }
  // a mandatory amount not present → nil
  const m = /^'(.+)' is mandatory — not present for (CY|PY) /.exec(msg);
  if (m && issue.concept && A.isNumeric(issue.concept)) return nilFix(S, issue.concept, m[2], []);
  // GR-5: one year entered, the other not → nil for the other year (the message is located at the missing cell)
  if (handler === 'cy-py-pairing' && issue.concept && A.isNumeric(issue.concept) && /value should be entered/.test(msg) && (issue.scope === 'CY' || issue.scope === 'PY')) {
    const other = issue.scope === 'CY' ? 'PY' : 'CY';
    const op = f.period(issue.concept, other);
    const prev = op && f.get(issue.concept, op, issue.dims || []);
    return nilFix(S, issue.concept, issue.scope, issue.dims || [], prev, other);
  }
  return null;
}

function nilFix(S, concept, scope, dims = [], otherFact = null, otherScope = null) {
  const A = S.A;
  const period = S.filing.period(concept, scope);
  if (S.pyLocked(scope)) return { label: 'Report nil (0)', disabled: LOCKED };
  const confirm = `Report <b>${esc(A.label(concept))}</b> as <b>0</b> for the ${PL[scope]}${otherFact ? ` (the ${PL[otherScope]} reports ${esc(S.displayOf(otherFact))})` : ''}? Only if the amount really is nil — otherwise enter the figure in its cell.`;
  return { label: 'Report nil (0)', confirm, apply: () => {
    const t = cellFor(S, { concept, period, dims });
    if (t.why) throw new Error(`No cell for this value: ${t.why}`);
    if (t.kind === 'row') return S.setValue(concept, t.scope, '0', { preferredLabel: t.preferredLabel, tab: t.elrUri, recalc: true });
    return S.setTableValue(t.tableId, t.scope, t.dims, concept, '0', { preferredLabel: t.preferredLabel, recalc: true, lockCalculated: true });
  } };
}
