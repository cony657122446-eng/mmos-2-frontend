import test from 'node:test';
import assert from 'node:assert/strict';
import { createHrSeed, getHrView, reduceHrAction, trainingStage, employmentStatus, checklistStatus, tenureDays, hrAnomalies, hrReminderPlan, isHrReferenceActive, mergeHrSource, beijingToday, reconcileHrState, loadHr, HR_KEY } from './hrWorkspace.js';

const day = '2026-11-05';
const seed = () => createHrSeed(day);
const act = (state, type, payload, role = '人事') => reduceHrAction(state, role, type, payload);
const submit = (state, recruitmentNo, requestId = 'test-request', extra = {}) => act(state, 'intake.submit', {
  requestId, values: { ...seed().intakes[0].values, recruitmentNo, ...extra },
}, '资料填写人');

test('master list contains only successful records and separate checklist state', () => {
  const view = getHrView('人事', seed(), day);
  assert.equal(view.people.length, 6);
  assert.equal(view.people.find(p => p.id === 'hr-3').employmentStatus, '待入职');
  assert.equal(view.people.find(p => p.id === 'hr-3').checklistStatus, '待签合同');
  assert.equal(view.people.find(p => p.id === 'hr-4').employmentStatus, '离职中');
  assert.equal(view.people.find(p => p.id === 'hr-5').employmentStatus, '已离职');
  assert.equal(view.people.find(p => p.id === 'hr-5').checklistStatus, '已完成');
});

test('PM and assistants receive scoped project people, no full candidate or intake data', () => {
  const state = seed();
  state.people[0].idNumber = 'secret-id';
  state.people[0].bankNumber = 'secret-bank';
  const pm = getHrView('PM', state, day);
  assert.equal(pm.candidates.length, 0);
  assert.equal(pm.intakes.length, 0);
  assert.equal(pm.onboarding.length, 0);
  assert.ok(!pm.projectPeople.some(p => p.id === 'hr-2'));
  assert.ok(!JSON.stringify(pm).includes('secret-id'));
  assert.ok(!JSON.stringify(pm).includes('secret-bank'));
  assert.ok(pm.outputs.every(o => pm.projects.some(p => p.id === o.projectId)));
  const assistant = getHrView('项目助理', state, day);
  assert.ok(assistant.projects.every(p => p.pa === '林晓彤'));
  assert.ok(assistant.projectPeople.every(p => !p.canTrain));
  assert.equal(getHrView('未知角色', state).people.length, 0);
});

test('first day passes to second day without premature checklist, second day passes once', () => {
  let state = act(seed(), 'training.update', { personId: 'hr-6', day1: '通过' }, 'PM');
  let person = state.people.find(p => p.id === 'hr-6');
  assert.equal(trainingStage(person), '第2天');
  assert.equal(person.checklistCreated, false);
  state = act(state, 'training.update', { personId: 'hr-6', result: '通过' }, 'PM');
  person = state.people.find(p => p.id === 'hr-6');
  assert.equal(person.checklistCreated, true);
  assert.equal(person.masterCreated, false);
  assert.equal(person.trainingStart, day);
  assert.equal(person.trainingPassedDate, ''); // no invented actual date
  assert.throws(() => act(state, 'training.update', { personId: 'hr-6', result: '通过' }, 'PM'), /已评定/);
});

test('cross-project and viewer-only training writes rejected', () => {
  assert.throws(() => act(seed(), 'training.update', { personId: 'hr-7', result: '通过' }, 'PM'), /无权/);
  for (const role of ['PMO', '财务', '项目助理']) assert.throws(() => act(seed(), 'training.update', { personId: 'hr-6', day1: '通过' }, role), /无权/);
  assert.throws(() => act(seed(), 'training.update', { personId: 'hr-6', result: '通过' }, 'PM'), /第一天/);
  const multi = seed();
  const otherTraining = multi.people.find(p => p.id === 'hr-7');
  otherTraining.projectIds.push(multi.projects[0].id);
  assert.ok(getHrView('PM', multi).projectPeople.some(p => p.id === otherTraining.id));
  assert.throws(() => act(multi, 'training.update', { personId: 'hr-7', result: '通过' }, 'PM'), /无权/);
});

