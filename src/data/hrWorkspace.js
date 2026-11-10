import { initialProjects } from './projectSeeds.js';
import { validateIntake, INTAKE_FIELDS } from './hrIntake.js';
import { ensureHrChangePreview, hrChangeSummaries, projectHrChangeRecords } from './hrChanges.js';
import { ensurePersonnelContracts, applyPersonnelContractAction, projectPersonnelContracts, contractLaunchReadiness } from './hrPersonnelContracts.js';
import { ensureHrAttendance, applyHrAttendanceAction, projectHrAttendance, monthValid } from './hrAttendance.js';
import { ensureHrCareer, reconcileCareerApprovals, applyHrCareerAction, projectHrCareer } from './hrCareer.js';

// This store is a browser-only preview. External account, contract and approval
// facts are fixtures/read-only inputs, never editable completion checkboxes.
export const HR_ROLE = '人事';
export const HR_KEY = 'mmos.hr.workspace.v1';
export const HR_ROLES = ['人事', 'PM', 'PMO', '财务', '项目助理', '部门经理'];
const clone = value => JSON.parse(JSON.stringify(value));
const clean = value => String(value ?? '').trim();
const requireRule = (condition, message) => { if (!condition) throw new Error(message); };
const normalizeRole = role => role === 'HR' ? HR_ROLE : role === 'PA' ? '项目助理' : role;
const makeId = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
export const beijingToday = (now = new Date()) => new Date(new Date(now).getTime() + 8 * 3600000).toISOString().slice(0, 10);
export const HR_DEPARTMENT_MANAGER_ACCOUNT = 'manager-demo-1';
const offsetDate = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export const validHrDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function isHrReferenceActive(row, day = beijingToday()) {
  if (!row || !['启用', '在用'].includes(row.status) || row.validity === '永久停用') return false;
  if (row.validity === '永久启用') return true;
  return row.validity === '时间段' && validHrDate(row.startDate) && validHrDate(row.endDate) && row.startDate <= day && row.endDate >= day;
}

export function trainingStage(person) {
  const result = person.trainingResult;
  if (person.trainingConflict) return '待核对';
  if (person.day1 === '淘汰' && !result) return '第1天淘汰';
  if (person.day1 === '通过') {
    if (['通过', '淘汰'].includes(result)) return `第2天${result}`;
    if (['培训储备', '培训储备-需一本及以上'].includes(result)) return '第2天培训储备';
    if (!result || result === '待确定') return '第2天';
  }
  if (person.day1 === '培训中' && (!result || result === '待确定')) return '第1天';
  return '待核对';
}

export function employmentStatus(person, day = beijingToday()) {
  if (!person.masterCreated) return '';
  const approval = person.resignation;
  if (approval?.status === '通过' && !approval.cancelled && validHrDate(approval.effectiveDate)) return approval.effectiveDate < day ? '已离职' : '离职中';
  // A later missing record or contract read failure must not regress employment.
  if (['在职', '离职中', '已离职'].includes(person.trustedEmploymentStatus)) return person.trustedEmploymentStatus;
  return person.contractSigned === true ? '在职' : '待入职';
}

export function checklistStatus(person) {
  if (!person.checklistCreated) return '';
  if (person.terminated && !person.masterCreated) return '已终止';
  if (person.checklistCompleted) return '已完成';
  if (person.masterCreated) return person.contractSigned === true ? '已完成' : '待签合同';
  return '办理中';
}

export function tenureDays(person, day = beijingToday()) {
  const end = employmentStatus(person, day) === '已离职' ? person.resignation?.effectiveDate : day;
  if (!validHrDate(person.trainingStart) || !validHrDate(end) || end < person.trainingStart) return null;
  return Math.round((Date.parse(end) - Date.parse(person.trainingStart)) / 86400000) + 1;
}

export function hrAnomalies(person) {
  if (!person.checklistCreated || person.terminated || person.intent === '不入职' && !person.masterCreated) return [];
  const legacyAssociationOnly = person.id === 'hr-10' && person.missingFields?.length === 1 && person.missingFields[0] === '尚未关联已提交资料';
  return [person.accountActive === false && '组织号未激活', person.contractSigned === false && '合同未签署', (person.materialsComplete === false && !legacyAssociationOnly || person.assignmentMissingFields?.length > 0) && '资料不全'].filter(Boolean);
}

export function hrReminderPlan(day = beijingToday()) {
  const d = Number(day.slice(-2));
  const month = Number(day.slice(5, 7));
  const last = new Date(Date.UTC(Number(day.slice(0, 4)), month, 0)).getUTCDate();
  const regular = [5, 10, 15, 20, month === 2 ? last : 30].includes(d);
  const focus = d >= 10 && d <= 15;
  return { regular, focus, anomalies: [...new Set([...(regular ? ['组织号未激活', '合同未签署', '资料不全'] : []), ...(focus ? ['合同未签署', '资料不全'] : [])])] };
}

function demoIntake(name, phone) {
  const file = label => ({ name: `${label}-.pdf`, type: 'application/pdf', data: 'data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y=', demo: true });
  return { name, phone, residentType: '中国大陆居民', gender: '女', hasFormerName: '没有曾用名', idNumber: 'DEMO-证件-仅', identityAttachment: file('证件'), address: '联系地址', emergencyName: '联系人', emergencyRelation: '家人', emergencyPhone: '联系方式', education: '本科', school: '大学', major: '语言学', graduation: '2025年6月', english: 'CET6', educationAttachment: file('学历'), bank: '招商银行', bank0_card: 'DEMO-银行卡-仅', bank0_branch: '支行', bank0_attachment: file('银行卡') };
}

