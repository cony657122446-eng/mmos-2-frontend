import test from 'node:test';
import assert from 'node:assert/strict';
import { createHrSeed, reconcileHrState, getHrContractsView, getHrAttendanceView, getHrCareerView } from './hrWorkspace.js';
import { contractExecution, applyPersonnelContractAction, contractLaunchReadiness, safeContractFile, ensurePersonnelContracts } from './hrPersonnelContracts.js';
import { attendanceDays, validateAttendanceSource, applyHrAttendanceAction, ensureHrAttendance } from './hrAttendance.js';
import { assignmentSnapshot, applyHrCareerAction, reconcileCareerApprovals } from './hrCareer.js';
import { filterOnboardingRows } from './hrOnboardingFilters.js';
import { INTAKE_FIELDS, banks, validateIntake } from './hrIntake.js';
import { createContractZip } from './contractZip.js';

const day = '2026-11-10', month = '2026-10';
const seed = () => reconcileHrState(createHrSeed(day), day);
const record = (extra = {}) => ({ id: 'old', personId: 'hr-1', employeeNo: 'MCE00001831', type: '劳动合同', signed: true, signedAt: '2026-10-01T09:00:00+08:00', evidence: '原件第1页', termType: '固定期限', startDate: '2026-10-01', endDate: '2026-11-30', ...extra });
const execution = (row, on, others = [], person = {}) => contractExecution(row, [row, ...others], person, on);
const contractAction = (state, type, payload, role = '人事') => applyPersonnelContractAction(state, role, type, payload, day);

test('fixed contracts include both boundary dates and expire the next Beijing day', () => {
  const row = record();
  assert.equal(execution(row, '2026-10-01').state, '正在执行');
  assert.equal(execution(row, '2026-11-30').state, '正在执行');
  assert.equal(execution(row, '2026-12-01').state, '结束执行');
  assert.equal(execution(row, '2026-12-01').endedOn, '2026-11-30');
  assert.equal(execution(record({ signedAt: '2026-09-30T16:30:00Z' }), '2026-10-01').state, '正在执行');
});

test('blank end dates are never inferred to be open ended; explicit source evidence is required', () => {
  assert.equal(execution(record({ endDate: '' }), day).state, '执行待核对');
  assert.equal(execution(record({ termType: '无固定期限', endDate: '' }), day).state, '执行待核对');
  assert.equal(execution(record({ termType: '无固定期限', endDate: '', openEndedEvidence: '第3条明确无固定期限' }), day).state, '正在执行');
});

test('termination applies on its effective date and independent agreements may run concurrently', () => {
  const row = record({ termination: { date: '2026-11-20', evidence: '确认终止材料' } });
  assert.equal(execution(row, '2026-11-19').state, '正在执行');
  assert.equal(execution(row, '2026-11-20').endedOn, '2026-11-19');
  const state = seed();
  const contracts = getHrContractsView('人事', 'hr-1', state, day).rows;
  assert.ok(contracts.filter(row => row.execution.state === '正在执行').length >= 3);
});

test('renewal waits for completion and start; late signing traces replacement to agreed start', () => {
  const old = record({ endDate: '2027-01-01' });
  const next = record({ id: 'new', replacesId: old.id, startDate: '2026-11-20', endDate: '2027-11-19', signedAt: '2026-11-23T12:00:00+08:00' });
  assert.equal(execution(old, '2026-11-21', [next]).state, '正在执行');
  assert.equal(execution(old, '2026-11-23', [next]).endedOn, '2026-11-19');
  assert.equal(execution(old, '2026-11-23', [{ ...next, deleted: true }]).endReason, '续签替代');
  assert.equal(next.signedAt, '2026-11-23T12:00:00+08:00');
  const early = { ...next, signedAt: '2026-11-01T12:00:00+08:00' };
  assert.equal(execution(old, '2026-11-19', [early]).state, '正在执行');
});

test('departure ends only a primary contract associated with that onboarding', () => {
  const person = { checklistId: 'intake-current', resignation: { status: '通过', effectiveDate: '2026-11-19', evidence: '离职审批' } };
  assert.equal(execution(record({ checklistId: 'intake-current' }), '2026-11-19', [], person).state, '正在执行');
  assert.equal(execution(record({ checklistId: 'intake-current' }), '2026-11-20', [], person).endReason, '离职生效');
  assert.equal(execution(record({ checklistId: 'older' }), '2026-11-20', [], person).state, '正在执行');
  assert.equal(execution(record({ type: '保密协议' }), '2026-11-20', [], person).state, '正在执行');
  assert.equal(execution(record(), '2026-11-20', [], person).state, '执行待核对');
});