test('elimination uses actual half days, zero remains unresolved, invalid numbers cannot produce payable', () => {
  const state = act(seed(), 'training.update', { personId: 'hr-6', day1: '淘汰', subsidyDays: .5 }, 'PM');
  const person = state.people.find(p => p.id === 'hr-6');
  assert.equal(trainingStage(person), '第1天淘汰');
  assert.equal(person.subsidyAmount, 40);
  assert.equal(person.checklistCreated, false);
  const zero = act(seed(), 'training.update', { personId: 'hr-6', day1: '淘汰', subsidyDays: 0 }, 'PM').people.find(p => p.id === 'hr-6');
  assert.equal(zero.subsidyAmount, null);
  assert.match(zero.subsidyReview, /待核对/);
  for (const value of ['', -1, 'invalid', .3]) assert.throws(() => act(seed(), 'training.update', { personId: 'hr-6', day1: '淘汰', subsidyDays: value }, 'PM'), /有效实际天数/);
});

test('HR corrections require reason, record before/after and retain downstream associations', () => {
  assert.throws(() => act(seed(), 'training.update', { personId: 'hr-3', result: '淘汰', subsidyDays: 1.5 }), /原因/);
  const state = act(seed(), 'training.update', { personId: 'hr-3', result: '淘汰', subsidyDays: 1.5, reason: '核对模拟评定原件' });
  const p = state.people.find(p => p.id === 'hr-3');
  assert.equal(p.masterCreated, true);
  assert.equal(p.checklistCreated, true);
  assert.match(p.downstreamReview, /核对下游/);
  assert.equal(state.audit[0].before.trainingResult, '通过');
  assert.equal(state.audit[0].after.trainingResult, '淘汰');
  assert.equal(state.audit[0].reason, '核对模拟评定原件');
});

test('source import exactly matches Beijing arrival day and training option, dedupes without overriding local results', () => {
  let state = seed();
  const source = { sourceId: 'new-1', name: '新模拟候选', arrivalDate: day, appliedPosition: '标注员', day1: '培训中', projectIds: [] };
  const rows = [source, { ...source, sourceId: 'new-2', arrivalDate: '2026-11-04' }, { ...source, sourceId: 'new-3', day1: '培训中-淘汰' }, { ...source, sourceId: 'new-4', appliedPosition: '兼职' }, { ...source, sourceId: 'new-5', appliedPosition: '' }];
  state = mergeHrSource(state, rows, day);
  assert.equal(state.people.length, 13);
  const newPerson = state.people.find(p => p.sourceId === 'new-1');
  assert.match(newPerson.employeeNo, /^MCE\d{8}$/);
  assert.equal(newPerson.projectIds.length, 0); // mapping failure does not block valid numbering
  newPerson.day1 = '通过';
  newPerson.locallyMaintained = true;
  state = mergeHrSource(state, [source], day);
  assert.equal(state.people.length, 13);
  assert.equal(state.people.find(p => p.sourceId === 'new-1').day1, '通过');
  const tomorrow = mergeHrSource(state, [], '2026-11-06');
  assert.equal(tomorrow.people.length, 13);
  assert.equal(beijingToday('2026-11-04T16:01:00Z'), day);
});

test('three gates create one master, contract not a gate and external facts cannot be edited', () => {
  const state = act(seed(), 'onboarding.update', { personId: 'hr-8', intent: '确认入职' });
  const person = state.people.find(p => p.id === 'hr-8');
  assert.equal(person.masterCreated, true);
  assert.equal(employmentStatus(person, day), '待入职');
  assert.equal(checklistStatus(person), '待签合同');
  const repeat = act(state, 'onboarding.review', { personId: 'hr-8' });
  assert.equal(repeat.people.filter(p => p.id === 'hr-8').length, 1);
  const blocked = act(seed(), 'onboarding.update', { personId: 'hr-9', intent: '确认入职' });
  assert.equal(blocked.people.find(p => p.id === 'hr-9').masterCreated, false);
  assert.throws(() => act(seed(), 'account.activate', { personId: 'hr-9' }), /真实外部结果/);
  assert.throws(() => act(seed(), 'contract.sign', { personId: 'hr-9' }), /真实外部结果/);
});