export function createHrSeed(day = beijingToday()) {
  const deptNames = ['总经办', '财务法务合规部', '人才与专家网络中心', '品牌策划与内容传播部', 'AI平台与数据治理中心', '行政与职场运营部', '客户增长与战略解决方案部', 'PMO经营治理办公室', 'AI数据交付中心'];
  const departments = deptNames.map((name, i) => ({ id: `dept-${i + 1}`, name, parentId: '', status: '启用', sort: i + 1, note: '' }));
  const children = { 'dept-3': ['人才开发部', '人才发展部', 'HRBP与组织发展部', '人事运营与薪酬部'], 'dept-5': ['开发部', '智能产品方案部', 'IT部'], 'dept-9': ['方言交付线', '多语种交付线', '代码工程交付线', '视听多模态交付线', '通用评测交付线', '专家任务构建交付线', '物理智能交付线'] };
  Object.entries(children).forEach(([parentId, names]) => names.forEach((name, i) => departments.push({ id: `${parentId}-${i + 1}`, name, parentId, status: '启用', sort: i + 1, note: '' })));
  const locations = ['渝-汉国中心', '渝-南岸千方产业园', '渝-金山中心', '渝-渝中桃花厂', '川-成都太平洋', '川-德阳', '线上', '驻场'].map((name, i) => ({ id: `loc-${i + 1}`, name, address: name === '线上' ? '无' : '具体地址待来源核验', status: i === 5 ? '筹备' : '在用', validity: '永久启用', startDate: '', endDate: '', note: '工作地点配置' }));
  const positions = [
    { id: 'pos-1', name: '数据标注员', departmentId: 'dept-9-5', manager: '王然' },
    { id: 'pos-2', name: '多语种评测员', departmentId: 'dept-9-2', manager: '陈默' },
    { id: 'pos-3', name: '人事专员', departmentId: 'dept-3-4', manager: '人事负责人' },
  ].map(p => ({ ...p, status: '启用', validity: '永久启用', startDate: '', endDate: '', keyType: '', bonusLevel: '' }));
  const projects = initialProjects.map(p => ({ id: p.projectNo, projectNo: p.projectNo, name: p.projectName, pm: p.pm, pa: p.pa, qa: p.qa, ended: p.status === '项目结束' }));
  const p1 = projects[0].id, p2 = projects[1].id, p4 = projects[3].id;
  const now = `${day}T01:00:00.000Z`;
  const base = (id, name, n, projectIds = [p1]) => ({ id, name, employeeNo: `MCE${String(n).padStart(8, '0')}`, recruitmentNo: `招聘-模拟-${n}`, category: '内部人员', sourceSystem: 'MMOS1', sourceId: `demo-source-${id}`, candidate: true, sourceReadAt: now, sourceSnapshot: { day1: '培训中', trainingResult: '待确定' }, arrivalDate: day, projectIds, positionId: 'pos-1', departmentId: 'dept-9-5', locationId: 'loc-1', manager: projectIds[0] === p2 ? '陈默' : '王然', employeeType: '全职', stage: '试用期', gender: '女', phone: `电话-${n}`, email: `demo${n}@example.test`, enterpriseAccount: `demo${n}@mmos.example.test`, personalAccount: `个人账号-模拟-${n}`, trainingStart: offsetDate(day, -4), entryDate: offsetDate(day, -4), probationDate: offsetDate(day, -4), firstWorkDate: offsetDate(day, -4), day1: '通过', trainingResult: '通过', subsidyDays: null, subsidyAmount: null, accountCreatedAt: `${offsetDate(day, -4)}T01:00:00.000Z`, accountActive: true, contractSigned: true, materialsComplete: true, missingFields: [], intent: '确认入职', masterCreated: true, checklistCreated: true, checklistCompleted: true, specialPlans: [], recruiter: '招聘同事', appliedPosition: '数据标注员', school: '大学', education: '本科', major: '语言学', graduation: '2025年6月', english: 'CET6', trainingPassedDate: offsetDate(day, -3), candidateNote: '入职记录' });
  const people = [
    base('hr-1', '林悦', 1831, [p1, p4]),
    { ...base('hr-2', '陈可', 1832, [p2]), positionId: 'pos-2', departmentId: 'dept-9-2', employeeType: '在校实习生', stage: '实习期', specialPlans: ['晨星计划'] },
    { ...base('hr-3', '许宁', 1833), contractSigned: false, checklistCompleted: false, specialPlans: ['魔鬼训练营'] },
    { ...base('hr-4', '周航', 1834), resignation: { status: '通过', effectiveDate: offsetDate(day, 5), evidence: '模拟有效审批-001' }, employeeType: '劳务返聘', stage: '劳务返聘' },
    { ...base('hr-5', '唐安', 1835), projectIds: [], resignation: { status: '通过', effectiveDate: offsetDate(day, -1), evidence: '模拟有效审批-002' }, trainingStart: offsetDate(day, -40) },
    { ...base('hr-6', '待评定', 1836), masterCreated: false, checklistCreated: false, checklistCompleted: false, day1: '培训中', trainingResult: '', trainingStart: day, trainingPassedDate: '', intent: '', accountCreatedAt: '', accountActive: null, contractSigned: null, materialsComplete: false, missingFields: ['尚未提交资料'], stage: '', enterpriseAccount: '' },
    { ...base('hr-7', '第二天', 1837, [p2]), masterCreated: false, checklistCreated: false, checklistCompleted: false, trainingResult: '', trainingStart: offsetDate(day, -1), trainingPassedDate: '', intent: '', accountCreatedAt: '', accountActive: null, contractSigned: null, materialsComplete: false, missingFields: ['尚未提交资料'], stage: '', enterpriseAccount: '' },
    { ...base('hr-8', '待确认入职', 1838), masterCreated: false, checklistCompleted: false, intent: '', contractSigned: false, stage: '' },
    { ...base('hr-9', '待激活', 1839), masterCreated: false, checklistCompleted: false, accountActive: false, contractSigned: false, materialsComplete: false, missingFields: ['学历证明附件'], stage: '' },
    { ...base('hr-10', '待关联资料', 1840), masterCreated: false, checklistCompleted: false, contractSigned: false, materialsComplete: null, missingFields: [], integrationIssue: '资料与候选人关联待核对，不属于员工漏填', stage: '' },
    { ...base('hr-11', '培训淘汰', 1841), masterCreated: false, checklistCreated: false, checklistCompleted: false, trainingResult: '淘汰', subsidyDays: 1.5, subsidyAmount: 120, intent: '', stage: '' },
    { ...base('hr-12', '培训储备', 1842), masterCreated: false, checklistCreated: false, checklistCompleted: false, trainingResult: '培训储备', intent: '', stage: '' },
  ];
  const external = [
    { id: 'ext-1', name: '兼职方晴', employeeNo: 'EXT-DEMO-001', externalNo: 'EXT-DEMO-001', projectIds: [p1], category: '外部人员', employeeType: '兼职', current: true },
    { id: 'ext-2', name: '兼职吴远', employeeNo: 'EXT-DEMO-002', externalNo: 'EXT-DEMO-002', projectIds: [p2], category: '外部人员', employeeType: '兼职', current: true },
    { id: 'ext-3', name: '已离项', employeeNo: 'EXT-DEMO-003', externalNo: 'EXT-DEMO-003', projectIds: [], category: '外部人员', employeeType: '兼职', current: false },
  ];
  const outputs = [
    { id: 'out-1', personId: 'hr-1', projectId: p1, date: offsetDate(day, -1), quantity: 180, unit: '条', category: '内部人员' },
    { id: 'out-2', personId: 'hr-1', projectId: p4, date: offsetDate(day, -2), quantity: 30, unit: '张', category: '内部人员' },
    { id: 'out-3', personId: 'hr-2', projectId: p2, date: offsetDate(day, -1), quantity: 150, unit: '条', category: '内部人员' },
    { id: 'out-4', personId: 'ext-1', projectId: p1, date: offsetDate(day, -1), quantity: 120, unit: '条', category: '外部人员' },
    { id: 'out-5', personId: 'ext-3', projectId: p1, date: offsetDate(day, -20), quantity: 60, unit: '条', category: '外部人员' },
    { id: 'out-6', personId: 'unknown-1', projectId: p1, date: offsetDate(day, -1), quantity: 10, unit: '条', category: '待核对', reason: '来源人员关联待核对' },
  ];
  const attendance = [
    { id: 'att-1', personId: 'hr-1', projectId: p1, date: offsetDate(day, -1), hours: 8, category: '内部人员' },
    { id: 'att-2', personId: 'hr-2', projectId: p2, date: offsetDate(day, -1), hours: 7.5, category: '内部人员' },
    { id: 'att-3', personId: 'ext-1', projectId: p1, date: offsetDate(day, -1), hours: 4, category: '外部人员' },
  ];
  const intakes = [
    { id: 'intake-demo-1', serial: 'ZL-DEMO-001', requestId: 'demo-request-1', values: { ...demoIntake('待关联资料', '电话-1840'), recruitmentNo: '招聘-模拟-1840' }, candidateId: '', submittedAt: now, complete: true, status: '未关联', submitter: '' },
    { id: 'intake-demo-2', serial: 'ZL-DEMO-002', requestId: 'demo-request-2', values: { ...demoIntake('独立填报', '电话-独立'), recruitmentNo: '招聘-模拟-1900' }, candidateId: '', submittedAt: now, complete: true, status: '未关联', submitter: '' },
  ];
  const result = { schema: 1, revision: 1, people, external, intakes, departments, locations, positions, projects, outputs, attendance, audit: [], nextEmployeeNumber: 1843, nextIntakeNumber: 3, fieldPermissions: { hrSalary: true, financeSalary: false }, sync: { status: '来源快照', lastSuccess: now, cadenceMinutes: 30, note: '尚未连接 MMOS1、飞书账号、审批及合同结果接口' } };
  addPreviewSources(result, day);
  return result;
}

let memoryStore;
export function loadHr() {
  if (typeof localStorage === 'undefined') {
    memoryStore = reconcileHrState(memoryStore || createHrSeed());
    return clone(memoryStore);
  }
  const raw = localStorage.getItem(HR_KEY);
  if (!raw) { const seed = reconcileHrState(createHrSeed()); localStorage.setItem(HR_KEY, JSON.stringify(seed)); return seed; }
  let state;
  try { state = JSON.parse(raw); } catch { throw new Error('人事数据无法读取，请保留现有数据并联系人事核对。'); }
  requireRule(state.schema === 1 && Array.isArray(state.people), '人事数据版本不兼容，请核对数据后重试。');
  const next = reconcileHrState(state);
  if (next.revision !== state.revision) localStorage.setItem(HR_KEY, JSON.stringify(next));
  return next;
}

const listeners = new Set();
export function subscribeHr(listener) {
  listeners.add(listener);
  const storage = event => { if (event.key === HR_KEY) listener(); };
  globalThis.addEventListener?.('storage', storage);
  return () => { listeners.delete(listener); globalThis.removeEventListener?.('storage', storage); };
}

function canProject(role, project) {
  if (!project || !HR_ROLES.includes(role) || role === '部门经理') return false;
  if (role === 'PM') return project.pm === '王然';
  if (role === '项目助理') return project.pa === '林晓彤';
  if (role === '财务') return ['ZJ20260910922', 'ZJ20260911880'].includes(project.id);
  return true;
}
export function canHrTrain(role, person, state = loadHr()) {
  role = normalizeRole(role);
  const trainingProjectId = person.trainingProjectId || person.projectIds[0];
  if (role === HR_ROLE) return true;
  if (role === '部门经理') return person.functional === true && state.departments.some(d => d.id === person.departmentId && d.status === '启用' && d.managerAccount === HR_DEPARTMENT_MANAGER_ACCOUNT);
  return role === 'PM' && state.projects.some(p => p.id === trainingProjectId && p.pm === '王然' && !p.ended);
}

const PERSON_FIELDS = ['id', 'name', 'employeeNo', 'recruitmentNo', 'category', 'projectIds', 'departmentId', 'positionId', 'locationId', 'manager', 'employeeType', 'stage', 'gender', 'phone', 'email', 'enterpriseAccount', 'personalAccount', 'trainingStart', 'entryDate', 'probationDate', 'firstWorkDate', 'day1', 'trainingResult', 'subsidyDays', 'subsidyAmount', 'subsidyReview', 'accountCreatedAt', 'accountActive', 'contractSigned', 'materialsComplete', 'missingFields', 'intent', 'masterCreated', 'checklistCreated', 'checklistCompleted', 'specialPlans', 'trainingPassedDate', 'trainingConflict', 'downstreamReview', 'reviewReason', 'integrationIssue', 'exitFollowup', 'terminated', 'appliedPosition', 'recruiter'];
const pick = (object, fields) => Object.fromEntries(fields.filter(key => object[key] !== undefined).map(key => [key, clone(object[key])]));

// Callers establish person/project visibility before using this shared field
// projection. Sensitive fields continue to be controlled by personDetail.
export function projectHrPersonDetail(person, role, state, projectIds, day = beijingToday()) {
  role = normalizeRole(role);
  const p = pick(person, [...PERSON_FIELDS, 'intakeId', 'intakeMatchStatus', 'intakeMatchIssue', 'intakeSerial']);
  p.projectIds = person.projectIds.filter(id => projectIds.has(id));
  // Compatibility for the initial preview seed only; never reinterpret actual
  // missing document fields in later source records.
  if (p.id === 'hr-10' && p.missingFields?.length === 1 && p.missingFields[0] === '尚未关联已提交资料') {
    p.materialsComplete = null;
    p.missingFields = [];
    p.integrationIssue = '资料与候选人关联待核对，不属于员工漏填';
  }
  return {
    ...p, ...personDetail(person, role, state, projectIds, day),
    departmentName: state.departments.find(row => row.id === p.departmentId)?.name || '待确认',
    positionName: state.positions.find(row => row.id === p.positionId)?.name || '待确认',
    locationName: state.locations.find(row => row.id === p.locationId)?.name || '未指定',
    projectNames: p.projectIds.map(id => state.projects.find(project => project.id === id)?.name || id),
    trainingStage: trainingStage(person), employmentStatus: employmentStatus(person, day), checklistStatus: checklistStatus(person),
    anomalies: hrAnomalies(person), masterAnomalies: person.contractSigned === false ? ['合同未签署'] : [], tenureDays: tenureDays(person, day),
    stage: person.employeeType === '劳务返聘' ? '劳务返聘' : person.stage || '待确认', canTrain: canHrTrain(role, person, state),
    accountReview: person.accountActive == null && person.checklistCreated ? '激活结果待核对' : '',
    contractReview: person.contractReview || (person.contractSigned == null && person.checklistCreated ? '合同结果待核对' : ''),
  };
}

