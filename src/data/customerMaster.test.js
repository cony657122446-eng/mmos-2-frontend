import test from 'node:test';
import assert from 'node:assert/strict';
import { GROWTH, seedCustomerMaster, projectCustomerView, applyCustomerCommand, customerDeleteReasons, commitCustomerCommand, prepareApplicationCustomers } from './customerMaster.js';

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
globalThis.window = { dispatchEvent() {} };
const base = () => seedCustomerMaster({ schema: 2, revision: 0, customers: [
  { key: 'c1', name: '字节', code: 'KH-001', fullName: '客户一', taxNo: '00123', active: true, term: 30, createdAt: '2026-08-01', contact: '旧对接人' },
  { key: 'c2', name: '腾讯', code: 'KH-002', fullName: '客户二', taxNo: '00456', active: true, term: null },
], invoices: [], journal: [], costs: [], contracts: [], audit: [] });
const save = (state, role, type, key, values) => applyCustomerCommand(state, role, { type, key, values });
const customerValues = { name: '字节新名', fullName: '客户一新全名', taxNo: '000099', invoiceItemName: '', taxCode: '', term: null };

test('财务和增长部共用主库；选填可空，编号与入库时间保留；必填及唯一性校验', () => {
  for (const role of ['财务', GROWTH]) {
    const state = save(base(), role, 'customer.save', 'c1', customerValues);
    assert.equal(state.customers[0].code, 'KH-001'); assert.equal(state.customers[0].createdAt, '2026-08-01'); assert.equal(state.customers[0].term, null);
    assert.equal(projectCustomerView(state, '财务').customers[0].name, '字节新名');
    assert.throws(() => save(state, role, 'customer.save', 'c1', { ...customerValues, name: '腾讯' }), /重复/);
    assert.throws(() => save(state, role, 'customer.save', 'c1', { ...customerValues, taxNo: '  ' }), /必填/);
  }
});
test('未开票同步，已确认及历史已开票快照保留；已回款账期冻结且不新增收支', () => {
  const state = base(); state.invoices = [
    { key: 'pending', customerKey: 'c1', payer: '旧购买方', invoiceNo: '' },
    { key: 'issued', customerKey: 'c1', payer: '已确认购买方', invoiceNo: 'F1', received: 0, taxIncluded: 100 },
    { key: 'legacy', customerKey: 'c1', payer: '历史购买方', legacyConfirmed: true },
    { key: 'paid', customerKey: 'c1', invoiceNo: 'F2', received: 100, taxIncluded: 100 },
  ];
  const next = save(state, GROWTH, 'customer.save', 'c1', customerValues);
  assert.equal(next.invoices[0].payer, customerValues.fullName); assert.equal(next.invoices[0].category, '');
  assert.equal(next.invoices[1].payer, '已确认购买方'); assert.equal(next.invoices[2].payer, '历史购买方');
  assert.equal(next.invoices[3].paidTermSnapshot, 30); assert.deepEqual(next.journal, state.journal);
});
test('只投影允许的字段；财务及PMO/PM无法从联系人、历史和审计取得拜访', () => {
  let state = save(base(), GROWTH, 'visit.save', null, { contactKey: 'cm-demo-a', date: '2026-11-03', content: '私密拜访内容' });
  for (const role of ['财务', 'PMO', 'PM']) {
    const view = projectCustomerView(state, role);
    assert.equal(view.visits, undefined); assert.equal(view.recentVisits, undefined); assert.ok(!JSON.stringify(view).includes('私密拜访内容'));
    assert.ok(!JSON.stringify(view).includes('旧对接人'));
    if (role !== '财务') assert.deepEqual(Object.keys(view.customers[0]), ['key', 'code', 'name', 'fullName']);
    assert.throws(() => save(state, role, 'visit.save', null, { contactKey: 'cm-demo-a', date: '2026-11-03', content: '拒绝' }), /仅增长部/);
  }
  assert.throws(() => projectCustomerView(state, '无权限'), /权限/);
});
test('客户删除检查所有关联；只删除无关联客户；停用不删除项目和联系人', () => {
  const state = base(); assert.ok(customerDeleteReasons(state, 'c1').includes('联系人'));
  assert.throws(() => save(state, '财务', 'customer.delete', 'c1'), /不能删除/);
  const deleted = save(state, GROWTH, 'customer.delete', 'cm-demo-empty'); assert.ok(!deleted.customers.some(row => row.key === 'cm-demo-empty'));
  const finance = base(); finance.invoices.push({ customerKey: 'cm-demo-empty' }); assert.throws(() => save(finance, '财务', 'customer.delete', 'cm-demo-empty'), /财务记录/);
  const stopped = save(state, '财务', 'customer.disable', 'c1'); assert.equal(stopped.customers[0].active, false); assert.deepEqual(stopped.customerRelations.contacts, state.customerRelations.contacts);
  const next = save(stopped, GROWTH, 'contact.save', null, { customerKey: 'c1', name: '停用后新增人员' }); assert.ok(next.customerRelations.contacts.some(row => row.name === '停用后新增人员'));
});
test('联系人同客户去首尾空白唯一；跨客户同名合法；改名保留稳定ID', () => {
  let state = base();
  assert.throws(() => save(state, GROWTH, 'contact.save', null, { customerKey: 'c1', name: ' 模拟陈悦 ' }), /重复/);
  state = save(state, GROWTH, 'contact.save', 'cm-demo-a', { customerKey: 'c1', name: '模拟陈悦更正' });
  assert.equal(state.customerRelations.contacts.find(row => row.key === 'cm-demo-a').name, '模拟陈悦更正');
  assert.ok(state.customerRelations.links.ZJ20260910922.customerPoc.includes('cm-demo-a'));
  assert.throws(() => save(state, '财务', 'contact.save', null, { customerKey: 'c1', name: '新增' }), /仅增长部/);
});
test('有当前/历史/拜访引用禁止换客户；无引用可以更换', () => {
  let state = base();
  assert.throws(() => save(state, GROWTH, 'contact.save', 'cm-demo-a', { customerKey: 'c2', name: '新名' }), /引用/);
  state = save(state, GROWTH, 'contact.save', 'cm-demo-d', { customerKey: 'c2', name: '独立人员' });
  assert.equal(state.customerRelations.contacts.find(row => row.key === 'cm-demo-d').customerKey, 'c2');
  state = save(state, 'PM', 'project.save', 'ZJ20260910922', {});
  assert.throws(() => save(state, GROWTH, 'contact.save', 'cm-demo-b', { customerKey: 'c2', name: '新名' }), /引用/);
});
test('三人多人名单、跨角色同人、清空及快照；重复保存不伪造历史', () => {
  let state = base();
  state = save(state, 'PM', 'project.save', 'ZJ20260910922', { customerType: '转手', customerPoc: ['cm-demo-a', 'cm-demo-b', 'cm-demo-c', 'cm-demo-c'], customerPm: ['cm-demo-a'], resourceBp: ['cm-demo-a'] });
  assert.equal(state.customerRelations.links.ZJ20260910922.customerPoc.length, 3);
  const changes = structuredClone(state.customerRelations.history[0]);
  state = save(state, GROWTH, 'contact.save', 'cm-demo-a', { customerKey: 'c1', name: '更正姓名' });
  assert.deepEqual(state.customerRelations.history[0], changes);
  state = save(state, 'PM', 'project.save', 'ZJ20260910922', {});
  assert.equal(state.customerRelations.links.ZJ20260910922.customerType, '');
  assert.deepEqual(state.customerRelations.links.ZJ20260910922.customerPoc, []);
  assert.equal(projectCustomerView(state, 'PM').contacts.length, 0);
  const count = state.customerRelations.history.length;
  state = save(state, 'PM', 'project.save', 'ZJ20260910922', {}); assert.equal(state.customerRelations.history.length, count);
});
test('项目修改限制PM本人项目，财务只读，跨客户联系人拒绝', () => {
  for (const [role, projectNo] of [['财务', 'ZJ20260910922'], ['PM', 'ZJ20260911880']]) assert.throws(() => save(base(), role, 'project.save', projectNo, {}), /无权/);
  assert.throws(() => save(base(), 'PMO', 'project.save', 'ZJ20260910922', { customerPoc: ['cm-demo-e'] }), /不属于/);
  assert.throws(() => save(base(), GROWTH, 'project.save', 'ZJ20260910922', { customerType: '潜在客户' }), /客户类型/);
});
test('拜访按次保存，同日不合并；更正不新增；DDL为文本；最近时间自动汇总', () => {
  let state = base(); const count = state.customerRelations.visits.length;
  const values = { contactKey: 'cm-demo-d', date: '2026-11-03', content: '同日拜访', nextDdl: '搁置', issues: '进展说明' };
  state = save(state, GROWTH, 'visit.save', null, values); state = save(state, GROWTH, 'visit.save', null, values);
  assert.equal(state.customerRelations.visits.length, count + 2); assert.deepEqual(state.customerRelations.recentVisits, {});
  const last = state.customerRelations.visits.at(-1); state = save(state, GROWTH, 'visit.save', last.key, { ...values, content: '更正内容' });
  assert.equal(state.customerRelations.visits.length, count + 2);
  assert.equal(state.customerRelations.visits.at(-1).nextDdl, '搁置');
  assert.equal(projectCustomerView(state, GROWTH).recentVisits['cm-demo-d'], '2026-11-03');
  state = save(state, GROWTH, 'visit.save', last.key, { ...values, date: '2026-09-01' });
  assert.equal(projectCustomerView(state, GROWTH).recentVisits['cm-demo-d'], '2026-11-03');
  assert.throws(() => save(state, GROWTH, 'recent.save', 'cm-demo-d', { date: '2026-12-01' }), /不支持/);
  assert.throws(() => save(state, GROWTH, 'visit.save', null, { ...values, date: '2026-02-30' }), /有效/);
  assert.throws(() => save(state, GROWTH, 'visit.save', null, { ...values, content: '  ' }), /有效/);
});
test('过期修订拒绝，保存失败保留原记录；模拟种子不重复恢复删除的数据', () => {
  const state = base(); state.revision = 4; storage.set('mmos.finance.ledger.v1', JSON.stringify(state));
  assert.throws(() => commitCustomerCommand('财务', 3, { type: 'customer.save', key: 'c1', values: customerValues }), /数据已变化/);
  assert.equal(JSON.parse(storage.get('mmos.finance.ledger.v1')).customers[0].name, '字节');
  const deleted = save(state, '财务', 'customer.delete', 'cm-demo-empty'); assert.equal(seedCustomerMaster(deleted), deleted);
  const originalSet = localStorage.setItem; localStorage.setItem = () => { throw new Error('模拟空间不足'); };
  assert.throws(() => commitCustomerCommand('财务', 4, { type: 'customer.save', key: 'c1', values: customerValues }), /空间不足/);
  localStorage.setItem = originalSet; assert.equal(JSON.parse(storage.get('mmos.finance.ledger.v1')).customers[0].name, '字节'); storage.clear();
});
test('立项四字段允许空或三人，生效姓名快照固定；换客户不沿用旧联系人', () => {
  storage.set('mmos.finance.ledger.v1', JSON.stringify(base()));
  const approved = prepareApplicationCustomers({ customer: '字节', customerPoc: ['cm-demo-a', 'cm-demo-b', 'cm-demo-c'], customerPm: ['cm-demo-a'] }, true);
  assert.equal(approved.customerLinks.customerPoc.length, 3);
  assert.equal(approved.customerContactSnapshot.customerPoc[0].name, '模拟陈悦');
  const changed = save(base(), GROWTH, 'contact.save', 'cm-demo-a', { name: '已更名', customerKey: 'c1' });
  storage.set('mmos.finance.ledger.v1', JSON.stringify(changed));
  assert.equal(approved.customerContactSnapshot.customerPoc[0].name, '模拟陈悦');
  assert.throws(() => prepareApplicationCustomers({ ...approved, customer: '腾讯' }), /不属于当前客户/);
  assert.deepEqual(prepareApplicationCustomers({ customer: '字节' }).customerPoc, []);
  storage.clear();
});

