import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanDisplayRecord, displayText, migrateDisplayTextStorage } from './displayText.js';
import { createHrSeed, reconcileHrState, reduceHrAction } from './hrWorkspace.js';
import { findFinanceCustomer } from './financeCustomers.js';
import { isByteCustomer } from './customerMaster.js';

function memoryStorage(entries) {
  const values = new Map(Object.entries(entries));
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index],
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('display text removes presentation markers while preserving ordinary punctuation', () => {
  assert.equal(displayText('招聘-模拟-1840'), '招聘-1840');
  assert.equal(displayText('模拟陈悦'), '陈悦');
  assert.equal(displayText('项目--分组'), '项目--分组');
  assert.equal(displayText(null), null);
});

test('cleanup retains canonical identifiers and internal statuses without changing the input', () => {
  const original = {
    id: '模拟-id', sourceId: '模拟-source', recruitmentNo: '招聘-模拟-1840',
    personalAccount: '个人账号-模拟-1840', evidence: '模拟有效审批-1',
    name: '模拟陈悦', note: '模拟验收单', status: '模拟待审批',
    file: { name: '模拟材料.pdf', data: 'data:模拟', url: 'https://example.test/模拟' },
  };
  const next = cleanDisplayRecord(original);
  for (const key of ['id', 'sourceId', 'recruitmentNo', 'personalAccount', 'evidence', 'status']) assert.equal(next[key], original[key]);
  assert.equal(next.name, '陈悦');
  assert.equal(next.note, '验收单');
  assert.equal(next.file.name, '材料.pdf');
  assert.equal(next.file.data, original.file.data);
  assert.equal(next.file.url, original.file.url);
  assert.equal(displayText(next.status), '待审批');
  assert.equal(original.name, '模拟陈悦');
});

test('storage migration covers module stores, preserves unrelated entries, and runs once', () => {
  const storage = memoryStorage({
    'mmos.finance.workspace': JSON.stringify({ revision: 3, invoices: [{ key: 'invoice-1', projectName: '模拟项目' }] }),
    'mmos.trial.records': JSON.stringify([{ id: 'trial-1', name: '模拟试标' }]),
    'mmos.projects.records': JSON.stringify([{ projectNo: 'P1', pm: '模拟王然' }]),
    'mmos.invalid': '{模拟',
    'other.app': JSON.stringify({ name: '模拟记录' }),
  });
  const result = migrateDisplayTextStorage(storage);
  assert.equal(result.updated.length, 3);
  assert.deepEqual(result.errors, []);
  assert.equal(JSON.parse(storage.getItem('mmos.finance.workspace')).revision, 4);
  assert.equal(JSON.parse(storage.getItem('mmos.trial.records'))[0].name, '试标');
  assert.equal(storage.getItem('mmos.invalid'), '{模拟');
  assert.equal(JSON.parse(storage.getItem('other.app')).name, '模拟记录');
  assert.deepEqual(migrateDisplayTextStorage(storage), { updated: [], errors: [] });
  assert.equal(JSON.parse(storage.getItem('mmos.finance.workspace')).revision, 4);
});

test('failed storage writes retain the saved value and report the affected entry', () => {
  const raw = JSON.stringify({ revision: 2, name: '模拟项目' });
  const storage = memoryStorage({ 'mmos.projects.records': raw });
  storage.setItem = () => { throw new Error('quota exceeded'); };
  assert.deepEqual(migrateDisplayTextStorage(storage), { updated: [], errors: [{ key: 'mmos.projects.records', message: 'quota exceeded' }] });
  assert.equal(storage.getItem('mmos.projects.records'), raw);
});

test('contact name collisions receive stable identifiers only within their customer', () => {
  const original = {
    contacts: [
      { key: 'contact-1', customerKey: 'c1', name: '模拟陈悦' },
      { key: 'contact-2', customerKey: 'c1', name: '陈悦' },
      { key: 'contact-3', customerKey: 'c2', name: '模拟陈悦' },
    ],
    people: [{ id: 'p1', name: '模拟陈悦' }, { id: 'p2', name: '陈悦' }],
  };
  const next = cleanDisplayRecord(original);
  assert.deepEqual(next.contacts.map(row => row.name), ['陈悦（contact-1）', '陈悦', '陈悦']);
  assert.equal(next.contacts[0].originalDisplayName, '模拟陈悦');
  assert.deepEqual(next.contacts.map(row => row.key), original.contacts.map(row => row.key));
  assert.deepEqual(next.people.map(row => row.name), ['陈悦', '陈悦']);
  assert.deepEqual(cleanDisplayRecord(next), next);
});