export function getHrView(role, state = loadHr(), day = beijingToday()) {
  // Explicit-state callers get the same result as storage readers, without
  // mutating their snapshot or persisting anything during projection.
  state = reconcileHrState(state, day);
  role = normalizeRole(role);
  const known = HR_ROLES.includes(role);
  const projects = known ? state.projects.filter(p => canProject(role, p)) : [];
  const ids = new Set(projects.map(p => p.id));
  const visible = person => role === HR_ROLE || role === '部门经理' && canHrTrain(role, person, state) || role === 'PMO' && [...person.projectIds, ...(person.endedProjectRelations || []).map(r => r.projectId)].length > 0 || [...person.projectIds, ...(person.endedProjectRelations || []).map(r => r.projectId)].some(id => ids.has(id));
  const projectNames = person => person.projectIds.filter(id => ids.has(id)).map(id => state.projects.find(p => p.id === id)?.name || id);
  const projectPerson = person => projectHrPersonDetail(person, role, state, ids, day);
  const scopePeople = known ? state.people.filter(visible).map(projectPerson) : [];
  const external = known ? state.external.filter(e => e.current && e.projectIds.some(id => ids.has(id))).map(e => ({ ...pick(e, ['id', 'name', 'employeeNo', 'externalNo', 'employeeType', 'category', 'current']), projectIds: e.projectIds.filter(id => ids.has(id)), projectNames: projectNames(e), trainingStage: '', anomalies: [], specialPlans: [] })) : [];
  const annotateOutput = output => {
    const person = [...state.people, ...state.external].find(p => p.id === output.personId);
    return { ...output, name: person?.name || '来源人员待核对', employeeNo: person?.employeeNo || '待核对' };
  };
  const intakes = role === HR_ROLE ? state.intakes : role === '财务' ? state.intakes.filter(i => i.candidateId && scopePeople.some(p => p.id === i.candidateId)) : [];
  return {
    revision: state.revision, role, today: day, sync: known ? role === HR_ROLE ? clone(state.sync) : pick(state.sync, ['status', 'lastSuccess', 'cadenceMinutes', 'note']) : null,
    people: scopePeople.filter(p => p.masterCreated),
    projectPeople: [...scopePeople.filter(p => p.projectIds.length > 0 && !p.terminated && p.employmentStatus !== '已离职'), ...external],
    candidates: [HR_ROLE, '部门经理'].includes(role) ? state.people.filter(p => p.candidate && visible(p)).map(person => ({ ...projectPerson(person), ...pick(person, ['sourceSystem', 'sourceId', 'sourceReadAt', 'sourceSnapshot', 'arrivalDate', 'school', 'education', 'major', 'graduation', 'english', 'candidateNote']) })) : [],
    onboarding: [HR_ROLE, '部门经理'].includes(role) ? scopePeople.filter(p => p.checklistCreated) : [],
    intakes: clone(intakes).map(intake => {
      const person = state.people.find(p => p.id === intake.candidateId);
      const projected = role === HR_ROLE ? intake : {
        ...pick(intake, ['id', 'serial', 'candidateId', 'submittedAt', 'complete', 'status', 'matchIssue']),
        values: pick(intake.values, ['recruitmentNo', 'name', 'phone', 'bank', 'bank0_card', 'bank0_branch', 'bank0_attachment', 'bank1_card', 'bank1_branch', 'bank1_attachment', 'bank2_card', 'bank2_branch', 'bank2_attachment']),
      };
      return { ...projected, recruitmentNo: clean(intake.values.recruitmentNo), name: intake.values.name, phone: intake.values.phone, employeeNo: person?.employeeNo || '', enterpriseAccount: person?.enterpriseAccount || '', accountActive: person?.accountActive ?? null };
    }), external, projects: clone(projects),
    departments: known ? clone(state.departments) : [], locations: known ? clone(state.locations) : [], positions: known ? clone(state.positions) : [],
    outputs: state.outputs.filter(o => ids.has(o.projectId)).map(annotateOutput), attendance: state.attendance.filter(o => ids.has(o.projectId)).map(annotateOutput),
    outputReadStatus: state.outputReadStatus || '待接入', outputReadError: state.outputReadError || '', outputSource: state.outputSource || '实际产出接口待接入',
    audit: role === HR_ROLE ? clone(state.audit) : [], reminderPlan: hrReminderPlan(day),
  };
}

function audit(state, role, type, objectId, before, after, reason = '') {
  // The caller only passes explicit business metadata, never whole intake values.
  state.audit.unshift({ id: makeId('audit'), actor: role, type, objectId, at: new Date().toISOString(), before, after, reason, result: '成功' });
}

function reconcileOnboarding(person, day = beijingToday()) {
  if (!person.checklistCreated || person.terminated || ['离职中', '已离职'].includes(employmentStatus(person, day))) return;
  if (person.intent === '不入职' && (!person.abandoned || person.exitConfirmed)) {
    if (person.masterCreated) person.exitFollowup = '先补齐合同，按飞书有效离职审批处理；实际出勤结算另行衔接';
    else if (person.accountActive === false) {
      person.terminated = true;
      person.exitFollowup = '账号清理待接入；培训补贴160元为应发，尚未支付';
      if (person.subsidyAmount == null) { person.subsidyDays = 2; person.subsidyAmount = 160; person.subsidySource = '未入主库退出'; }
      else person.downstreamReview = '已有同次培训应发，保留原记录待核对，未重复生成';
    } else person.exitFollowup = '等待飞书有效离职审批及获批日期，暂不终止、清理或生成应发';
    return;
  }
  if (!person.masterCreated && !person.abandoned && !(person.assignmentMissingFields || []).length && trainingStage(person) === '第2天通过' && person.intent === '确认入职' && person.accountActive === true && person.materialsComplete === true && !person.reviewReason && !person.integrationIssue && !person.intakeMatchIssue) {
    person.masterCreated = true;
    if (person.contractSigned === true) person.trustedEmploymentStatus = '在职';
  }
  if (person.masterCreated && person.contractSigned === true) person.checklistCompleted = true;
}

function reconcileHrMatches(state, day = beijingToday()) {
  // Only these two exact preview fixtures are upgraded; employee names never
  // identify a person or select an intake, including during migration.
  for (const intake of state.intakes) {
    const demoNo = intake.id === 'intake-demo-1' && intake.requestId === 'demo-request-1' ? '招聘-模拟-1840'
      : intake.id === 'intake-demo-2' && intake.requestId === 'demo-request-2' ? '招聘-模拟-1900' : '';
    if (demoNo && intake.values.recruitmentNo == null) intake.values.recruitmentNo = demoNo;
    if (intake.values.recruitmentNo != null) intake.values.recruitmentNo = clean(intake.values.recruitmentNo);
  }
  for (const person of state.people) if (person.recruitmentNo != null) person.recruitmentNo = clean(person.recruitmentNo);
  const byNumber = rows => {
    const result = new Map();
    for (const row of rows) {
      const number = clean(row.values ? row.values.recruitmentNo : row.recruitmentNo);
      if (number) result.set(number, [...(result.get(number) || []), row]);
    }
    return result;
  };
  const peopleByNumber = byNumber(state.people);
  const intakesByNumber = byNumber(state.intakes);
  for (const person of state.people) {
    const number = clean(person.recruitmentNo);
    const linked = state.intakes.filter(i => i.candidateId === person.id || i.id === person.intakeId);
    person.intakeMatchStatus = '等待资料';
    person.intakeMatchIssue = '';
    if (!number) {
      person.intakeMatchStatus = '等待匹配';
      person.intakeMatchIssue = '缺少招聘编号，等待来源补齐后自动匹配';
    } else if ((peopleByNumber.get(number)?.length || 0) > 1 || (intakesByNumber.get(number)?.length || 0) > 1) {
      person.intakeMatchStatus = '待核对';
      person.intakeMatchIssue = '招聘编号重复，保留原关联，待核对来源';
    } else if (linked.length > 1 || linked.some(i => clean(i.values.recruitmentNo) !== number) || person.intakeId && !linked.length) {
      person.intakeMatchStatus = '待核对';
      person.intakeMatchIssue = '历史资料关联与招聘编号不一致或缺失，待核对来源';
    }
  }
  for (const intake of state.intakes) {
    const number = clean(intake.values.recruitmentNo);
    const candidates = peopleByNumber.get(number) || [];
    const person = candidates.length === 1 ? candidates[0] : null;
    const prior = { candidateId: intake.candidateId || '', integrated: intake.integrated === true };
    const setStatus = (status, issue = '') => {
      intake.status = status; intake.matchIssue = issue;
      if (person) { person.intakeMatchStatus = status; person.intakeMatchIssue = issue; }
    };
    if (!number) { setStatus('等待匹配', '缺少招聘编号，等待来源补齐后自动匹配'); continue; }
    if (candidates.length > 1 || (intakesByNumber.get(number)?.length || 0) > 1) {
      setStatus('待核对', '招聘编号重复，保留原关联，待核对来源'); continue;
    }
    if (!person) { setStatus('等待匹配', '等待同一招聘编号的候选人记录'); continue; }
    if (person.sourceIntegrityIssue) { setStatus('待核对', person.sourceIntegrityIssue); continue; }
    if (person.intakeMatchIssue || intake.candidateId && intake.candidateId !== person.id || person.intakeId && person.intakeId !== intake.id) {
      setStatus('待核对', person.intakeMatchIssue || '历史资料关联与招聘编号不一致，保留原关联，待核对来源'); continue;
    }
    const previouslyLinked = intake.candidateId === person.id && person.intakeId === intake.id;
    if (person.terminated || ['离职中', '已离职'].includes(employmentStatus(person, day))) {
      setStatus('待核对', '本次办理已终止或人员已进入离职流程，保留历史，不重新整合'); continue;
    }
    const legacyIntegrated = previouslyLinked && intake.status === '已完成整合';
    intake.candidateId = person.id;
    intake.matchingMethod = 'recruitmentNo';
    person.intakeId = intake.id;
    person.intakeSerial = intake.serial;
    if (person.masterCreated && !intake.integrated && !legacyIntegrated) {
      setStatus('待核对', '已建档人员资料变更须走审批，未覆盖原档案');
    } else if (person.masterCreated) {
      intake.integrated = true;
      setStatus('已完成整合');
    } else {
      // Clear only the original preview's association hint. Other integration
      // or review issues still block the original three-gate admission rule.
      if (person.integrationIssue === '资料与候选人关联待核对，不属于员工漏填') person.integrationIssue = '';
      const errors = validateIntake(intake.values);
      person.materialsComplete = intake.complete === true && errors.length === 0;
      person.missingFields = person.materialsComplete ? [] : errors;
      if (!person.checklistCreated || trainingStage(person) !== '第2天通过') setStatus('已自动关联，待培训通过');
      else if (person.accountActive !== true) setStatus('已自动关联，待激活整合');
      else if (!person.materialsComplete) setStatus('待核对', '资料尚未完整，待补齐后整合');
      else {
        if (!intake.integrated) {
          person.gender = intake.values.gender;
          person.contactFromIntake = intake.values.phone;
          person.intakeProfile = clone(intake.values);
          intake.integrated = true;
        }
        setStatus('已完成整合');
        // Matching must not itself trigger refusal compensation/termination.
        if (person.intent === '确认入职') reconcileOnboarding(person, day);
      }
    }
    if (prior.candidateId !== intake.candidateId || prior.integrated !== (intake.integrated === true)) {
      audit(state, '系统', 'intake.autoMatch', intake.id, prior, { candidateId: intake.candidateId, integrated: intake.integrated === true }, '招聘编号唯一匹配');
    }
  }
}

