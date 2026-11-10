import test from 'node:test';
import assert from 'node:assert/strict';
import { createHrSeed, getHrView, HR_KEY, mergeHrOutputFacts, mergeHrSource, reconcileHrState } from './hrWorkspace.js';
import { getDeliveryLineChanges, getPoolPersonDetails, getTransferView, initializeDeliveryLineSources, initializeTransferState, reduceTransferAction, transferAction } from './hrTransfers.js';

const day = '2026-11-10';
const wang = 'pm-wang-ran';
const chen = 'pm-chen-mo';
const lin = 'pm-lin-xiaotong';
const ownProject = 'DEMO-TRANSFER-WR-01';
const peerProject = 'DEMO-TRANSFER-LXT-01';
const crossProject = 'DEMO-TRANSFER-CM-01';
const fulltime = 'hr-transfer-fulltime';
const intern = 'hr-transfer-intern';
const pooled = 'hr-transfer-pool';
const seed = () => initializeTransferState(createHrSeed(day), day);
const act = (state, type, payload, actor = wang, role = 'PM') => reduceTransferAction(state, actor, type, payload, state.revision, role, day);
const item = (personId = fulltime, sourceProjectId = ownProject) => ({ personId, sourceProjectId });
const person = (state, personId) => state.people.find(row => row.id === personId);

test('incremental demo initialization preserves existing records and runs once', () => {
  const previous = createHrSeed(day);
  previous.people[0].name = '用户修改名称';
  const state = initializeTransferState(previous, day);
  assert.equal(state.people[0].name, '用户修改名称');
  assert.deepEqual(previous.people[0].projectIds, state.people[0].projectIds);
  assert.equal(state.people.length, previous.people.length + 4);
  assert.deepEqual(initializeTransferState(state, day), state);
  state.people = state.people.filter(row => row.id !== fulltime);
  assert.equal(initializeTransferState(state, day).people.some(row => row.id === fulltime), false);
});

test('pool profile samples migrate exact built-in records once and preserve every existing field source', () => {
  const state = seed();
  delete state.transfers.profileSamplesVersion;
  const sample = person(state, pooled);
  sample.archive = { school: '用户保存学校', english: '', abilityTags: [] };
  sample.education = '用户保存学历';
  sample.intakeProfile = { major: '用户保存专业' };
  const untouched = { ...sample, id: 'real-intern', sourceId: 'real-intern', sourceSystem: 'MMOS1', archive: {}, intakeProfile: {}, education: undefined, demo: false };
  state.people.push(untouched);
  const migrated = initializeTransferState(state, day);
  const profile = getTransferView(wang, 'PM', migrated).pool.find(row => row.personId === pooled);
  assert.deepEqual(profile.abilityTags, []);
  assert.equal(profile.english, '');
  assert.equal(profile.school, '用户保存学校');
  assert.equal(profile.education, '用户保存学历');
  assert.equal(profile.major, '用户保存专业');
  assert.deepEqual(person(migrated, 'real-intern').archive, {});
  assert.equal(sample.historySource, undefined);
  assert.equal(person(migrated, pooled).historySource, undefined);
  assert.deepEqual(initializeTransferState(migrated, day), migrated);
  delete person(migrated, pooled).archive.school;
  assert.equal(person(initializeTransferState(migrated, day), pooled).archive.school, undefined);
});

test('profile migration requires matching demo ID, source ID and known source system', () => {
  for (const change of [{ demo: false }, { sourceId: 'other-record' }, { sourceSystem: 'MMOS1' }]) {
    const state = seed();
    delete state.transfers.profileSamplesVersion;
    Object.assign(person(state, pooled), { archive: {} }, change);
    const next = initializeTransferState(state, day);
    assert.deepEqual(person(next, pooled).archive, {});
  }
});

test('opening an existing browser pool persists missing built-in profile data once', () => {
  const previousStorage = globalThis.localStorage;
  const previous = seed();
  delete previous.transfers.profileSamplesVersion;
  person(previous, pooled).archive = {};
  const baseline = reconcileHrState(previous);
  let stored = JSON.stringify(baseline);
  globalThis.localStorage = { getItem: key => key === HR_KEY ? stored : null, setItem: (key, value) => { if (key === HR_KEY) stored = value; } };
  try {
    const first = getTransferView(wang, 'PM');
    const saved = stored;
    assert.deepEqual(first.pool.find(row => row.personId === pooled).abilityTags, ['文本标注', '中文语义理解']);
    assert.equal(first.revision, baseline.revision + 1);
    assert.equal(JSON.parse(stored).people.length, baseline.people.length);
    assert.equal(JSON.parse(stored).transfers.profileSamplesVersion, 1);
    const second = getTransferView(wang, 'PM');
    assert.equal(second.revision, first.revision);
    assert.equal(stored, saved);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousStorage;
  }
});