test('recoverable deletion preserves termination and renewal relationships, with revision conflicts rejected', () => {
  const state = seed(), id = 'personnel-contract-active';
  contractAction(state, 'contract.terminate', { id, date: day, reason: '终止确认', expectedVersion: 1 });
  contractAction(state, 'contract.delete', { id, reason: '重复台账可见性整理', expectedVersion: 2 });
  assert.ok(getHrContractsView('人事', 'hr-1', state, day).rows.find(row => row.id === id).deleted);
  assert.equal(getHrContractsView('财务', 'hr-1', state, day).rows.some(row => row.id === id), false);
  assert.throws(() => contractAction(state, 'contract.restore', { id, reason: '恢复', expectedVersion: 2 }), /已更新/);
  contractAction(state, 'contract.restore', { id, reason: '恢复核对', expectedVersion: 3 });
  const row = getHrContractsView('人事', 'hr-1', state, day).rows.find(row => row.id === id);
  assert.equal(row.execution.state, '结束执行');
  assert.equal(row.history.length, 3);
  const count = state.personnelContracts.length;
  ensurePersonnelContracts(state, day);
  assert.equal(state.personnelContracts.length, count);
});

test('historical corrections preserve attachments and original values; invalid PDF never replaces existing files', () => {
  const state = seed(), id = 'personnel-contract-active';
  const file = { name: '原件.pdf', data: 'data:application/pdf;base64,JVBERi0xLjQK' };
  contractAction(state, 'contract.correct', { id, number: '核实编号', file, reason: '据原件编号纠错', expectedVersion: 1 });
  const row = state.personnelContracts.find(row => row.id === id);
  assert.equal(row.files.length, 2);
  assert.equal(row.files.at(-1).version, 2);
  assert.equal(row.history.at(-1).before.number, 'HT-2026-001');
  assert.equal(safeContractFile({ name: '伪装.pdf', data: 'data:text/html;base64,abcd' }), null);
  assert.throws(() => contractAction(state, 'contract.correct', { id, file: { name: 'x.pdf', data: 'bad' }, reason: '依据', expectedVersion: 2 }), /PDF/);
  assert.equal(state.personnelContracts.find(row => row.id === id).files.length, 2);
  assert.equal(state.audit[0].after.files.at(-1).data, undefined);
});

test('contracts enforce actor, person scope, salary and original grants independently', () => {
  const state = seed();
  assert.throws(() => contractAction(state, 'contract.delete', { id: 'personnel-contract-active', reason: '材料', expectedVersion: 1 }, '财务'), /仅人事/);
  const pm = getHrContractsView('PM', undefined, state, day);
  assert.ok(pm.rows.every(row => !row.canPreview && !row.canManage && !row.files));
  assert.equal(getHrContractsView('PM', 'hr-2', state, day).rows.length, 0);
  let finance = getHrContractsView('财务', 'hr-1', state, day).rows.find(row => row.id === 'personnel-contract-active');
  assert.equal(finance.canPreview, false);
  Object.assign(state.fieldPermissions, { financeContractOriginals: true, financeContractIdentity: true, financeSalary: true });
  finance = getHrContractsView('财务', 'hr-1', state, day).rows.find(row => row.id === 'personnel-contract-active');
  assert.equal(finance.canPreview, true);
  assert.equal(finance.canExport, false);
  assert.equal(finance.evidence, undefined);
  assert.equal(getHrContractsView('unknown', undefined, state, day).rows.length, 0);
});

test('export captures selected versions and missing reasons and rejects stale or deleted records', () => {
  const state = seed(), selected = state.personnelContracts.find(row => row.id === 'personnel-contract-active');
  contractAction(state, 'contract.export', { selection: [{ id: selected.id, version: selected.version }], missing: [{ id: selected.id, reason: '读取失败' }], successCount: 0 });
  assert.equal(state.contractExports[0].selection[0].fileVersion, 1);
  assert.equal(state.contractExports[0].missing[0].reason, '读取失败');
  assert.throws(() => contractAction(state, 'contract.export', { selection: [{ id: selected.id, version: 99 }] }), /版本已变化/);
  assert.throws(() => contractAction(state, 'contract.export', { selection: [{ id: selected.id, version: 1 }] }, 'PM'), /仅人事/);
});

