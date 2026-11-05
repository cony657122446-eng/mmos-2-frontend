import { initialProjects } from './projectSeeds.js';
import { validateIntake, INTAKE_FIELDS } from './hrIntake.js';

// This store is a browser-only preview. External account, contract and approval
// facts are fixtures/read-only inputs, never editable completion checkboxes.
export const HR_ROLE = '人事';
export const HR_KEY = 'mmos.hr.workspace.v1';
export const HR_ROLES = ['人事', 'PM', 'PMO', '财务', '项目助理'];
const clone = value => JSON.parse(JSON.stringify(value));
const clean = value => String(value ?? '').trim();
const requireRule = (condition, message) => { if (!condition) throw new Error(message); };
const normalizeRole = role => role === 'HR' ? HR_ROLE : role === 'PA' ? '项目助理' : role;
const makeId = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
export const beijingToday = (now = new Date()) => new Date(new Date(now).getTime() + 8 * 3600000).toISOString().slice(0, 10);
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
  if (approval?.status === '通过' && !approval.cancelled && validHrDate(approval.effectiveDate)) return approval.effectiveDate <= day ? '已离职' : '离职中';
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
  return [person.accountActive === false && '组织号未激活', person.contractSigned === false && '合同未签署', person.materialsComplete === false && !legacyAssociationOnly && '资料不全'].filter(Boolean);
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
  const file = label => ({ name: `${label}-模拟.pdf`, type: 'application/pdf', data: 'data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y=', demo: true });
  return { name, phone, residentType: '中国大陆居民', gender: '女', hasFormerName: '没有曾用名', idNumber: 'DEMO-证件-仅模拟', identityAttachment: file('证件'), address: '模拟联系地址', emergencyName: '模拟联系人', emergencyRelation: '家人', emergencyPhone: '模拟联系方式', education: '本科', school: '模拟大学', major: '语言学', graduation: '2025年6月', english: 'CET6', educationAttachment: file('学历'), bank: '招商银行', bank0_card: 'DEMO-银行卡-仅模拟', bank0_branch: '模拟支行', bank0_attachment: file('银行卡') };
}