test('pool selection fields normalize array, string and lookup values and keep missing real profiles empty', () => {
  const state = seed();
  const sample = person(state, pooled);
  sample.archive.abilityTags = ['来源标签'];
  sample.intakeProfile = { abilityTags: ['入职标签'] };
  sample.abilityTags = ['文本标注', { label: '英语评测' }, { value: { text: '数据质检' } }, '文本标注', {}];
  sample.english = { value: 'CET6' };
  sample.education = [{ name: '本科在读' }];
  let row = getTransferView(wang, 'PM', state).pool.find(item => item.personId === pooled);
  assert.deepEqual(row.abilityTags, ['文本标注', '英语评测', '数据质检']);
  assert.equal(row.english, 'CET6');
  assert.equal(row.education, '本科在读');
  sample.abilityTags = '文本标注，英语评测、数据质检';
  row = getTransferView(wang, 'PM', state).pool.find(item => item.personId === pooled);
  assert.deepEqual(row.abilityTags, ['文本标注', '英语评测', '数据质检']);
  delete sample.abilityTags;
  delete sample.english;
  delete sample.education;
  sample.archive = {};
  sample.intakeProfile = {};
  row = getTransferView(wang, 'PM', state).pool.find(item => item.personId === pooled);
  assert.deepEqual(row.abilityTags, []);
  assert.equal(row.english, '');
  assert.equal(row.education, '');
});

test('shared pool details allow cross-line PM reading without widening normal directory or output scope', () => {
  const state = seed();
  const employee = person(state, 'hr-transfer-chen-intern');
  employee.archive.idNumber = 'SECRET_ID';
  employee.bankAccounts = [{ bank: '银行', cardNumber: 'SECRET_BANK' }];
  employee.compensation = { salary: 987654, abilityAllowance: 'SECRET_ALLOWANCE' };
  employee.contracts = [{ id: 'contract-private', type: '实习协议', salary: 987654 }];
  employee.changes = [{ id: 'change-private', type: '调薪', salary: 987654, previousSalary: 123456, reason: 'SECRET_REASON' }];
  employee.rawPrivate = 'SECRET_RAW';
  state.outputs.push({ id: 'cross-private-output', personId: employee.id, projectId: crossProject, date: day, category: '内部人员' });
  state.attendance.push({ id: 'cross-private-attendance', personId: employee.id, projectId: crossProject, date: day, hours: 8 });
  const entered = act(state, 'pool.enter', { items: [item(employee.id, crossProject)] }, chen);
  const normalBefore = getHrView('PM', entered);
  assert.equal(normalBefore.people.some(row => row.id === employee.id), false);
  const detail = getPoolPersonDetails(wang, 'PM', employee.id, entered);
  assert.equal(detail.person.id, employee.id);
  assert.deepEqual(detail.person.abilityTags, ['英语评测', '多语种内容审核']);
  assert.deepEqual(detail.view.projects, [{ id: crossProject, name: entered.projects.find(project => project.id === crossProject).name }]);
  assert.equal(detail.person.endedProjectRelations[0].projectId, crossProject);
  assert.deepEqual(detail.view.outputs, []);
  assert.deepEqual(detail.view.attendance, []);
  assert.equal(detail.person.canTrain, false);
  const serialized = JSON.stringify(detail);
  assert.ok(!serialized.includes('SECRET_'));
  assert.ok(!serialized.includes('987654'));
  assert.ok(!serialized.includes('123456'));
  assert.equal(detail.person.compensation, undefined);
  assert.equal(detail.person.bankAccounts, undefined);
  assert.deepEqual(getHrView('PM', entered), normalBefore);
});

test('pool details preserve HR and finance field-level gates and visible-person scopes', () => {
  const state = seed();
  const employee = person(state, 'hr-2');
  employee.archive = { idNumber: 'HR_ONLY_ID' };
  employee.compensation = { salary: 789123, housingFund: true };
  employee.bankAccounts = [{ bank: '银行', cardNumber: 'FINANCE_BANK' }];
  const entered = act(state, 'pool.enter', { items: [item(employee.id, employee.projectIds[0])] }, chen);
  entered.fieldPermissions.hrSalary = false;
  const finance = getPoolPersonDetails(wang, '财务', employee.id, entered);
  assert.equal(finance.person.idNumber, undefined);
  assert.equal(finance.person.bankAccounts[0].cardNumber, 'FINANCE_BANK');
  assert.equal(finance.person.compensation.salary, undefined);
  const hr = getPoolPersonDetails(wang, '人事', employee.id, entered);
  assert.equal(hr.person.idNumber, 'HR_ONLY_ID');
  assert.equal(hr.person.compensation.salary, undefined);
  entered.fieldPermissions.financeSalary = true;
  assert.equal(getPoolPersonDetails(wang, '财务', employee.id, entered).person.compensation.salary, 789123);
  assert.equal(getPoolPersonDetails(wang, '财务', pooled, entered), null);
});

test('pool detail access ends with membership and rejects invalid PM or role and arbitrary person IDs', () => {
  const state = seed();
  assert.ok(getPoolPersonDetails(wang, 'PM', pooled, state));
  assert.equal(getPoolPersonDetails('unknown-pm', 'PM', pooled, state), null);
  assert.equal(getPoolPersonDetails(wang, '未知角色', pooled, state), null);
  assert.equal(getPoolPersonDetails(wang, 'PM', fulltime, state), null);
  assert.equal(getPoolPersonDetails(wang, 'PM', 'unknown-person', state), null);
  const claimed = act(state, 'pool.claim', { personIds: [pooled], targetProjectId: ownProject });
  assert.equal(getPoolPersonDetails(wang, 'PM', pooled, claimed), null);
  for (const change of [{ terminated: true }, { trustedEmploymentStatus: '已离职' }, { projectIds: [ownProject] }, { employeeType: '全职' }]) {
    const invalid = seed();
    Object.assign(person(invalid, pooled), change);
    assert.equal(getPoolPersonDetails(wang, 'PM', pooled, invalid), null);
  }
});