export function reconcileHrState(previous, day = beijingToday(), now = Date.now()) {
  const state = clone(previous);
  reconcileLifecycle(state, day, Number(new Date(now)));
  ensurePersonnelContracts(state, day);
  ensureHrAttendance(state, day);
  ensureHrCareer(state, day);
  reconcileCareerApprovals(state, day);
  reconcileHrMatches(state, day);
  reconcileLifecycle(state, day, Number(new Date(now)));
  if (JSON.stringify(state) !== JSON.stringify(previous)) state.revision = previous.revision + 1;
  return state;
}

function validateValidity(row) {
  requireRule(['永久启用', '永久停用', '时间段'].includes(row.validity), '请选择有效性模式');
  if (row.validity === '时间段') requireRule(validHrDate(row.startDate) && validHrDate(row.endDate) && row.startDate <= row.endDate, '有效期须填写正确的起止日期，起日不得晚于止日');
}

export function reduceHrAction(previous, role, type, payload = {}) {
  role = normalizeRole(role);
  requireRule(HR_ROLES.includes(role) || role === '资料填写人' && type === 'intake.submit', '无权执行此操作');
  if (payload.expectedRevision != null) requireRule(payload.expectedRevision === previous.revision, '数据已更新，请重新读取后再提交');
  const state = clone(previous);
  reconcileLifecycle(state);
  ensurePersonnelContracts(state, beijingToday());
  ensureHrAttendance(state, beijingToday());
  ensureHrCareer(state, beijingToday());
  if (applyPersonnelContractAction(state, role, type, payload, beijingToday()) ||
      applyHrAttendanceAction(state, role, type, payload, beijingToday()) ||
      applyHrCareerAction(state, role, type, payload, beijingToday())) {
    state.revision = previous.revision + 1;
    return state;
  }
  if (applyExtendedAction(state, role, type, payload)) {
    reconcileHrMatches(state);
    reconcileLifecycle(state);
    state.revision = previous.revision + 1;
    return state;
  }
  if (type === 'intake.submit') {
    requireRule(role === '资料填写人', '请从本人入职资料填写入口提交');
    requireRule(clean(payload.requestId), '缺少提交请求标识，请重新打开表单');
    if (state.intakes.some(i => i.requestId === clean(payload.requestId))) return state;
    const values = pick(payload.values || {}, INTAKE_FIELDS.map(f => f.key));
    values.recruitmentNo = clean(payload.values?.recruitmentNo);
    requireRule(!values.recruitmentNo || !state.intakes.some(i => clean(i.values.recruitmentNo) === values.recruitmentNo), '该招聘编号已提交资料，请勿重复提交；如需更正请联系人事核对');
    const errors = validateIntake(values);
    requireRule(!errors.length, errors.join('；'));
    const id = makeId('intake');
    state.intakes.push({ id, serial: `ZL-${String(state.nextIntakeNumber++).padStart(6, '0')}`, requestId: clean(payload.requestId), values, candidateId: '', submittedAt: new Date().toISOString(), complete: true, status: '等待匹配', submitter: '' });
    reconcileHrMatches(state);
    audit(state, role, type, id, null, { complete: true });
  } else if (type === 'intake.link') {
    throw new Error('资料按唯一招聘编号自动匹配，不支持手动关联人员');
  } else if (type === 'training.update') {
    const person = state.people.find(p => p.id === payload.personId);
    requireRule(person && canHrTrain(role, person, state), '无权维护该项目人员的培训结果');
    requireRule(!person.trainingConflict, '来源组合有冲突，请先核对关联结果');
    const before = pick(person, ['day1', 'trainingResult', 'subsidyDays', 'subsidyAmount']);
    requireRule(role !== HR_ROLE || clean(payload.reason), '人事更正必须填写原因');
    const priorStage = trainingStage(person);
    if (['PM', '部门经理'].includes(role)) requireRule(['第1天', '第2天'].includes(priorStage), '已评定结果须由人事核对更正');
    if (payload.day1 != null) {
      requireRule(['通过', '淘汰', '培训中'].includes(payload.day1), '第一天状态无效');
      if (['PM', '部门经理'].includes(role)) requireRule(priorStage === '第1天' && ['通过', '淘汰'].includes(payload.day1), '请在对应第一天培训阶段操作');
      person.day1 = payload.day1;
    }
    if (payload.result != null) {
      requireRule(['通过', '淘汰', '培训储备', ''].includes(payload.result), '第二天评定结果无效');
      if (['PM', '部门经理'].includes(role)) requireRule(priorStage === '第2天', '第一天通过后方可评定第二天');
      requireRule(person.day1 === '通过' || !payload.result, '第二天评定必须有第一天通过依据');
      person.trainingResult = payload.result;
    }
    requireRule(person.day1 === '通过' || !person.trainingResult, '两天状态互相矛盾，请一并核对更正');
    const eliminated = person.day1 === '淘汰' || person.trainingResult === '淘汰';
    if (eliminated) {
      const value = payload.subsidyDays ?? person.subsidyDays;
      requireRule(value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 2 && Math.abs(Number(value) * 10 - Math.round(Number(value) * 10)) < 1e-8, '淘汰补贴须填写有效实际天数，0至2天且最多1位小数');
      person.subsidyDays = Number(value);
      person.subsidyAmount = Math.round(person.subsidyDays * 800) / 10;
      person.subsidyReview = '';
      person.subsidyStatus = '已生成应发';
      person.subsidyUpdatedAt = new Date().toISOString();
      person.subsidySource = '培训淘汰实际天数';
    } else if (payload.subsidyDays != null) throw new Error('仅淘汰记录可维护此项补贴天数');
    person.trainingEvaluatedAt = new Date().toISOString();
    person.trainingEvaluator = role;
    if (person.trainingResult === '通过' && person.day1 === '通过') {
      person.checklistCreated = true;
      person.trainingPassedDate = beijingToday();
      person.accountCreationStatus ||= '待创建组织号';
    }
    if (eliminated && person.checklistCreated && !person.masterCreated) {
      person.terminated = true;
      person.terminatedAt ||= new Date().toISOString();
      person.terminationReason = clean(payload.reason) || '培训淘汰';
      person.accountCreationStatus = '已停止创建';
      person.exitFollowup = person.accountActive === true ? '账号退出待办：等待有效飞书离职审批' : person.enterpriseAccount ? '账号退出待办：待人事核对移除结果' : '';
    }
    if (person.checklistCreated || before.subsidyAmount != null) person.downstreamReview = role === HR_ROLE ? '已有关联办理或应发，保留原记录，请核对下游影响' : person.downstreamReview;
    person.locallyMaintained = true;
    reconcileHrMatches(state);
    reconcileOnboarding(person);
    audit(state, role, type, person.id, before, pick(person, ['day1', 'trainingResult', 'subsidyDays', 'subsidyAmount']), clean(payload.reason));
  } else if (['onboarding.update', 'onboarding.review'].includes(type)) {
    requireRule(role === HR_ROLE, '仅人事可维护入职意愿及核对资料');
    const person = state.people.find(p => p.id === payload.personId);
    requireRule(person?.checklistCreated, '尚未进入入职清单');
    requireRule(!['accountActive', 'contractSigned', 'materialsComplete', 'masterCreated', 'resignation', 'terminated'].some(key => key in payload), '真实激活、签署、资料和审批结果不可通过人工操作覆盖');
    requireRule(!person.terminated, '本次办理已终止，保留历史，不重新开启');
    const before = pick(person, ['intent', 'departmentId', 'positionId', 'locationId', 'manager', 'masterCreated', 'terminated']);
    updateAssignment(person, payload, state);
    if (payload.intent != null) {
      requireRule(['确认入职', '不入职'].includes(payload.intent), '请选择有效入职意愿');
      person.intent = payload.intent;
    }
    if (payload.locationId != null && payload.locationId !== person.locationId) {
      requireRule(!person.masterCreated, '已建档人员工作地点变更须走飞书信息变更审批');
      requireRule(isHrReferenceActive(state.locations.find(l => l.id === payload.locationId)), '工作地点当前不可用于新业务');
      person.locationId = payload.locationId;
    }
    reconcileHrMatches(state);
    reconcileOnboarding(person);
    audit(state, role, type, person.id, before, pick(person, ['intent', 'locationId', 'masterCreated', 'terminated']), clean(payload.reason));
  } else if (type === 'organization.save' || type === 'organization.delete') {
    requireRule(role === HR_ROLE, '仅人事可维护组织配置');
    const { collection, id } = payload;
    requireRule(['departments', 'locations', 'positions'].includes(collection), '组织配置类型无效');
    const rows = state[collection];
    const old = rows.find(row => row.id === id);
    if (id) requireRule(old, '配置已不存在，请刷新');
    if (type === 'organization.delete') {
      requireRule(old, '请选择要删除的配置');
      const field = { departments: 'departmentId', locations: 'locationId', positions: 'positionId' }[collection];
      const used = state.people.some(p => p[field] === id) || collection === 'departments' && (state.departments.some(d => d.parentId === id) || state.positions.some(p => p.departmentId === id));
      requireRule(!used, '配置存在人员、岗位或下级引用，请使用停用/弃用');
      state[collection] = rows.filter(row => row.id !== id);
      audit(state, role, type, id, old, null);
    } else {
      const fields = collection === 'departments' ? ['name', 'parentId', 'status', 'sort', 'note', 'managerAccount'] : collection === 'locations' ? ['name', 'address', 'status', 'validity', 'startDate', 'endDate', 'note'] : ['name', 'departmentId', 'manager', 'status', 'validity', 'startDate', 'endDate', 'keyType', 'bonusLevel'];
      const row = { ...(old || {}), ...pick(payload, fields), id: id || makeId(collection), name: clean(payload.name ?? old?.name) };
      requireRule(row.name, '名称不能为空');
      if (collection === 'departments') {
        row.parentId ||= '';
        requireRule(['启用', '停用'].includes(row.status), '请选择部门状态');
        requireRule(!row.parentId || rows.some(d => d.id === row.parentId), '上级部门不存在');
        let current = row.parentId; const seen = new Set([row.id]);
        while (current) { requireRule(!seen.has(current), '不能将部门移动到自己或后代之下'); seen.add(current); current = rows.find(d => d.id === current)?.parentId; }
        requireRule(!rows.some(d => d.id !== row.id && d.parentId === row.parentId && clean(d.name) === row.name), '同一上级下部门名称不能重复');
      } else {
        validateValidity(row);
        if (collection === 'locations') {
          requireRule(['在用', '筹备', '弃用'].includes(row.status), '请选择工作地点状态');
          requireRule(!rows.some(d => d.id !== row.id && clean(d.name) === row.name), '工作地点名称不能重复');
        } else {
          requireRule(['启用', '停用'].includes(row.status), '请选择岗位状态');
          requireRule(state.departments.some(d => d.id === row.departmentId), '请选择有效所属部门');
          requireRule(!rows.some(d => d.id !== row.id && d.departmentId === row.departmentId && clean(d.name) === row.name), '同部门岗位名称不能重复');
        }
      }
      if (old) rows[rows.findIndex(d => d.id === id)] = row; else rows.push(row);
      audit(state, role, type, row.id, old || null, row);
    }
  } else throw new Error('此操作不属于当前授权功能；真实外部结果不可手工修改');
  reconcileLifecycle(state);
  reconcileHrMatches(state);
  state.revision = previous.revision + 1;
  return state;
}

