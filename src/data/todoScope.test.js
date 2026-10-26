import test from 'node:test';
import assert from 'node:assert/strict';
import { scopeManagerTodos } from './todoScope.js';

const rows = [{ key: 'a', pm: '王然', creator: '林晓彤' }, { key: 'b', pm: '陈默', creator: '王然' }, { key: 'c', pm: '林晓彤', creator: '陈默' }];
test('PMO可看全部经理或指定经理，清除筛选恢复全部，不改原数组', () => {
  assert.deepEqual(scopeManagerTodos(rows, 'PMO'), rows);
  assert.deepEqual(scopeManagerTodos(rows, 'PMO', '陈默').map(r => r.key), ['b']);
  assert.equal(scopeManagerTodos(rows, 'PMO', '无记录经理').length, 0);
  assert.equal(scopeManagerTodos(rows, 'PMO', 'all').length, 3);
  assert.equal(rows.length, 3);
});
test('PM不能通过经理筛选扩大自己的待办范围', () => {
  for (const manager of ['all', '陈默', '林晓彤']) assert.deepEqual(scopeManagerTodos(rows, 'PM', manager).map(r => r.key), ['a']);
  assert.deepEqual(scopeManagerTodos(rows, 'PM', 'all', '陈默').map(r => r.key), ['b']);
  assert.deepEqual(scopeManagerTodos(rows, '财务'), []);
  assert.deepEqual(scopeManagerTodos(rows, 'unknown'), []);
});
test('立项待办遵循既有创建人归属，PMO可按同一归属查看', () => {
  assert.deepEqual(scopeManagerTodos(rows, 'PM', 'all', '王然', 'creator').map(r => r.key), ['b']);
  assert.deepEqual(scopeManagerTodos(rows, 'PMO', '陈默', '王然', 'creator').map(r => r.key), ['c']);
});
