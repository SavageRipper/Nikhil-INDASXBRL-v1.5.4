// Units for numeric concepts, as required by the Ind AS 2017 taxonomy item types.
// Filing Manual Ind AS §1.1.3.1 #7/#24, generic rule 8 (INR except the listed subsidiary elements).

export const UNIT_DEFS = {
  INR: { id: 'INR', measures: ['iso4217:INR'] },
  shares: { id: 'shares', measures: ['xbrli:shares'] },
  pure: { id: 'pure', measures: ['xbrli:pure'] },
  INRPerShare: { id: 'INRPerShare', numerator: ['iso4217:INR'], denominator: ['xbrli:shares'] },
};

export function currencyUnit(code) {
  if (code === 'INR') return UNIT_DEFS.INR;
  if (!/^[A-Z]{3}$/.test(code)) throw new Error(`Invalid ISO 4217 code: ${code}`);
  return { id: code, measures: [`iso4217:${code}`] };
}

// default unit id for a concept (currency may be overridden for exempt subsidiary tables)
export function defaultUnitFor(dataType, currency = 'INR') {
  switch (dataType) {
    case 'monetary': return currency === 'INR' ? 'INR' : currency;
    case 'shares': return 'shares';
    case 'perShare': return 'INRPerShare';
    case 'percent': case 'pure': case 'decimal': return 'pure';
    default: return null;
  }
}

export function unitDef(id) {
  if (UNIT_DEFS[id]) return UNIT_DEFS[id];
  if (/^[A-Z]{3}$/.test(id)) return currencyUnit(id);
  if (/^[A-Z]{3}PerShare$/.test(id)) return { id, numerator: [`iso4217:${id.slice(0, 3)}`], denominator: ['xbrli:shares'] };
  return null;
}

// Is a unit definition consistent with the data type?
export function unitMatchesType(dataType, def) {
  if (!def) return false;
  const m = def.measures || [];
  switch (dataType) {
    case 'monetary': return m.length === 1 && m[0].startsWith('iso4217:') && !def.denominator;
    case 'shares': return m.length === 1 && m[0] === 'xbrli:shares';
    case 'perShare': return !!def.numerator && def.numerator[0].startsWith('iso4217:') && def.denominator?.[0] === 'xbrli:shares';
    case 'percent': case 'pure': return m.length === 1 && m[0] === 'xbrli:pure';
    case 'decimal': return !!def;
    default: return false;
  }
}

export function unitKey(def) {
  if (def.denominator) return `${def.numerator.join('*')}/${def.denominator.join('*')}`;
  return def.measures.join('*');
}

// v1.5.2: one unit per family of related count / ratio facts (data type 'decimal', which the taxonomy allows in any unit).
// A family = decimal-type concepts linked by a calculation arc or a roll-forward (closing = opening + change). XBRL adds
// up only facts with the same unit: MCA-validated filings report such counts in INR (with the share-option counts in
// INR) or in xbrli:pure; mixing both in one family made the MCA validator miss parts of a total (a next-year filing
// whose imported previous-year counts were in INR and the newly typed ones in pure). @returns Map concept → family id
const FAMILIES = new WeakMap();
export function decimalFamilies(A) {
  if (FAMILIES.has(A)) return FAMILIES.get(A);
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const isDec = (q) => A.concept(q) && A.dataType(q) === 'decimal';
  const add = (q) => { if (!parent.has(q)) parent.set(q, q); };
  const union = (a, b) => { if (!isDec(a) || !isDec(b)) return; add(a); add(b); const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const arcs of Object.values(A.json.calculation || {})) for (const a of arcs) union(a.from, a.to);
  for (const r of A.rules.rules) if (r.status === 'EXECUTABLE' && r.ast?.type === 'crossPeriod') union(r.ast.balance, r.ast.change);
  const out = new Map();
  for (const q of parent.keys()) out.set(q, find(q));
  FAMILIES.set(A, out);
  return out;
}