export function hrAction(role, type, payload = {}) {
  const next = updateHrWorkspace(previous => reduceHrAction(previous, role, type, payload), payload.expectedRevision);
  return getHrView(role, next);
}

// Shared synchronous commit boundary for local HR features. Each operation reads
// the latest revision and validates its complete batch before publishing changes.
export function updateHrWorkspace(update, expectedRevision) {
  const previous = loadHr();
  if (expectedRevision != null) requireRule(expectedRevision === previous.revision, '数据已更新，请重新读取后再提交');
  const next = update(clone(previous));
  if (JSON.stringify(next) === JSON.stringify(previous)) return previous;
  next.revision = previous.revision + 1;
  // Commit only after every validation succeeds. Quota/serialization errors are
  // propagated to the UI, preserving its draft and the last committed store.
  if (typeof localStorage === 'undefined') memoryStore = next;
  else localStorage.setItem(HR_KEY, JSON.stringify(next));
  listeners.forEach(listener => listener());
  return clone(next);
}

// Adapter model for future source integration, not wired to a pretend sync UI.
export function mergeHrSource(previous, rows, day = beijingToday(), options = {}) {
  const state = clone(previous);
  reconcileLifecycle(state, day);
  const recordConflict = (source, reason) => {
    state.sync.conflicts ||= [];
    const issue = { sourceId: clean(source.sourceId), recruitmentNo: clean(source.recruitmentNo), reason };
    if (!state.sync.conflicts.some(item => JSON.stringify(item) === JSON.stringify(issue))) state.sync.conflicts.push(issue);
  };
  for (const source of rows) {
    if (!clean(source.sourceId)) continue;
    const old = state.people.find(p => p.sourceSystem === 'MMOS1' && p.sourceId === source.sourceId);
    if (!old && !options.supplement && (source.arrivalDate !== day || source.day1 !== '培训中')) continue;
    if (!source.appliedPosition || !source.name) continue;
    if (source.appliedPosition === '兼职') {
      if (!options.supplement) continue;
      const ext = state.external.find(p => p.sourceId === source.sourceId);
      if (!ext) state.external.push({ id: makeId('external'), sourceSystem:'MMOS1', sourceId:source.sourceId, name:source.name, employeeNo:`EXT-DEMO-${String(state.external.length+1).padStart(3,'0')}`, externalNo:`EXT-DEMO-${String(state.external.length+1).padStart(3,'0')}`, projectIds:[], category:'外部人员', employeeType:'兼职', current:false, relationIssue:'等待可明确匹配的外部产出记录' });
      continue;
    }
    const recruitmentNo = clean(source.recruitmentNo);
    const duplicateNumber = recruitmentNo && state.people.some(p => p.id !== old?.id && clean(p.recruitmentNo) === recruitmentNo);
    if (duplicateNumber) recordConflict(source, '招聘编号属于多条来源记录，人员保留独立编号，跨表关联待核对');
    const sourceEmployeeNo = clean(source.employeeNo);
    const validOldNo = /^MCE\d{8}$/.test(sourceEmployeeNo);
    const occupied = sourceEmployeeNo && state.people.find(p => p.id !== old?.id && p.employeeNo === sourceEmployeeNo);
    if (occupied) { recordConflict(source, '旧MCE已由其他人员占用，身份关系待核验'); continue; }
    let person = old;
    if (!person) {
      const employeeNo = validOldNo ? sourceEmployeeNo : `MCE${String(state.nextEmployeeNumber++).padStart(8, '0')}`;
      person = { id: makeId('candidate'), employeeNo, sourceEmployeeNo, sourceSystem:'MMOS1', sourceId:source.sourceId, candidate:true, category:'内部人员', projectIds:[], day1:'培训中', trainingResult:'', masterCreated:false, checklistCreated:false, materialsComplete:false, missingFields:['尚未提交资料'], accountActive:null, contractSigned:null, intent:'', specialPlans:[] };
      state.people.push(person);
      state.nextEmployeeNumber = Math.max(state.nextEmployeeNumber, Number(employeeNo.slice(3))+1);
    }
    const snapshot = pick(source, ['name','arrivalDate','appliedPosition','phone','email','recruitmentNo','employeeNo','departmentId','positionId','locationId','manager','day1','trainingResult']);
    if (JSON.stringify(snapshot) !== JSON.stringify(person.sourceSnapshot)) {
      person.sourceHistory ||= [];
      if (person.sourceSnapshot) person.sourceHistory.push({ values: clone(person.sourceSnapshot), readAt: person.sourceReadAt || '' });
      person.sourceSnapshot = snapshot;
      person.sourceReadAt = new Date().toISOString();
    }
    // The source owns identity and corrections. MMOS owns training assessment.
    Object.assign(person, pick(source, ['name','arrivalDate','appliedPosition','email','departmentId','positionId','locationId','manager','functional']));
    if (source.phone != null) { person.registrationPhone = source.phone; person.phone ||= source.phone; }
    if (source.projectIds) {
      if (person.transferControl) {
        const incoming = [...new Set(source.projectIds)].sort();
        if (JSON.stringify(incoming) !== JSON.stringify([...person.projectIds].sort())) recordConflict(source, '来源项目关联与已执行调配不一致，保留调配结果并待核对');
      } else person.projectIds = source.projectIds.filter(id => state.projects.some(p => p.id === id && !p.ended) && !(person.endedProjectRelations || []).some(r => r.projectId === id));
    }
    person.recruitmentNo = recruitmentNo;
    person.trainingStart ||= source.arrivalDate;
    person.sourceIntegrityIssue = options.complete === false ? '来源分页尚未齐备，等待唯一性核验' : '';
    person.trainingConflict = source.day1 === '培训中' && source.trainingResult === '通过';
    if (person.trainingConflict) recordConflict(source, '来源第一天培训中但结果通过，请来源责任人更正第一天状态');
  }
  reconcileLifecycle(state, day);
  reconcileHrMatches(state, day);
  if (JSON.stringify(state) !== JSON.stringify(previous)) state.revision = previous.revision + 1;
  return state;
}