test('pool profiles have no current project or delivery-line owner while retaining archival organization', () => {
  const state = seed();
  const employee = person(state, pooled);
  Object.assign(employee, { manager: '旧负责人', projectManagerSource: '旧项目负责人', attendanceManagerSource: '旧出勤负责人', deliveryLine: '旧交付线', deliveryLineAuto: '旧自动归属', deliveryLineBackup: '旧备用归属', deliveryLineNote: '旧归属说明' });
  const detail = getPoolPersonDetails(wang, 'PM', pooled, state);
  assert.equal(detail.person.manager, '');
  assert.equal(detail.person.projectManagerSource, '');
  assert.equal(detail.person.attendanceManagerSource, '');
  assert.equal(detail.person.deliveryLine, '自由人');
  assert.equal(detail.person.deliveryLineAuto, '');
  assert.equal(detail.person.deliveryLineBackup, '');
  assert.equal(detail.person.deliveryLineNote, '');
  assert.equal(detail.person.departmentId, employee.departmentId);
  assert.deepEqual(detail.person.projectIds, []);
  assert.deepEqual(detail.person.projectExperience, []);
  assert.deepEqual(detail.view.projects, []);
  assert.equal(person(state, pooled).manager, '旧负责人');
});

test('pool project experience comes only from deduped recorded project associations', () => {
  const entered = act(seed(), 'pool.enter', { items: [item(intern)] });
  const employee = person(entered, intern);
  employee.endedProjectRelations.push({ ...employee.endedProjectRelations[0] });
  const expected = [...new Set(employee.endedProjectRelations.map(row => row.projectId))];
  const row = getTransferView(wang, 'PM', entered).pool.find(entry => entry.personId === intern);
  assert.deepEqual(row.projectExperience.map(project => project.id), expected);
  assert.ok(row.projectExperience.every(project => entered.projects.some(source => source.id === project.id && source.name === project.name)));
  assert.deepEqual(getTransferView(wang, 'PM', entered).pool.find(entry => entry.personId === pooled).projectExperience, []);
});

test('former PM records the current pool entry initiator for multi-PM project exits in both list and details', () => {
  const state = seed();
  person(state, intern).projectIds.push(crossProject);
  person(state, intern).manager = '陈默';
  const entered = act(state, 'pool.enter', { items: [item(intern)] });
  const stored = entered.transfers.pool.find(row => row.personId === intern);
  assert.equal(stored.formerPmId, wang);
  assert.equal(stored.formerPmName, '王然');
  assert.ok(stored.sourceProjectIds.includes(crossProject));
  const row = getTransferView(chen, 'PM', entered).pool.find(entry => entry.personId === intern);
  const detail = getPoolPersonDetails(chen, 'PM', intern, entered).person;
  assert.equal(row.formerPmId, wang);
  assert.equal(row.formerPmName, '王然');
  assert.equal(detail.formerPmId, row.formerPmId);
  assert.equal(detail.formerPmName, row.formerPmName);
});

test('legacy former PM names come from the matching entry operation snapshot rather than current owners', () => {
  const entered = act(seed(), 'pool.enter', { items: [item(intern)] });
  const stored = entered.transfers.pool.find(row => row.personId === intern);
  delete stored.formerPmId;
  delete stored.formerPmName;
  entered.transfers.managers.find(manager => manager.id === wang).name = '王然新名称';
  entered.projects.find(project => project.id === ownProject).pm = '陈默';
  person(entered, intern).manager = '林晓彤';
  const before = JSON.stringify(entered);
  const row = getTransferView(chen, 'PM', entered).pool.find(entry => entry.personId === intern);
  assert.equal(row.formerPmId, wang);
  assert.equal(row.formerPmName, '王然');
  assert.equal(getPoolPersonDetails(chen, 'PM', intern, entered).person.formerPmName, '王然');
  assert.equal(JSON.stringify(entered), before);
});

test('unrecorded and ID-only pool origins never borrow a current PM name or a different operation type', () => {
  const state = seed();
  const stored = state.transfers.pool.find(row => row.personId === pooled);
  let row = getTransferView(wang, 'PM', state).pool.find(entry => entry.personId === pooled);
  assert.equal(row.formerPmId, '');
  assert.equal(row.formerPmName, '');
  stored.actorId = wang;
  state.transfers.history.push({ id: stored.operationId, type: 'pool.claim', actorId: chen, actorName: '陈默', items: [] });
  row = getTransferView(wang, 'PM', state).pool.find(entry => entry.personId === pooled);
  assert.equal(row.formerPmId, wang);
  assert.equal(row.formerPmName, '');
  state.transfers.history[0].type = 'pool.enter';
  state.transfers.history[0].actorName = '';
  state.transfers.history[0].items = [{ personId: intern }];
  row = getTransferView(wang, 'PM', state).pool.find(entry => entry.personId === pooled);
  assert.equal(row.formerPmId, wang);
  assert.equal(row.formerPmName, '');
  state.transfers.history[0].items = [{ personId: pooled }];
  row = getTransferView(wang, 'PM', state).pool.find(entry => entry.personId === pooled);
  assert.equal(row.formerPmId, chen);
  assert.equal(row.formerPmName, '');
});