test('最近拜访按最大实际日期取值；补录、更正、旧手工值、空记录和联系人隔离', () => {
  let state = base();
  state.customerRelations.recentVisits = { 'cm-demo-a': '2099-01-01', 'cm-demo-d': '2026-11-03' };
  assert.equal(projectCustomerView(state, GROWTH).recentVisits['cm-demo-a'], '2026-10-30');
  assert.equal(projectCustomerView(state, GROWTH).recentVisits['cm-demo-d'], undefined);
  state = save(state, GROWTH, 'visit.save', null, { contactKey: 'cm-demo-a', date: '2026-09-01', content: '补录旧记录' });
  assert.equal(projectCustomerView(state, GROWTH).recentVisits['cm-demo-a'], '2026-10-30');
  state = save(state, GROWTH, 'visit.save', 'cm-demo-visit-2', { date: '2026-10-01', content: '更正最新记录日期' });
  assert.equal(projectCustomerView(state, GROWTH).recentVisits['cm-demo-a'], '2026-10-23');
  state = save(state, GROWTH, 'visit.save', 'cm-demo-visit-1', { date: '2026-11-03', content: '更正为较新日期' });
  assert.equal(projectCustomerView(state, GROWTH).recentVisits['cm-demo-a'], '2026-11-03');
  state = save(state, GROWTH, 'visit.save', null, { contactKey: 'cm-demo-d', date: '2026-11-05', content: '另一个联系人' });
  const view = projectCustomerView(state, GROWTH);
  assert.equal(view.recentVisits['cm-demo-a'], '2026-11-03');
  assert.equal(view.recentVisits['cm-demo-d'], '2026-11-05');
});