function addPreviewSources(state, day) {
  state.workCalendar ||= { source: '公司工作日历', days: {} };
  for (let offset = -45; offset <= 45; offset++) {
    const date = offsetDate(day, offset);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    state.workCalendar.days[date] ??= weekday !== 0 && weekday !== 6;
  }
  state.sourceRows ||= [
    { sourceId: 'supplement-demo-1', name: '补采候选', recruitmentNo: '招聘-模拟-1900', arrivalDate: offsetDate(day, -2), appliedPosition: '职能助理', day1: '培训中', departmentId: 'dept-8', functional: true, projectIds: [] },
    { sourceId: 'supplement-demo-2', name: '兼职补采', recruitmentNo: '招聘-模拟-1901', arrivalDate: day, appliedPosition: '兼职', day1: '培训中', projectIds: [state.projects[0]?.id].filter(Boolean) },
  ];
  const department = state.departments.find(d => d.id === 'dept-8');
  if (department && department.managerAccount == null) department.managerAccount = HR_DEPARTMENT_MANAGER_ACCOUNT;
  if (!state.people.some(p => p.id === 'hr-functional-demo')) {
    const next = Math.max(state.nextEmployeeNumber || 1, ...state.people.filter(p => /^MCE\d{8}$/.test(p.employeeNo || '')).map(p => Number(p.employeeNo.slice(3)) + 1));
    state.people.push({ id: 'hr-functional-demo', sourceId: 'functional-demo', sourceSystem: 'MMOS1', name: '职能候选', employeeNo: `MCE${String(next).padStart(8, '0')}`, recruitmentNo: '招聘-职能-模拟-001', candidate: true, functional: true, departmentId: 'dept-8', positionId: '', locationId: 'loc-1', manager: '部门经理', projectIds: [], day1: '通过', trainingResult: '', arrivalDate: day, trainingStart: day, appliedPosition: '职能助理', category: '内部人员', employeeType: '全职', masterCreated: false, checklistCreated: false, materialsComplete: false, missingFields: ['尚未提交资料'], accountActive: null, contractSigned: null, intent: '', specialPlans: [] });
  }
  state.nextEmployeeNumber = Math.max(state.nextEmployeeNumber || 1, 1844);
  state.previewRevision = 2;
  state.outputReadStatus ||= '成功';
  state.outputSource = '产出快照';
  const sample = state.people.find(p => p.id === 'hr-1');
  if (sample && !sample.historySource) {
    sample.historySource = { status: '成功', lastSuccess: `${day}T01:00:00.000Z`, source: '旧人员主库 tblgS8BD00FYBZrp', recordId: 'history-demo-hr-1', mappingVersion: 'hr-108-v2.8.1' };
    sample.archive = { ethnicity: '汉族', politics: '群众', birthday: '1998-06-15', nativePlace: '籍贯', address: '联系地址', emergencyName: '紧急联系人', emergencyRelation: '家人', emergencyPhone: '紧急联系电话', school: '大学', education: '本科', major: '语言学', majorType: '文科', schoolLevel: '待核对', graduation: '2025年6月', english: 'CET6', abilityTags: ['多语种能力'], hasFormerName: '没有曾用名', residentType: '中国大陆居民', idNumber: 'DEMO-证件-仅', resumeSupplement: '原选项待核对', personnelAnomalies: '暂无记录' };
    sample.bankAccounts = [
      { id: 'bank-demo-1', bank: '招商银行', cardNumber: 'DEMO-CARD-001', branch: '支行', completeNumber: true, attachments: [{name:'银行卡版本1.pdf',source:'旧主库记录',version:1}], source: '旧主库记录' },
      { id: 'bank-demo-2', bank: '招商银行', cardNumber: 'DEMO-CARD-002', branch: '第二支行', completeNumber: true, attachments: [], source: '信息变更审批' },
    ];
    sample.contracts = [{ id: 'contract-demo-1', type: '劳动合同', form: '电子合同', owner: '签约主体', number: 'DEMO-CONTRACT-001', startDate: offsetDate(day, -30), endDate: '2027-11-08', taskId: 'DEMO-FADADA-001', status: '已完成', source: '签署记录' }];
    sample.compensation = { salary: 5200, abilityAllowance: '能力档位', standbyAllowance: false, socialInsuranceStart: '2026-10-01', socialInsuranceStop: '', socialInsuranceCompany: '参保主体', housingFund: true, employerLiabilityInsurance: '来源适用范围待核对', starPlanCost: '待核对' };
    sample.changes = [{ id: 'change-demo-1', type: '入职', date: sample.entryDate, status: '已完成', source: '历史入职记录', reason: '历史任职依据' }];
  }
}

export function assignmentMissingFields(person, state) {
  return [
    !state.departments.some(d => d.id === person.departmentId) && '所属部门',
    !state.positions.some(p => p.id === person.positionId && p.departmentId === person.departmentId) && '岗位',
    !state.locations.some(l => l.id === person.locationId) && '工作地点',
    !clean(person.manager) && '直属经理',
  ].filter(Boolean);
}

function updateAssignment(person, payload, state) {
  const fields = ['departmentId', 'positionId', 'locationId', 'manager'];
  const changed = fields.some(key => key in payload && clean(payload[key]) !== clean(person[key]));
  if (!changed) return;
  requireRule(!person.masterCreated, '已建档人员任职信息变更须走飞书信息变更审批');
  for (const key of fields) if (key in payload) person[key] = clean(payload[key]);
  requireRule(!person.departmentId || state.departments.some(d => d.id === person.departmentId && d.status === '启用'), '请选择有效所属部门');
  requireRule(!person.positionId || state.positions.some(p => p.id === person.positionId && p.departmentId === person.departmentId && isHrReferenceActive(p)), '请选择所属部门的有效岗位');
  requireRule(!person.locationId || state.locations.some(l => l.id === person.locationId && isHrReferenceActive(l)), '请选择有效工作地点');
  person.assignmentMissingFields = assignmentMissingFields(person, state);
}

function endProjectRelations(person, projectIds, reason, day, evidence = '') {
  person.endedProjectRelations ||= [];
  for (const projectId of new Set(projectIds)) {
    // Only current relations can end. A later re-entry creates a new relation
    // generation even when it eventually ends for the same reason again.
    if ((person.projectIds || []).includes(projectId)) person.endedProjectRelations.push({ projectId, reason, endedDate: day, evidence });
  }
  person.projectIds = (person.projectIds || []).filter(id => !projectIds.includes(id));
}

function reconcileLifecycle(state, day = beijingToday(), now = Date.now()) {
  if (!state.previewRevision) addPreviewSources(state, day);
  ensureHrChangePreview(state, day);
  state.sync ||= {};
  const occupied = state.people.map(p => /^MCE(\d{8})$/.exec(p.employeeNo || '')).filter(Boolean).map(m => Number(m[1]));
  state.nextEmployeeNumber = Math.max(state.nextEmployeeNumber || 1, ...occupied.map(number => number + 1));
  for (const person of state.people) {
    person.projectIds ||= [];
    if (person.checklistCreated) person.checklistId ||= `onboarding-${person.id}`;
    person.trainingProjectId ||= person.projectIds[0] || '';
    person.assignmentMissingFields = assignmentMissingFields(person, state);
    person.personalMissingFields = [...(person.missingFields || [])];
    person.trainingFirstDate = person.arrivalDate || person.trainingStart || '';
    person.trainingDateIssue = '';
    if (validHrDate(person.trainingFirstDate)) {
      let next = offsetDate(person.trainingFirstDate, 1);
      person.trainingDay2 = '';
      for (let i = 0; i < 30; i++, next = offsetDate(next, 1)) {
        if (state.workCalendar?.days[next] == null) { person.trainingDateIssue = '公司工作日历缺少对应日期'; break; }
        if (state.workCalendar.days[next]) { person.trainingDay2 = next; break; }
      }
    } else person.trainingDateIssue = '缺少有效到岗日期';
    const created = Date.parse(person.accountCreatedAt);
    if (!person.masterCreated && !person.terminated && person.checklistCreated && person.accountActive === false && Number.isFinite(created) && now - created > 72 * 3600000) {
      person.abandoned = true;
      person.abandonedAt ||= new Date(created + 72 * 3600000 + 1).toISOString();
      person.abandonReason = '企业组织号创建成功超过72小时仍未激活';
    }
    if (person.abandoned && !person.terminated && !person.exitConfirmed) person.exitFollowup = '已判定放弃入职，待人事确认退出';
    if (person.subsidyAmount != null) person.subsidyStatus ||= '已生成应发';
    const ended = person.projectIds.filter(id => state.projects.some(p => p.id === id && p.ended));
    if (ended.length) {
      endProjectRelations(person, ended, '项目最终验收通过', day);
      if (!person.checklistCompleted || !['通过', '淘汰', '培训储备'].includes(person.trainingResult)) person.handoffReason = '项目结束，未完培训及入职待办由人事接续';
    }
    if (person.masterCreated && employmentStatus(person, day) === '已离职') {
      endProjectRelations(person, [...person.projectIds], '有效离职生效', offsetDate(person.resignation?.effectiveDate || day, 1), person.resignation?.evidence || '最近可信离职状态');
    } else if (!person.masterCreated && (person.terminated || ['第1天淘汰', '第2天淘汰', '第2天培训储备'].includes(trainingStage(person)))) {
      endProjectRelations(person, [...person.projectIds], person.terminated ? '入职办理终止' : '培训结果结束在项关系', day);
    }
    if (person.exitConfirmed && person.accountActive === true && person.resignation?.status === '通过' && !person.resignation.cancelled && validHrDate(person.resignation.effectiveDate) && person.resignation.effectiveDate < day && !person.masterCreated) {
      person.terminated = true;
      person.terminatedAt ||= `${offsetDate(person.resignation.effectiveDate, 1)}T00:00:00+08:00`;
      person.exitFollowup = '离职已生效，组织号移除结果待接入';
      if (person.subsidySource !== '培训淘汰实际天数') { person.subsidyDays = 2; person.subsidyAmount = 160; person.subsidyStatus = '已生成应发'; }
    }
  }
  for (const person of state.external) {
    const ended = person.projectIds.filter(id => state.projects.some(p => p.id === id && p.ended));
    if (ended.length) endProjectRelations(person, ended, '项目最终验收通过', day);
    const latest = state.outputs.filter(o => o.personId === person.id && o.category === '外部人员' && validHrDate(o.date)).map(o => o.date).sort().at(-1);
    person.latestOutputDate = latest || '';
    if (latest && state.outputReadStatus === '成功' && Date.parse(day) - Date.parse(latest) > 15 * 86400000) endProjectRelations(person, [...person.projectIds], '连续超过15天无产出记录', day);
    person.current = person.projectIds.length > 0;
  }
}

export function mergeHrBankAccounts(accounts = []) {
  const merged = [];
  for (const source of accounts) {
    const cardNumber = clean(source.cardNumber);
    const reliable = source.completeNumber === true || /^\d{12,24}$/.test(cardNumber);
    const old = reliable && merged.find(row => row.cardNumber === cardNumber && row.completeNumber);
    const attachments = source.attachments || [];
    if (!old) {
      merged.push({ ...clone(source), cardNumber, completeNumber: reliable, attachments: clone(attachments), sources: [source.source || '来源待核对'], issue: reliable ? source.issue || '' : '完整卡号待核对' });
      continue;
    }
    old.sources = [...new Set([...old.sources, source.source || '来源待核对'])];
    if (old.bank !== source.bank || old.branch !== source.branch) {
      old.issue = '同卡银行名称或开户行存在来源差异，待人事核对';
      old.sourceValues ||= [{ bank: old.bank, branch: old.branch, source: old.sources[0] }];
      if (!old.sourceValues.some(v => v.source === source.source)) old.sourceValues.push({ bank: source.bank, branch: source.branch, source: source.source });
    }
    for (const attachment of attachments) if (!old.attachments.some(a => JSON.stringify(a) === JSON.stringify(attachment))) old.attachments.push(clone(attachment));
  }
  return merged;
}