export function createHrSeed(day = beijingToday()) {
  const deptNames = ['总经办', '财务法务合规部', '人才与专家网络中心', '品牌策划与内容传播部', 'AI平台与数据治理中心', '行政与职场运营部', '客户增长与战略解决方案部', 'PMO经营治理办公室', 'AI数据交付中心'];
  const departments = deptNames.map((name, i) => ({ id: `dept-${i + 1}`, name, parentId: '', status: '启用', sort: i + 1, note: '' }));
  const children = { 'dept-3': ['人才开发部', '人才发展部', 'HRBP与组织发展部', '人事运营与薪酬部'], 'dept-5': ['开发部', '智能产品方案部', 'IT部'], 'dept-9': ['方言交付线', '多语种交付线', '代码工程交付线', '视听多模态交付线', '通用评测交付线', '专家任务构建交付线', '物理智能交付线'] };
  Object.entries(children).forEach(([parentId, names]) => names.forEach((name, i) => departments.push({ id: `${parentId}-${i + 1}`, name, parentId, status: '启用', sort: i + 1, note: '' })));
  const locations = ['渝-汉国中心', '渝-南岸千方产业园', '渝-金山中心', '渝-渝中桃花厂', '川-成都太平洋', '川-德阳', '线上', '驻场'].map((name, i) => ({ id: `loc-${i + 1}`, name, address: name === '线上' ? '无' : '具体地址待来源核验', status: i === 5 ? '筹备' : '在用', validity: '永久启用', startDate: '', endDate: '', note: '状态为交互演示配置' }));
  const positions = [
    { id: 'pos-1', name: '数据标注员', departmentId: 'dept-9-5', manager: '王然' },
    { id: 'pos-2', name: '多语种评测员', departmentId: 'dept-9-2', manager: '陈默' },
    { id: 'pos-3', name: '人事专员', departmentId: 'dept-3-4', manager: '模拟人事负责人' },
  ].map(p => ({ ...p, status: '启用', validity: '永久启用', startDate: '', endDate: '', keyType: '', bonusLevel: '' }));
  const projects = initialProjects.map(p => ({ id: p.projectNo, projectNo: p.projectNo, name: p.projectName, pm: p.pm, pa: p.pa, ended: p.status === '项目结束' }));
  const p1 = projects[0].id, p2 = projects[1].id, p4 = projects[3].id;
  const now = `${day}T01:00:00.000Z`;
  const base = (id, name, n, projectIds = [p1]) => ({ id, name, employeeNo: `MCE${String(n).padStart(8, '0')}`, recruitmentNo: `招聘-模拟-${n}`, category: '内部人员', sourceSystem: 'MMOS1', sourceId: `demo-source-${id}`, candidate: true, sourceReadAt: now, sourceSnapshot: { day1: '培训中', trainingResult: '待确定' }, arrivalDate: day, projectIds, positionId: 'pos-1', departmentId: 'dept-9-5', locationId: 'loc-1', manager: projectIds[0] === p2 ? '陈默' : '王然', employeeType: '全职', stage: '试用期', gender: '女', phone: `模拟电话-${n}`, email: `demo${n}@example.test`, enterpriseAccount: `demo${n}@mmos.example.test`, personalAccount: `个人账号-模拟-${n}`, trainingStart: offsetDate(day, -4), entryDate: offsetDate(day, -4), probationDate: offsetDate(day, -4), firstWorkDate: offsetDate(day, -4), day1: '通过', trainingResult: '通过', subsidyDays: null, subsidyAmount: null, accountCreatedAt: `${offsetDate(day, -4)}T01:00:00.000Z`, accountActive: true, contractSigned: true, materialsComplete: true, missingFields: [], intent: '确认入职', masterCreated: true, checklistCreated: true, checklistCompleted: true, specialPlans: [], recruiter: '模拟招聘同事', appliedPosition: '数据标注员', school: '模拟大学', education: '本科', major: '语言学', graduation: '2025年6月', english: 'CET6', trainingPassedDate: offsetDate(day, -3), candidateNote: '本地交互演示数据' });
  const people = [
    base('hr-1', '模拟林悦', 1831, [p1, p4]),
    { ...base('hr-2', '模拟陈可', 1832, [p2]), positionId: 'pos-2', departmentId: 'dept-9-2', employeeType: '在校实习生', stage: '实习期', specialPlans: ['晨星计划'] },
    { ...base('hr-3', '模拟许宁', 1833), contractSigned: false, checklistCompleted: false, specialPlans: ['魔鬼训练营'] },
    { ...base('hr-4', '模拟周航', 1834), resignation: { status: '通过', effectiveDate: offsetDate(day, 5), evidence: '模拟有效审批-001' }, employeeType: '劳务返聘', stage: '劳务返聘' },
    { ...base('hr-5', '模拟唐安', 1835), projectIds: [], resignation: { status: '通过', effectiveDate: offsetDate(day, -1), evidence: '模拟有效审批-002' }, trainingStart: offsetDate(day, -40) },
    { ...base('hr-6', '模拟待评定', 1836), masterCreated: false, checklistCreated: false, checklistCompleted: false, day1: '培训中', trainingResult: '', trainingStart: day, trainingPassedDate: '', intent: '', accountCreatedAt: '', accountActive: null, contractSigned: null, materialsComplete: false, missingFields: ['尚未提交资料'], stage: '', enterpriseAccount: '' },
    { ...base('hr-7', '模拟第二天', 1837, [p2]), masterCreated: false, checklistCreated: false, checklistCompleted: false, trainingResult: '', trainingStart: offsetDate(day, -1), trainingPassedDate: '', intent: '', accountCreatedAt: '', accountActive: null, contractSigned: null, materialsComplete: false, missingFields: ['尚未提交资料'], stage: '', enterpriseAccount: '' },
    { ...base('hr-8', '模拟待确认入职', 1838), masterCreated: false, checklistCompleted: false, intent: '', contractSigned: false, stage: '' },
    { ...base('hr-9', '模拟待激活', 1839), masterCreated: false, checklistCompleted: false, accountActive: false, contractSigned: false, materialsComplete: false, missingFields: ['学历证明附件'], stage: '' },
    { ...base('hr-10', '模拟待关联资料', 1840), masterCreated: false, checklistCompleted: false, contractSigned: false, materialsComplete: null, missingFields: [], integrationIssue: '资料与候选人关联待核对，不属于员工漏填', stage: '' },
    { ...base('hr-11', '模拟培训淘汰', 1841), masterCreated: false, checklistCreated: false, checklistCompleted: false, trainingResult: '淘汰', subsidyDays: 1.5, subsidyAmount: 120, intent: '', stage: '' },
    { ...base('hr-12', '模拟培训储备', 1842), masterCreated: false, checklistCreated: false, checklistCompleted: false, trainingResult: '培训储备', intent: '', stage: '' },
  ];
  const external = [
    { id: 'ext-1', name: '模拟兼职方晴', employeeNo: 'EXT-DEMO-001', externalNo: 'EXT-DEMO-001', projectIds: [p1], category: '外部人员', employeeType: '兼职', current: true },
    { id: 'ext-2', name: '模拟兼职吴远', employeeNo: 'EXT-DEMO-002', externalNo: 'EXT-DEMO-002', projectIds: [p2], category: '外部人员', employeeType: '兼职', current: true },
    { id: 'ext-3', name: '模拟已离项', employeeNo: 'EXT-DEMO-003', externalNo: 'EXT-DEMO-003', projectIds: [], category: '外部人员', employeeType: '兼职', current: false },
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
    { id: 'intake-demo-1', serial: 'ZL-DEMO-001', requestId: 'demo-request-1', values: { ...demoIntake('模拟待关联资料', '模拟电话-1840'), recruitmentNo: '招聘-模拟-1840' }, candidateId: '', submittedAt: now, complete: true, status: '未关联', submitter: '' },
    { id: 'intake-demo-2', serial: 'ZL-DEMO-002', requestId: 'demo-request-2', values: { ...demoIntake('模拟独立填报', '模拟电话-独立'), recruitmentNo: '招聘-模拟-1900' }, candidateId: '', submittedAt: now, complete: true, status: '未关联', submitter: '' },
  ];
  return { schema: 1, revision: 1, people, external, intakes, departments, locations, positions, projects, outputs, attendance, audit: [], nextEmployeeNumber: 1843, nextIntakeNumber: 3, sync: { status: '演示快照', lastSuccess: now, cadenceMinutes: 30, note: '尚未连接 MMOS1、飞书账号、审批及合同结果接口' } };
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
  if (!project || !HR_ROLES.includes(role)) return false;
  if (role === 'PM') return project.pm === '王然';
  if (role === '项目助理') return project.pa === '林晓彤';
  if (role === '财务') return ['ZJ20260910922', 'ZJ20260911880'].includes(project.id);
  return true;
}
export function canHrTrain(role, person, state = loadHr()) {
  role = normalizeRole(role);
  const trainingProjectId = person.trainingProjectId || person.projectIds[0];
  return role === HR_ROLE || role === 'PM' && state.projects.some(p => p.id === trainingProjectId && p.pm === '王然');
}

