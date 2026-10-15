// v1.2 release-owner decisions (2026-10-09):
//  1. SR-L1097-1 / SR-L1304-1 (revaluation flags of the PPE / intangibles notes) are warnings only while the PPE /
//     intangibles balance is absent, nil or 0 for that year (MCA-validated reference instance B (2024-25)); blocking otherwise.
//  2. schemaRef: the 2017 address and the MCA V3 address are both accepted on import, an imported filing keeps its own,
//     and new filings are written with the MCA V3 address.
import test from 'node:test';
import assert from 'node:assert/strict';
import { baseSession, runRule, set } from './fixtures.mjs';
import { q, authority } from './helpers.mjs';

for (const [id, flag, bal] of [['SR-L1097-1', 'WhetherPropertyPlantAndEquipmentAreStatedAtRevaluedAmount', 'PropertyPlantAndEquipment'], ['SR-L1304-1', 'WhetherOtherIntangibleAssetsAreStatedAtRevaluedAmount', 'OtherIntangibleAssets']]) {
  test(`${id}: warning while ${bal} is absent or 0; blocking once it has an amount; passes when answered`, () => {
    const s = baseSession();
    const clear = () => { for (const f of s.filing.all().filter((x) => x.concept === q(flag) || x.concept === q(bal))) s.filing.removeFact(f.key); };
    clear();
    assert.deepEqual(runRule(s, id, { scope: 'CY' }).statuses, ['WARN'], 'absent');
    set(s, bal, 0, 0);
    const w = runRule(s, id, { scope: 'CY' });
    assert.deepEqual(w.statuses, ['WARN'], 'reported as 0');
    assert.match(w.res[0].message, /calibrated: not blocking while/);
    set(s, bal, 500, 400);
    assert.deepEqual(runRule(s, id, { scope: 'CY' }).statuses, ['FAIL'], 'an amount: blocking');
    assert.deepEqual(runRule(s, id, { scope: 'PY' }).statuses, ['FAIL']);
    s.setValue(q(flag), 'CY', 'false'); s.setValue(q(flag), 'PY', 'false');
    assert.deepEqual(runRule(s, id, { scope: 'CY' }).statuses, ['PASS']);
  });
}

import { exampleSession, exportUnchecked } from './fixtures.mjs';
import { importSession } from './helpers.mjs';
const V3 = 'https://www.mca.gov.in/V3XBRL/2017/07/16/Taxonomy/Ind/in-ci-ent-2017-03-31.xsd';
const OLD = 'http://www.mca.gov.in/XBRL/2017/07/16/Taxonomy/Ind/in-ci-ent-2017-03-31.xsd';
const href = (xml) => /<link:schemaRef [^>]*xlink:href="([^"]+)"/.exec(xml)[1];
test('schemaRef: a new filing is written with the MCA V3 address', () => {
  assert.equal(href(exampleSession().exportXml({ today: '2018-09-30' }).xml), V3);
});
test('schemaRef: an imported filing keeps its own accepted address (2017 or V3); an unknown one is replaced by V3 with a warning', () => {
  const xml = exportUnchecked(exampleSession());
  for (const h of [OLD, V3]) {
    const { s, report } = importSession(xml.replace(V3, h));
    assert.equal(report.schemaRefMatches, true, h);
    assert.equal(s.filing.meta.schemaRef, h);
    assert.equal(href(s.exportXml({ today: '2018-09-30' }).xml), h, 'written back unchanged');
  }
  const { s, report } = importSession(xml.replace(V3, 'http://example.com/x.xsd'));
  assert.equal(report.schemaRefMatches, false);
  assert.ok(report.warnings.some((w) => /not an accepted/.test(w)));
  assert.equal(href(s.exportXml({ today: '2018-09-30' }).xml), V3);
});