test('unactivated HR refusal terminates once, activated branch waits for genuine approval', () => {
  const state = act(seed(), 'onboarding.update', { personId: 'hr-9', intent: '不入职' });
  const person = state.people.find(p => p.id === 'hr-9');
  assert.equal(checklistStatus(person), '已终止');
  assert.equal(person.subsidyAmount, 160);
  assert.equal(person.trainingResult, '通过');
  assert.throws(() => act(state, 'onboarding.update', { personId: 'hr-9', intent: '确认入职' }), /已终止/);
  const activated = act(seed(), 'onboarding.update', { personId: 'hr-8', intent: '不入职' }).people.find(p => p.id === 'hr-8');
  assert.equal(activated.terminated, undefined);
  assert.equal(activated.masterCreated, false);
  assert.equal(activated.subsidyAmount, null);
  assert.match(activated.exitFollowup, /等待飞书/);
});

test('independent intake accepts unknown candidate, is request-idempotent and never leaks into logs', () => {
  const original = seed();
  const values = { ...original.intakes[0].values, name: '尚未进入候选库', recruitmentNo: '', idNumber: 'SECRET-DEMO-12345' };
  const state = act(original, 'intake.submit', { requestId: 'unique-request', values }, '资料填写人');
  assert.equal(state.intakes.length, 3);
  assert.equal(state.people.length, original.people.length);
  assert.equal(state.intakes.at(-1).candidateId, '');
  assert.ok(!JSON.stringify(state.audit).includes('SECRET-DEMO-12345'));
  assert.ok(!JSON.stringify(state.audit).includes('base64'));
  const again = act(state, 'intake.submit', { requestId: 'unique-request', values }, '资料填写人');
  assert.equal(again.intakes.length, 3);
  const sameNameNewRequest = act(state, 'intake.submit', { requestId: 'different-request', values }, '资料填写人');
  assert.equal(sameNameNewRequest.intakes.length, 4);
});

test('tenure is inclusive real business dates and never fabricates zero', () => {
  const person = seed().people[0];
  assert.equal(tenureDays(person, day), 5);
  assert.equal(tenureDays({ ...person, trainingStart: '' }, day), null);
  assert.equal(tenureDays({ ...person, trainingStart: '2026-11-06' }, day), null);
  const exited = { ...person, resignation: { status: '通过', effectiveDate: '2026-11-03' } };
  assert.equal(tenureDays(exited, day), 3);
  assert.equal(employmentStatus(exited, day), '已离职');
  assert.equal(employmentStatus({ ...exited, contractSigned: true }, day), '已离职');
});

test('only applicable onboarding records show anomalies; calendar has deduped regular and focused reminders', () => {
  assert.deepEqual(hrAnomalies(seed().people.find(p => p.id === 'hr-6')), []);
  assert.deepEqual(hrAnomalies(seed().people.find(p => p.id === 'hr-9')), ['组织号未激活', '合同未签署', '资料不全']);
  assert.deepEqual(hrReminderPlan('2026-11-10').anomalies, ['组织号未激活', '合同未签署', '资料不全']);
  assert.deepEqual(hrReminderPlan('2026-11-11').anomalies, ['合同未签署', '资料不全']);
  assert.equal(hrReminderPlan('2027-02-28').regular, true);
  assert.equal(hrReminderPlan('2028-02-29').regular, true);
  assert.equal(hrReminderPlan('2026-11-06').anomalies.length, 0);
  const legacy = seed();
  Object.assign(legacy.people.find(p => p.id === 'hr-10'), { materialsComplete: false, missingFields: ['尚未关联已提交资料'] });
  const projection = getHrView('人事', legacy).onboarding.find(p => p.id === 'hr-10');
  assert.equal(projection.materialsComplete, true);
  assert.ok(!projection.anomalies.includes('资料不全'));
  assert.equal(getHrView('PA', seed()).role, '项目助理');
});

test('department cycle, trimmed sibling duplicate and referenced deletion rejected atomically', () => {
  const state = seed();
  assert.throws(() => act(state, 'organization.save', { collection: 'departments', id: 'dept-9', parentId: 'dept-9-1', name: 'AI数据交付中心' }), /后代/);
  assert.throws(() => act(state, 'organization.save', { collection: 'departments', name: ' 总经办 ', parentId: '', status: '启用' }), /重复/);
  assert.throws(() => act(state, 'organization.delete', { collection: 'departments', id: 'dept-9' }), /引用/);
  assert.equal(state.departments.find(d => d.id === 'dept-9').parentId, '');
  assert.throws(() => act(state, 'organization.save', { collection: 'departments', name: '新部门', parentId: '', status: '启用' }, 'PMO'), /仅人事/);
});