const PERSON_FIELDS = ['id', 'name', 'employeeNo', 'recruitmentNo', 'category', 'projectIds', 'departmentId', 'positionId', 'locationId', 'manager', 'employeeType', 'stage', 'gender', 'phone', 'email', 'enterpriseAccount', 'personalAccount', 'trainingStart', 'entryDate', 'probationDate', 'firstWorkDate', 'day1', 'trainingResult', 'subsidyDays', 'subsidyAmount', 'subsidyReview', 'accountCreatedAt', 'accountActive', 'contractSigned', 'materialsComplete', 'missingFields', 'intent', 'masterCreated', 'checklistCreated', 'checklistCompleted', 'specialPlans', 'trainingPassedDate', 'trainingConflict', 'downstreamReview', 'reviewReason', 'integrationIssue', 'exitFollowup', 'terminated', 'appliedPosition', 'recruiter'];
const pick = (object, fields) => Object.fromEntries(fields.filter(key => object[key] !== undefined).map(key => [key, clone(object[key])]));

export function getHrView(role, state = loadHr(), day = beijingToday()) {
  // Explicit-state callers get the same result as storage readers, without
  // mutating their snapshot or persisting anything during projection.
  state = reconcileHrState(state, day);
  role = normalizeRole(role);
  const known = HR_ROLES.includes(role);
  const projects = known ? state.projects.filter(p => canProject(role, p)) : [];
  const ids = new Set(projects.map(p => p.id));
  const visible = person => role === HR_ROLE || role === 'PMO' && person.projectIds.length > 0 || person.projectIds.some(id => ids.has(id));
  const projectNames = person => person.projectIds.filter(id => ids.has(id)).map(id => state.projects.find(p => p.id === id)?.name || id);
  const projectPerson = person => {
    const p = pick(person, [...PERSON_FIELDS, 'intakeId', 'intakeMatchStatus', 'intakeMatchIssue', 'intakeSerial']);
    p.projectIds = person.projectIds.filter(id => ids.has(id));
    // Compatibility for the initial preview seed only; never reset the user's
    // other persisted HR records or reinterpret actual missing document fields.
    if (p.id === 'hr-10' && p.missingFields?.length === 1 && p.missingFields[0] === '尚未关联已提交资料') {
      p.materialsComplete = null; p.missingFields = []; p.integrationIssue = '资料与候选人关联待核对，不属于员工漏填';
    }
    return { ...p, departmentName: state.departments.find(d => d.id === p.departmentId)?.name || '待确认', positionName: state.positions.find(d => d.id === p.positionId)?.name || '待确认', locationName: state.locations.find(d => d.id === p.locationId)?.name || '未指定', projectNames: projectNames(person), trainingStage: trainingStage(person), employmentStatus: employmentStatus(person, day), checklistStatus: checklistStatus(person), anomalies: hrAnomalies(person), masterAnomalies: person.contractSigned === false ? ['合同未签署'] : [], tenureDays: tenureDays(person, day), stage: person.employeeType === '劳务返聘' ? '劳务返聘' : person.stage || '待确认', canTrain: canHrTrain(role, person, state), accountReview: person.accountActive == null && person.checklistCreated ? '激活结果待核对' : '', contractReview: person.contractSigned == null && person.checklistCreated ? '合同结果待核对' : '' };
  };
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
    candidates: role === HR_ROLE ? state.people.filter(p => p.candidate).map(person => ({ ...projectPerson(person), ...pick(person, ['sourceSystem', 'sourceId', 'sourceReadAt', 'sourceSnapshot', 'arrivalDate', 'school', 'education', 'major', 'graduation', 'english', 'candidateNote']) })) : [],
    onboarding: role === HR_ROLE ? scopePeople.filter(p => p.checklistCreated) : [],
    intakes: clone(intakes).map(intake => {
      const person = state.people.find(p => p.id === intake.candidateId);
      return { ...intake, recruitmentNo: clean(intake.values.recruitmentNo), name: intake.values.name, phone: intake.values.phone, employeeNo: person?.employeeNo || '', enterpriseAccount: person?.enterpriseAccount || '', accountActive: person?.accountActive ?? null };
    }), external, projects: clone(projects),
    departments: known ? clone(state.departments) : [], locations: known ? clone(state.locations) : [], positions: known ? clone(state.positions) : [],
    outputs: state.outputs.filter(o => ids.has(o.projectId)).map(annotateOutput), attendance: state.attendance.filter(o => ids.has(o.projectId)).map(annotateOutput),
    audit: role === HR_ROLE ? clone(state.audit) : [], reminderPlan: hrReminderPlan(day),
  };
}