function personDetail(person, role, state, projectIds, day = beijingToday()) {
  const common = pick(person, ['functional', 'trainingFirstDate', 'trainingDay2', 'trainingDateIssue', 'trainingEvaluatedAt', 'trainingEvaluator', 'assignmentMissingFields', 'personalMissingFields', 'abandoned', 'abandonedAt', 'abandonReason', 'subsidyStatus', 'subsidySource', 'subsidyUpdatedAt', 'terminatedAt', 'terminationReason', 'accountCreationStatus', 'handoffReason', 'exitConfirmed', 'contactFromIntake', 'checklistId']);
  if (role === '部门经理') return common;
  const values = { ...(person.archive || {}), ...(person.intakeProfile || {}), ...pick(person, ['school', 'education', 'major', 'graduation', 'english', 'abilityTags']) };
  const profile = pick(values, ['address', 'emergencyName', 'emergencyRelation', 'emergencyPhone', 'education', 'school', 'major', 'majorType', 'schoolLevel', 'graduation', 'english', 'abilityTags', 'resumeSupplement', 'personnelAnomalies']);
  profile.educationAttachments = values.educationAttachment ? [values.educationAttachment] : values.educationAttachments || [];
  profile.resumeAttachments = values.resumeAttachments || [];
  const historySource = person.historySource || { status: '待接入', lastSuccess: '', error: '' };
  const visibleHistory = (person.endedProjectRelations || []).filter(r => role === HR_ROLE || projectIds.has(r.projectId));
  const lifecycleFields = pick(person, ['onboardingPm','probationFormulaDate','plannedRegularizationDate','actualRegularizationDate','regularizationType','expectedLastWorkDate','lastWorkDate','resignationEffectiveDate','lastWorkMonth','contractTaskId','contractTaskStatus','contractSource','contractStartMonth','attendanceStatus','attendanceRecordId','personnelAnomalies','trainingStartMonth','projectManagerSource','attendanceManagerSource','deliveryLine','deliveryLineAuto','deliveryLineBackup','deliveryLineNote']);
  if (person.resignation?.status === '通过' && validHrDate(person.resignation.effectiveDate)) { lifecycleFields.lastWorkDate = person.resignation.effectiveDate; lifecycleFields.resignationEffectiveDate = offsetDate(person.resignation.effectiveDate, 1); }
  const salaryAuthorized = role === HR_ROLE && state.fieldPermissions?.hrSalary === true || role === '财务' && state.fieldPermissions?.financeSalary === true;
  const changeFields = ['id', 'type', 'changeType', 'date', 'status', 'source'];
  const contractFields = ['id', 'type', 'form', 'owner', 'number', 'startDate', 'endDate', 'taskId', 'status', 'source'];
  if (salaryAuthorized) {
    changeFields.push('salary', 'previousSalary', 'abilityAllowance', 'standbyAllowance', 'starPlanCost');
    contractFields.push('salary', 'abilityAllowance', 'standbyAllowance');
  }
  if (role === HR_ROLE && salaryAuthorized) changeFields.push('reason');
  const storedChanges = (person.changes || []).map(row => pick(row, changeFields));
  const sourceChanges = hrChangeSummaries(person, state, role, salaryAuthorized);
  const changes = [...sourceChanges.filter(row => !storedChanges.some(stored => stored.id === row.id)), ...storedChanges];
  const result = { ...common, ...profile, ...lifecycleFields, historySource: clone(historySource), endedProjectRelations: clone(visibleHistory), recruitmentPlan: clone(person.recruitmentPlan || []), changes, contracts: (state.personnelContracts ? projectPersonnelContracts(state, [person], role, day) : (person.contracts || []).map(row => pick(row, contractFields))) };
  if (role === HR_ROLE) {
    Object.assign(result, pick(values, ['ethnicity', 'politics', 'birthday', 'nativePlace', 'hasFormerName', 'formerName', 'residentType', 'idNumber', 'returnPermit', 'taiwanPermit', 'passport', 'exitDate', 'identityAttachment']));
    result.resignationReason = person.resignationReason;
    result.residentEntryDate = values.entryDate;
    result.certificateCategory = values.residentType;
  }
  if ([HR_ROLE, '财务'].includes(role)) {
    const accounts = clone(person.bankAccounts || []);
    const intake = person.intakeProfile;
    if (intake?.bank) {
      const index = ['招商银行', '浙商银行', '其他银行'].indexOf(intake.bank);
      if (index >= 0 && intake[`bank${index}_card`]) accounts.push({ id: `intake-bank-${person.id}`, bank: intake.bank, cardNumber: intake[`bank${index}_card`], branch: intake[`bank${index}_branch`], attachments: intake[`bank${index}_attachment`] ? [{...intake[`bank${index}_attachment`],source:person.intakeId,version:1}] : [], source: person.intakeId });
    }
    result.bankAccounts = mergeHrBankAccounts(accounts);
    result.compensation = pick(person.compensation || {}, ['socialInsuranceStart', 'socialInsuranceStop', 'socialInsuranceCompany', 'housingFund', 'employerLiabilityInsurance']);
    result.salaryAuthorized = salaryAuthorized;
    if (salaryAuthorized) Object.assign(result.compensation, pick(person.compensation || {}, ['salary', 'abilityAllowance', 'standbyAllowance', 'starPlanCost']));
    result.compensation.salaryAuthorized = salaryAuthorized;
  }
  return result;
}

export function getHrChangesView(role = HR_ROLE, type, previous, day = beijingToday()) {
  if (normalizeRole(role) !== HR_ROLE) return { role, canView: false, rows: [], sync: null, personView: { people: [] } };
  const state = reconcileHrState(previous || loadHr(), day);
  const personView = getHrView(role, state, day);
  const salaryAuthorized = state.fieldPermissions?.hrSalary === true;
  return {
    role, canView: true,
    rows: projectHrChangeRecords(state, personView, type, salaryAuthorized),
    sync: clone(state.hrChangeSync || { status: '待接入', lastSuccess: '', note: '飞书审批接口待接入。' }),
    personView,
  };
}

export function getHrContractsView(role = HR_ROLE, personId, previous, day = beijingToday()) {
  role = normalizeRole(role);
  if (!HR_ROLES.includes(role) || role === '部门经理') return { role, canView: false, rows: [], people: [], revision: 0 };
  const state = reconcileHrState(previous || loadHr(), day);
  const people = getHrView(role, state, day).people.filter(person => !personId || person.id === personId);
  return {
    role, canView: true, canManage: role === HR_ROLE, revision: state.revision, today: day,
    people: people.map(person => ({ id: person.id, name: person.name, employeeNo: person.employeeNo })),
    rows: projectPersonnelContracts(state, people, role, day),
    readiness: role === HR_ROLE ? state.people.filter(person => people.some(row => row.id === person.id)).map(person => ({ personId: person.id, name: person.name, employeeNo: person.employeeNo, ...contractLaunchReadiness(person, state.contractSigningConfiguration) })) : [],
  };
}

export function getHrAttendanceView(role, month, personId, previous, day = beijingToday()) {
  requireRule(monthValid(month), '请选择有效月份');
  role = normalizeRole(role);
  if (!HR_ROLES.includes(role)) return { role, rows: [], batches: [], latest: null, original: null, revision: 0 };
  const state = reconcileHrState(previous || loadHr(), day);
  const people = getHrView(role, state, day).people;
  return { role, revision: state.revision, today: day, canRead: role === HR_ROLE, ...projectHrAttendance(state, people, month, personId, role === HR_ROLE) };
}

export function getHrCareerView(role, personId, previous, day = beijingToday()) {
  role = normalizeRole(role);
  if (!HR_ROLES.includes(role)) return { role, rows: [], people: [], pending: [], revision: 0 };
  const state = reconcileHrState(previous || loadHr(), day);
  const people = getHrView(role, state, day).people.filter(person => !personId || person.id === personId);
  return {
    role, revision: state.revision, canManage: role === HR_ROLE, today: day,
    people: people.map(person => ({ id: person.id, name: person.name, employeeNo: person.employeeNo })),
    rows: projectHrCareer(state, people, personId),
    pending: state.careerApprovals.filter(row => people.some(person => person.id === row.personId && person.employeeNo === row.employeeNo) && !row.applied).map(row => pick(row, ['id', 'personId', 'employeeNo', 'effectiveDate', 'status', 'before', 'after', 'approvalId', 'sourceRecordId', 'issue'])),
  };
}

