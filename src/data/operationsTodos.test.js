import test from 'node:test';
import assert from 'node:assert/strict';
import { attentionRows, attentionReasons, createPreview, operationsTodos, updateReport } from './operationsDashboard.js';

test('待办与看板共用异常口径，按项目业务周唯一，保留历史未处理记录', () => {
  const state = createPreview();
  const todos = operationsTodos(state, 'PMO');
  assert.equal(todos.length, attentionRows(state.rows).length);
  assert.equal(new Set(todos.map(r => r.key)).size, todos.length);
  assert.ok(todos.some(r => r.start === '2026-09-04'));
  assert.ok(todos.every(r => attentionReasons(r).length > 0));
});

test('分别归属对应PM，PMO可见全部，财务与未知角色无经营待办', () => {
  const state = createPreview();
  for (const actor of ['王然', '陈默', '林晓彤']) {
    const todos = operationsTodos(state, 'PM', actor);
    assert.ok(todos.length > 0);
    assert.ok(todos.every(r => r.pm === actor));
    assert.deepEqual(new Set(todos.map(r => r.key)), new Set(operationsTodos(state, 'PMO').filter(r => r.pm === actor).map(r => r.key)));
  }
  assert.deepEqual(operationsTodos(state, '财务'), []);
  assert.deepEqual(operationsTodos(state, 'unknown'), []);
});

test('PM核对保存后两个入口同时消除，PMO批注不能完成待办', () => {
  const state = createPreview();
  const row = state.rows.find(r => r.projectId === 'demo-ops-1' && !r.confirmed);
  const annotated = updateReport(state, row.key, { annotation: '已提醒核对' }, 'PMO', 'annotation');
  assert.ok(operationsTodos(annotated, 'PM').some(r => r.key === row.key));
  const next = updateReport(annotated, row.key, { checked: 10000, subsidy: 0, extra: 0, deviation: '已核对', measure: '继续跟进' }, 'PM');
  assert.ok(!operationsTodos(next, 'PM').some(r => r.key === row.key));
  assert.ok(!attentionRows(next.rows).some(r => r.key === row.key));
  assert.ok(!state.rows.find(r => r.key === row.key).confirmed);
});

test('提交不能掩盖缺价，解决失败后清除待办', () => {
  const state = createPreview();
  const missing = state.rows.find(r => r.projectId === 'demo-ops-13');
  const next = updateReport(state, missing.key, { checked: 10000, subsidy: 0, extra: 0, deviation: '已核对', measure: '待补单价' }, 'PM');
  assert.ok(operationsTodos(next, 'PM').some(r => r.key === missing.key));
  assert.match(attentionReasons(next.rows.find(r => r.key === missing.key)).join('；'), /单价/);
  const failed = state.rows.find(r => r.calcStatus === 'failed');
  const recovered = updateReport(state, failed.key, { checked: 10000, subsidy: 0, extra: 0, deviation: '已复核', measure: '已重算' }, 'PM');
  assert.ok(!operationsTodos(recovered, 'PM').some(r => r.key === failed.key));
});