test('later termination registration cannot erase an earlier effective fact', () => {
  const state = seed(), id = 'personnel-contract-active';
  contractAction(state, 'contract.terminate', { id, date: '2026-11-01', reason: '原终止材料', expectedVersion: 1 });
  contractAction(state, 'contract.terminate', { id, date: '2026-11-20', reason: '后到终止材料', expectedVersion: 2 });
  const row = getHrContractsView('人事', 'hr-1', state, day).rows.find(row => row.id === id);
  assert.equal(row.execution.state, '结束执行');
  assert.equal(row.execution.endedOn, '2026-10-31');
  assert.equal(row.terminations.length, 2);
});

test('effective departure persists on its original contract after a later onboarding and applies only once', () => {
  const state = seed(), person = state.people[0];
  person.resignation = { status: '通过', effectiveDate: '2026-11-09', evidence: '关联离职审批' };
  ensurePersonnelContracts(state, day);
  const row = state.personnelContracts.find(row => row.id === 'personnel-contract-active');
  assert.equal(row.terminations.length, 1);
  const version = row.version;
  ensurePersonnelContracts(state, day);
  assert.equal(row.version, version);
  person.checklistId = 'new-onboarding';
  delete person.resignation;
  assert.equal(contractExecution(row, state.personnelContracts, person, day).endReason, '离职生效');
  assert.equal(state.personnelContracts.find(row => row.id === 'personnel-contract-nda').terminations, undefined);
});

test('launch readiness requires actual activation, materials, current valid handling and verified configuration', () => {
  const person = { checklistCreated: true, accountActive: false, materialsComplete: true };
  assert.ok(contractLaunchReadiness(person).reasons.some(value => value.includes('实际激活')));
  assert.equal(contractLaunchReadiness({ ...person, accountActive: true }, { verified: true }).state, '待服务端发起');
  assert.equal(contractLaunchReadiness({ ...person, contractTaskId: 'existing' }).state, '已有签署任务');
  assert.ok(contractLaunchReadiness({ ...person, accountActive: true, terminated: true }, { verified: true }).reasons.some(value => value.includes('终止')));
});

test('monthly attendance divides total hours once and distinguishes real zero, unread and invalid values', () => {
  assert.equal(attendanceDays(9), '1.125'); assert.equal(attendanceDays(80), '10.000');
  assert.equal(attendanceDays(0), '0.000'); assert.equal(attendanceDays(null), '未读取');
  const state = seed();
  const result = getHrAttendanceView('人事', month, undefined, state, day);
  assert.equal(result.rows.find(row => row.personId === 'hr-1').days, '1.125');
  assert.equal(result.rows.find(row => row.personId === 'hr-2').days, '10.000');
  assert.equal(getHrAttendanceView('人事', '2026-11', 'hr-1', state, day).rows[0].status, '未读取');
});

test('daily duration normalizes units and deduplicates; conflicting dates and identities remain issues', () => {
  const state = seed(), person = state.people[0];
  const source = { id: 'a', personId: person.id, employeeNo: person.employeeNo, date: '2026-10-01', duration: 540, unit: 'minutes' };
  let result = validateAttendanceSource([source, source], state.people, month);
  assert.equal(result.records.length, 1); assert.equal(result.records[0].hours, 9);
  result = validateAttendanceSource([source, { ...source, id: 'b', duration: 600 }, { ...source, id: 'c', employeeNo: 'wrong' }, { ...source, id: 'd', date: '2026-10-32' }], state.people, month);
  assert.equal(result.records.length, 0); assert.equal(result.issues.length, 3);
});

test('historical re-read changes current version, keeps the original snapshot and never double counts', () => {
  const state = seed(), original = structuredClone(state.hrAttendance.originals[month]);
  applyHrAttendanceAction(state, '人事', 'attendance.read', { month, expectedMonthVersion: 1 }, day);
  assert.equal(state.hrAttendance.months[month].version, 2);
  assert.equal(getHrAttendanceView('人事', month, 'hr-1', state, day).rows[0].days, '1.250');
  assert.deepEqual(state.hrAttendance.originals[month], original);
  applyHrAttendanceAction(state, '人事', 'attendance.read', { month, expectedMonthVersion: 2 }, day);
  assert.equal(state.hrAttendance.months[month].changes.length, 0);
  assert.equal(getHrAttendanceView('人事', month, 'hr-1', state, day).rows[0].hours, 10);
});