test('a later pool entry takes its own initiator snapshot and preserves earlier operation history', () => {
  const first = act(seed(), 'pool.enter', { items: [item(intern)] });
  const firstOperation = first.transfers.pool.find(row => row.personId === intern).operationId;
  const claimed = act(first, 'pool.claim', { personIds: [intern], targetProjectId: crossProject }, chen);
  const second = act(claimed, 'pool.enter', { items: [item(intern, crossProject)] }, chen);
  const stored = second.transfers.pool.find(row => row.personId === intern);
  assert.notEqual(stored.operationId, firstOperation);
  assert.equal(stored.formerPmId, chen);
  assert.equal(stored.formerPmName, '陈默');
  second.transfers.managers.find(manager => manager.id === chen).name = '陈默新名称';
  const row = getTransferView(wang, 'PM', second).pool.find(entry => entry.personId === intern);
  assert.equal(row.formerPmName, '陈默');
  assert.equal(getPoolPersonDetails(wang, 'PM', intern, second).person.formerPmName, '陈默');
  assert.equal(second.transfers.history.find(entry => entry.id === firstOperation).actorName, '王然');
});

test('PM summaries follow configured PM delivery line and omit private personnel fields', () => {
  const state = seed();
  person(state, fulltime).departmentId = 'dept-9-2';
  person(state, fulltime).idNumber = 'PRIVATE-ID';
  person(state, fulltime).salary = 123456;
  const view = getTransferView(wang, 'PM', state);
  assert.equal(view.actor.lineId, 'line-general');
  assert.ok(view.rows.some(row => row.personId === fulltime));
  assert.ok(!view.rows.some(row => row.personId === 'hr-transfer-chen-intern'));
  assert.ok(view.pool.some(row => row.personId === pooled && row.lineId === ''));
  assert.ok(!JSON.stringify(view).includes('PRIVATE-ID'));
  assert.ok(!JSON.stringify(view).includes('123456'));
});

test('non-PM view follows the existing project scope and is read-only', () => {
  const state = seed();
  for (const role of ['财务', '项目助理', '人事', 'PMO', '未知角色']) {
    const allowed = new Set(getHrView(role, state).projects.map(row => row.id));
    const view = getTransferView(wang, role, state);
    assert.equal(view.canOperate, false);
    assert.ok(view.projects.every(row => allowed.has(row.id)));
    assert.ok(view.rows.every(row => allowed.has(row.sourceProjectId)));
    assert.ok(view.rows.every(row => row.currentProjects.every(project => allowed.has(project.id))));
    assert.throws(() => act(state, 'transfer', { items: [item()], targetProjectId: peerProject, confirmed: true }, wang, role), /仅可查看/);
  }
});

test('same-PM transfer ends only the selected source relation and preserves other projects', () => {
  const state = seed();
  const original = person(state, intern).projectIds.find(projectId => projectId !== ownProject);
  const target = state.projects.find(project => project.pm === '王然' && !project.ended && ![ownProject, original].includes(project.id)).id;
  const next = act(state, 'transfer', { items: [item(intern)], targetProjectId: target });
  assert.deepEqual(new Set(person(next, intern).projectIds), new Set([original, target]));
  assert.deepEqual(person(next, intern).endedProjectRelations.map(row => row.projectId), [ownProject]);
  assert.equal(next.transfers.notifications.length, 0);
  assert.equal(person(state, intern).projectIds.includes(ownProject), true);
});

test('same-line cross-PM transfer requires confirmation and immediately notifies target PM', () => {
  const state = seed();
  const payload = { items: [item()], targetProjectId: peerProject };
  assert.throws(() => act(state, 'transfer', payload), /请确认/);
  const next = act(state, 'transfer', { ...payload, confirmed: true });
  assert.deepEqual(person(next, fulltime).projectIds, [peerProject]);
  assert.equal(next.transfers.approvals.length, 0);
  assert.equal(next.transfers.notifications[0].recipientName, '林晓彤');
  assert.equal(next.transfers.notifications[0].status, '模拟通知');
  assert.equal(getTransferView(lin, 'PM', next).rows.find(row => row.personId === fulltime).canTransfer, true);
});

test('batch transfer validates every source relation before committing any change', () => {
  const state = seed();
  const before = JSON.stringify(state);
  assert.throws(() => act(state, 'transfer', { items: [item(), item('hr-transfer-chen-intern', crossProject)], targetProjectId: peerProject, confirmed: true }), /自己项目/);
  assert.equal(JSON.stringify(state), before);
  const original = person(state, intern).projectIds.find(projectId => projectId !== ownProject);
  const next = act(state, 'transfer', { items: [item(), item(intern, original)], targetProjectId: peerProject, confirmed: true });
  assert.deepEqual(person(next, fulltime).projectIds, [peerProject]);
  assert.deepEqual(new Set(person(next, intern).projectIds), new Set([ownProject, peerProject]));
});

test('eligibility, project status, invalid actors and stale revision are revalidated', () => {
  const state = seed();
  const payload = { items: [item()], targetProjectId: peerProject, confirmed: true };
  assert.throws(() => reduceTransferAction(state, wang, 'transfer', payload, state.revision - 1), /数据已更新/);
  assert.throws(() => act(state, 'transfer', payload, 'unknown'), /操作PM不存在/);
  state.projects.find(project => project.id === peerProject).ended = true;
  assert.throws(() => act(state, 'transfer', payload), /未结束/);
  state.projects.find(project => project.id === peerProject).ended = false;
  person(state, fulltime).employeeType = '劳务返聘';
  assert.throws(() => act(state, 'transfer', payload), /全职员工、实习生/);
  person(state, fulltime).employeeType = '全职';
  person(state, fulltime).trustedEmploymentStatus = '已离职';
  assert.throws(() => act(state, 'transfer', payload), /来源项目关联已结束|全职员工、实习生/);
});

