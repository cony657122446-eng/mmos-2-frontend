import test from 'node:test';
import assert from 'node:assert/strict';
import { createHrSeed, getHrView, reduceHrAction, trainingStage, employmentStatus, checklistStatus, tenureDays, hrAnomalies, hrReminderPlan, isHrReferenceActive, mergeHrSource, beijingToday, reconcileHrState, loadHr, HR_KEY, mergeHrBankAccounts, mergeHrExternalFacts, mergeHrOutputFacts } from './hrWorkspace.js';

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
  assert.equal(person.trainingPassedDate, beijingToday()); // actual successful assessment date
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

test('elimination supports zero to two days with one decimal and zero payable', () => {
  const state = act(seed(), 'training.update', { personId: 'hr-6', day1: '淘汰', subsidyDays: .5 }, 'PM');
  const person = state.people.find(p => p.id === 'hr-6');
  assert.equal(trainingStage(person), '第1天淘汰');
  assert.equal(person.subsidyAmount, 40);
  assert.equal(person.checklistCreated, false);
  const zero = act(seed(), 'training.update', { personId: 'hr-6', day1: '淘汰', subsidyDays: 0 }, 'PM').people.find(p => p.id === 'hr-6');
  assert.equal(zero.subsidyAmount, 0);
  assert.equal(zero.subsidyStatus, '已生成应发');
  for (const value of ['', -1, 'invalid', .33, 2.1]) assert.throws(() => act(seed(), 'training.update', { personId: 'hr-6', day1: '淘汰', subsidyDays: value }, 'PM'), /有效实际天数/);
});

test('HR corrections require reason, record before/after and retain downstream associations', () => {
  assert.throws(() => act(seed(), 'training.update', { personId: 'hr-3', result: '淘汰', subsidyDays: 1.5 }), /原因/);
  const state = act(seed(), 'training.update', { personId: 'hr-3', result: '淘汰', subsidyDays: 1.5, reason: '核对评定原件' });
  const p = state.people.find(p => p.id === 'hr-3');
  assert.equal(p.masterCreated, true);
  assert.equal(p.checklistCreated, true);
  assert.match(p.downstreamReview, /核对下游/);
  assert.equal(state.audit[0].before.trainingResult, '通过');
  assert.equal(state.audit[0].after.trainingResult, '淘汰');
  assert.equal(state.audit[0].reason, '核对评定原件');
});

test('source import exactly matches Beijing arrival day and training option, dedupes without overriding local results', () => {
  let state = seed();
  const source = { sourceId: 'new-1', name: '新候选', arrivalDate: day, appliedPosition: '标注员', day1: '培训中', projectIds: [] };
  const rows = [source, { ...source, sourceId: 'new-2', arrivalDate: '2026-11-04' }, { ...source, sourceId: 'new-3', day1: '培训中-淘汰' }, { ...source, sourceId: 'new-4', appliedPosition: '兼职' }, { ...source, sourceId: 'new-5', appliedPosition: '' }];
  state = mergeHrSource(state, rows, day);
  assert.equal(state.people.length, seed().people.length + 1);
  const newPerson = state.people.find(p => p.sourceId === 'new-1');
  assert.match(newPerson.employeeNo, /^MCE\d{8}$/);
  assert.equal(newPerson.projectIds.length, 0); // mapping failure does not block valid numbering
  newPerson.day1 = '通过';
  newPerson.locallyMaintained = true;
  state = mergeHrSource(state, [source], day);
  assert.equal(state.people.length, seed().people.length + 1);
  assert.equal(state.people.find(p => p.sourceId === 'new-1').day1, '通过');
  const tomorrow = mergeHrSource(state, [], '2026-11-06');
  assert.equal(tomorrow.people.length, seed().people.length + 1);
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
  const state = act(seed(), 'onboarding.confirmExit', { personId: 'hr-9', reason: '核对后确认退出' });
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
  const source = { sourceId: 'later-source', recruitmentNo: '0001901', name: '来源候选', arrivalDate: day, appliedPosition: '标注员', day1: '培训中', projectIds: [first.projects[0].id] };
  let state = mergeHrSource(first, [source], day);
  let person = state.people.find(p => p.sourceId === source.sourceId);
  assert.equal(state.intakes.at(-1).candidateId, person.id);
  assert.equal(person.intakeMatchStatus, '已自动关联，待培训通过');
  assert.equal(person.contactFromIntake, undefined);
  state = act(state, 'training.update', { personId: person.id, day1: '通过' }, 'PM');
  state = act(state, 'training.update', { personId: person.id, result: '通过' }, 'PM');
  person = state.people.find(p => p.id === person.id);
  assert.equal(person.intakeMatchStatus, '已自动关联，待激活整合');
  state = act(state, 'onboarding.update', { personId: person.id, intent: '确认入职', departmentId:'dept-9-5', positionId:'pos-1', locationId:'loc-1', manager:'王然' });
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
  assert.equal(next.people.length, state.people.length + 1);
  assert.equal(next.nextEmployeeNumber, state.nextEmployeeNumber + 1);
  assert.equal(next.people.find(p => p.id === 'hr-1').employeeNo, state.people.find(p => p.id === 'hr-1').employeeNo);
  assert.equal(next.people.find(p => p.sourceId === row.sourceId).intakeMatchStatus,'待核对');
  assert.equal(getHrView('人事', next, day).sync.conflicts.length, 1);
  assert.equal(getHrView('PMO', next, day).sync.conflicts, undefined);
  assert.deepEqual(mergeHrSource(next, [row], day), next);
});

