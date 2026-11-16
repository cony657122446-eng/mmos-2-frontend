import test from 'node:test';
import assert from 'node:assert/strict';
import { addFinanceDemo } from './financeDemo.js';
import { validateFinanceInvoice } from './financeLedger.js';
import { registerReceipt, approvalPayment } from './financeWorkspace.js';
import { CONTRACT_FIELDS } from './financeContracts.js';
const fixture = () => addFinanceDemo({ customers: [], invoices: [], journal: [], approvals: [], settlements: [], costs: [], contracts: [] }, new Date('2026-10-21T00:00:00Z'));
test('数据保留原记录、重复载入不覆盖用户修改或恢复删除项', () => {
  const old = { key: 'existing', note: '用户记录' };
  const state = addFinanceDemo({ invoices: [old] });
  assert.equal(state.invoices[0], old);
  state.invoices[1].note = '用户修改'; state.costs.pop();
  assert.equal(addFinanceDemo(state), state);
  assert.equal(state.costs.length, 8);
});
test('发票有效，合票增量回款与已有收入一致', () => {
  const state = fixture();
  for (const row of state.invoices) assert.equal(validateFinanceInvoice(row, state.invoices), '');
  const row = state.invoices[6], other = state.invoices[7];
  const next = registerReceipt(state, row, 7000, '2026-10-21', { [row.key]: 4000, [other.key]: 3000 });
  assert.equal(next.journal.at(-1).income, 3000);
  assert.ok(state.invoices[3].voucherUrl.startsWith('data:application/pdf;base64,'));
});
test('财务样例不再生成兼职结算记录，报销付款保持可追踪', () => {
  const state = fixture();
  assert.deepEqual(state.settlements, []);
  assert.equal(state.journal.some(row => row.key.endsWith('j-settlement')), false);
  assert.equal(approvalPayment(state.approvals[2], state.journal).paid, 500);
});
test('季度成本可批量操作，合同40字段完整', () => {
  const state = fixture();
  assert.equal(state.demoPositions.length, 4); assert.equal(state.costs.length, 9);
  assert.deepEqual([...new Set(state.costs.map(row => row.month))], ['2026-10', '2026-11', '2026-12']);
  for (const row of state.contracts) for (const field of CONTRACT_FIELDS) assert.ok(Object.hasOwn(row, field), field);
});
