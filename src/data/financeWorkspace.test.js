import test from 'node:test';
import assert from 'node:assert/strict';
import { combineInvoices, issueInvoice, registerReceipt, registerJournal, completeSettlements, approvalPayment, projectFinance, customerProjection, costProjection, financeAllowed, saveWorkspace, loadWorkspace } from './financeWorkspace.js';
import { applyCostBatch, quarterMonths } from './financeCosts.js';
import { CONTRACT_FIELDS, mergeContracts } from './financeContracts.js';
const invoice = (key, amount, overrides = {}) => ({ key, recordNo: key, acceptanceNo: key, projectNo: `project-${key}`, projectName: `项目${key}`, customerKey: 'c1', customer: '客户', acceptanceAmount: amount, taxIncluded: amount, received: 0, invoiceNo: '', ...overrides });
const initial = () => ({ revision: 0, customers: [], invoices: [invoice('a', 6000), invoice('b', 4000)], journal: [], settlements: [], approvals: [], costs: [], contracts: [], audit: [] });
const issued = () => { const state = combineInvoices(initial(), ['a', 'b']); return issueInvoice(state, state.invoices[0], { invoiceNo: 'F1', invoiceDate: '2026-10-21', taxIncluded: 10000, voucher: 'test.pdf', voucherUrl: 'data:application/pdf;base64,AA==' }); };
test('同客户跨项目合票保留各验收金额；独立票号重复拒绝且开票不产生日记账', () => {
  const state = issued(); assert.equal(state.journal.length, 0); assert.deepEqual(state.invoices.map(row => row.taxIncluded), [6000, 4000]);
  const wrong = initial(); wrong.invoices[1].customerKey = 'c2'; assert.throws(() => combineInvoices(wrong, ['a', 'b']), /同一客户/);
  const duplicate = { ...state, invoices: [...state.invoices, invoice('c', 1)] };
  assert.throws(() => issueInvoice(duplicate, duplicate.invoices[2], { invoiceNo: 'F1', invoiceDate: '2026-10-21', taxIncluded: 1, voucher: 'f.pdf', voucherUrl: 'data:application/pdf;base64,AA==' }), /重复/);
});
test('合票4000→7000只记3000增量，项目按手动分配汇总，重复保存不新增', () => {
  let state = issued(); state = registerReceipt(state, state.invoices[0], 4000, '2026-10-18', { a: 3000, b: 1000 });
  assert.equal(state.journal[0].income, 4000); assert.equal(projectFinance('project-a', state).remitted, 3000);
  state = registerReceipt(state, state.invoices[0], 7000, '2026-10-19', { a: 5000, b: 2000 });
  assert.equal(state.journal[1].income, 3000); assert.equal(projectFinance('project-b', state).remitted, 2000);
  state = registerReceipt(state, state.invoices[0], 7000, '2026-10-19', { a: 5000, b: 2000 }); assert.equal(state.journal.length, 2);
});
test('仅改验收分配不改变收入；调减保护混合收入、未关联部分、支出', () => {
  let state = issued();
  state = registerJournal(state, { date: '2026-10-18', summary: '混合', payer: '客户', income: 10000, expense: 0, allocations: [{ target: 'a', type: '开票', amount: 3000 }, { target: 'b', type: '开票', amount: 1000 }] });
  state = registerReceipt(state, state.invoices[0], 4000, '2026-10-18', { a: 1000, b: 3000 }); assert.equal(state.journal[0].income, 10000);
  state = registerReceipt(state, state.invoices[0], 2000, '2026-10-18', { a: 500, b: 1500 }); assert.equal(state.journal[0].income, 8000);
  assert.equal(state.journal[0].allocations.reduce((sum, link) => sum + link.amount, 0), 2000);
});
test('合票分配不足、超额、日期错误、未开票收入均原子拒绝', () => {
  const state = issued(); const before = structuredClone(state);
  for (const allocations of [{ a: 3000, b: 999 }, { a: 7000, b: 0 }, { a: -1, b: 4001 }]) assert.throws(() => registerReceipt(state, state.invoices[0], 4000, '2026-10-18', allocations));
  assert.throws(() => registerReceipt(state, state.invoices[0], 4000, '2026-02-30', { a: 3000, b: 1000 }));
  assert.throws(() => registerReceipt(initial(), initial().invoices[0], 1, '2026-10-18', { a: 1 }), /先完成开票/);
  assert.deepEqual(state, before);
});
test('日记账全额计入收支、按分配计回款；追加关联不改变收入', () => {
  let state = issued(); state = registerJournal(state, { date: '2026-10-18', summary: '收款', payer: '客户', income: 10000, expense: 0, allocations: [{ target: 'a', type: '开票', amount: 6000 }] });
  assert.equal(state.invoices[0].received, 6000); assert.equal(state.invoices[1].received, 0);
  state = registerJournal(state, { allocations: [{ target: 'b', type: '开票', amount: 3000 }] }, state.journal[0].key);
  assert.equal(state.journal.length, 1); assert.equal(state.journal[0].income, 10000); assert.equal(state.invoices[1].received, 3000);
});
test('审批实付只按自身关联金额回填，原通过金额保持', () => {
  const state = { ...initial(), approvals: [{ key: 'p1', type: '费用报销', status: '已读取', amount: 800 }, { key: 'p2', type: '借款', status: '已读取', amount: 2000 }] };
  const next = registerJournal(state, { date: '2026-10-18', summary: '付款', payer: '人员', income: 0, expense: 1000, allocations: [{ target: 'p1', amount: 600 }, { target: 'p2', amount: 300 }] });
  assert.equal(approvalPayment(state.approvals[0], next.journal).paid, 600); assert.equal(approvalPayment(state.approvals[1], next.journal).paid, 300); assert.equal(next.approvals[0].amount, 800);
  assert.throws(() => registerJournal(state, { date: '2026-10-18', summary: '付款', payer: '人', expense: 10, allocations: [{ target: 'settlement', amount: 10 }] }), /仅关联/);
});
test('结算完成精确批次、实际日期与唯一支出；重复完成拒绝', () => {
  const row = { key: 's1', sourceLineId: 'line1', projectMatched: true, projectNo: 'p1', projectName: '项目', approvalKey: 'ap1', period: '2026-10', idCode: 'mock-person', bankName: '测试', bankNo: 'mock-account', bank: '测试银行', quantity: 3, price: 1000, amount: 3000, inCost: true };
  const state = { ...initial(), approvals: [{ key: 'ap1', status: '已读取', result: '审批通过' }], settlements: [row, { ...row, key: 's2', sourceLineId: 'line2', period: '2026-11' }] };
  assert.throws(() => completeSettlements(state, ['s1', 's2'], '2026-10-18'), /同一周期/);
  const next = completeSettlements(state, ['s1'], '2026-10-18'); assert.equal(next.journal.length, 1); assert.equal(next.journal[0].date, '2026-10-18'); assert.equal(next.journal[0].expense, 3000); assert.ok(next.settlements[0].inCost); assert.equal(next.settlements[1].completedAt, undefined);
  assert.throws(() => completeSettlements(next, ['s1'], '2026-10-18'), /已完成/);
});
test('季度展开、重复新增逐条失败、未选单月保留、删除与0区别', () => {
  const positions = [{ key: 'p1', name: '岗位' }]; const edits = quarterMonths(2026, 4).map(month => ({ positionId: 'p1', month, daily: 800 }));
  let batch = applyCostBatch([], edits, 'add', positions); assert.equal(batch.rows.length, 3);
  batch = applyCostBatch(batch.rows, [{ ...edits[1], daily: 880, original: 800 }], 'edit', positions); assert.deepEqual(batch.rows.map(row => row.daily).sort(), [800, 800, 880]);
  const duplicate = applyCostBatch(batch.rows, [...edits, { positionId: 'p1', month: '2027-01', daily: 0 }], 'add', positions); assert.equal(duplicate.results.filter(row => !row.success).length, 3); assert.equal(duplicate.rows.find(row => row.month === '2027-01').daily, 0);
  const deleted = applyCostBatch(duplicate.rows, [edits[0]], 'delete', positions); assert.equal(deleted.rows.some(row => row.month === '2026-10'), false);
  assert.equal(applyCostBatch([], edits, 'add', []).results[0].success, false);
});
test('合同仅40字段，同名不同源保留，源异常保留旧数据，排除月度费用', () => {
  assert.equal(CONTRACT_FIELDS.length, 40);
  const first = mergeContracts([], [{ sourceId: '1', 合同名称: '同名', '2026-08费用': 100 }, { sourceId: '2', 合同名称: '同名' }]); assert.equal(first.rows.length, 2); assert.equal('2026-08费用' in first.rows[0], false);
  const next = mergeContracts(first.rows, [{ sourceId: '1', readError: '类型变化' }]); assert.equal(next.rows[0].合同名称, '同名'); assert.equal(next.errors.length, 1);
});
test('PM与PMO仅客户三字段和本月成本；受限路由拒绝', () => {
  for (const role of ['PM', 'PMO']) {
    assert.equal(financeAllowed(role, 'finance-invoices'), false); assert.equal(financeAllowed(role, 'finance-contracts'), false);
    assert.deepEqual(customerProjection([{ key: 'c', code: '1', name: '客户', fullName: '全名', taxNo: 'secret' }], role), [{ key: 'c', code: '1', name: '客户', fullName: '全名' }]);
    assert.equal(costProjection([{ month: '2026-09' }, { month: '2026-10', daily: 0 }], role, '2026-10').length, 1);
  }
});
test('统一保存检查旧版本，失败不覆盖；历史旧开票迁移按验收去重', () => {
  const data = new Map(); globalThis.localStorage = { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) }; globalThis.window = { dispatchEvent() {} }; globalThis.CustomEvent = class {};
  const before = loadWorkspace(); const next = saveWorkspace(before, before, '首次统一保存'); assert.equal(loadWorkspace().invoices.length, before.invoices.length);
  assert.throws(() => saveWorkspace(before, before, '过期更新'), /数据已变化/); assert.equal(loadWorkspace().revision, next.revision);
});
