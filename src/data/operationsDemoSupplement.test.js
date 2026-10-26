import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreview, supplementComparisonDemo, updateReport, filterRows } from './operationsDashboard.js';
import { buildComparison } from './operationsComparison.js';

test('补充27条完整历史，重复载入不重复，保留既有及新样例的人工修改', () => {
  const original = createPreview();
  original.rows[0].note = '用户已保存内容';
  const augmented = supplementComparisonDemo(original);
  assert.equal(augmented.rows.length, 139);
  assert.equal(augmented.projects.length, 17);
  assert.strictEqual(augmented.rows[0], original.rows[0]);
  const row = augmented.rows.find(r => r.projectId === 'demo-mom-growth');
  const edited = updateReport(augmented, row.key, { annotation: '保留批注' }, 'PMO', 'annotation', '2026-10-26 12:00:00', 0);
  const reloaded = supplementComparisonDemo(edited);
  assert.equal(reloaded.rows.length, 139);
  assert.equal(reloaded.rows.find(r => r.key === row.key).annotation, '保留批注');
  assert.equal(reloaded.rows[0].note, '用户已保存内容');
  assert.equal(reloaded.revision, edited.revision);
});

test('新增样例周/月三项均可计算，增长下降减亏方向正确且可追溯', () => {
  const state = supplementComparisonDemo(createPreview());
  for (const mode of ['week', 'month']) {
    for (const id of ['growth', 'decline', 'recovery']) {
      const comparison = buildComparison(state, 'PMO', { mode, anchor: '2026-10-26', today: '2026-10-26', project: `demo-mom-${id}` });
      for (const result of Object.values(comparison.metrics)) {
        assert.equal(result.status, 'ready', `${mode}/${id}`);
        assert.ok(result.current.entries.every(e => e.row));
        assert.ok(result.previous.entries.every(e => e.row));
      }
      assert.equal(comparison.metrics.profit.direction, id === 'decline' ? -1 : 1);
      if (id === 'recovery') assert.match(comparison.metrics.profit.text, /^减亏/);
    }
  }
  assert.ok(filterRows(state, 'PM').every(r => r.pm === '王然'));
  assert.equal(filterRows(state, 'PM', { project: 'demo-mom-decline' }).length, 0);
});

test('原异常不会因增加正常样例而被掩盖', () => {
  const result = buildComparison(supplementComparisonDemo(createPreview()), 'PMO', { mode: 'week', anchor: '2026-10-26', today: '2026-10-26' });
  assert.equal(result.metrics.value.status, 'incomplete');
  assert.ok(result.metrics.value.current.entries.some(e => e.reason.includes('包月')));
});