test('location validity honors business status and inclusive date boundaries', () => {
  const row = { status: '在用', validity: '时间段', startDate: '2026-11-01', endDate: day };
  assert.equal(isHrReferenceActive(row, '2026-11-01'), true);
  assert.equal(isHrReferenceActive(row, day), true);
  assert.equal(isHrReferenceActive(row, '2026-11-06'), false);
  assert.equal(isHrReferenceActive({ ...row, status: '筹备', validity: '永久启用' }, day), false);
  assert.throws(() => act(seed(), 'organization.save', { collection: 'locations', name: '新地点', status: '在用', validity: '时间段', startDate: day, endDate: '2026-11-01' }), /起止日期/);
  assert.throws(() => act(seed(), 'onboarding.update', { personId: 'hr-1', locationId: 'loc-2' }), /审批/);
});

test('position rename updates current references but does not overwrite employee manager', () => {
  const state = act(seed(), 'organization.save', { collection: 'positions', id: 'pos-1', name: '数据评测员', manager: '新默认经理' });
  const person = getHrView('人事', state).people.find(p => p.id === 'hr-1');
  assert.equal(person.positionName, '数据评测员');
  assert.equal(person.manager, '王然');
  assert.equal(state.audit.find(a => a.type === 'organization.save').before.name, '数据标注员');
});

test('stale writes and unapproved master mutations rejected', () => {
  assert.throws(() => act(seed(), 'onboarding.update', { personId: 'hr-8', intent: '确认入职', expectedRevision: 0 }), /数据已更新/);
  assert.throws(() => act(seed(), 'person.save', { personId: 'hr-1', name: '改名' }), /授权功能/);
});

test('external roster is current only but historical classification and independent attendance persist', () => {
  const view = getHrView('人事', seed(), day);
  assert.ok(!view.external.some(p => p.id === 'ext-3'));
  assert.equal(view.outputs.find(o => o.personId === 'ext-3').category, '外部人员');
  assert.ok(view.outputs.some(o => o.category === '待核对'));
  assert.ok(!view.attendance.some(o => o.personId === 'ext-3'));
});

test('demo numbers auto-match once and preserve integrated status after admission', () => {
  const original = seed();
  const state = reconcileHrState(original, day);
  const person = state.people.find(p => p.id === 'hr-10');
  assert.equal(person.intakeId, 'intake-demo-1');
  assert.equal(person.masterCreated, true);
  assert.equal(person.employeeNo, 'MCE00001840');
  assert.equal(person.intakeMatchStatus, '已完成整合');
  assert.equal(person.idNumber, undefined);
  assert.equal(person.bank0_card, undefined);
  assert.equal(state.intakes[1].candidateId, '');
  assert.equal(state.intakes[1].status, '等待匹配');
  assert.deepEqual(reconcileHrState(state, day), state);
  assert.equal(original.people.find(p => p.id === 'hr-10').masterCreated, false);
  const view = getHrView('人事', original, day);
  assert.equal(view.onboarding.find(p => p.id === person.id).intakeSerial, 'ZL-DEMO-001');
  assert.equal(view.intakes[0].recruitmentNo, '招聘-模拟-1840');
  assert.throws(() => act(state, 'intake.link', { id: 'intake-demo-2', candidateId: 'hr-8', evidence: '同名' }), /自动匹配/);
});

test('candidate first trims recruitment number but preserves leading zeroes and ignores names', () => {
  const state = seed();
  const person = state.people.find(p => p.id === 'hr-8');
  person.recruitmentNo = ' 0001838 ';
  const next = submit(state, ' 0001838 ', 'zero-request', { name: '与候选姓名不同', gender: '男' });
  const intake = next.intakes.at(-1);
  assert.equal(intake.values.recruitmentNo, '0001838');
  assert.equal(intake.candidateId, person.id);
  assert.equal(next.people.find(p => p.id === person.id).name, person.name);
  assert.equal(next.people.find(p => p.id === person.id).gender, '男');
  assert.equal(next.people.find(p => p.id === person.id).masterCreated, false); // intent remains unconfirmed
  const admitted = act(next, 'onboarding.update', { personId: person.id, intent: '确认入职' });
  assert.equal(admitted.people.find(p => p.id === person.id).masterCreated, true);
  const different = submit(next, '1838', 'different-number', { name: person.name });
  assert.equal(different.intakes.at(-1).candidateId, '');
});