test('cross-line transfer stays pending with source intact until simulated approval', () => {
  const state = seed();
  const payload = { items: [item()], targetProjectId: crossProject, confirmed: true };
  assert.throws(() => act(state, 'transfer', payload), /跨交付线/);
  const pending = act(state, 'approval.submit', payload);
  assert.deepEqual(person(pending, fulltime).projectIds, [ownProject]);
  assert.equal(pending.transfers.approvals[0].status, '模拟待审批');
  assert.throws(() => act(pending, 'approval.submit', payload), /已有待审批/);
  const next = act(pending, 'approval.resolve', { approvalId: pending.transfers.approvals[0].id, decision: 'approve' });
  assert.deepEqual(person(next, fulltime).projectIds, [crossProject]);
  assert.equal(next.transfers.approvals[0].status, '模拟通过');
  assert.equal(next.transfers.history.length, 2);
  assert.equal(next.transfers.notifications[0].recipientName, '陈默');
  assert.throws(() => act(next, 'approval.resolve', { approvalId: next.transfers.approvals[0].id, decision: 'approve' }), /已经处理/);
});

test('simulated rejection preserves source and cannot be processed as another PM', () => {
  const pending = act(seed(), 'approval.submit', { items: [item()], targetProjectId: crossProject });
  const payload = { approvalId: pending.transfers.approvals[0].id, decision: 'reject' };
  assert.throws(() => act(pending, 'approval.resolve', payload, chen), /仅申请PM/);
  const next = act(pending, 'approval.resolve', payload);
  assert.deepEqual(person(next, fulltime).projectIds, [ownProject]);
  assert.equal(next.transfers.approvals[0].status, '模拟驳回');
  assert.equal(next.transfers.notifications.length, 0);
});

test('ending an approved source generation invalidates pending approval even after rejoining it', () => {
  const pending = act(seed(), 'approval.submit', { items: [item()], targetProjectId: crossProject });
  const otherOwn = pending.projects.find(project => project.pm === '王然' && !project.ended && project.id !== ownProject).id;
  const moved = act(pending, 'transfer', { items: [item()], targetProjectId: otherOwn });
  assert.equal(moved.transfers.approvals[0].status, '模拟已失效');
  const returned = act(moved, 'transfer', { items: [item(fulltime, otherOwn)], targetProjectId: ownProject });
  assert.throws(() => act(returned, 'approval.resolve', { approvalId: pending.transfers.approvals[0].id, decision: 'approve' }), /已经处理/);
  assert.deepEqual(person(returned, fulltime).projectIds, [ownProject]);
  assert.ok(returned.transfers.history.some(row => row.type === 'approval.invalidate'));
});

test('entering the pool invalidates all pending approvals for removed project relations', () => {
  const pending = act(seed(), 'approval.submit', { items: [item(intern)], targetProjectId: crossProject });
  const entered = act(pending, 'pool.enter', { items: [item(intern)] });
  assert.equal(entered.transfers.approvals[0].status, '模拟已失效');
});

test('approval source generation is rechecked after lifecycle closure and later source reentry', () => {
  const pending = act(seed(), 'approval.submit', { items: [item()], targetProjectId: crossProject });
  pending.projects.find(project => project.id === ownProject).ended = true;
  const closed = reconcileHrState(pending, day);
  closed.projects.find(project => project.id === ownProject).ended = false;
  const reentered = mergeHrOutputFacts(closed, [{ id: 'new-reentry', personId: fulltime, projectId: ownProject, date: day, validated: true }], {}, day);
  assert.deepEqual(person(reentered, fulltime).projectIds, [ownProject]);
  assert.throws(() => act(reentered, 'approval.resolve', { approvalId: pending.transfers.approvals[0].id, decision: 'approve' }), /申请时的来源项目关联已结束/);
});

test('repeated lifecycle closures create separate relation generations and cannot revive old approval', () => {
  const closeAndReenter = (state, outputId) => {
    state.projects.find(project => project.id === ownProject).ended = true;
    const closed = reconcileHrState(state, day);
    const repeated = reconcileHrState(closed, day);
    assert.equal(person(repeated, fulltime).endedProjectRelations.length, person(closed, fulltime).endedProjectRelations.length);
    closed.projects.find(project => project.id === ownProject).ended = false;
    return mergeHrOutputFacts(closed, [{ id: outputId, personId: fulltime, projectId: ownProject, date: day, validated: true }], {}, day);
  };
  const firstReentry = closeAndReenter(seed(), 'first-reentry');
  const pending = act(firstReentry, 'approval.submit', { items: [item()], targetProjectId: crossProject });
  const secondReentry = closeAndReenter(pending, 'second-reentry');
  assert.equal(person(secondReentry, fulltime).endedProjectRelations.length, 2);
  assert.equal(pending.transfers.approvals[0].items[0].sourceRelationVersion, 1);
  assert.throws(() => act(secondReentry, 'approval.resolve', { approvalId: pending.transfers.approvals[0].id, decision: 'approve' }), /申请时的来源项目关联已结束/);
  assert.deepEqual(person(secondReentry, fulltime).projectIds, [ownProject]);
});

