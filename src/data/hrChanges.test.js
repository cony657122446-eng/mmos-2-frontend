import test from 'node:test';
import assert from 'node:assert/strict';
import { createHrSeed, getHrChangesView, getHrView, reconcileHrState } from './hrWorkspace.js';
import { ensureHrChangePreview, HR_CHANGE_TYPES, matchHrChangePerson } from './hrChanges.js';

const day = '2026-11-10';
const seed = () => reconcileHrState(createHrSeed(day), day);

test('five change types project existing fields and preserve source snapshots independently of current values', () => {
  const state = seed();
  const before = structuredClone(state);
  for (const type of HR_CHANGE_TYPES) {
    const view = getHrChangesView('人事', type.key, state, day);
    assert.ok(view.rows.length > 0, type.key);
    assert.ok(view.rows.every(row => row.type === type.key && row.fields.length && row.associationStatus === '已关联'));
    assert.equal(view.sync.status, '来源快照');
    assert.ok(view.rows.every(row => !row.approvalNo && !row.approvalUrl && !row.readAt));
  }
  state.people[0].compensation.salary = 6100;
  const salary = getHrChangesView('人事', 'salary', state, day).rows[0].fields.find(field => field.key === 'salary');
  assert.deepEqual([salary.before, salary.after, salary.currentValue], [5000, 5200, 6100]);
  assert.equal(salary.targetTable, '薪资档案');
  assert.equal(state.hrChangeRecords.find(row => row.type === 'salary').fields[0].after, 5200);
  state.people[0].compensation.salary = before.people[0].compensation.salary;
  assert.deepEqual(state, before);
});

test('reading pending, rejected and historical records never applies values to the personnel or salary archive', () => {
  const state = seed();
  const source = structuredClone(state);
  const view = getHrChangesView('人事', undefined, state, day);
  assert.ok(view.rows.some(row => row.status === '审批中'));
  assert.ok(view.rows.some(row => row.status === '已驳回'));
  assert.equal(view.personView.people[0].stage, '试用期');
  assert.equal(view.personView.people[0].phone, '电话-1831');
  assert.deepEqual(state, source);
  assert.deepEqual(getHrChangesView('HR', 'position', state, day).rows, view.rows.filter(row => row.type === 'position'));
});

test('stable personnel matching rejects conflicts, duplicates and uncreated personnel without a name fallback', () => {
  const people = seed().people;
  const base = { name: people[0].name, employeeNo: people[0].employeeNo };
  assert.equal(matchHrChangePerson(base, people).person.id, 'hr-1');
  assert.equal(matchHrChangePerson({ personId: 'hr-2', ...base }, people).person, null);
  assert.equal(matchHrChangePerson({ name: people[0].name }, people).person, null);
  assert.equal(matchHrChangePerson(base, [...people, { ...people[0], id: 'duplicate' }]).person, null);
  assert.equal(matchHrChangePerson({ personId: 'hr-6' }, people).person, null);
  const state = seed();
  state.hrChangeRecords[0].personId = 'hr-2';
  const row = getHrChangesView('人事', 'position', state, day).rows[0];
  assert.equal(row.personId, '');
  assert.match(row.associationStatus, /待核对/);
  assert.ok(row.fields.every(field => field.currentValue === undefined));
});

test('change lists remain HR-only and salary permissions hide all salary values and free-text explanations', () => {
  const state = seed();
  const salary = state.hrChangeRecords.find(row => row.type === 'salary');
  salary.fields[0].before = 99001;
  salary.fields[0].after = 99002;
  salary.reason = '敏感薪资说明99002';
  state.fieldPermissions.hrSalary = false;
  const view = getHrChangesView('人事', 'salary', state, day);
  const serialized = JSON.stringify(view);
  assert.ok(!serialized.includes('99001'));
  assert.ok(!serialized.includes('99002'));
  assert.equal(view.rows[0].reason, '');
  assert.ok(view.rows[0].fields.every(field => field.before === '无权限' && field.after === '无权限' && field.currentValue === '无权限'));
  for (const role of ['PM', 'PMO', '财务', 'PA', '部门经理', '未知']) {
    const denied = getHrChangesView(role, undefined, state, day);
    assert.equal(denied.canView, false);
    assert.deepEqual(denied.rows, []);
    assert.deepEqual(denied.personView.people, []);
    assert.ok(!JSON.stringify(getHrView(role, state, day)).includes('99002'));
  }
});

test('incremental samples require exact built-in identity and do not overwrite records or current archives', () => {
  const state = seed();
  const once = structuredClone(state);
  ensureHrChangePreview(state, day);
  assert.deepEqual(state, once);
  delete state.hrChangePreviewVersion;
  state.hrChangeRecords[0].reason = '已保存的说明';
  const person = structuredClone(state.people[0]);
  ensureHrChangePreview(state, '2026-11-20');
  assert.equal(state.hrChangeRecords[0].reason, '已保存的说明');
  assert.deepEqual(state.people[0], person);
  assert.equal(state.hrChangeRecords.length, once.hrChangeRecords.length);
  const actual = createHrSeed(day);
  actual.people.forEach(person => { person.sourceId = 'actual-source'; });
  ensureHrChangePreview(actual, day);
  assert.deepEqual(actual.hrChangeRecords, []);
});

test('personnel master includes linked change summaries while preserving existing history fields', () => {
  const state = seed();
  state.people[0].changes.push({ id: 'legacy', type: '其他变动', date: day, status: '已完成', source: '旧记录' });
  const person = getHrView('人事', state, day).people.find(person => person.id === 'hr-1');
  assert.ok(person.changes.some(row => row.changeType === 'salary'));
  assert.ok(person.changes.some(row => row.changeType === 'position'));
  assert.equal(person.changes.filter(row => row.id === 'legacy').length, 1);
  assert.equal(person.changes.at(-1).id, 'legacy');
  assert.ok(person.changes.every(row => !Object.hasOwn(row, 'fields')));
});

test('unmapped approval fields stay unlinked and source links allow only secure Feishu domains', () => {
  const state = seed();
  const source = state.hrChangeRecords.find(row => row.type === 'position');
  source.fields.push({ key: 'unverified', before: 'private-old', after: 'private-new' });
  source.approvalUrl = 'https://company.feishu.cn/approval/record';
  let row = getHrChangesView('人事', 'position', state, day).rows[0];
  assert.match(row.fieldMappingStatus, /待核对/);
  assert.ok(!JSON.stringify(row).includes('private-new'));
  assert.equal(row.approvalUrl, source.approvalUrl);
  for (const url of ['javascript:alert(1)', 'http://company.feishu.cn/approval', 'https://feishu.cn.example.test/record', 'https://user:secret@company.feishu.cn/record']) {
    source.approvalUrl = url;
    assert.equal(getHrChangesView('人事', 'position', state, day).rows[0].approvalUrl, '');
  }
});

test('regularization sample uses three calendar months and keeps the unverified source mapping explicit', () => {
  const state = reconcileHrState(createHrSeed('2026-12-04'), '2026-12-04');
  const row = getHrChangesView('人事', 'regularization', state, '2026-12-04').rows[0];
  assert.equal(row.fields.find(field => field.key === 'probationDate').after, '2026-11-30');
  assert.equal(row.fields.find(field => field.key === 'plannedRegularizationDate').after, '2027-02-28');
  assert.match(row.fieldMappingStatus, /待核对/);
  assert.match(row.fields.find(field => field.key === 'plannedRegularizationDate').targetLabel, /待核对/);
});
