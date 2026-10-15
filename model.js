// Filing-state engine: the single source of truth for a filing's facts.
// Facts are keyed by (concept, period, dimensions). CURRENT/PRIOR is derived from the
// period dates, never from fact order.
import * as Dec from './decimal.js';
import { periodKey, periodFor, scopeOf, validatePeriods, isoDate } from './periods.js';
import { scalePower, toCanonical, monetaryDecimals, enteredDecimals } from './scaling.js';
import { defaultUnitFor, decimalFamilies } from './units.js';
import { xmlSafe } from './richtext.js';

export function normDims(dims) {
  return (dims || []).map((d) => (d.typed != null ? { axis: d.axis, typed: String(d.typed) } : { axis: d.axis, member: d.member }))
    .sort((a, b) => a.axis.localeCompare(b.axis));
}
export function dimKey(dims) {
  return normDims(dims).map((d) => (d.member ? `${d.axis}=${d.member}` : `${d.axis}="${d.typed}"`)).join('|');
}
export function factKey(concept, period, dims) { return `${concept}#${periodKey(period)}#${dimKey(dims)}`; }

export class FactValueError extends Error {}

export function defaultMeta() {
  return {
    name: 'Untitled filing',
    cin: '',
    reportType: 'Standalone',
    firstFinancialYear: false,
    periods: { cy: { start: '', end: '' }, py: { start: '', end: '' } },
    level: 'Actual',
    displayPlaces: 0,
    // v1.5: decimal places of the statement figures as presented (null = displayPlaces); typed amounts are declared at
    // this accuracy unless they carry finer digits (Filing.defaultDecimals)
    statementPlaces: null,
    currency: 'INR',
    schemaRef: null, // null = authority default (Filing Manual); set from an imported validated instance
    // text blocks (v1.1): 'headings' (default for new filings) = bold / italic / underline saved as plain text, whole bold
    // lines made headings by Tidy and Word pastes (richtext.js tidy); 'highlight' = highlightedText1/2/3 (white on grey
    // in the MCA PDF; kept for instances that use them); 'none' = plain text throughout. Saved projects keep theirs.
    textEmphasis: 'headings',
  };
}

export class Filing {
  constructor(authority, meta = {}) {
    this.A = authority;
    this.meta = { ...defaultMeta(), ...meta, periods: { ...defaultMeta().periods, ...(meta.periods || {}) } };
    this.facts = new Map();
    this.footnotes = new Map(); // id -> {id, text, lang, factKeys:Set}
    this.importReport = null;
    // v1.3: values kept in the project but not part of the filing (never generated, never checked): earlier years,
    // last year's current-year-only disclosures, values no tab can show (upkeep.js). Restorable from Hidden data.
    this.setAside = [];
    // v1.3: last year's filed figures (the previous-year column as filed), for the comparison on the Validation page
    this.filedReference = null;
    this.revision = 0;
  }

  periodsValid() { return validatePeriods(this.meta.periods).length === 0; }
  period(concept, scope) {
    const c = this.A.concept(concept);
    return periodFor(this.meta.periods, c.periodType, scope);
  }
  scopeOf(period) { return scopeOf(this.meta.periods, period); }

  // ---- canonicalisation of a raw value for a concept
  canonicalValue(concept, raw) {
    const A = this.A;
    const t = A.dataType(concept);
    if (raw == null) throw new FactValueError('Empty value');
    const s = String(raw).trim();
    if (A.isNumeric(concept)) {
      if (!Dec.isDecimalString(s.replace(/,/g, ''))) throw new FactValueError(`'${s}' is not a number`);
      return Dec.toString(Dec.parse(s));
    }
    switch (t) {
      case 'boolean': {
        if (/^(true|yes)$/i.test(s)) return 'true';
        if (/^(false|no)$/i.test(s)) return 'false';
        throw new FactValueError(`'${s}' is not true/false`);
      }
      case 'date': if (!isoDate(s)) throw new FactValueError(`'${s}' is not a yyyy-mm-dd date`); return s;
      case 'enum': {
        const en = A.enumerations(concept);
        if (!en.includes(s)) throw new FactValueError(`'${s}' is not one of: ${en.join(', ')}`);
        return s;
      }
      default: return xmlSafe(String(raw));
    }
  }