test('failed, missing and invalid reads preserve successful hours and record reasons', () => {
  const state = seed(), original = structuredClone(state.hrAttendance.months[month]);
  state.hrAttendance.sources[month].error = '来源超时';
  applyHrAttendanceAction(state, '人事', 'attendance.read', { month }, day);
  assert.deepEqual(state.hrAttendance.months[month].records, original.records);
  assert.equal(state.hrAttendance.months[month].lastError, '来源超时');
  delete state.hrAttendance.sources[month].error;
  const row = state.hrAttendance.sources[month].rows.find(row => row.personId === 'hr-1' && row.duration === 2);
  row.duration = -1;
  applyHrAttendanceAction(state, '人事', 'attendance.read', { month }, day);
  const read = state.hrAttendance.months[month];
  assert.ok(read.issues.length); assert.equal(read.complete, false);
  assert.equal(read.records.find(item => item.personId === row.personId && item.date === row.date).hours, 1);
});

test('attendance HR permissions, future months, stale versions and old source batches are enforced', () => {
  const state = seed();
  assert.throws(() => applyHrAttendanceAction(state, 'PM', 'attendance.read', { month }, day), /仅人事/);
  assert.throws(() => applyHrAttendanceAction(state, '人事', 'attendance.read', { month: '2026-12' }, day), /不晚于/);
  assert.throws(() => applyHrAttendanceAction(state, '人事', 'attendance.read', { month, expectedMonthVersion: 0 }, day), /版本已变化/);
  state.hrAttendance.sources[month].version = 0;
  assert.throws(() => applyHrAttendanceAction(state, '人事', 'attendance.read', { month }, day), /来源版本早于/);
  const pm = getHrAttendanceView('PM', month, undefined, state, day);
  assert.equal(pm.rows.some(row => row.personId === 'hr-2'), false);
  assert.equal(getHrAttendanceView('unknown', month, undefined, state, day).rows.length, 0);
});

test('attendance supports a non-project staff member by stable personnel identity', () => {
  const state = seed(), person = { ...state.people[0], id: 'functional-staff', employeeNo: 'MCE99990001', sourceId: 'real-functional', functional: true, projectIds: [], endedProjectRelations: [], contracts: [] };
  state.people.push(person);
  state.hrAttendance.sources[month].rows.push({ id: 'functional-attendance', personId: person.id, employeeNo: person.employeeNo, date: '2026-10-02', duration: 0, unit: 'hours' });
  applyHrAttendanceAction(state, '人事', 'attendance.read', { month }, day);
  const hr = getHrAttendanceView('人事', month, person.id, state, day);
  assert.equal(hr.rows[0].days, '0.000');
  assert.equal(getHrAttendanceView('PMO', month, person.id, state, day).rows.length, 0);
});

test('month-start fixtures never insert future days and do not invent a confirmed 3rd-day execution time', () => {
  const state = createHrSeed('2026-11-01');
  ensureHrAttendance(state, '2026-11-01');
  assert.ok(state.hrAttendance.sources['2026-11'].rows.every(row => row.date <= '2026-11-01'));
  assert.equal(state.hrAttendance.months[month], undefined);
  assert.equal(seed().hrAttendance.originals[month].readAt, '2026-11-03');
});

test('verified career approval closes prior period the day before and persists four immutable snapshots', () => {
  const state = seed(), person = state.people[0], before = assignmentSnapshot(person, state);
  const after = { ...structuredClone(before), position: { id: 'pos-new', name: '交付审核员' } };
  state.careerApprovals.push({ id: 'approval', sourceRecordId: 'source-new', approvalId: 'approval-no', personId: person.id, employeeNo: person.employeeNo, status: '已通过', validated: true, effectiveDate: day, before, after });
  reconcileCareerApprovals(state, day);
  const old = state.careerHistory.find(row => row.id === 'career-history-snapshot-002');
  assert.equal(old.endDate, '2026-11-09');
  const next = state.careerHistory.find(row => row.sourceRecordId === 'source-new');
  assert.equal(next.startDate, day); assert.deepEqual(next.before, before); assert.deepEqual(next.after, after);
  const count = state.careerHistory.length; reconcileCareerApprovals(state, day);
  assert.equal(state.careerHistory.length, count);
  state.departments.find(row => row.id === before.department.id).name = '改名部门';
  assert.equal(getHrCareerView('人事', person.id, state, day).rows.find(row => row.id === next.id).before.department.name, before.department.name);
});