test('approval revalidates target ownership, ended state and current source relation', () => {
  const pending = act(seed(), 'approval.submit', { items: [item()], targetProjectId: crossProject });
  const payload = { approvalId: pending.transfers.approvals[0].id, decision: 'approve' };
  pending.projects.find(project => project.id === crossProject).ended = true;
  assert.throws(() => act(pending, 'approval.resolve', payload), /未结束/);
  pending.projects.find(project => project.id === crossProject).ended = false;
  pending.projects.find(project => project.id === crossProject).pm = '李想';
  assert.throws(() => act(pending, 'approval.resolve', payload), /目标PM或交付线/);
  pending.projects.find(project => project.id === crossProject).pm = '陈默';
  person(pending, fulltime).projectIds = [];
  assert.throws(() => act(pending, 'approval.resolve', payload), /来源项目关联已结束/);
});

test('intern entry exits all project relations including other PMs and dedupes batch people', () => {
  const state = seed();
  const original = person(state, intern).projectIds.find(projectId => projectId !== ownProject);
  person(state, intern).projectIds.push(crossProject);
  const next = act(state, 'pool.enter', { items: [item(intern), item(intern, original)] });
  assert.deepEqual(person(next, intern).projectIds, []);
  assert.equal(person(next, intern).endedProjectRelations.length, 3);
  assert.equal(next.transfers.pool.filter(row => row.personId === intern).length, 1);
  assert.equal(next.transfers.notifications.length, 1);
  assert.equal(next.transfers.notifications[0].content, '你已被调休');
  assert.throws(() => act(state, 'pool.enter', { items: [item()] }), /仅适用于实习生/);
});

test('company pool can be claimed across delivery lines without approval and sends all previews', () => {
  const entered = act(seed(), 'pool.enter', { items: [item(intern)] });
  const next = act(entered, 'pool.claim', { personIds: [intern], targetProjectId: crossProject }, chen);
  assert.deepEqual(person(next, intern).projectIds, [crossProject]);
  assert.equal(person(next, intern).transferControl.pool, false);
  assert.equal(next.transfers.pool.some(row => row.personId === intern), false);
  assert.equal(next.transfers.approvals.length, 0);
  assert.deepEqual(next.transfers.notifications.slice(1).map(row => row.recipientRole), ['实习生', 'PM', 'PA', 'QA']);
  assert.ok(next.transfers.notifications.every(row => row.status === '模拟通知'));
});

test('claim rejects another PM target, ended target, repeated claim and mixed invalid batch', () => {
  const state = seed();
  const payload = { personIds: [pooled], targetProjectId: ownProject };
  assert.throws(() => act(state, 'pool.claim', payload, chen), /自己负责/);
  assert.throws(() => act(state, 'pool.claim', { ...payload, personIds: [pooled, fulltime] }), /已被提取/);
  assert.equal(person(state, pooled).projectIds.length, 0);
  const next = act(state, 'pool.claim', payload);
  assert.throws(() => act(next, 'pool.claim', payload), /已被提取/);
  state.projects.find(project => project.id === ownProject).ended = true;
  assert.throws(() => act(state, 'pool.claim', payload), /未结束/);
});

test('missing PA or QA produces a configuration-needed preview instead of a fictitious recipient', () => {
  const state = seed();
  const target = state.projects.find(project => project.id === ownProject);
  target.pa = '—';
  delete target.qa;
  const next = act(state, 'pool.claim', { personIds: [pooled], targetProjectId: ownProject });
  assert.deepEqual(next.transfers.notifications.slice(-2).map(row => row.status), ['模拟待配置', '模拟待配置']);
});

test('historical outputs stay readable while new conflicts cannot undo transfer or pool state', () => {
  const state = seed();
  state.outputs.push({ id: 'before-transfer', personId: fulltime, projectId: ownProject, date: day, category: '内部人员' });
  const moved = act(state, 'transfer', { items: [item()], targetProjectId: peerProject, confirmed: true });
  const next = mergeHrOutputFacts(moved, [
    { id: 'before-transfer', personId: fulltime, projectId: ownProject, date: day, validated: true },
    { id: 'historic-transfer', personId: fulltime, projectId: ownProject, date: '2026-11-09', validated: true },
    { id: 'future-transfer', personId: fulltime, projectId: ownProject, date: '2026-11-11', validated: true },
  ], {}, day);
  assert.deepEqual(person(next, fulltime).projectIds, [peerProject]);
  assert.equal(next.outputs.find(row => row.id === 'before-transfer').category, '内部人员');
  assert.equal(next.outputs.find(row => row.id === 'historic-transfer').category, '内部人员');
  assert.equal(next.outputs.find(row => row.id === 'future-transfer').category, '待核对');
  const entered = act(next, 'pool.enter', { items: [item(intern)] });
  const afterOutput = mergeHrOutputFacts(entered, [{ id: 'pool-future', personId: intern, projectId: ownProject, date: day, validated: true }], {}, day);
  assert.deepEqual(person(afterOutput, intern).projectIds, []);
  assert.equal(afterOutput.outputs.find(row => row.id === 'pool-future').category, '待核对');
  assert.equal(reconcileHrState(afterOutput, day).transfers.pool.some(row => row.personId === intern), true);
});

