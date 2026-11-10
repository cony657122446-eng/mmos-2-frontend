import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCustomerMaster, applyCustomerCommand, customerProjects, prepareApplicationCustomers, isByteCustomer, GROWTH } from './customerMaster.js';
import { approveAcceptanceGroup, invoiceStateForAcceptanceGroup } from './acceptanceGroups.js';
import { invoiceTasks, issueInvoice } from './financeWorkspace.js';
import { reconcileProjectStartup } from './projectStartup.js';

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
globalThis.window = { dispatchEvent() {} };
const base = () => seedCustomerMaster({ schema: 2, revision: 0, customers: [{ key: 'c1', code: 'KH-001', name: '字节', fullName: '北京字跳网络技术有限公司', taxNo: 'ABC001', active: true }], invoices: [], journal: [], audit: [] });
const command = (state, role, type, key, values) => applyCustomerCommand(state, role, { type, key, values });

test('two subjects retain separate identities, normalized tax uniqueness includes disabled subjects, migration repeats safely', () => {
  const state = base();
  const subjects = state.customers.filter(row => row.groupKey === 'group-c1');
  assert.equal(subjects.length, 2);
  assert.equal(seedCustomerMaster(state), state);
  const stopped = command(state, '财务', 'customer.disable', 'c1');
  assert.throws(() => command(stopped, '财务', 'customer.save', null, { groupKey: 'group-c1', name: '新主体', fullName: '测试公司', taxNo: ' abc001 ' }), /重复/);
  assert.throws(() => command(state, GROWTH, 'group.save', null, { name: ' 字节 ' }), /重复/);
});

test('optional initiation subject stays empty, no inference from customer name, and finance fills it with a recorded reason', () => {
  storage.clear();
  const state = base();
  storage.set('mmos.finance.ledger.v1', JSON.stringify(state));
  const application = prepareApplicationCustomers({ customer: '字节' }, true);
  assert.equal(application.subjectKey, '');
  storage.set('mmos.project.master.v1', JSON.stringify([{ projectNo: 'P-empty', customer: '字节', subjectKey: '', pm: '王然', status: '项目进行中' }]));
  assert.equal(customerProjects(state)[0].subjectKey, undefined);
  assert.throws(() => command(state, 'PMO', 'subject.assign', 'P-empty', { subjectKey: 'c1', reason: '核实合同' }), /仅财务/);
  const next = command(state, '财务', 'subject.assign', 'P-empty', { subjectKey: 'c1', reason: '按合同主体核实' });
  assert.equal(customerProjects(next)[0].subjectKey, 'c1');
  assert.equal(next.customerRelations.history[0].reason, '按合同主体核实');
  storage.clear();
});

test('subject correction clears current roles, retains names in history, and dependent acceptance blocks correction', () => {
  storage.clear();
  const state = base();
  const values = { subjectKey: 'cm-demo-byte-second', reason: '合同主体更正' };
  const next = command(state, GROWTH, 'subject.assign', 'ZJ20260910922', values);
  assert.deepEqual(next.customerRelations.links.ZJ20260910922.customerPoc, []);
  assert.equal(next.customerRelations.history[0].changes.before.customerPoc[0].name, '陈悦');
  storage.set('mmos.acceptance.records.v1', JSON.stringify([{ key: 'acceptance', projectNo: 'ZJ20260910922' }]));
  assert.throws(() => command(state, '财务', 'subject.assign', 'ZJ20260910922', values), /先完成/);
  storage.clear();
});

test('byte signing remains attached to parent ID after rename, startup checks all conditions only in waiting status', () => {
  let state = base();
  state = command(state, '财务', 'group.save', 'group-c1', { name: '字节客户新称呼' });
  const project = { projectNo: 'P-start', groupKey: 'group-c1', subjectKey: 'cm-demo-byte-second', status: '待启动', managementTableUrl: 'https://example.com/management', outputTableUrl: 'https://example.com/output' };
  assert.equal(isByteCustomer(project, state), true);
  assert.equal(reconcileProjectStartup(project, [], state), project);
  const quotes = [{ projectNo: project.projectNo, confirmResult: '已签单', confirmTime: '2026-11-09 10:00', voucher: 'https://example.com/signature' }];
  assert.equal(reconcileProjectStartup(project, quotes, state).status, '项目进行中');
  for (const status of ['项目暂停', '项目结束', '报价中']) assert.equal(reconcileProjectStartup({ ...project, status }, quotes, state).status, status);
});

test('approval fixes one same-subject group, preserves paused stage state and closes final project before finance retries', () => {
  const state = base();
  const projects = [{ projectNo: 'A', subjectKey: 'c1', groupKey: 'group-c1', status: '项目暂停' }, { projectNo: 'B', subjectKey: 'c1', groupKey: 'group-c1', status: '项目进行中' }];
  const records = [{ key: 'a', acceptanceNo: 'A-1', projectNo: 'A', type: '阶段验收', amount: 100, applyStatus: '待审核' }, { key: 'b', acceptanceNo: 'B-1', projectNo: 'B', type: '最终验收', amount: 200, applyStatus: '待审核' }];
  const approved = approveAcceptanceGroup(records, ['a', 'b'], projects, state.customers, '2026-11-09');
  assert.equal(approved[0].projectStatus, '项目暂停');
  assert.equal(approved[1].projectStatus, '项目结束');
  assert.equal(approved[0].approvalGroupId, approved[1].approvalGroupId);
  const disabled = { ...state, customers: state.customers.map(row => ({ ...row, active: false })) };
  assert.equal(invoiceStateForAcceptanceGroup(disabled, approved).invoices[0].subjectActive, false);
  assert.throws(() => invoiceStateForAcceptanceGroup({ ...state, customers: [] }, approved), /未确定/);
  assert.equal(approved[1].applyStatus, '已通过');
  const pushed = invoiceStateForAcceptanceGroup(state, approved);
  assert.equal(invoiceStateForAcceptanceGroup(pushed, approved), pushed);
  const tasks = invoiceTasks(pushed.invoices);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].taxIncluded, 300);
  assert.equal(tasks[0].members.length, 2);
  assert.throws(() => invoiceStateForAcceptanceGroup(pushed, approved.slice(0, 1)), /全部分项/);
  assert.throws(() => approveAcceptanceGroup(approved, ['a', 'b'], projects, state.customers, '2026-11-09'), /已通过组/);
  const mixed = projects.map(row => row.projectNo === 'B' ? { ...row, subjectKey: 'cm-demo-byte-second' } : row);
  assert.throws(() => approveAcceptanceGroup(records, ['a', 'b'], mixed, state.customers, '2026-11-09'), /同一公司主体/);
});

test('disabled subject blocks new invoice confirmation even when acceptance remains valid', () => {
  const state = base();
  state.customers[0].active = false;
  const invoice = { key: 'a', customerKey: 'c1', acceptanceAmount: 100, taxIncluded: 100 };
  state.invoices = [invoice];
  assert.throws(() => issueInvoice(state, invoice, { invoiceNo: 'F1', invoiceDate: '2026-11-09', taxIncluded: 100, voucher: 'invoice.pdf', voucherUrl: 'data:application/pdf;base64,AA==' }), /停用/);
});