test('future and conflicting career approvals preserve the current assignment', () => {
  const state = seed(), person = state.people[0], before = assignmentSnapshot(person, state);
  const approval = { sourceRecordId: 'future', approvalId: 'future-no', personId: person.id, employeeNo: person.employeeNo, status: '已通过', validated: true, effectiveDate: '2026-11-20', before, after: structuredClone(before) };
  approval.after.position = { id: 'future-pos', name: '未来岗位' };
  state.careerApprovals.push(approval); reconcileCareerApprovals(state, day);
  assert.equal(person.positionId, before.position.id);
  approval.effectiveDate = day; approval.before.position.name = '错误前值';
  reconcileCareerApprovals(state, day);
  assert.match(approval.issue, /冲突/); assert.equal(person.positionId, before.position.id);
});

test('historical career backfill keeps overlapping periods pending and enforces evidence, permissions and versions', () => {
  const state = seed(), person = state.people[0];
  const input = { personId: person.id, startDate: '2026-10-01', endDate: '2026-10-10', assignment: assignmentSnapshot(person, state), evidence: '历史任命材料', sourceRecordId: 'backfill-1' };
  applyHrCareerAction(state, '人事', 'career.add', input, day);
  const row = state.careerHistory.at(-1);
  assert.equal(row.status, '待核对'); assert.match(row.issue, /重叠/);
  assert.throws(() => applyHrCareerAction(state, 'PM', 'career.add', input, day), /仅人事/);
  assert.throws(() => applyHrCareerAction(state, '人事', 'career.add', { ...input, sourceRecordId: '', evidence: '' }, day), /材料依据/);
  assert.throws(() => applyHrCareerAction(state, '人事', 'career.add', input, day), /已关联/);
  assert.throws(() => applyHrCareerAction(state, '人事', 'career.correct', { ...input, id: row.id, expectedVersion: 0 }, day), /记录变更/);
  assert.throws(() => applyHrCareerAction(state, '人事', 'career.add', { ...input, sourceRecordId: '', endDate: day }, day), /早于今天/);
  assert.equal(person.positionId, input.assignment.position.id);
});

test('four independent onboarding filters combine with AND and preserve unknown facts', () => {
  const rows = [
    { id: 'a', name: '甲', projectIds: ['p1'], contractSigned: false, materialsComplete: false, checklistStatus: '办理中' },
    { id: 'b', name: '乙', projectIds: ['p1'], contractSigned: true, materialsComplete: false, checklistStatus: '已完成' },
    { id: 'c', name: '丙', projectIds: ['p2'], contractSigned: false, materialsComplete: true, checklistStatus: '待签合同' },
    { id: 'd', name: '丁', projectIds: ['p1'], contractSigned: null, materialsComplete: null, checklistStatus: '办理中' },
  ];
  assert.deepEqual(filterOnboardingRows(rows, { project: 'p1', signature: 'unsigned', materials: 'incomplete' }).map(row => row.id), ['a']);
  assert.deepEqual(filterOnboardingRows(rows, { signature: 'signed' }).map(row => row.id), ['b']);
  assert.deepEqual(filterOnboardingRows(rows, { signature: 'unknown', materials: 'unknown' }).map(row => row.id), ['d']);
  assert.deepEqual(filterOnboardingRows(rows, { checklist: '已完成', materials: 'incomplete' }).map(row => row.id), ['b']);
  assert.equal(filterOnboardingRows(rows).length, 4);
});

test('every intake field has rule-based help; optional fields and confirmed bank options are preserved', () => {
  assert.ok(INTAKE_FIELDS.every(field => typeof field.help === 'string' && field.help.trim().length > 0));
  assert.deepEqual(banks, ['招商银行', '浙商银行', '其他银行']);
  const values = { ...createHrSeed(day).intakes[0].values };
  for (const key of ['politics', 'ethnicity', 'nativePlace']) delete values[key];
  assert.deepEqual(validateIntake(values), []);
  values.bank1_card = ''; values.bank1_attachment = undefined;
  assert.deepEqual(validateIntake(values), []);
});

test('stored ZIP contains untouched binary PDFs, UTF8 filenames and a valid central directory', async () => {
  const binary = new Uint8Array([37, 80, 68, 70, 45, 255, 0, 128]);
  const zip = new Uint8Array(await createContractZip([{ name: '合同原件.pdf', bytes: binary }, { name: '缺件清单.csv', bytes: '\ufeff编号,原因\r\n001,缺失' }]).arrayBuffer());
  const view = new DataView(zip.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  const nameLength = view.getUint16(26, true);
  assert.equal(new TextDecoder().decode(zip.slice(30, 30 + nameLength)), '合同原件.pdf');
  assert.deepEqual(zip.slice(30 + nameLength, 30 + nameLength + binary.length), binary);
  const end = zip.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 2);
  assert.equal(view.getUint32(view.getUint32(end + 16, true), true), 0x02014b50);
});