test('source refresh cannot replace explicit transferred associations with an old snapshot', () => {
  const state = seed();
  const original = person(state, 'hr-1').projectIds[0];
  const moved = act(state, 'transfer', { items: [item('hr-1', original)], targetProjectId: peerProject, confirmed: true });
  const next = mergeHrSource(moved, [{ sourceId: 'demo-source-hr-1', recruitmentNo: '招聘-模拟-1831', appliedPosition: '数据标注员', name: '林悦', projectIds: [original], day1: '通过', trainingResult: '通过' }], day);
  assert.deepEqual(person(next, 'hr-1').projectIds, person(moved, 'hr-1').projectIds);
  assert.ok(next.sync.conflicts.some(row => row.reason.includes('保留调配结果')));
});

test('concurrent browser claims serialize and reject the stale revision without double allocation', async () => {
  const oldStorage = globalThis.localStorage;
  const oldWindow = globalThis.window;
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let stored = JSON.stringify(reconcileHrState(seed()));
  let queue = Promise.resolve();
  let locks = 0;
  globalThis.localStorage = { getItem: key => key === HR_KEY ? stored : null, setItem: (key, value) => { if (key === HR_KEY) stored = value; } };
  globalThis.window = {};
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request: (name, operation) => { assert.equal(name, `${HR_KEY}.transfers`); locks++; const result = queue.then(operation); queue = result.catch(() => {}); return result; } } } });
  try {
    const view = getTransferView(wang);
    const results = await Promise.allSettled([
      transferAction(wang, 'pool.claim', { personIds: [pooled], targetProjectId: ownProject }, view.revision),
      transferAction(chen, 'pool.claim', { personIds: [pooled], targetProjectId: crossProject }, view.revision),
    ]);
    assert.equal(locks, 2);
    assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected']);
    assert.match(results[1].reason.message, /数据已更新/);
    const saved = JSON.parse(stored);
    assert.deepEqual(person(saved, pooled).projectIds, [ownProject]);
    assert.equal(saved.transfers.history.filter(row => row.type === 'pool.claim').length, 1);
  } finally {
    globalThis.localStorage = oldStorage;
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else delete globalThis.navigator;
  }
});

test('delivery-line history is HR-only and uses saved personnel and project snapshots', () => {
  const state = seed();
  state.transfers.approvals = [{
    id: 'legacy-approval', actorId: wang, actorName: '王然', targetPmId: chen, targetPmName: '陈默',
    targetProjectId: crossProject, targetProjectName: '申请时目标项目', createdAt: '2026-11-10T08:00:00+08:00', status: '模拟通过', decisionAt: '2026-11-10T09:00:00+08:00',
    items: [
      { personId: fulltime, name: '申请时人员', employeeNo: 'MCE001', employeeType: '全职', sourceProjectId: ownProject, sourceProjectName: '申请时来源项目' },
      { personId: intern, name: '申请时实习生', employeeNo: 'MCE002', employeeType: '在校实习生', sourceProjectId: ownProject, sourceProjectName: '申请时来源项目' },
    ],
  }];
  person(state, fulltime).name = '后来修改的姓名';
  state.projects.find(row => row.id === ownProject).name = '后来修改的项目';
  state.transfers.managers.find(row => row.id === wang).lineName = '后来修改的交付线';
  const original = structuredClone(state);
  for (const role of ['PM', 'PMO', '财务', 'PA', '部门经理', '未知角色']) assert.deepEqual(getDeliveryLineChanges(role, state), { role, canView: false, rows: [] });
  const view = getDeliveryLineChanges('人事', state);
  assert.equal(view.rows.length, 2);
  assert.equal(view.rows[0].name, '申请时人员');
  assert.equal(view.rows[0].sourceProjectName, '申请时来源项目');
  assert.equal(view.rows[0].targetProjectName, '申请时目标项目');
  assert.equal(view.rows[0].sourcePmName, '王然');
  assert.equal(view.rows[0].sourceLineName, '');
  assert.equal(view.rows[0].targetLineName, '');
  assert.equal(view.rows[0].status, '通过');
  assert.equal(view.rows[0].source, '');
  assert.equal(view.rows[0].approvalUrl, '');
  assert.equal(view.rows[0].completedAt, state.transfers.approvals[0].decisionAt);
  assert.equal(view.rows[0].effectiveDate, '');
  assert.deepEqual(getDeliveryLineChanges('HR', state).rows, view.rows);
  assert.deepEqual(state, original);
});

test('delivery-line history exposes only actual sourced Feishu links and explicit line snapshots', () => {
  const state = seed();
  const approval = { id: 'feishu-record', source: '飞书审批', url: 'https://example.feishu.cn/approval/instance-1', sourceLineId: 'line-old', sourceLineName: '原交付线', targetLineId: 'line-new', targetLineName: '目标交付线', status: '已通过', completedAt: '2026-11-10T10:00:00+08:00', items: [{ personId: 'archived-person', name: '历史人员', employeeNo: 'MCE003', sourcePmName: '历史PM' }] };
  state.transfers.approvals = [approval];
  let row = getDeliveryLineChanges('人事', state).rows[0];
  assert.equal(row.approvalUrl, approval.url);
  assert.equal(row.sourceLineName, '原交付线');
  assert.equal(row.targetLineName, '目标交付线');
  assert.equal(row.sourcePmName, '历史PM');
  assert.equal(row.completedAt, approval.completedAt);
  state.transfers.approvals[0].effectiveDate = '2026-11-12';
  assert.equal(getDeliveryLineChanges('人事', state).rows[0].effectiveDate, '2026-11-12');
  for (const url of ['javascript:alert(1)', 'https://feishu.cn.example.test/approval/1', 'http://example.feishu.cn/approval/1', 'https://user:password@example.feishu.cn/approval/1', '']) {
    state.transfers.approvals[0] = { ...approval, url };
    assert.equal(getDeliveryLineChanges('人事', state).rows[0].approvalUrl, '');
  }
  state.transfers.approvals[0] = { ...approval, source: '' };
  assert.equal(getDeliveryLineChanges('人事', state).rows[0].approvalUrl, '');
  assert.deepEqual(getDeliveryLineChanges('人事', { people: [], projects: [] }).rows, []);
});