test('customer group name collisions preserve every stable group identifier', () => {
  const next = cleanDisplayRecord({ customerGroups: [
    { key: 'g1', code: 'C001', name: '模拟客户' },
    { key: 'g2', code: 'C002', name: '客户' },
    { key: 'g3', code: 'C003', name: '模拟模拟客户' },
  ] });
  assert.deepEqual(next.customerGroups.map(row => row.name), ['客户（C001）', '客户', '客户（C003）']);
  assert.deepEqual(next.customerGroups.map(row => row.key), ['g1', 'g2', 'g3']);
  assert.deepEqual(cleanDisplayRecord(next), next);
});

test('legacy recruitment numbers retain automatic matching after visible name cleanup', () => {
  const state = createHrSeed('2026-11-05');
  const person = state.people.find(row => row.recruitmentNo === '招聘-模拟-1840');
  person.name = '模拟关联人员';
  const storage = memoryStorage({ 'mmos.hr.workspace': JSON.stringify(state) });
  migrateDisplayTextStorage(storage);
  const migrated = reconcileHrState(JSON.parse(storage.getItem('mmos.hr.workspace')));
  const candidate = migrated.people.find(row => row.id === person.id);
  assert.equal(candidate.recruitmentNo, '招聘-模拟-1840');
  assert.equal(displayText(candidate.recruitmentNo), '招聘-1840');
  assert.equal(candidate.name, '关联人员');
  assert.equal(candidate.intakeId, 'intake-demo-1');
  assert.equal(migrated.intakes[0].candidateId, candidate.id);
  const submitCandidate = migrated.people.find(row => row.recruitmentNo === '招聘-模拟-1831');
  const submitted = reduceHrAction(migrated, '资料填写人', 'intake.submit', {
    requestId: 'display-cleanup-submit',
    values: { ...migrated.intakes[0].values, recruitmentNo: submitCandidate.recruitmentNo },
  });
  assert.equal(submitted.intakes.at(-1).candidateId, submitCandidate.id);
  assert.equal(submitted.intakes.at(-1).values.recruitmentNo, submitCandidate.recruitmentNo);
});

test('known legacy labels change only their intended fields and recruitment identifiers remain canonical', () => {
  const original = { revision: 2, sync: { status: '演示快照' }, sourceSystem: '调配演示', recruitmentNo: '招聘-调配演示-1923', name: '演示快照', note: '产品演示项目', audit: [{ actor: '系统 · 本地演示' }, { actor: '增长部 · 演示账号' }], locations: [{ id: 'loc-1', name: '办公区', note: '状态为交互演示配置' }] };
  const storage = memoryStorage({ 'mmos.hr.workspace': JSON.stringify(original) });
  migrateDisplayTextStorage(storage);
  const next = JSON.parse(storage.getItem('mmos.hr.workspace'));
  assert.equal(next.sync.status, '来源快照');
  assert.equal(next.sourceSystem, '人员调配');
  assert.equal(next.recruitmentNo, original.recruitmentNo);
  assert.equal(displayText(next.recruitmentNo), '招聘-调配-1923');
  assert.equal(next.name, original.name);
  assert.equal(next.note, original.note);
  assert.deepEqual(next.audit.map(row => row.actor), ['系统', '增长部 · 客户增长']);
  assert.equal(next.locations[0].note, '工作地点配置');
  assert.deepEqual(migrateDisplayTextStorage(storage), { updated: [], errors: [] });
});