function audit(state, role, type, objectId, before, after, reason = '') {
  // The caller only passes explicit business metadata, never whole intake values.
  state.audit.unshift({ id: makeId('audit'), actor: role, type, objectId, at: new Date().toISOString(), before, after, reason, result: '成功' });
}

function reconcileOnboarding(person, day = beijingToday()) {
  if (!person.checklistCreated || person.terminated || ['离职中', '已离职'].includes(employmentStatus(person, day))) return;
  if (person.intent === '不入职') {
    if (person.masterCreated) person.exitFollowup = '先补齐合同，按飞书有效离职审批处理；实际出勤结算另行衔接';
    else if (person.accountActive === false) {
      person.terminated = true;
      person.exitFollowup = '账号清理待接入；培训补贴160元为应发，尚未支付';
      if (person.subsidyAmount == null) { person.subsidyDays = 2; person.subsidyAmount = 160; person.subsidySource = '未入主库退出'; }
      else person.downstreamReview = '已有同次培训应发，保留原记录待核对，未重复生成';
    } else person.exitFollowup = '等待飞书有效离职审批及获批日期，暂不终止、清理或生成应发';
    return;
  }
  if (!person.masterCreated && trainingStage(person) === '第2天通过' && person.intent === '确认入职' && person.accountActive === true && person.materialsComplete === true && !person.reviewReason && !person.integrationIssue && !person.intakeMatchIssue) {
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

export function reconcileHrState(previous, day = beijingToday()) {
  const state = clone(previous);
  reconcileHrMatches(state, day);
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
    if (role === 'PM') requireRule(['第1天', '第2天'].includes(priorStage), '已评定结果须由人事核对更正');
    if (payload.day1 != null) {
      requireRule(['通过', '淘汰', '培训中'].includes(payload.day1), '第一天状态无效');
      if (role === 'PM') requireRule(priorStage === '第1天' && ['通过', '淘汰'].includes(payload.day1), '请在对应第一天培训阶段操作');
      person.day1 = payload.day1;
    }
    if (payload.result != null) {
      requireRule(['通过', '淘汰', '培训储备', ''].includes(payload.result), '第二天评定结果无效');
      if (role === 'PM') requireRule(priorStage === '第2天', '第一天通过后方可评定第二天');
      requireRule(person.day1 === '通过' || !payload.result, '第二天评定必须有第一天通过依据');
      person.trainingResult = payload.result;
    }
    requireRule(person.day1 === '通过' || !person.trainingResult, '两天状态互相矛盾，请一并核对更正');
    const eliminated = person.day1 === '淘汰' || person.trainingResult === '淘汰';
    if (eliminated) {
      const value = payload.subsidyDays ?? person.subsidyDays;
      requireRule(value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) * 2 === Math.round(Number(value) * 2), '淘汰补贴须填写有效实际天数，支持0.5天，不能为负数');
      person.subsidyDays = Number(value);
      person.subsidyAmount = person.subsidyDays > 0 ? person.subsidyDays * 80 : null;
      person.subsidyReview = person.subsidyDays === 0 ? '0天发放口径待核对，未生成有效应发' : '';
    } else if (payload.subsidyDays != null) throw new Error('仅淘汰记录可维护此项补贴天数');
    if (person.trainingResult === '通过' && person.day1 === '通过') person.checklistCreated = true;
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
    const before = pick(person, ['intent', 'locationId', 'masterCreated', 'terminated']);
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
      const fields = collection === 'departments' ? ['name', 'parentId', 'status', 'sort', 'note'] : collection === 'locations' ? ['name', 'address', 'status', 'validity', 'startDate', 'endDate', 'note'] : ['name', 'departmentId', 'manager', 'status', 'validity', 'startDate', 'endDate', 'keyType', 'bonusLevel'];
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
  reconcileHrMatches(state);
  state.revision = previous.revision + 1;
  return state;
}

export function hrAction(role, type, payload = {}) {
  const previous = loadHr();
  const next = reduceHrAction(previous, role, type, payload);
  // Commit only after every validation succeeds. Quota/serialization errors are
  // propagated to the UI, preserving its draft and the last committed store.
  if (typeof localStorage === 'undefined') memoryStore = next;
  else localStorage.setItem(HR_KEY, JSON.stringify(next));
  listeners.forEach(listener => listener());
  return getHrView(role, next);
}

// Adapter model for future source integration, not wired to a pretend sync UI.
export function mergeHrSource(previous, rows, day = beijingToday()) {
  const state = clone(previous);
  const conflict = (source, reason) => {
    const issue = { sourceId: clean(source.sourceId), recruitmentNo: clean(source.recruitmentNo), reason };
    state.sync.conflicts ||= [];
    if (!state.sync.conflicts.some(item => JSON.stringify(item) === JSON.stringify(issue))) state.sync.conflicts.push(issue);
  };
  for (const source of rows) {
    if (!source.sourceId || source.arrivalDate !== day || source.day1 !== '培训中' || !source.appliedPosition || source.appliedPosition === '兼职') continue;
    const old = state.people.find(p => p.sourceSystem === 'MMOS1' && p.sourceId === source.sourceId);
    const recruitmentNo = clean(source.recruitmentNo);
    if (recruitmentNo && state.people.some(p => p.id !== old?.id && clean(p.recruitmentNo) === recruitmentNo)) {
      conflict(source, '招聘编号已属于另一来源记录，保留原人员，不导入重复记录'); continue;
    }
    if (old) {
      if (clean(old.recruitmentNo) && recruitmentNo && clean(old.recruitmentNo) !== recruitmentNo) {
        conflict(source, '同一来源记录的招聘编号发生变化，保留原编号与关联，待核对'); continue;
      }
      if (!clean(old.recruitmentNo) && recruitmentNo) old.recruitmentNo = recruitmentNo;
      const snapshot = { day1: source.day1, trainingResult: source.trainingResult };
      if (JSON.stringify(snapshot) !== JSON.stringify(old.sourceSnapshot)) { old.sourceSnapshot = snapshot; old.sourceReadAt = new Date().toISOString(); }
      continue;
    }
    const result = source.trainingResult === '培训储备-需一本及以上' ? '培训储备' : source.trainingResult || '';
    state.people.push({ ...pick(source, ['name', 'sourceId', 'arrivalDate', 'appliedPosition', 'phone', 'email', 'trainingStart']), recruitmentNo, id: makeId('candidate'), employeeNo: `MCE${String(state.nextEmployeeNumber++).padStart(8, '0')}`, sourceSystem: 'MMOS1', candidate: true, category: '内部人员', projectIds: (source.projectIds || []).filter(id => state.projects.some(p => p.id === id)), day1: source.day1, trainingResult: result, trainingConflict: !!result && result !== '待确定', sourceSnapshot: { day1: source.day1, trainingResult: source.trainingResult }, sourceReadAt: new Date().toISOString(), masterCreated: false, checklistCreated: false, materialsComplete: false, missingFields: ['尚未关联资料'], accountActive: null, contractSigned: null, intent: '', specialPlans: [] });
  }
  reconcileHrMatches(state, day);
  if (JSON.stringify(state) !== JSON.stringify(previous)) state.revision = previous.revision + 1;
  return state;
}