  // ---- low-level fact API (used by importer and controller)
  setFact({ concept, period, dims = [], value = null, nil = false, decimals, unit, lang, origin = 'user', source = null, id = null }) {
    const A = this.A;
    const c = A.concept(concept);
    if (!c) throw new FactValueError(`Unknown concept ${concept}`);
    if (!A.isReportable(concept)) throw new FactValueError(`${concept} is not a reportable item`);
    if (c.periodType === 'instant' && period.type !== 'instant') throw new FactValueError(`${concept} requires an instant period`);
    if (c.periodType === 'duration' && period.type !== 'duration') throw new FactValueError(`${concept} requires a duration period`);
    const nd = normDims(dims);
    const key = factKey(concept, period, nd);
    const numeric = A.isNumeric(concept);
    const canonical = nil ? null : this.canonicalValue(concept, value);
    const prev = this.facts.get(key);
    const fact = {
      key, concept, period: { ...period }, dims: nd, value: canonical, nil: !!nil,
      decimals: numeric && !nil ? (decimals ?? null) : null,
      unit: numeric ? (unit || this.unitFor(concept)) : null,
      lang: numeric || !A.langAllowed(concept) ? null : (lang || null),
      origin, source: source || prev?.source || null, sourceId: id || prev?.sourceId || null,
    };
    if (numeric && !nil && fact.decimals == null) fact.decimals = String(this.defaultDecimals(concept, canonical));
    this.facts.set(key, fact);
    this.revision++;
    return fact;
  }