test('public transfer actions reject local cross-line approval creation and resolution without writes', async () => {
  const previousStorage = globalThis.localStorage;
  const state = seed();
  let stored = JSON.stringify(state);
  let writes = 0;
  globalThis.localStorage = { getItem: () => stored, setItem: (_, value) => { stored = value; writes++; } };
  try {
    for (const type of ['approval.submit', 'approval.resolve']) await assert.rejects(transferAction(wang, type, { items: [item()], targetProjectId: crossProject, decision: 'approve' }, state.revision), /交付线变更请在飞书审批中办理/);
    assert.equal(writes, 0);
    assert.deepEqual(JSON.parse(stored), state);
  } finally { globalThis.localStorage = previousStorage; }
});

test('delivery-line records preserve a separate source and destination project snapshot for every association', () => {
  const state = seed();
  state.deliveryLineRecords = [{
    id: 'source-record', approvalNo: 'AP-001', approvalSource: '飞书审批', sourceRecordId: 'source-001',
    targetProjectId: 'header-target', targetProjectName: '审批头项目', targetPmName: '审批头经理',
    items: [
      { personId: fulltime, sourceProjectId: ownProject, sourceProjectNo: 'OLD-001', sourceProjectName: '申请时项目一',
        targetProjectId: crossProject, targetProjectNo: 'NEW-001', targetProjectName: '申请时目标一', targetPmName: '陈默', effectiveDate: day },
      { personId: fulltime, sourceProjectId: peerProject, sourceProjectNo: 'OLD-002', sourceProjectName: '申请时项目二',
        targetProjectId: 'second-target', targetProjectNo: 'NEW-002', targetProjectName: '申请时目标二', targetPmName: '李想', sourceRecordId: 'detail-002' },
      { personId: intern, sourceProjectId: ownProject, targetProjectId: '', targetProjectName: '', targetPmName: '' },
    ],
  }];
  const original = structuredClone(state);
  const rows = getDeliveryLineChanges('人事', state).rows;
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map(row => row.key)).size, 3);
  assert.deepEqual(rows.slice(0, 2).map(row => [row.sourceProjectNo, row.targetProjectNo, row.targetPmName]), [
    ['OLD-001', 'NEW-001', '陈默'], ['OLD-002', 'NEW-002', '李想'],
  ]);
  assert.equal(rows[1].sourceRecordId, 'detail-002');
  assert.equal(rows[2].targetProjectName, '');
  assert.equal(rows[2].targetPmName, '');
  state.projects.find(project => project.id === ownProject).name = '当前项目新名称';
  assert.equal(getDeliveryLineChanges('人事', state).rows[0].sourceProjectName, '申请时项目一');
  state.projects.find(project => project.id === ownProject).name = original.projects.find(project => project.id === ownProject).name;
  assert.deepEqual(state, original);
});

test('delivery-line source samples migrate once without changing project relations or actionable approvals', () => {
  const state = seed();
  const next = initializeDeliveryLineSources(state, day);
  assert.deepEqual(next.people, state.people);
  assert.deepEqual(next.transfers, state.transfers);
  assert.deepEqual(next.projects, state.projects);
  const rows = getDeliveryLineChanges('人事', next).rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].personId, rows[1].personId);
  assert.notEqual(rows[0].sourceProjectId, rows[1].sourceProjectId);
  assert.notEqual(rows[0].targetProjectId, rows[1].targetProjectId);
  assert.ok(rows.every(row => !row.approvalNo && !row.approvalUrl));
  assert.deepEqual(initializeDeliveryLineSources(next, day), next);
  const actual = seed();
  actual.people[0].sourceId = 'actual-source';
  assert.deepEqual(initializeDeliveryLineSources(actual, day).deliveryLineRecords, []);
});

test('a project-specific detail cannot inherit names, PM or delivery line from a different header project', () => {
  const state = seed();
  state.deliveryLineRecords = [{
    id: 'mixed-projects', sourceProjectId: 'source-header', sourceProjectNo: 'SOURCE-HEADER', sourceProjectName: '审批头来源项目',
    sourcePmName: '审批头来源经理', actorName: '申请人', sourceLineName: '审批头来源线',
    targetProjectId: 'target-header', targetProjectNo: 'TARGET-HEADER', targetProjectName: '审批头目标项目',
    targetPmName: '审批头目标经理', targetLineName: '审批头目标线',
    items: [{ personId: fulltime, sourceProjectId: 'source-detail', targetProjectId: 'target-detail' }],
  }];
  const row = getDeliveryLineChanges('人事', state).rows[0];
  assert.equal(row.sourceProjectId, 'source-detail');
  assert.equal(row.targetProjectId, 'target-detail');
  for (const field of ['sourceProjectNo', 'sourceProjectName', 'sourcePmName', 'sourceLineName', 'targetProjectNo', 'targetProjectName', 'targetPmName', 'targetLineName']) assert.equal(row[field], '', field);
});