function applyExtendedAction(state, role, type, payload) {
  const actions = ['intake.correct', 'onboarding.rebuild', 'onboarding.confirmExit', 'history.backfill', 'source.refresh', 'source.supplement'];
  if (!actions.includes(type)) return false;
  requireRule(role === HR_ROLE, '仅人事可执行此项操作');
  if (type === 'intake.correct') {
    const intake = state.intakes.find(row => row.id === payload.id);
    requireRule(intake, '入职资料记录不存在');
    const person = state.people.find(p => p.id === intake.candidateId);
    requireRule(!person?.masterCreated, '已建档人员资料更正须转飞书信息变更审批');
    requireRule(!person?.terminated, '本次办理已终止，保留原资料');
    requireRule(clean(payload.reason), '请填写资料更正依据');
    const values = { ...intake.values, ...pick(payload.values || {}, INTAKE_FIELDS.map(f => f.key).filter(key => key !== 'recruitmentNo')) };
    requireRule(!validateIntake(values).length, validateIntake(values).join('；'));
    intake.versions ||= [];
    intake.versions.push({ values: clone(intake.values), reason: clean(payload.reason), at: new Date().toISOString() });
    intake.values = values;
    intake.complete = true;
    intake.integrated = false;
    audit(state, role, type, intake.id, {version:intake.versions.length-1}, {version:intake.versions.length}, clean(payload.reason));
  } else if (type === 'onboarding.rebuild' || type === 'onboarding.confirmExit') {
    const person = state.people.find(p => p.id === payload.personId);
    requireRule(person?.checklistCreated, '尚未进入入职清单');
    if (type === 'onboarding.rebuild') {
      if (person.masterCreated) return true;
      requireRule(!person.terminated && !person.abandoned && trainingStage(person) === '第2天通过', '当前培训或退出判定停止建档');
      requireRule(person.accountActive === true && person.materialsComplete === true && person.intent === '确认入职' && !assignmentMissingFields(person,state).length && !person.reviewReason && !person.integrationIssue && !person.intakeMatchIssue, '准入条件尚未齐备，请补齐本人资料、任职信息及实际办理结果');
      reconcileOnboarding(person);
      requireRule(person.masterCreated, '当前有效条件未满足，保留办理记录');
    } else {
      requireRule(clean(payload.reason), '请填写人事确认退出依据');
      requireRule(!person.masterCreated && !person.terminated, '本次办理已有建档或终止结果，请按对应业务处理');
      person.exitConfirmed = true;
      person.intent = '不入职';
      reconcileOnboarding(person);
    }
    audit(state, role, type, person.id, null, { masterCreated: person.masterCreated, terminated: !!person.terminated, exitConfirmed: !!person.exitConfirmed }, clean(payload.reason));
  } else if (type === 'history.backfill') {
    requireRule(clean(payload.sourceEvidence) && clean(payload.name) && clean(payload.enterpriseAccount), '请填写身份、账号及历史核验依据');
    requireRule(/^MCE\d{8}$/.test(clean(payload.employeeNo)), '请填写已核实的MCE及8位数字旧员工编号');
    requireRule(validHrDate(payload.entryDate) && payload.entryDate <= beijingToday() && validHrDate(payload.trainingStart || payload.entryDate) && (payload.trainingStart || payload.entryDate) <= beijingToday(), '请填写真实历史入职及培训日期');
    const existing = state.people.find(p => p.employeeNo === clean(payload.employeeNo));
    if (existing) {
      const accountMatches = clean(existing.enterpriseAccount) && clean(existing.enterpriseAccount) === clean(payload.enterpriseAccount);
      const sourceMatches = !clean(existing.enterpriseAccount) && clean(existing.sourceId) && clean(existing.sourceId) === clean(payload.sourceId);
      requireRule(existing.name === clean(payload.name) && (accountMatches || sourceMatches), '旧员工编号对应身份冲突或缺少稳定来源核验，请核验原人员姓名、企业账号及来源记录');
      if (existing.masterCreated) return true;
    }
    requireRule(!existing || !existing.terminated && !existing.abandoned && existing.trainingResult !== '淘汰', '原办理已有退出或淘汰判定，不能按历史补录恢复');
    requireRule(!state.people.some(p => p.id !== existing?.id && p.enterpriseAccount === clean(payload.enterpriseAccount)), '企业账号已关联其他人员');
    const person = existing || { id: makeId('history'), projectIds: [], category:'内部人员', candidate:false, specialPlans:[] };
    Object.assign(person, pick(payload, ['name','employeeNo','departmentId','positionId','locationId','manager','enterpriseAccount','entryDate','sourceId']), {trainingStart:payload.trainingStart || payload.entryDate, masterCreated:true, trustedEmploymentStatus:'在职', historySource:{status:'成功',lastSuccess:new Date().toISOString(),source:clean(payload.sourceEvidence)}, historicalBackfill:true});
    person.assignmentMissingFields = assignmentMissingFields(person,state);
    if (!existing) state.people.push(person);
    audit(state,role,type,person.id,null,{employeeNo:person.employeeNo,historicalBackfill:true},clean(payload.sourceEvidence));
  } else {
    const filters = { name: clean(payload.name), startDate: payload.startDate || '', endDate: payload.endDate || '' };
    if (type === 'source.supplement') {
      requireRule(filters.name || filters.startDate && filters.endDate, '请填写姓名或完整报到日期区间');
      requireRule(!filters.startDate && !filters.endDate || validHrDate(filters.startDate) && validHrDate(filters.endDate) && filters.startDate <= filters.endDate, '报到日期区间无效');
    }
    const rows = (state.sourceRows || []).filter(row => type === 'source.refresh' ? state.people.some(p => p.sourceId === row.sourceId) : (!filters.name || row.name.includes(filters.name)) && (!filters.startDate || row.arrivalDate >= filters.startDate && row.arrivalDate <= filters.endDate));
    const next = mergeHrSource(state, rows, beijingToday(), { supplement:type === 'source.supplement' });
    Object.assign(state,next);
    state.sync.lastResults = rows.map(row => ({sourceId:row.sourceId,name:row.name,result:state.people.some(p=>p.sourceId===row.sourceId)||state.external.some(p=>p.sourceId===row.sourceId)?'已读取':'待核对'}));
    state.sync.lastFilters = filters;
    state.sync.status = '来源读取完成';
    state.sync.lastSuccess = new Date().toISOString();
    audit(state,role,type,'source',null,{count:rows.length,filters},'本地来源快照');
  }
  return true;
}

export function syncHrProjectFacts(projects) {
  const state = loadHr();
  const before = JSON.stringify(state);
  for (const source of projects) {
    const project = state.projects.find(row => row.id === source.projectNo);
    if (!project) continue;
    if (source.pm != null) project.pm = source.pm;
    if (source.pa != null) project.pa = source.pa;
    if (source.qa != null) project.qa = source.qa;
    if (source.status === '项目结束' || source.projectStatus === '项目结束') project.ended = true;
  }
  reconcileLifecycle(state);
  if (JSON.stringify(state) === before) return;
  state.revision++;
  if (typeof localStorage === 'undefined') memoryStore = state;
  else localStorage.setItem(HR_KEY, JSON.stringify(state));
  listeners.forEach(listener => listener());
}


// Read-only source adapters. Callers must supply verified, stable object mapping.
export function mergeHrExternalFacts(previous, rows, day = beijingToday(), now = Date.now()) {
  const state = clone(previous);
  reconcileLifecycle(state, day, Number(new Date(now)));
  for (const source of rows) {
    const person = state.people.find(p => p.id === source.personId);
    if (!person || !source.sourceRecordId) continue;
    if (source.employeeNo && source.employeeNo !== person.employeeNo || source.enterpriseAccount && person.enterpriseAccount && source.enterpriseAccount !== person.enterpriseAccount) { person.integrationIssue = '企业账号来源对象冲突，保留最近可信结果'; continue; }
    if (source.enterpriseAccount) person.enterpriseAccount = source.enterpriseAccount;
    if (typeof source.accountActive === 'boolean') person.accountActive = source.accountActive;
    if (source.accountCreatedAt && Number.isFinite(Date.parse(source.accountCreatedAt))) person.accountCreatedAt ||= source.accountCreatedAt;
    if (source.resignation?.personId === person.id && (person.masterCreated || source.resignation.checklistId === person.checklistId) && source.resignation.evidence && source.resignation.status === '通过' && validHrDate(source.resignation.lastWorkDate)) {
      person.resignation = { status:'通过',effectiveDate:source.resignation.lastWorkDate,evidence:source.resignation.evidence };
    }
    const task = source.contractTask;
    if (task?.id && task.personId === person.id && task.checklistId === person.checklistId && task.valid === true && task.status === '已完成') {
      person.contractSigned = true;
      person.contractReview = '';
      person.contractTaskId = task.id;
      person.contractTaskStatus = task.status;
      person.contractSource = source.sourceRecordId;
    } else if (task && (task.personId !== person.id || task.checklistId !== person.checklistId || task.valid !== true)) person.contractReview = '签署任务与本次办理关联待核验';
  }
  const next = reconcileHrState(state, day, now);
  next.revision = previous.revision + (JSON.stringify({ ...next, revision: previous.revision }) !== JSON.stringify(previous) ? 1 : 0);
  return next;
}

export function mergeHrOutputFacts(previous, rows, options = {}, day = beijingToday()) {
  const state = clone(previous);
  state.outputReadStatus = options.status === '失败' ? '失败' : options.complete === false ? '读取未完成' : '成功';
  state.outputSource = options.source || '已接入产出事实适配器';
  if (state.outputReadStatus === '失败') {
    state.outputReadError = options.error || '产出来源读取失败，保留最近成功名单';
    if (JSON.stringify(state) !== JSON.stringify(previous)) state.revision = previous.revision + 1;
    return state;
  }
  state.outputReadError = '';
  for (const source of rows) {
    if (!source.id || source.validated !== true || !validHrDate(source.date)) continue;
    const person = [...state.people, ...state.external].find(p => p.id === source.personId);
    const project = state.projects.find(p => p.id === source.projectId);
    const record = clone(source);
    if (!person || !project) {
      record.category = '待核对';
      record.reason = !person ? '来源人员映射不明确，待核对' : '来源项目映射不明确，待核对';
      const existing = state.outputs.findIndex(row => row.id === record.id);
      if (existing < 0) state.outputs.push(record); else state.outputs[existing] = record;
      continue;
    }
    const lastWorkDate = person.resignation?.effectiveDate;
    if (person.masterCreated && person.resignation?.status === '通过' && validHrDate(lastWorkDate) && source.date > lastWorkDate) {
      record.reason = '业务日期在离职生效后，待核对'; record.category = '待核对';
    } else {
      record.category = person.category;
      const ended = project.ended || person.terminated || ['第1天淘汰','第2天淘汰','第2天培训储备'].includes(trainingStage(person)) || person.masterCreated && employmentStatus(person,day)==='已离职';
      // Late historical output remains readable. New conflicting output is
      // evidence to review, never permission to undo an explicit transfer.
      if (person.transferControl && !person.projectIds.includes(project.id) && source.date >= person.transferControl.effectiveDate) {
        const historical = state.outputs.find(row => row.id === source.id && row.personId === person.id && row.projectId === project.id && row.date === source.date);
        if (!historical || historical.category === '待核对') {
          record.category = '待核对';
          record.reason = '产出项目与已执行换项或调休池状态不一致，保留调配结果';
        }
      }
      if (!ended && !person.transferControl) {
        if (person.category === '外部人员') {
          const latest = state.outputs.filter(row => row.id !== source.id && row.personId === person.id && row.category === '外部人员' && validHrDate(row.date)).sort((a,b) => b.date.localeCompare(a.date))[0];
          if (latest?.date === source.date && latest.projectId !== project.id) {
            record.category = '待核对';
            record.reason = '同一业务日存在多个项目来源，保留最近可信关系';
          } else if (!latest || source.date >= latest.date) person.projectIds = [project.id];
        } else person.projectIds = [...new Set([...person.projectIds,project.id])];
      }
    }
    const index = state.outputs.findIndex(r => r.id === record.id);
    if (index < 0) state.outputs.push(record); else state.outputs[index] = record;
  }
  if (options.complete !== false) reconcileLifecycle(state, day);
  if (JSON.stringify(state) !== JSON.stringify(previous)) state.revision = previous.revision + 1;
  return state;
}