test('source correction may replace its number while preserving mismatched historical association for review', () => {
  const row = { sourceId: 'missing-number-source', name: '候选', arrivalDate: day, appliedPosition: '标注员', day1: '培训中' };
  let state = mergeHrSource(seed(), [row], day);
  state = submit(state, 'late-0007', 'late-request');
  state = mergeHrSource(state, [{ ...row, recruitmentNo: ' late-0007 ' }], day);
  const person = state.people.find(p => p.sourceId === row.sourceId);
  assert.equal(person.recruitmentNo, 'late-0007');
  assert.equal(person.intakeId, state.intakes.at(-1).id);
  const conflict = mergeHrSource(state, [{ ...row, recruitmentNo: 'late-0008' }], day);
  assert.equal(conflict.people.find(p => p.id === person.id).recruitmentNo, 'late-0008');
  assert.match(conflict.people.find(p => p.id === person.id).intakeMatchIssue,/历史资料/);
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


test('assignment completeness blocks new admission and HR can fill it without erasing old master', () => {
  const state = seed();
  const person = state.people.find(p => p.id === 'hr-8');
  person.manager = ''; person.intent = '确认入职';
  let next = act(state,'onboarding.review',{personId:person.id});
  assert.equal(next.people.find(p=>p.id===person.id).masterCreated,false);
  assert.deepEqual(next.people.find(p=>p.id===person.id).assignmentMissingFields,['直属经理']);
  next = act(next,'onboarding.update',{personId:person.id,manager:'经理'});
  assert.equal(next.people.find(p=>p.id===person.id).masterCreated,true);
  next.people[0].manager='';
  assert.equal(reconcileHrState(next).people[0].masterCreated,true);
});

test('department manager scopes reads and writes to current configured manager account', () => {
  const state = seed();
  const view = getHrView('部门经理',state,day);
  assert.equal(view.candidates.length,1);
  assert.equal(view.candidates[0].id,'hr-functional-demo');
  assert.equal(view.intakes.length,0);
  const next=act(state,'training.update',{personId:'hr-functional-demo',result:'通过'},'部门经理');
  assert.equal(next.people.find(p=>p.id==='hr-functional-demo').checklistCreated,true);
  state.departments.find(d=>d.id==='dept-8').managerAccount='another-manager';
  assert.equal(getHrView('部门经理',state,day).candidates.length,0);
  assert.throws(()=>act(state,'training.update',{personId:'hr-functional-demo',result:'通过'},'部门经理'),/无权/);
});

test('calendar uses explicit holidays and adjustment workdays while early pass is effective immediately', () => {
  const state = seed(); const person=state.people.find(p=>p.id==='hr-6');
  person.arrivalDate='2026-11-06'; person.day1='通过';
  state.workCalendar.days['2026-11-07']=false;state.workCalendar.days['2026-11-08']=true;
  const view=getHrView('人事',state,day);
  assert.equal(view.candidates.find(p=>p.id===person.id).trainingDay2,'2026-11-08');
  const next=act(state,'training.update',{personId:person.id,result:'通过'},'PM');
  assert.equal(next.people.find(p=>p.id===person.id).trainingPassedDate,beijingToday());
  assert.equal(next.people.find(p=>p.id===person.id).checklistCreated,true);
});

test('72 hour boundary and late activation preserve abandonment and block rebuild', () => {
  const state=seed();const p=state.people.find(p=>p.id==='hr-9');
  p.accountCreatedAt='2026-11-06T01:00:00Z';p.materialsComplete=true;
  let next=reconcileHrState(state,'2026-11-09','2026-11-09T01:00:00Z');
  assert.equal(next.people.find(x=>x.id===p.id).abandoned,undefined);
  next=reconcileHrState(next,'2026-11-09','2026-11-09T01:00:00.001Z');
  assert.equal(next.people.find(x=>x.id===p.id).abandoned,true);
  next.people.find(x=>x.id===p.id).accountActive=true;
  next=reconcileHrState(next,'2026-11-09','2026-11-09T02:00:00Z');
  assert.equal(next.people.find(x=>x.id===p.id).masterCreated,false);
  assert.throws(()=>act(next,'onboarding.rebuild',{personId:p.id}),/停止建档/);
});

test('correction to elimination terminates checklist and ends current relations with 0.8 day payable', () => {
  const state=seed();const p=state.people.find(p=>p.id==='hr-8');
  const next=act(state,'training.update',{personId:p.id,result:'淘汰',subsidyDays:.8,reason:'核验误填'});
  const person=next.people.find(x=>x.id===p.id);
  assert.equal(person.terminated,true);assert.equal(person.subsidyAmount,64);
  assert.equal(person.projectIds.length,0);assert.ok(person.endedProjectRelations.length);
  assert.equal(person.masterCreated,false);assert.match(person.exitFollowup,/账号退出/);
});

test('last working day remains departing and all project relations end the next Beijing day', () => {
  const state=seed();const p=state.people[0];p.resignation={status:'通过',effectiveDate:day,evidence:'verified'};
  assert.equal(employmentStatus(p,day),'离职中');
  let next=reconcileHrState(state,day);assert.equal(next.people[0].projectIds.length,1);
  next=reconcileHrState(next,'2026-11-06');assert.equal(next.people[0].projectIds.length,0);
  assert.equal(tenureDays(next.people[0],'2026-11-07'),5);
  const late=mergeHrOutputFacts(next,[{id:'late-before',personId:p.id,projectId:state.projects[0].id,date:day,validated:true},{id:'late-after',personId:p.id,projectId:state.projects[0].id,date:'2026-11-06',validated:true}],{},'2026-11-07');
  assert.equal(late.outputs.find(r=>r.id==='late-before').category,'内部人员');
  assert.equal(late.outputs.find(r=>r.id==='late-after').category,'待核对');
  assert.equal(late.people[0].projectIds.length,0);
});

test('external roster uses greater than 15 day threshold and failed reads preserve the latest list', () => {
  const state=seed();state.outputs.find(o=>o.id==='out-4').date='2026-11-01';
  assert.equal(reconcileHrState(state,'2026-11-16').external[0].current,true);
  assert.equal(reconcileHrState(state,'2026-11-17').external[0].current,false);
  state.outputReadStatus='失败';
  assert.equal(reconcileHrState(state,'2026-11-17').external[0].current,true);
});

test('full details protect sensitive fields and independently authorize finance salary', () => {
  const state=seed();state.people[0].compensation.salary=98765;
  for(const role of ['PM','PMO','项目助理']) {
    const person=getHrView(role,state,day).projectPeople.find(p=>p.id==='hr-1');
    if(!person)continue;
    assert.equal(person.address,'联系地址');assert.ok(person.emergencyName);
    assert.equal(person.bankAccounts,undefined);assert.equal(person.compensation,undefined);assert.equal(person.idNumber,undefined);
  }
  const hr=getHrView('人事',state,day).people[0];assert.equal(hr.bankAccounts.length,2);assert.equal(hr.compensation.salary,98765);
  const finance=getHrView('财务',state,day).people.find(p=>p.id==='hr-1');
  if(finance)assert.equal(finance.compensation.salary,undefined);
});

test('bank merge combines full same card while preserving versions and conflicting source values', () => {
  const rows=[{id:'a',bank:'招商银行',cardNumber:'1234567890123456',branch:'A',source:'old',attachments:[{name:'a.pdf',version:1}]},{id:'b',bank:'招商银行',cardNumber:'1234567890123456',branch:'B',source:'new',attachments:[{name:'a.pdf',version:2}]},{id:'c',bank:'招商银行',cardNumber:'1234567890123457',branch:'A',source:'new',attachments:[]}];
  const accounts=mergeHrBankAccounts(rows);assert.equal(accounts.length,2);assert.equal(accounts[0].attachments.length,2);assert.match(accounts[0].issue,/差异/);
  assert.deepEqual(mergeHrBankAccounts([...rows,rows[1]]),accounts);
});

test('supplement preserves MMOS training, refreshes known cross-day sources, allocates after all old MCEs', () => {
  const state=seed();state.people[0].employeeNo='MCE00009000';
  const row={sourceId:'old-source',name:'补采',arrivalDate:'2026-10-01',day1:'通过',trainingResult:'通过',appliedPosition:'职能专员',departmentId:'dept-8',functional:true};
  let next=mergeHrSource(state,[row],day,{supplement:true});let p=next.people.find(p=>p.sourceId===row.sourceId);
  assert.equal(p.employeeNo,'MCE00009001');assert.equal(p.day1,'培训中');assert.equal(p.trainingResult,'');
  p.day1='通过';p.trainingResult='淘汰';p.subsidyAmount=144;
  next=mergeHrSource(next,[{...row,name:'来源更正名称'}],'2026-11-09');p=next.people.find(p=>p.sourceId===row.sourceId);
  assert.equal(p.name,'来源更正名称');assert.equal(p.trainingResult,'淘汰');assert.equal(p.subsidyAmount,144);
  assert.throws(()=>act(state,'source.supplement',{}),/姓名或/);
  const imported=act(state,'source.supplement',{name:'董欣然'});
  assert.equal(imported.sync.lastResults.length,1);
});

test('HR intake correction keeps recruitment key and history, master data correction requires approval', () => {
  let state=submit(seed(),'correction-001','correction-request');const intake=state.intakes.at(-1);
  state=act(state,'intake.correct',{id:intake.id,reason:'材料核对',values:{address:'新地址',recruitmentNo:'illegal-change'}});
  assert.equal(state.intakes.at(-1).values.address,'新地址');assert.equal(state.intakes.at(-1).values.recruitmentNo,'correction-001');assert.equal(state.intakes.at(-1).versions.length,1);
  assert.throws(()=>act(state,'intake.correct',{id:'intake-demo-1',reason:'更正',values:{address:'x'}}),/审批/);
});

test('historical backfill keeps verified old MCE and real dates idempotently', () => {
  const data={employeeNo:'MCE00009991',name:'历史员工',enterpriseAccount:'history@example.test',entryDate:'2024-01-01',sourceEvidence:'已核验历史依据'};
  const state=act(seed(),'history.backfill',data);const p=state.people.find(p=>p.employeeNo===data.employeeNo);
  assert.equal(p.masterCreated,true);assert.equal(p.trustedEmploymentStatus,'在职');assert.ok(p.assignmentMissingFields.length);
  assert.equal(act(state,'history.backfill',data).people.length,state.people.length);
  assert.throws(()=>act(state,'history.backfill',{...data,name:'其他身份'}),/身份冲突/);
});


test('salary grants are independent for HR and cannot leak through history or contract payloads', () => {
  const state = seed();
  const person = state.people[0];
  person.compensation.salaryAuthorized = true;
  person.changes.push({ id:'sensitive-change', type:'调薪', date:day, status:'已完成', source:'source', salary:99000, reason:'薪资99000', details:{ salary:99000 }, attachments:[{data:'sensitive'}] });
  person.contracts[0].salary = 99000;
  person.contracts[0].attachments = [{data:'sensitive'}];
  state.fieldPermissions.hrSalary = false;
  let projected = getHrView('人事',state,day).people.find(p=>p.id===person.id);
  assert.equal(projected.compensation.salary,undefined);
  assert.equal(projected.compensation.salaryAuthorized,false);
  assert.equal(projected.changes.at(-1).salary,undefined);
  assert.equal(projected.changes.at(-1).reason,undefined);
  assert.equal(projected.changes.at(-1).details,undefined);
  assert.equal(projected.changes.at(-1).attachments,undefined);
  assert.equal(projected.contracts[0].salary,undefined);
  assert.equal(projected.contracts[0].attachments,undefined);
  state.fieldPermissions.hrSalary = true;
  projected = getHrView('人事',state,day).people.find(p=>p.id===person.id);
  assert.equal(projected.compensation.salaryAuthorized,true);
  assert.equal(projected.changes.at(-1).salary,99000);
  assert.equal(projected.contracts[0].salary,99000);
});

test('external facts require current checklist contract mapping and retain latest trusted completion', () => {
  const state = reconcileHrState(seed(),day);
  const person = state.people.find(p=>p.id==='hr-3');
  const source = {personId:person.id,sourceRecordId:'verified-task-source',employeeNo:person.employeeNo,enterpriseAccount:person.enterpriseAccount,contractTask:{id:'task',personId:person.id,checklistId:'old-onboarding',valid:true,status:'已完成'}};
  let next = mergeHrExternalFacts(state,[source],day);
  assert.equal(next.people.find(p=>p.id===person.id).contractSigned,false);
  assert.match(next.people.find(p=>p.id===person.id).contractReview,/本次办理/);
  source.contractTask.checklistId = person.checklistId;
  next = mergeHrExternalFacts(next,[source],day);
  assert.equal(next.people.find(p=>p.id===person.id).contractSigned,true);
  assert.ok(next.revision > state.revision);
  const repeated = mergeHrExternalFacts(next,[source],day);
  assert.equal(repeated.revision,next.revision);
  source.contractTask.status = '部分签署';
  const late = mergeHrExternalFacts(next,[source],day);
  assert.equal(late.people.find(p=>p.id===person.id).contractSigned,true);
});

test('incomplete output reads preserve project relations across later projections', () => {
  const state = seed();
  state.outputs.find(o=>o.id==='out-4').date='2026-11-01';
  const incomplete = mergeHrOutputFacts(state,[],{complete:false},'2026-11-17');
  assert.equal(incomplete.outputReadStatus,'读取未完成');
  assert.equal(reconcileHrState(incomplete,'2026-11-18').external[0].current,true);
  const complete = mergeHrOutputFacts(incomplete,[],{complete:true},'2026-11-18');
  assert.equal(complete.external[0].current,false);
});

test('project closure retains history and hands unfinished training to HR without restoring current relations', () => {
  const state = seed();
  const person = state.people.find(p=>p.id==='hr-6');
  const project = state.projects.find(p=>p.id===person.projectIds[0]);
  project.ended=true;
  const next = reconcileHrState(state,day);
  const ended = next.people.find(p=>p.id===person.id);
  assert.equal(ended.projectIds.length,0);
  assert.match(ended.handoffReason,/人事接续/);
  assert.equal(getHrView('PM',next,day).projectPeople.some(p=>p.id===person.id),false);
  assert.equal(getHrView('人事',next,day).candidates.some(p=>p.id===person.id),true);
  const delayed = mergeHrOutputFacts(next,[{id:'late-ended',personId:person.id,projectId:project.id,date:day,validated:true}],{},day);
  assert.equal(delayed.people.find(p=>p.id===person.id).projectIds.length,0);
  assert.ok(delayed.outputs.some(r=>r.id==='late-ended'));
});


test('late external output keeps latest project and ambiguous same-day rows await review', () => {
  const state = seed();
  const person = state.external[0];
  const originalProject = person.projectIds[0];
  const secondProject = state.projects[1].id;
  const rows = [
    { id:'historical-other-project', personId:person.id, projectId:secondProject, date:'2026-11-01', validated:true },
    { id:'conflicting-current-project', personId:person.id, projectId:secondProject, date:'2026-11-04', validated:true },
    { id:'unmapped-person', personId:'unmapped', projectId:originalProject, date:day, validated:true },
  ];
  const next = mergeHrOutputFacts(state,rows,{},day);
  assert.deepEqual(next.external[0].projectIds,[originalProject]);
  assert.equal(next.outputs.find(row=>row.id==='conflicting-current-project').category,'待核对');
  assert.equal(next.outputs.find(row=>row.id==='unmapped-person').category,'待核对');
  assert.equal(next.outputs.find(row=>row.id==='historical-other-project').category,'外部人员');
});


test('finance intake projection includes business bank data without identity or version payloads', () => {
  const state = seed();
  state.intakes[0].versions = [{values:{idNumber:'PRIVATE-OLD-ID'}}];
  const view = getHrView('财务',state,day);
  assert.ok(view.intakes.length > 0);
  for (const intake of view.intakes) {
    assert.equal(intake.values.idNumber,undefined);
    assert.equal(intake.values.identityAttachment,undefined);
    assert.equal(intake.versions,undefined);
    assert.ok(intake.values.bank);
  }
});


test('historical backfill never reassigns an occupied candidate MCE to another identity', () => {
  const state = seed();
  const person = state.people.find(p=>p.id==='hr-6');
  const payload = {employeeNo:person.employeeNo,name:'另一个人',enterpriseAccount:'different@example.test',entryDate:'2024-01-01',sourceEvidence:'核验依据'};
  const snapshot = JSON.stringify(state);
  assert.throws(()=>act(state,'history.backfill',payload),/身份冲突/);
  assert.equal(JSON.stringify(state),snapshot);
  // A matching display name alone cannot establish identity when the original
  // candidate has no enterprise account yet. Require its stable source record.
  assert.throws(()=>act(state,'history.backfill',{...payload,name:person.name}),/稳定来源核验/);
  assert.throws(()=>act(state,'history.backfill',{...payload,name:person.name,sourceId:'another-source'}),/身份冲突/);
  const verified = {...payload,name:person.name,sourceId:person.sourceId};
  const next = act(state,'history.backfill',verified);
  const archived = next.people.find(p=>p.id===person.id);
  assert.equal(archived.employeeNo,person.employeeNo);
  assert.equal(archived.sourceId,person.sourceId);
  assert.equal(archived.masterCreated,true);
  assert.equal(next.people.length,state.people.length);
  assert.equal(act(next,'history.backfill',verified).people.length,state.people.length);
  assert.throws(()=>act(next,'history.backfill',{...verified,enterpriseAccount:'wrong@example.test'}),/身份冲突/);
});

test('historical backfill verifies existing unarchived enterprise account before reuse', () => {
  const state = seed();
  const person = state.people.find(p=>p.id==='hr-8');
  const payload = {employeeNo:person.employeeNo,name:person.name,enterpriseAccount:'wrong@example.test',sourceId:person.sourceId,entryDate:'2024-01-01',sourceEvidence:'历史依据'};
  assert.throws(()=>act(state,'history.backfill',payload),/身份冲突/);
  const next = act(state,'history.backfill',{...payload,enterpriseAccount:person.enterpriseAccount});
  assert.equal(next.people.find(p=>p.id===person.id).masterCreated,true);
  assert.equal(next.people.length,state.people.length);
});

test('legacy sample labels change only for identified people and forms; edited names and workflow values survive', () => {
  const state = seed(), p = id => state.people.find(r => r.id === id);
  p('hr-6').name = '待评定'; p('hr-9').name = '待激活';
  p('hr-10').name = '待关联资料'; p('hr-11').name = '用户已更名';
  state.intakes[0].values.name = '待关联资料';
  state.external[0].name = '兼职方晴';
  state.people.push({ ...p('hr-6'), id: 'other-source', sourceId: 'other-source', employeeNo: 'MCE99999111', recruitmentNo: 'ZP99111' });
  const next = reconcileHrState(state, day);
  assert.equal(next.people.find(r => r.employeeNo === 'MCE00001836').name, '宋雨桐');
  assert.equal(next.people.find(r => r.employeeNo === 'MCE00001839').name, '邓思妍');
  assert.equal(next.people.find(r => r.id === 'hr-9').accountActive, false);
  assert.equal(next.people.find(r => r.id === 'hr-11').name, '用户已更名');
  assert.equal(next.people.find(r => r.id === 'hr-12').trainingResult, '培训储备');
  assert.equal(next.people.find(r => r.id === 'other-source').name, '待评定');
  assert.equal(next.external[0].name, '方晴');
  assert.equal(next.intakes[0].values.name, next.people.find(r => r.id === 'hr-10').name);
  assert.deepEqual(reconcileHrState(next, day), next);
});