test('intake first reconciles when the source arrives and again after training and account activation', () => {
  const first = submit(seed(), '0001901');
  const source = { sourceId: 'later-source', recruitmentNo: '0001901', name: '模拟来源候选', arrivalDate: day, appliedPosition: '标注员', day1: '培训中', projectIds: [first.projects[0].id] };
  let state = mergeHrSource(first, [source], day);
  let person = state.people.find(p => p.sourceId === source.sourceId);
  assert.equal(state.intakes.at(-1).candidateId, person.id);
  assert.equal(person.intakeMatchStatus, '已自动关联，待培训通过');
  assert.equal(person.contactFromIntake, undefined);
  state = act(state, 'training.update', { personId: person.id, day1: '通过' }, 'PM');
  state = act(state, 'training.update', { personId: person.id, result: '通过' }, 'PM');
  person = state.people.find(p => p.id === person.id);
  assert.equal(person.intakeMatchStatus, '已自动关联，待激活整合');
  state = act(state, 'onboarding.update', { personId: person.id, intent: '确认入职' });
  assert.equal(state.people.find(p => p.id === person.id).masterCreated, false);
  state.people.find(p => p.id === person.id).accountActive = true; // external fact adapter
  state = act(state, 'onboarding.review', { personId: person.id });
  assert.equal(state.people.find(p => p.id === person.id).masterCreated, true);
  assert.equal(state.intakes.at(-1).status, '已完成整合');
});

test('a repeated request is idempotent and a different request cannot overwrite the unique recruitment number', () => {
  const state = submit(seed(), 'unique-0123', 'request-0123', { idNumber: 'SECRET-UNIQUE-ID' });
  const repeat = submit(state, 'unique-0123', 'request-0123', { name: '重试不得覆盖' });
  assert.deepEqual(repeat, state);
  assert.throws(() => submit(state, ' unique-0123 ', 'another-request'), /已提交资料/);
  assert.equal(state.intakes.at(-1).values.idNumber, 'SECRET-UNIQUE-ID');
  assert.ok(!JSON.stringify(state.audit).includes('SECRET-UNIQUE-ID'));
  assert.ok(!JSON.stringify(state.audit).includes('base64'));
});

test('legacy missing numbers and mismatched manual associations never guess from names', () => {
  let state = seed();
  state.intakes = [{ ...state.intakes[0], id: 'historical-intake', requestId: 'historical-request', values: { ...state.intakes[0].values, recruitmentNo: '' }, candidateId: 'hr-8' }];
  const person = state.people.find(p => p.id === 'hr-8');
  person.intakeId = 'historical-intake';
  person.intent = '确认入职';
  state = reconcileHrState(state, day);
  assert.equal(state.intakes[0].candidateId, 'hr-8'); // retain evidence, not trusted for integration
  assert.equal(state.intakes[0].status, '等待匹配');
  assert.equal(state.people.find(p => p.id === 'hr-8').masterCreated, false);
  state.intakes[0].values.recruitmentNo = '招聘-模拟-1839';
  state = reconcileHrState(state, day);
  assert.equal(state.intakes[0].status, '待核对');
  assert.equal(state.intakes[0].candidateId, 'hr-8');
  assert.equal(state.people.find(p => p.id === 'hr-9').intakeId, undefined);
});

test('matching legacy association is kept, unrelated review issues still block admission', () => {
  const original = seed();
  original.intakes[0].candidateId = 'hr-10';
  original.people.find(p => p.id === 'hr-10').intakeId = 'intake-demo-1';
  original.people.find(p => p.id === 'hr-10').integrationIssue = '外部字段来源尚未核实';
  const state = reconcileHrState(original, day);
  const person = state.people.find(p => p.id === 'hr-10');
  assert.equal(person.intakeId, 'intake-demo-1');
  assert.equal(person.integrationIssue, '外部字段来源尚未核实');
  assert.equal(person.masterCreated, false);
});