function customerCollisionState() {
  return {
    revision: 1,
    customerGroups: [
      { key: 'g1', code: 'G001', name: '模拟客户', byteSigning: true },
      { key: 'g2', code: 'G002', name: '客户', byteSigning: false },
    ],
    customers: [
      { key: 'c1', code: 'C001', groupKey: 'g1', name: '模拟公司', fullName: '模拟公司全称' },
      { key: 'c2', code: 'C002', groupKey: 'g2', name: '公司', fullName: '公司全称' },
    ],
    invoices: [{ key: 'invoice-1', customer: '模拟公司', payer: '模拟公司全称' }],
    projects: [{ id: 'project-1', customer: '模拟客户', subjectKey: '' }],
  };
}

test('customer collisions preserve the original group and subject lookup results', () => {
  const original = customerCollisionState();
  const next = cleanDisplayRecord(original);
  assert.equal(isByteCustomer(original.projects[0], original), true);
  assert.equal(isByteCustomer(next.projects[0], next), true);
  assert.equal(next.projects[0].groupKey, 'g1');
  assert.equal(next.projects[0].subjectKey, '');
  assert.equal(next.projects[0].customerKey, undefined);
  assert.equal(findFinanceCustomer(original.invoices[0], original.customers).key, 'c1');
  assert.equal(findFinanceCustomer(next.invoices[0], next.customers).key, 'c1');
  assert.equal(next.invoices[0].payer, next.customers[0].fullName);
  assert.equal(findFinanceCustomer({ customer: '模拟公司' }, next.customers).key, 'c1');
  assert.deepEqual(next.customers[0].previousNames, ['模拟公司']);
  assert.deepEqual(next.customers[0].previousFullNames, ['模拟公司全称']);
  assert.deepEqual(cleanDisplayRecord(next), next);
});

test('cross-module customer references survive a partial migration and a later retry', () => {
  const original = customerCollisionState();
  const project = { projectNo: 'P1', customer: '模拟客户', subjectKey: '' };
  const invoice = { key: 'invoice-2', customer: '模拟公司' };
  const storage = memoryStorage({
    'mmos.finance.ledger.v1': JSON.stringify(original),
    'mmos.project.master.v1': JSON.stringify([project]),
    'mmos.invoice.records.v1': JSON.stringify([invoice]),
  });
  const save = storage.setItem;
  storage.setItem = (key, value) => { if (key === 'mmos.project.master.v1') throw new Error('write failed'); save(key, value); };
  const first = migrateDisplayTextStorage(storage);
  assert.equal(first.errors.length, 1);
  const ledger = JSON.parse(storage.getItem('mmos.finance.ledger.v1'));
  assert.equal(isByteCustomer(JSON.parse(storage.getItem('mmos.project.master.v1'))[0], ledger), true);
  assert.equal(findFinanceCustomer(JSON.parse(storage.getItem('mmos.invoice.records.v1'))[0], ledger.customers).key, 'c1');
  storage.setItem = save;
  migrateDisplayTextStorage(storage);
  const migratedProject = JSON.parse(storage.getItem('mmos.project.master.v1'))[0];
  assert.equal(isByteCustomer(migratedProject, ledger), true);
  assert.equal(migratedProject.subjectKey, '');
  assert.equal(migratedProject.customerKey, undefined);
  assert.deepEqual(migrateDisplayTextStorage(storage), { updated: [], errors: [] });
});

test('organization name cleanup respects department, position and location uniqueness scopes', () => {
  const next = cleanDisplayRecord({
    departments: [{ id: 'd1', parentId: 'root', name: '模拟交付' }, { id: 'd2', parentId: 'root', name: '交付' }, { id: 'd3', parentId: 'other', name: '模拟交付' }],
    positions: [{ id: 'p1', departmentId: 'd1', name: '模拟标注员' }, { id: 'p2', departmentId: 'd1', name: '标注员' }, { id: 'p3', departmentId: 'd2', name: '模拟标注员' }],
    locations: [{ id: 'l1', name: '模拟办公区' }, { id: 'l2', name: '办公区' }],
  });
  assert.deepEqual(next.departments.map(row => row.name), ['交付（d1）', '交付', '交付']);
  assert.deepEqual(next.positions.map(row => row.name), ['标注员（p1）', '标注员', '标注员']);
  assert.deepEqual(next.locations.map(row => row.name), ['办公区（l1）', '办公区']);
  assert.deepEqual(cleanDisplayRecord(next), next);
});
