import { dateValid, nextDay } from './hrPersonnelContracts.js';

const copy = value => JSON.parse(JSON.stringify(value));
const text = value => String(value ?? '').trim();
const check = (condition, message) => { if (!condition) throw new Error(message); };
const uid = () => `career-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
export const ASSIGNMENT_KEYS = ['department', 'position', 'location', 'manager'];
export const ASSIGNMENT_LABELS = { department: '所属部门', position: '岗位', location: '工作地点', manager: '直属经理' };
const fieldsComplete = value => ASSIGNMENT_KEYS.every(key => text(value?.[key]?.name) && text(value?.[key]?.id));

export function assignmentSnapshot(person, state) {
  return {
    department: { id: person.departmentId || '', name: state.departments.find(row => row.id === person.departmentId)?.name || '' },
    position: { id: person.positionId || '', name: state.positions.find(row => row.id === person.positionId)?.name || '' },
    location: { id: person.locationId || '', name: state.locations.find(row => row.id === person.locationId)?.name || '' },
    manager: { id: person.managerId || '', name: person.manager || '' },
  };
}

export function ensureHrCareer(state, day) {
  state.careerHistory ||= [];
  state.careerApprovals ||= [];
  if (state.careerPreviewVersion >= 1) return;
  const person = state.people.find(person => person.id === 'hr-1' && person.employeeNo === 'MCE00001831' && person.sourceId === 'demo-source-hr-1');
  if (person && !state.careerHistory.some(row => row.id === 'career-history-snapshot-001')) {
    // This stable manager identifier belongs to the built-in source fixture.
    if (!person.managerId && person.manager === '王然') person.managerId = 'pm-wang-ran';
    const before = {
      department: { id: 'dept-9-4', name: '视听多模态交付线' },
      position: { id: 'position-archive-01', name: '内容审核员' },
      location: { id: 'location-archive-01', name: '渝-南岸千方产业园' },
      manager: { id: 'pm-lin-xiaotong', name: '林晓彤' },
    };
    const after = assignmentSnapshot(person, state);
    const effectiveDate = nextDay(day, -1);
    state.careerHistory.push(
      { id: 'career-history-snapshot-001', personId: person.id, employeeNo: person.employeeNo, startDate: nextDay(day, -60), endDate: nextDay(effectiveDate, -1), assignment: before, status: '已记录', source: '历史任职材料快照', evidence: '历史岗位任职资料', version: 1, history: [] },
      { id: 'career-history-snapshot-002', personId: person.id, employeeNo: person.employeeNo, startDate: effectiveDate, endDate: '', effectiveDate, assignment: after, before, after, status: '已记录', source: '岗位变动快照', sourceRecordId: '岗位变动快照-001', approvalId: '', evidence: '岗位变动前后资料快照', version: 1, history: [] },
    );
  }
  state.careerPreviewVersion = 1;
}

// Only a verified connector can provide effective approval facts. This is not a
// user-facing manual current-assignment action.
export function reconcileCareerApprovals(state, day) {
  for (const approval of state.careerApprovals || []) {
    if (approval.applied || approval.validated !== true || approval.status !== '已通过' || !dateValid(approval.effectiveDate) || approval.effectiveDate > day) continue;
    const person = state.people.find(person => person.id === approval.personId && person.employeeNo === approval.employeeNo && person.masterCreated);
    if (!person || !approval.sourceRecordId || !approval.approvalId || !fieldsComplete(approval.before) || !fieldsComplete(approval.after)) { approval.issue = '审批身份、四项快照或原审批关联不完整'; continue; }
    if (state.careerHistory.some(row => row.sourceRecordId === approval.sourceRecordId && row.personId === person.id)) { approval.applied = true; continue; }
    const current = assignmentSnapshot(person, state);
    if (ASSIGNMENT_KEYS.some(key => (approval.before[key].id && current[key].id !== approval.before[key].id) || current[key].name !== approval.before[key].name)) { approval.issue = '当前任职与审批前值冲突，保留原任职待核对'; continue; }
    const conflicts = state.careerHistory.some(row => row.personId === person.id && row.startDate >= approval.effectiveDate);
    if (conflicts) { approval.issue = '任职生效日期与已有任职段冲突'; continue; }
    const active = state.careerHistory.find(row => row.personId === person.id && !row.endDate && row.status === '已记录');
    if (active) active.endDate = nextDay(approval.effectiveDate, -1);
    else state.careerHistory.push({ id: uid(), personId: person.id, employeeNo: person.employeeNo, startDate: '', endDate: nextDay(approval.effectiveDate, -1), assignment: copy(approval.before), status: '待核对', issue: '历史任职开始日期待核对', version: 1, history: [] });
    const row = { id: uid(), personId: person.id, employeeNo: person.employeeNo, startDate: approval.effectiveDate, endDate: '', effectiveDate: approval.effectiveDate, assignment: copy(approval.after), before: copy(approval.before), after: copy(approval.after), sourceRecordId: approval.sourceRecordId, approvalId: approval.approvalId, source: '飞书审批', evidence: approval.evidence || approval.approvalId, status: '已记录', version: 1, history: [] };
    state.careerHistory.push(row);
    Object.assign(person, { departmentId: approval.after.department.id, positionId: approval.after.position.id, locationId: approval.after.location.id, manager: approval.after.manager.name, managerId: approval.after.manager.id });
    approval.applied = true;
    approval.issue = '';
    state.audit.unshift({ id: uid(), actor: '系统', type: 'career.approval', objectId: row.id, personId: person.id, at: new Date().toISOString(), before: copy(approval.before), after: copy(approval.after), reason: approval.approvalId, result: '成功' });
  }
}

export function projectHrCareer(state, people, personId) {
  const ids = new Set(people.filter(person => !personId || person.id === personId).map(person => person.id));
  return state.careerHistory.filter(row => ids.has(row.personId) && people.some(person => person.id === row.personId && person.employeeNo === row.employeeNo)).map(row => ({
    ...copy(row), name: people.find(person => person.id === row.personId)?.name,
  })).sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
}

export function applyHrCareerAction(state, role, type, payload, day) {
  if (!['career.add', 'career.correct'].includes(type)) return false;
  check(['人事', 'HR'].includes(role), '仅人事可以补录历史任职履历');
  const old = state.careerHistory.find(row => row.id === payload.id);
  check(type !== 'career.correct' || old && old.historicalBackfill && old.version === payload.expectedVersion, '仅可更正可核验的历史补录记录；记录变更后请刷新');
  const person = state.people.find(person => person.id === (old?.personId || payload.personId) && person.masterCreated);
  check(person, '请选择已建档人员');
  check(text(payload.evidence), '请填写历史审批或可核实材料依据');
  check(!payload.startDate || dateValid(payload.startDate) && payload.startDate <= day, '历史任职开始日期无效或晚于今天');
  check(!payload.endDate || dateValid(payload.endDate) && payload.endDate < day, '历史补录结束日期须早于今天；当前任职更正走飞书审批');
  check(!payload.startDate || !payload.endDate || payload.startDate <= payload.endDate, '历史任职起止日期顺序不正确');
  check(!payload.sourceRecordId || !state.careerHistory.some(row => row.id !== old?.id && row.personId === person.id && row.sourceRecordId === payload.sourceRecordId), '该历史来源已关联任职记录');
  const assignment = Object.fromEntries(ASSIGNMENT_KEYS.map(key => [key, { id: text(payload.assignment?.[key]?.id), name: text(payload.assignment?.[key]?.name) }]));
  const issues = [];
  if (!payload.startDate || !payload.endDate) issues.push('历史任职期间待核对');
  if (!fieldsComplete(assignment)) issues.push('任职四项名称或来源标识待补齐');
  if (payload.startDate && payload.endDate && state.careerHistory.some(row => row.id !== old?.id && row.personId === person.id && row.startDate && row.startDate <= payload.endDate && (!row.endDate || row.endDate >= payload.startDate))) issues.push('与已有任职段重叠，保留原记录待核对');
  const row = {
    ...(old || {}), id: old?.id || uid(), personId: person.id, employeeNo: person.employeeNo,
    startDate: payload.startDate || '', endDate: payload.endDate || '', assignment,
    sourceRecordId: text(payload.sourceRecordId), approvalId: text(payload.approvalId), evidence: text(payload.evidence), source: '人事历史补录',
    historicalBackfill: true, status: issues.length ? '待核对' : '已记录', issue: issues.join('；'),
    version: (old?.version || 0) + 1, recordedAt: new Date().toISOString(), actor: role,
    history: [...(old?.history || []), { at: new Date().toISOString(), actor: role, before: old ? { ...copy(old), history: undefined } : null, evidence: text(payload.evidence) }],
  };
  if (old) state.careerHistory[state.careerHistory.findIndex(item => item.id === old.id)] = row;
  else state.careerHistory.push(row);
  state.audit.unshift({ id: uid(), actor: role, type, objectId: row.id, personId: person.id, at: row.recordedAt, before: old ? copy(old) : null, after: copy(row), reason: row.evidence, result: row.status });
  return true;
}
