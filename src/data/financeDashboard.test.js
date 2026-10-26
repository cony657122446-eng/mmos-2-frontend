import test from 'node:test';
import assert from 'node:assert/strict';
import { journalRange, summarizeJournal } from './financeDashboard.js';

const entries = [
  { key: 'opening', date: '2026-09-01', opening: true, income: 999999, expense: 0 },
  { key: 'in1', date: '2026-09-10', payer: '甲公司', income: 1000, expense: 0, allocations: [{ type: '开票', amount: 300 }, { type: '开票', amount: 200 }] },
  { key: 'in2', date: '2026-10-02', payer: '乙公司', income: '200.10', expense: 0, allocations: [{ type: '开票', amount: 200.10 }] },
  { key: 'out1', date: '2026-10-03', payer: '供应商', income: 0, expense: 300, allocations: [{ type: '费用报销', amount: 100 }, { type: '兼职结算', amount: 150 }] },
  { key: 'zero', date: '2026-10-04', income: 0, expense: 0 },
];
test('只计日记账实际收支，期初和零流水排除，分配不能重复增加收入', () => {
  const data = summarizeJournal(entries);
  assert.equal(data.totals.count, 3);
  assert.equal(data.openingCount, 1);
  assert.equal(data.totals.income, 1200.10);
  assert.equal(data.totals.expense, 300);
  assert.equal(data.totals.net, 900.10);
  assert.equal(data.totals.linked, 950.10);
  assert.equal(data.totals.unlinked, 550);
});
test('支出构成按分配拆分，残值单列，构成合计等于实际支出', () => {
  const data = summarizeJournal(entries);
  assert.deepEqual(data.expenseTypes, [{ name: '兼职结算', value: 150 }, { name: '费用报销', value: 100 }, { name: '未关联支出', value: 50 }]);
  assert.equal(data.expenseTypes.reduce((sum, item) => sum + item.value, 0), data.totals.expense);
  assert.deepEqual(data.incomePayers, [{ name: '甲公司', value: 1000 }, { name: '乙公司', value: 200.10 }]);
});
test('关联无效或超额时整笔归待核对，实际收支仍保留且未关联不变负数', () => {
  const data = summarizeJournal([
    { key: 'a', date: '2026-10-01', income: 0, expense: 100, allocations: [{ amount: 200 }] },
    { key: 'b', date: '2026-10-02', income: 50, expense: 0, allocations: [null] },
  ]);
  assert.equal(data.totals.net, -50);
  assert.equal(data.totals.allocationPending, 150);
  assert.equal(data.totals.unlinked, 0);
  assert.deepEqual(data.expenseTypes, [{ name: '关联待核对', value: 100 }]);
});
test('日期和收付款人过滤同时作用于指标趋势分类与明细', () => {
  const data = summarizeJournal(entries, { range: ['2026-10-02', '2026-10-02'], payer: '乙公司', grain: 'day' });
  assert.equal(data.rows.length, 1);
  assert.equal(data.totals.income, 200.10);
  assert.deepEqual(data.trends, [{ date: '2026-10-02', income: 200.10, expense: 0, net: 200.10 }]);
  assert.deepEqual(data.expenseTypes, []);
});
test('趋势只列已登记时间点，金额按分相加，空范围为明确空结果', () => {
  assert.deepEqual(summarizeJournal(entries).trends, [{ date: '2026-09', income: 1000, expense: 0, net: 1000 }, { date: '2026-10', income: 200.10, expense: 300, net: -99.90 }]);
  const empty = summarizeJournal(entries, { range: ['2025-01-01', '2025-12-31'] });
  assert.equal(empty.totals.count, 0);
  assert.deepEqual(empty.trends, []);
});
test('异常日期/双向金额/负金额/非数值不能静默变成有效0元', () => {
  const rows = [
    { key: 'a', date: '2026-02-30', income: 100 }, { key: 'b', date: '', income: 100 },
    { key: 'c', date: '2026-10-01', income: 100, expense: 10 }, { key: 'd', date: '2026-10-01', income: -100 },
    { key: 'e', date: '2026-10-01', expense: '无效' },
  ];
  const data = summarizeJournal(rows);
  assert.equal(data.excluded.length, 5); assert.equal(data.rows.length, 0);
});
test('期间以传入北京时间今天为截止，近3个月正确跨年', () => {
  assert.deepEqual(journalRange('recent', '2026-01-02'), ['2025-11-01', '2026-01-02']);
  assert.deepEqual(journalRange('month', '2026-10-26'), ['2026-10-01', '2026-10-26']);
  assert.deepEqual(journalRange('year', '2026-10-26'), ['2026-01-01', '2026-10-26']);
  assert.equal(journalRange('all', '2026-10-26'), null);
});