test('new intake cannot overwrite existing master and terminated or departed records never reopen', () => {
  const masterState = submit(seed(), '招聘-模拟-1831', 'master-request', { gender: '男' });
  const master = masterState.people.find(p => p.id === 'hr-1');
  assert.equal(master.gender, '女');
  assert.equal(master.contactFromIntake, undefined);
  assert.match(masterState.intakes.at(-1).matchIssue, /审批/);
  for (const kind of ['terminated', 'departed']) {
    const state = seed();
    const person = state.people.find(p => p.id === 'hr-10');
    if (kind === 'terminated') person.terminated = true;
    else { person.masterCreated = true; person.trustedEmploymentStatus = '已离职'; }
    const next = reconcileHrState(state, day);
    assert.equal(next.intakes[0].candidateId, '');
    assert.equal(next.people.find(p => p.id === person.id).contactFromIntake, undefined);
    assert.match(next.intakes[0].matchIssue, /不重新整合/);
  }
});

test('duplicate source number preserves the trusted person, exposes conflicts only to HR and remains idempotent', () => {
  const state = reconcileHrState(seed(), day);
  const row = { sourceId: 'duplicate-source', recruitmentNo: ' 招聘-模拟-1831 ', name: '重复来源', arrivalDate: day, appliedPosition: '标注员', day1: '培训中' };
  const next = mergeHrSource(state, [row], day);
  assert.equal(next.people.length, state.people.length);
  assert.equal(next.nextEmployeeNumber, state.nextEmployeeNumber);
  assert.deepEqual(next.people.find(p => p.id === 'hr-1'), state.people.find(p => p.id === 'hr-1'));
  assert.equal(getHrView('人事', next, day).sync.conflicts.length, 1);
  assert.equal(getHrView('PMO', next, day).sync.conflicts, undefined);
  assert.deepEqual(mergeHrSource(next, [row], day), next);
});

test('the same source may fill its missing number but cannot silently replace a known number', () => {
  const row = { sourceId: 'missing-number-source', name: '模拟候选', arrivalDate: day, appliedPosition: '标注员', day1: '培训中' };
  let state = mergeHrSource(seed(), [row], day);
  state = submit(state, 'late-0007', 'late-request');
  state = mergeHrSource(state, [{ ...row, recruitmentNo: ' late-0007 ' }], day);
  const person = state.people.find(p => p.sourceId === row.sourceId);
  assert.equal(person.recruitmentNo, 'late-0007');
  assert.equal(person.intakeId, state.intakes.at(-1).id);
  const conflict = mergeHrSource(state, [{ ...row, recruitmentNo: 'late-0008' }], day);
  assert.equal(conflict.people.find(p => p.id === person.id).recruitmentNo, 'late-0007');
  assert.equal(conflict.sync.conflicts.length, 1);
});

test('legacy duplicate numbers freeze matching and keep original trusted association', () => {
  const state = reconcileHrState(seed(), day);
  state.people.find(p => p.id === 'hr-9').recruitmentNo = '招聘-模拟-1840';
  const before = state.people.find(p => p.id === 'hr-10');
  const next = reconcileHrState(state, day);
  assert.equal(next.intakes[0].candidateId, 'hr-10');
  assert.equal(next.intakes[0].status, '待核对');
  assert.equal(next.people.find(p => p.id === 'hr-10').gender, before.gender);
  assert.equal(next.people.find(p => p.id === 'hr-9').masterCreated, false);
});

test('load persists exact demo migration once without audit or revision churn and leaves real missing keys untouched', () => {
  const oldStore = globalThis.localStorage;
  const state = seed();
  delete state.intakes[0].values.recruitmentNo;
  delete state.intakes[1].values.recruitmentNo;
  state.intakes.push({ ...state.intakes[0], id: 'real-intake', requestId: 'real-request', values: { ...state.intakes[0].values } });
  const storage = new Map([[HR_KEY, JSON.stringify(state)]]);
  let writes = 0;
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { writes++; storage.set(key, value); } };
  try {
    const first = loadHr();
    const next = loadHr();
    assert.deepEqual(next, first);
    assert.equal(writes, 1);
    assert.equal(first.revision, state.revision + 1);
    assert.equal(first.intakes[0].values.recruitmentNo, '招聘-模拟-1840');
    assert.equal(first.intakes[1].values.recruitmentNo, '招聘-模拟-1900');
    assert.equal(first.intakes[2].values.recruitmentNo, undefined);
    assert.equal(first.intakes[2].candidateId, '');
  } finally {
    if (oldStore === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStore;
  }
});