  // v1.5.2: the unit of a new numeric fact. A count / ratio (data type 'decimal') takes the unit its family already uses in
  // this filing (units.js decimalFamilies) — the imported facts' unit first — so that a total and its parts are in one
  // unit; otherwise the type's default (INR, shares, pure …).
  unitFor(concept) {
    const t = this.A.dataType(concept);
    if (t === 'decimal') {
      // v1.5.4: a count in no family (e.g. number of subsidiary companies) is its own family: it keeps the unit the
      // filing already uses for it (last year's imported figure first)
      const fam = decimalFamilies(this.A), id = fam.get(concept) || concept;
      {
        const mine = this.all().filter((x) => x.unit && (fam.get(x.concept) || x.concept) === id);
        const count = (pred) => { const m = new Map(); for (const x of mine) if (pred(x)) m.set(x.unit, (m.get(x.unit) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0]; };
        const u = count((x) => x.origin === 'import') || count(() => true);
        if (u) return u;
      }
    }
    return defaultUnitFor(t, this.meta.currency);
  }

  // v1.5.2: a family of counts / ratios reported in more than one unit is put into one unit (the imported facts' unit
  // first, else the most used one). Values, decimals and origins are unchanged. @returns the facts changed
  harmonizeUnits() {
    const fam = decimalFamilies(this.A), byFam = new Map();
    // v1.5.4: a count in no family is its own family (one unit for both years)
    for (const x of this.all()) { const id = !x.nil && x.unit && this.A.dataType(x.concept) === 'decimal' && (fam.get(x.concept) || x.concept); if (id) (byFam.get(id) || byFam.set(id, []).get(id)).push(x); }
    const changed = [];
    for (const list of byFam.values()) {
      if (new Set(list.map((x) => x.unit)).size < 2) continue;
      const pick = (arr) => { const m = new Map(); for (const x of arr) m.set(x.unit, (m.get(x.unit) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0]; };
      const target = pick(list.filter((x) => x.origin === 'import')) || pick(list);
      for (const x of list) if (x.unit !== target) { changed.push({ concept: x.concept, period: x.period, dims: x.dims, before: x.unit, after: target }); x.unit = target; }
    }
    if (changed.length) this.revision++;
    return changed;
  }

  // v1.5: accuracy (decimals) of the filing's statement figures for a monetary concept, null otherwise — the fewest
  // places a derived total is rounded to (session.js sumDecimals)
  statementDecimals(concept) {
    return this.A.dataType(concept) === 'monetary' ? this.defaultDecimals(concept, '0') : null;
  }

  defaultDecimals(concept, canonical) {
    if (this.A.dataType(concept) === 'monetary') {
      // accuracy of the filing's statement figures, raised if the value carries finer digits (capped at 2, GR-8).
      // v1.5: meta.statementPlaces (decimal places of the statement figures as presented — set on import from the figures
      // most of the instance reports at; null = the display places) can be coarser than the display places a few figures
      // need: e.g. statements presented in lakhs to 2 places (decimals -3) with share capital to the
      // rupee; with 4 display places every typed figure was declared accurate to ten rupees and totals of the rounded
      // statement figures could not agree (Equity and liabilities ≠ Assets).
      const places = this.meta.statementPlaces ?? this.meta.displayPlaces;
      const d = monetaryDecimals(this.meta.level, Math.min(places, this.meta.displayPlaces));
      const req = Dec.requiredDecimals(Dec.parse(canonical));
      if (req === Infinity || req <= d) return Math.min(2, d);
      // a figure with more places than the statements use (share capital to the rupee in a filing presented to 2 places in
      // lakhs) is presented to the display places: declared at their accuracy, not at the coarsest that fits its digits —
      // else a total of it with a figure to the rupee was rounded to that coarser accuracy (a closing share capital to the
      // rupee lost its last digit)
      return Math.min(2, Math.max(monetaryDecimals(this.meta.level, this.meta.displayPlaces), req));
    }
    return enteredDecimals(canonical);
  }

  // UI/editing entry point: value typed in the filing's display scale.
  // Monetary values are rounded (half away from zero) to displayPlaces, then scaled to canonical.
  setDisplayValue({ concept, period, dims = [], display, origin = 'user' }) {
    const A = this.A;
    const key = factKey(concept, period, dims);
    if (display == null || String(display).trim() === '') { this.removeFact(key); return null; }
    const prev = this.facts.get(key);
    const t = A.dataType(concept);
    if (t === 'monetary') {
      const raw = String(display).trim().replace(/,/g, '');
      if (!Dec.isDecimalString(raw)) throw new FactValueError(`'${display}' is not a number`);
      const rounded = Dec.toString(Dec.round(Dec.parse(raw), this.meta.displayPlaces));
      const canonical = toCanonical(rounded, this.meta.level);
      let decimals = String(this.defaultDecimals(concept, canonical));
      // keep imported decimals when the edited value is still consistent with them; the same value typed again keeps its
      // accuracy (the cell shows 22,475.1 for 22,475.10 — retyping it must not make it coarser)
      if (prev?.decimals != null && prev.origin !== 'user' && Dec.eq(Dec.round(Dec.parse(canonical), prev.decimals), Dec.parse(canonical))) decimals = prev.decimals;
      else if (prev?.decimals != null && !prev.nil && prev.value === canonical) decimals = prev.decimals;
      return this.setFact({ concept, period, dims, value: canonical, decimals, origin: prev ? prev.origin === 'user' ? 'user' : 'edited' : origin, unit: prev?.unit });
    }
    const canonical = this.canonicalValue(concept, display);
    let decimals;
    if (A.isNumeric(concept)) {
      decimals = String(enteredDecimals(canonical));
      if (prev?.decimals != null && prev.origin !== 'user' && Dec.eq(Dec.round(Dec.parse(canonical), prev.decimals), Dec.parse(canonical))) decimals = prev.decimals;
    }
    return this.setFact({ concept, period, dims, value: canonical, decimals, origin: prev ? prev.origin === 'user' ? 'user' : 'edited' : origin, unit: prev?.unit, lang: prev?.lang || (A.isNumeric(concept) ? null : 'en') });
  }

  removeFact(key) { const ok = this.facts.delete(key); if (ok) this.revision++; for (const f of this.footnotes.values()) f.factKeys.delete(key); return ok; }
  get(concept, period, dims = []) { return this.facts.get(factKey(concept, period, dims)) || null; }
  all() { return [...this.facts.values()]; }
  factsOf(concept) { return this.all().filter((f) => f.concept === concept); }
  inScope(scope) { return this.all().filter((f) => this.scopeOf(f.period) === scope); }

  // value lookup by concept + scope + dims (period resolved from the concept's periodType)
  value(concept, scope, dims = []) {
    const p = this.period(concept, scope);
    if (!p) return null;
    const f = this.get(concept, p, dims);
    return f && !f.nil ? f.value : null;
  }

  // ---- metadata facts mirrored into the general-information ELR
  addFootnote(text, factKeys = [], lang = 'en') {
    let n = this.footnotes.size + 1; while (this.footnotes.has(`fn${n}`)) n++;
    const id = `fn${n}`;
    this.footnotes.set(id, { id, text, lang, factKeys: new Set(factKeys) });
    this.revision++;
    return id;
  }

  // ---- persistence (local-first project file)
  toJSON() {
    return {
      format: 'mca-indas-xbrl-project', version: 1, authorityHash: this.A.meta.authorityHash,
      meta: this.meta,
      facts: this.all().map(({ key, ...f }) => f),
      footnotes: [...this.footnotes.values()].map((f) => ({ ...f, factKeys: [...f.factKeys] })),
      importReport: this.importReport,
      setAside: this.setAside,
      filedReference: this.filedReference,
    };
  }
  static fromJSON(authority, json) {
    if (json.format !== 'mca-indas-xbrl-project') throw new Error('Not an MCA Ind AS XBRL project file (Nikhil-IndASXBRL)');
    const f = new Filing(authority, json.meta);
    for (const x of json.facts) {
      const fact = { ...x, dims: normDims(x.dims) };
      fact.key = factKey(fact.concept, fact.period, fact.dims);
      f.facts.set(fact.key, fact);
    }
    for (const fn of json.footnotes || []) f.footnotes.set(fn.id, { ...fn, factKeys: new Set(fn.factKeys) });
    f.importReport = json.importReport || null;
    f.setAside = Array.isArray(json.setAside) ? json.setAside.map((x) => ({ ...x, dims: normDims(x.dims || []) })) : [];
    f.filedReference = json.filedReference || null;
    return f;
  }
}

export { scalePower };
