import { populateStaffingRosters } from './hrStaffingRosters.js';
import { beijingToday, employmentStatus, getHrView, HR_KEY, loadHr, projectHrPersonDetail, reconcileHrState, updateHrWorkspace } from './hrWorkspace.js';
import { displayText } from './displayText.js';

const clone = value => JSON.parse(JSON.stringify(value));
const check = (condition, message) => { if (!condition) throw new Error(message); };
const id = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const isIntern = person => ['实习生', '在校实习生'].includes(person.employeeType);
const eligible = (person, day) => person.category === '内部人员' && (person.employeeType === '全职' || isIntern(person)) && !person.terminated && employmentStatus(person, day) !== '已离职';

// Explicit preview configuration. A person's department does not determine the
// delivery line used by project transfers.
export const TRANSFER_MANAGERS = [
  { id: 'pm-wang-ran', name: '王然', lineId: 'line-general', lineName: '通用评测交付线' },
  { id: 'pm-lin-xiaotong', name: '林晓彤', lineId: 'line-general', lineName: '通用评测交付线' },
  { id: 'pm-chen-mo', name: '陈默', lineId: 'line-language', lineName: '多语种交付线' },
  { id: 'pm-li-xiang', name: '李想', lineId: 'line-language', lineName: '多语种交付线' },
];

const daysBefore = (day, count) => new Date(Date.parse(day + 'T12:00:00Z') - count * 86400000).toISOString().slice(0, 10);
const profileVersion = 2;
const sampleProfiles = {
  'hr-transfer-pool': { name: '沈宁', oldName: '待提取沈宁', abilityTags: ['文本标注', '中文语义理解'], english: 'CET4', school: '重庆师范大学', major: '汉语言文学', graduation: '2027年6月' },
  'hr-transfer-intern': { name: '周禾', oldName: '多项目周禾', abilityTags: ['文本标注', '数据质检'], english: 'CET6', school: '西南大学', major: '汉语言文学', graduation: '2027年6月' },
  'hr-transfer-chen-intern': { name: '叶青', oldName: '多语种叶青', abilityTags: ['英语评测', '多语种内容审核'], english: 'CET6', school: '四川外国语大学', major: '英语', graduation: '2027年6月' },
  'hr-transfer-fulltime': { name: '林澄', oldName: '调配林澄', abilityTags: ['语义评测', '标注质量复核'], english: 'CET6', school: '重庆邮电大学', major: '计算机科学与技术', graduation: '2023年6月' },
  'hr-available-lin': { name: '方知远', abilityTags: ['文本评测', '质量复核'], english: 'CET4', school: '重庆理工大学', major: '信息管理与信息系统', graduation: '2022年6月' },
};

function completeTransferSamples(state) {
  if (state.transfers.profileSamplesVersion === profileVersion) return state;
  for (const person of state.people) {
    const profile = sampleProfiles[person.id];
    if (!profile || person.demo !== true || person.sourceId !== person.id || !['人员调配', '调配演示'].includes(person.sourceSystem)) continue;
    const { name, oldName, ...fields } = profile;
    if (oldName && person.name === oldName) person.name = name;
    person.archive ||= {};
    for (const [field, value] of Object.entries({ ...fields, education: '本科' })) {
      if ([person, person.intakeProfile || {}].some(source => Object.hasOwn(source, field))) continue;
      const existing = person.archive[field];
      const oldDefault = field === 'school' && ['示例大学', '示例外国语大学'].includes(existing)
        || field === 'education' && existing === '本科在读';
      if (oldDefault || !Object.hasOwn(person.archive, field)) person.archive[field] = clone(value);
    }
    // Only the original built-in pool entry has this known source. Never infer
    // a former manager from a current assignment or change a later pool entry.
    if (person.id !== 'hr-transfer-pool' || person.transferControl?.operationId !== 'transfer-pool-seed' || person.projectIds.length) continue;
    const entry = state.transfers.pool.find(row => row.personId === person.id && row.operationId === 'transfer-pool-seed');
    if (!entry || entry.sourceProjectIds?.length || entry.sourceProjectNames?.length || entry.actorId || entry.formerPmId || entry.formerPmName || person.endedProjectRelations?.length) continue;
    Object.assign(entry, { sourceProjectIds: ['DEMO-TRANSFER-WR-01'], sourceProjectNames: ['语义评测协作项目'], actorId: 'pm-wang-ran', formerPmId: 'pm-wang-ran', formerPmName: '王然' });
    person.endedProjectRelations = [{ projectId: entry.sourceProjectIds[0], endedDate: entry.enteredAt.slice(0, 10), reason: '调休入池', evidence: entry.operationId }];
  }
  state.transfers.profileSamplesVersion = profileVersion;
  return state;
}

// Fixed IDs plus a one-time migration keep claimed interns out of the pool on reload.
const poolExamples = [
  ['lin-shuyan', '林书妍', 'pm-wang-ran', /语义|客服/, '西南大学', '汉语言文学', 'CET6', ['语义评测', '意图分类']],
  ['xu-jingzhou', '许景舟', 'pm-wang-ran', /OCR|数学/i, '重庆邮电大学', '计算机科学与技术', 'CET4', ['公式标注', 'OCR识别复核']],
  ['shen-qinghe', '沈清禾', 'pm-lin-xiaotong', /语音|语料/, '重庆师范大学', '广播电视学', 'CET4', ['语音转写', '音频切分']],
  ['gu-yiran', '顾以然', 'pm-lin-xiaotong', /评测/, '重庆理工大学', '信息管理与信息系统', 'CET6', ['标注质量复核', '评测结果校验']],
  ['he-xinyue', '何欣玥', 'pm-chen-mo', /海外|多语种/, '四川外国语大学', '英语', 'CET6', ['英语内容审核', '双语文本校对']],
  ['jiang-yucheng', '蒋予澄', 'pm-chen-mo', /图像|质检/, '重庆大学', '软件工程', 'CET4', ['图像质检', '目标框标注']],
  ['tang-ningan', '唐宁安', 'pm-li-xiang', /双语|海外/, '西南大学', '翻译', 'CET6', ['双语语料对齐', '译文评测']],
  ['cheng-zhixia', '程知夏', 'pm-li-xiang', /语料|多语种/, '四川外国语大学', '日语', 'CET4', ['日语语料清洗', '多语种文本标注']],
];

function completeStaffingExamples(state, day) {
  populateStaffingRosters(completeTransferSamples(initializeAvailability(state, day)), day);
  if (state.transfers.internPoolSamplesVersion >= 1) return state;
  poolExamples.forEach(([slug, name, pmId, match, school, major, english, abilityTags], index) => {
    const personId = 'hr-pool-intern-' + slug;
    const pm = state.transfers.managers.find(row => row.id === pmId);
    const projects = pm && state.projects.filter(row => row.pm === pm.name);
    const project = projects?.find(row => match.test(row.name)) || projects?.[0];
    if (!project || state.people.some(row => row.id === personId)) return;
    const n = state.nextEmployeeNumber++;
    const operationId = 'pool-entry-' + slug, endedDate = daysBefore(day, 1 + index);
    const enteredAt = endedDate + 'T16:30:00+08:00', entryDate = daysBefore(day, 43 + index * 3);
    const language = pm.lineId === 'line-language';
    state.people.push({ id: personId, sourceId: personId, sourceSystem: '人员调配', demo: true,
      employeeNo: 'MCE' + String(n).padStart(8, '0'), recruitmentNo: 'ZP-' + n, name, employeeType: '在校实习生',
      category: '内部人员', stage: '实习期', projectIds: [], departmentId: language ? 'dept-9-2' : 'dept-9-5',
      positionId: language ? 'pos-2' : 'pos-1', locationId: 'loc-1', manager: '', masterCreated: true,
      trustedEmploymentStatus: '在职', accountActive: true, candidate: false, checklistCreated: true,
      checklistCompleted: true, contractSigned: true, materialsComplete: true, missingFields: [], specialPlans: [],
      entryDate, arrivalDate: entryDate, trainingStart: entryDate, day1: '通过', trainingResult: '通过',
      archive: { school, major, english, abilityTags: [...abilityTags], education: '本科', graduation: '2027年6月' },
      endedProjectRelations: [{ projectId: project.id, endedDate, reason: '调休入池', evidence: operationId }],
      transferControl: { operationId, effectiveDate: endedDate, changedAt: enteredAt, pool: true },
    });
    state.transfers.pool.push({ personId, enteredAt, sourceProjectNames: [project.name], sourceProjectIds: [project.id],
      actorId: pm.id, formerPmId: pm.id, formerPmName: pm.name, operationId });
  });
  state.transfers.internPoolSamplesVersion = 1;
  return state;
}

export function initializeTransferState(previous, day = beijingToday()) {
  const state = clone(previous);
  if (state.transfers?.version === 1) {
    return completeStaffingExamples(state, day);
  }
  state.transfers = { version: 1, managers: clone(TRANSFER_MANAGERS), history: [], approvals: [], notifications: [], pool: [] };
  const projects = [
    { id: 'DEMO-TRANSFER-WR-01', name: '语义评测协作项目', pm: '王然', pa: '梁禾', qa: '郭安宁' },
    { id: 'DEMO-TRANSFER-LXT-01', name: '通用评测承接项目', pm: '林晓彤', pa: '陈雨舒', qa: '夏芷' },
    { id: 'DEMO-TRANSFER-CM-01', name: '多语种承接项目', pm: '陈默', pa: '林璐', qa: '谢安然' },
  ];
  for (const project of projects) {
    if (!state.projects.some(existing => existing.id === project.id)) state.projects.push({ ...project, projectNo: project.id, ended: false, demo: true });
  }
  const samples = [
    { id: 'hr-transfer-fulltime', name: '林澄', employeeType: '全职', projectIds: [projects[0].id] },
    { id: 'hr-transfer-intern', name: '周禾', employeeType: '在校实习生', projectIds: [projects[0].id] },
    { id: 'hr-transfer-pool', name: '沈宁', employeeType: '在校实习生', projectIds: [] },
    { id: 'hr-transfer-chen-intern', name: '叶青', employeeType: '在校实习生', projectIds: [projects[2].id] },
  ];
  for (const sample of samples) {
    if (state.people.some(person => person.id === sample.id)) continue;
    const number = state.nextEmployeeNumber++;
    const entryDate = daysBefore(day, isIntern(sample) ? 36 : 112);
    state.people.push({
      ...sample, employeeNo: `MCE${String(number).padStart(8, '0')}`, recruitmentNo: `招聘-调配演示-${number}`,
      category: '内部人员', sourceSystem: '人员调配', sourceId: sample.id, demo: true,
      departmentId: sample.id === 'hr-transfer-chen-intern' ? 'dept-9-2' : 'dept-9-5',
      positionId: sample.id === 'hr-transfer-chen-intern' ? 'pos-2' : 'pos-1', locationId: 'loc-1',
      manager: sample.id === 'hr-transfer-chen-intern' ? '陈默' : '王然', stage: isIntern(sample) ? '实习期' : '正式',
      masterCreated: true, trustedEmploymentStatus: '在职', contractSigned: true, checklistCreated: true,
      checklistCompleted: true, accountActive: true, materialsComplete: true, missingFields: [],
      day1: '通过', trainingResult: '通过', trainingStart: entryDate, arrivalDate: entryDate, entryDate,
      specialPlans: [], candidate: false,
    });
  }
  const pooled = state.people.find(person => person.id === 'hr-transfer-pool');
  if (pooled.projectIds.length === 0) {
    const enteredAt = `${day}T00:00:00+08:00`;
    pooled.transferControl = { operationId: 'transfer-pool-seed', effectiveDate: day, changedAt: enteredAt, pool: true };
    state.transfers.pool.push({ personId: pooled.id, enteredAt, sourceProjectNames: [], sourceProjectIds: [], actorId: '', operationId: 'transfer-pool-seed' });
  }
  return completeStaffingExamples(state, day);
}

function initializeAvailability(state, day) {
  if (Array.isArray(state.transfers.available)) return state;
  state.transfers.available = [];
  // Isolated example: never move an existing employee or assign a missing source.
  const personId = 'hr-available-lin', project = state.projects.find(p => p.id === 'DEMO-TRANSFER-LXT-01');
  const owner = state.transfers.managers.find(m => m.name === project?.pm);
  if (!owner || state.people.some(p => p.id === personId)) return state;
  const enteredAt = day + 'T00:00:00+08:00', operationId = 'available-seed-lin';
  state.people.push({ id: personId, name: '方知远', employeeNo: 'MCE' + String(state.nextEmployeeNumber++).padStart(8, '0'),
    sourceSystem: '人员调配', sourceId: personId, demo: true, category: '内部人员', employeeType: '全职',
    projectIds: [], departmentId: 'dept-9-5', positionId: 'pos-1', manager: owner.name, stage: '正式',
    masterCreated: true, trustedEmploymentStatus: '在职', entryDate: daysBefore(day, 180), accountActive: true, specialPlans: [],
    archive: { abilityTags: ['文本评测', '质量复核'] },
    endedProjectRelations: [{ projectId: project.id, endedDate: day, reason: '释放至可分配人员', evidence: operationId }],
    transferControl: { operationId, effectiveDate: day, changedAt: enteredAt, pool: false } });
  state.transfers.available.push({ key: operationId, personId, ownerId: owner.id, ownerName: owner.name, visible: true, enteredAt, sources: [{ id: project.id, name: project.name }] });
  return state;
}

function projectDirectory(state) {
  return state.projects.map(project => {
    const pm = state.transfers.managers.find(manager => manager.name === project.pm);
    return { ...project, pmId: pm?.id || '', pmName: project.pm, lineId: pm?.lineId || '', lineName: pm?.lineName || 'PM交付线待配置' };
  });
}

function personSummary(person) {
  return { personId: person.id, name: person.name, employeeNo: person.employeeNo, employeeType: person.employeeType, intern: isIntern(person) };
}

function readTransferState(previous) {
  let state = previous;
  if (!state) {
    state = loadHr();
    if (!state.transfers?.internPoolSamplesVersion || !state.transfers.staffingVersion || state.transfers.profileSamplesVersion !== profileVersion || !Array.isArray(state.transfers.available)) state = updateHrWorkspace(current => initializeTransferState(current));
  }
  return reconcileHrState(initializeTransferState(state));
}

function profileText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(profileText).filter(Boolean).join('、');
  if (value && typeof value === 'object') return profileText(value.label ?? value.name ?? value.value ?? value.text);
  return '';
}

function selectionProfile(person) {
  const tags = Array.isArray(person.abilityTags) ? person.abilityTags : [person.abilityTags];
  return {
    abilityTags: [...new Set(tags.flatMap(value => profileText(value).split(/[、,，;；\n]/)).map(value => value.trim()).filter(Boolean))],
    english: profileText(person.english), education: profileText(person.education),
    school: profileText(person.school), major: profileText(person.major),
  };
}

function projectExperience(person, state, visibleProjectIds) {
  const ids = [...new Set([...person.projectIds, ...(person.endedProjectRelations || []).map(row => row.projectId)])];
  return ids.filter(id => !visibleProjectIds || visibleProjectIds.has(id)).map(id => ({ id, name: state.projects.find(project => project.id === id)?.name || id }));
}

function formerPmSnapshot(entry, state) {
  const recordedText = value => typeof value === 'string' ? value.trim() : '';
  const operation = state.transfers.history.find(row => row.id === entry.operationId && row.type === 'pool.enter' && row.items?.some(item => item.personId === entry.personId));
  const storedId = recordedText(entry.formerPmId);
  const operationId = recordedText(operation?.actorId);
  const formerPmId = storedId || operationId || recordedText(entry.actorId);
  const matchingSnapshot = !storedId || !operationId || storedId === operationId;
  return {
    formerPmId,
    formerPmName: recordedText(entry.formerPmName) || (matchingSnapshot ? recordedText(operation?.actorName) : ''),
  };
}

export function getTransferView(actorId = 'pm-wang-ran', role = 'PM', previous) {
  const state = readTransferState(previous);
  const actor = state.transfers.managers.find(manager => manager.id === actorId);
  const canOperate = role === 'PM' && !!actor;
  const directory = projectDirectory(state);
  const existingScope = role === 'PM' ? null : getHrView(role, state);
  const visibleProjectIds = new Set(role === 'PM' ? directory.filter(project => actor && project.lineId === actor.lineId).map(project => project.id) : existingScope.projects.map(project => project.id));
  const visiblePeople = new Set(existingScope?.people.map(person => person.id) || []);
  const rows = [...state.people, ...state.external.filter(person => person.current)].flatMap(person => person.projectIds.filter(projectId => visibleProjectIds.has(projectId)).map(sourceProjectId => {
    const project = directory.find(row => row.id === sourceProjectId);
    const allowed = eligible(person, beijingToday()) && !project.ended && !person.transferControl?.pool;
    const own = canOperate && project.pmId === actor.id;
    const currentProjectIds = own ? person.projectIds : person.projectIds.filter(projectId => visibleProjectIds.has(projectId));
    return {
      ...personSummary(person), key: `${person.id}:${sourceProjectId}`, sourceProjectId, sourceProjectName: project.name,
      pmId: project.pmId, pmName: project.pmName, projectIds: [...currentProjectIds],
      currentProjects: currentProjectIds.map(projectId => ({ id: projectId, name: directory.find(row => row.id === projectId)?.name || projectId })), eligible: allowed,
      canTransfer: own && allowed, canEnterPool: own && allowed && isIntern(person),
      reason: !allowed ? '仅在项且未离职的全职员工、实习生可调配' : !own ? '仅所属PM可以操作' : '',
    };
  }));
  const visibleOperation = entry => role === 'PM' ? entry.actorId === actorId || entry.targetPmId === actorId || entry.sourceOwnerId === actorId : entry.items?.some(item => visibleProjectIds.has(item.sourceProjectId)) || visibleProjectIds.has(entry.targetProjectId);
  const projectOperation = entry => role === 'PM' ? clone(entry) : { ...clone(entry), items: entry.items.filter(item => visibleProjectIds.has(item.sourceProjectId) || visibleProjectIds.has(entry.targetProjectId)) };
  const history = state.transfers.history.filter(visibleOperation).map(projectOperation).reverse();
  const operationIds = new Set(state.transfers.history.filter(entry => visibleOperation(entry) && (role === 'PM' || entry.items.every(item => visibleProjectIds.has(item.sourceProjectId) || visibleProjectIds.has(entry.targetProjectId)))).map(entry => entry.id));
  const pool = state.transfers.pool.flatMap(entry => {
    const person = state.people.find(row => row.id === entry.personId);
    if (!person || !eligible(person, beijingToday()) || !isIntern(person) || !person.transferControl?.pool || person.projectIds.length || role === 'PM' && !actor || role !== 'PM' && !visiblePeople.has(person.id)) return [];
    const sourceProjectIds = role === 'PM' ? entry.sourceProjectIds : entry.sourceProjectIds.filter(projectId => visibleProjectIds.has(projectId));
    const experience = projectExperience(person, state, role === 'PM' ? null : visibleProjectIds);
    const detail = projectHrPersonDetail(person, role, state, new Set(experience.map(project => project.id)));
    return [{
      ...personSummary(person), ...entry, ...formerPmSnapshot(entry, state), ...selectionProfile(detail), projectExperience: experience,
      sourceProjectIds, sourceProjectNames: sourceProjectIds.map(projectId => directory.find(project => project.id === projectId)?.name || projectId),
      canClaim: canOperate, lineId: '', lineName: '自由人',
    }];
  });
  const available = state.transfers.available.flatMap(entry => {
    const person = state.people.find(p => p.id === entry.personId);
    const own = canOperate && entry.ownerId === actorId;
    if (!person || person.employeeType !== '全职' || !eligible(person, beijingToday()) || !own && (!entry.visible || (role === 'PM' ? !actor : !visiblePeople.has(person.id)))) return [];
    const experience = projectExperience(person, state, visibleProjectIds);
    const projected = projectHrPersonDetail(person, role, state, new Set(experience.map(p => p.id)));
    return [{ ...personSummary(person), ...selectionProfile(projected), ...clone(entry), canManage: own,
      sourceProjectNames: entry.sources.map(p => p.name), projectExperience: experience,
      assignedProjectIds: own ? [...person.projectIds] : [], canClaimAvailable: canOperate && !own && entry.visible === true && !person.projectIds.length, canClaim: false }];
  });
  return {
    revision: state.revision, role, actor: actor ? clone(actor) : null, canOperate,
    managers: clone(state.transfers.managers), projects: role === 'PM' ? directory : directory.filter(project => visibleProjectIds.has(project.id)),
    lineProjects: directory.filter(project => actor && project.lineId === actor.lineId && !project.ended && visibleProjectIds.has(project.id)),
    rows, pool, available, history, approvals: state.transfers.approvals.filter(visibleOperation).map(projectOperation).reverse(),
    notifications: state.transfers.notifications.filter(entry => operationIds.has(entry.operationId)).slice().reverse(),
  };
}

export function getPoolPersonDetails(actorId, role, personId, previous) {
  const state = readTransferState(previous);
  const poolView = getTransferView(actorId, role, state);
  const intern = poolView.pool.find(row => row.personId === personId);
  const entry = intern || poolView.available.find(row => row.personId === personId);
  if (!entry) return null;
  const source = state.people.find(person => person.id === personId);
  const normalView = getHrView(role, state);
  const projectIds = new Set(entry.projectExperience.map(project => project.id));
  const projected = projectHrPersonDetail(source, role, state, projectIds);
  const person = {
    ...projected, ...selectionProfile(projected), projectExperience: entry.projectExperience,
    ...(intern ? { formerPmId: entry.formerPmId, formerPmName: entry.formerPmName,
    canTrain: false, poolState: '自由人', projectIds: [], projectNames: [], manager: '',
    projectManagerSource: '', attendanceManagerSource: '', deliveryLine: '自由人', deliveryLineAuto: '', deliveryLineBackup: '', deliveryLineNote: '',
    } : { canTrain: false }),
  };
  const actorProjects = new Set(normalView.projects.filter(project => role !== 'PM' || project.pm === poolView.actor?.name).map(project => project.id));
  const ownAuthorizedRecord = row => row.personId === personId && actorProjects.has(row.projectId);
  return {
    person,
    view: {
      revision: state.revision, role, today: normalView.today, people: [person], projectPeople: [],
      projects: clone(entry.projectExperience), outputs: normalView.outputs.filter(ownAuthorizedRecord),
      attendance: normalView.attendance.filter(ownAuthorizedRecord), audit: [],
    },
  };
}

function feishuApprovalUrl(source, value) {
  if (!/飞书|feishu|lark/i.test(source) || typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)(feishu\.cn|larksuite\.com)$/.test(url.hostname) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

// History uses recorded snapshots. Current personnel/project/manager names and
// delivery-line configuration cannot establish missing historical facts.
export function initializeDeliveryLineSources(previous, day = beijingToday()) {
  const state = clone(previous);
  if (state.deliveryLinePreviewVersion >= 1) return state;
  state.deliveryLineRecords ||= [];
  const sample = state.people.find(person => person.id === 'hr-1' && person.employeeNo === 'MCE00001831' && person.sourceId === 'demo-source-hr-1' && person.sourceSystem === 'MMOS1' && person.masterCreated);
  if (sample && !state.deliveryLineRecords.some(record => record.id === 'delivery-line-source-preview-001')) {
    state.deliveryLineRecords.push({
      id: 'delivery-line-source-preview-001', approvalSource: '审批记录快照', sourceRecordId: '交付线变更快照-001',
      requesterName: '王然', status: '审批中', requestedAt: `${day}T09:00:00+08:00`, effectiveDate: '',
      items: [
        { personId: 'hr-1', name: '林悦', employeeNo: 'MCE00001831', employeeType: '全职',
          sourceProjectId: 'ZJ20260910922', sourceProjectNo: 'ZJ20260910922', sourceProjectName: '星河智能客服项目',
          sourcePmId: 'pm-wang-ran', sourcePmName: '王然', sourceLineId: 'line-general', sourceLineName: '通用评测交付线',
          targetProjectId: 'ZJ20260911880', targetProjectNo: 'ZJ20260911880', targetProjectName: '海外内容审核产线',
          targetPmId: 'pm-chen-mo', targetPmName: '陈默', targetLineId: 'line-language', targetLineName: '多语种交付线' },
        { personId: 'hr-1', name: '林悦', employeeNo: 'MCE00001831', employeeType: '全职',
          sourceProjectId: 'ZJ20260913041', sourceProjectNo: 'ZJ20260913041', sourceProjectName: '数学 OCR 试标项目',
          sourcePmId: 'pm-wang-ran', sourcePmName: '王然', sourceLineId: 'line-general', sourceLineName: '通用评测交付线',
          targetProjectId: 'DEMO-TRANSFER-CM-01', targetProjectNo: 'DEMO-TRANSFER-CM-01', targetProjectName: '多语种承接项目',
          targetPmId: 'pm-chen-mo', targetPmName: '陈默', targetLineId: 'line-language', targetLineName: '多语种交付线' },
      ],
      reason: '跨项目交付资源安排',
    });
  }
  state.deliveryLinePreviewVersion = 1;
  return state;
}

export function getDeliveryLineChanges(role = '人事', previous) {
  if (!['人事', 'HR'].includes(role)) return { role, canView: false, rows: [] };
  let state = previous || loadHr();
  if (!previous && !state.deliveryLinePreviewVersion) state = updateHrWorkspace(current => initializeDeliveryLineSources(current));
  const approvals = [...(state.transfers?.approvals || []), ...(state.deliveryLineRecords || [])];
  const rows = approvals.flatMap((approval, approvalIndex) => {
    return (approval.items || []).map((item, itemIndex) => {
      const snapshot = field => item[field] ?? approval[field] ?? '';
      const inheritsProject = side => {
        const idField = `${side}ProjectId`;
        const numberField = `${side}ProjectNo`;
        return !(item[idField] && approval[idField] && item[idField] !== approval[idField]) &&
          !(item[numberField] && approval[numberField] && item[numberField] !== approval[numberField]);
      };
      const projectSnapshot = (side, field) => item[field] ?? (inheritsProject(side) ? approval[field] : '') ?? '';
      const source = item.approvalSource ?? approval.approvalSource ?? approval.sourceSystem ?? (typeof approval.source === 'string' ? approval.source : approval.source?.name) ?? '';
      const url = item.approvalUrl ?? approval.approvalUrl ?? approval.sourceUrl ?? approval.url ?? approval.source?.url;
      return {
        key: `${approval.id || approvalIndex}:${item.personId || itemIndex}:${snapshot('sourceProjectId')}:${snapshot('targetProjectId')}:${itemIndex}`,
        approvalId: approval.id || '', approvalNo: displayText(snapshot('approvalNo')),
        sourceRecordId: snapshot('sourceRecordId') || approval.source?.recordId || '',
        sourceRecordNo: displayText(snapshot('sourceRecordNo') || approval.source?.recordNo || ''),
        requesterId: approval.requesterId || approval.actorId || '', requesterName: displayText(approval.requesterName || approval.actorName || ''),
        personId: item.personId || '', name: displayText(item.name || ''), employeeNo: displayText(item.employeeNo || ''),
        employeeType: item.employeeType || '',
        sourceProjectId: snapshot('sourceProjectId'), sourceProjectNo: displayText(projectSnapshot('source', 'sourceProjectNo')), sourceProjectName: displayText(projectSnapshot('source', 'sourceProjectName')),
        sourcePmId: item.sourcePmId ?? (inheritsProject('source') ? approval.sourcePmId ?? approval.actorId ?? approval.requesterId : '') ?? '',
        sourcePmName: displayText(item.sourcePmName ?? (inheritsProject('source') ? approval.sourcePmName ?? approval.actorName : '') ?? ''),
        sourceLineId: projectSnapshot('source', 'sourceLineId'), sourceLineName: displayText(projectSnapshot('source', 'sourceLineName')),
        targetProjectId: snapshot('targetProjectId'), targetProjectNo: displayText(projectSnapshot('target', 'targetProjectNo')), targetProjectName: displayText(projectSnapshot('target', 'targetProjectName')),
        targetPmId: projectSnapshot('target', 'targetPmId'), targetPmName: displayText(projectSnapshot('target', 'targetPmName')),
        targetLineId: projectSnapshot('target', 'targetLineId'), targetLineName: displayText(projectSnapshot('target', 'targetLineName')),
        requestedAt: item.requestedAt ?? approval.requestedAt ?? approval.createdAt ?? '',
        completedAt: item.completedAt ?? approval.completedAt ?? approval.decisionAt ?? '',
        effectiveDate: snapshot('effectiveDate'), status: displayText(snapshot('status')), source: displayText(source),
        approvalUrl: feishuApprovalUrl(source, url), reason: displayText(item.reason ?? approval.reason ?? approval.invalidReason ?? ''),
      };
    });
  }).sort((left, right) => String(right.requestedAt).localeCompare(String(left.requestedAt)));
  return { role, canView: true, rows };
}

function validateItems(state, actor, items, day) {
  check(Array.isArray(items) && items.length > 0, '请至少选择一条人员项目关联');
  const keys = new Set();
  return items.map(item => {
    const person = state.people.find(row => row.id === item.personId);
    const source = state.projects.find(project => project.id === item.sourceProjectId);
    check(person && source, '人员或来源项目不存在，请刷新列表');
    check(!keys.has(`${person.id}:${source.id}`), '同一人员项目关联重复提交');
    keys.add(`${person.id}:${source.id}`);
    check(source.pm === actor.name, '只能调配自己项目下的人员');
    check(!source.ended && person.projectIds.includes(source.id), '来源项目关联已结束，请刷新列表');
    check(eligible(person, day) && !person.transferControl?.pool, '仅在项且未离职的全职员工、实习生可调配');
    return { person, source };
  });
}

function validateTarget(state, targetProjectId) {
  const target = state.projects.find(project => project.id === targetProjectId);
  check(target && !target.ended, '请选择未结束的目标项目');
  const manager = state.transfers.managers.find(pm => pm.name === target.pm);
  check(manager, '目标项目的PM交付线尚未配置');
  return { target, manager };
}

function endRelations(state, person, projectIds, entry, day, reason) {
  for (const approval of state.transfers.approvals) {
    if (approval.status !== '模拟待审批' || approval.id === entry.approvalId || !approval.items.some(item => item.personId === person.id && projectIds.includes(item.sourceProjectId))) continue;
    approval.status = '模拟已失效';
    approval.decisionAt = entry.createdAt;
    approval.invalidReason = '申请涉及的来源项目关联已结束，请按当前关联重新申请';
    record(state, { ...clone(approval), id: id('transfer'), type: 'approval.invalidate', title: '审批失效', approvalId: approval.id, createdAt: entry.createdAt, summary: approval.invalidReason });
  }
  person.endedProjectRelations ||= [];
  for (const projectId of projectIds) person.endedProjectRelations.push({ projectId, reason, endedDate: day, evidence: entry.id, simulation: true });
  person.projectIds = person.projectIds.filter(projectId => !projectIds.includes(projectId));
}

function control(person, entry, day, pool) {
  person.transferControl = { operationId: entry.id, effectiveDate: day, changedAt: entry.createdAt, pool };
}

function notify(state, entry, recipientName, recipientRole, content) {
  const configured = recipientName && recipientName !== '—';
  state.transfers.notifications.push({ id: id('transfer-notice'), operationId: entry.id, status: configured ? '模拟通知' : '模拟待配置', simulation: true, recipientName: configured ? recipientName : `${recipientRole}待配置`, recipientRole, content, createdAt: entry.createdAt, actorId: entry.actorId, targetPmId: entry.targetPmId || '' });
}

function notifyPmOfMove(state, entry, recipientName, names, destination) {
  notify(state, entry, recipientName, 'PM', `${[...new Set(names)].join('、')}已经加入${destination}，请及时联系。`);
}

function applyTransfer(state, relations, target, manager, entry, day) {
  for (const { person, source } of relations) {
    endRelations(state, person, [source.id], entry, day, '项目换项');
    person.projectIds = [target.id];
    control(person, entry, day, false);
  }
  if (manager.id !== entry.actorId) notifyPmOfMove(state, entry, manager.name, relations.map(row => row.person.name), target.name);
}

function record(state, entry) {
  state.transfers.history.push(entry);
  state.audit ||= [];
  state.audit.push({ id: id('audit-transfer'), at: entry.createdAt, role: 'PM', actor: entry.actorName, type: `transfer.${entry.type}`, objectId: entry.id, after: clone(entry), reason: '本地调配操作' });
}

export function reduceTransferAction(previous, actorId, type, payload = {}, expectedRevision, role = 'PM', day = beijingToday()) {
  check(role === 'PM', '当前角色仅可查看，换项和调休池操作由PM执行');
  if (expectedRevision != null) check(expectedRevision === previous.revision, '数据已更新，请重新读取后再提交');
  const state = reconcileHrState(initializeTransferState(previous, day), day);
  const actor = state.transfers.managers.find(manager => manager.id === actorId);
  check(actor, '操作PM不存在，请重新选择');
  if (type === 'claim') {
    const { members, destination, targetProjectId, confirmed } = payload;
    check(Array.isArray(members) && members.length && new Set(members.map(m => m.personId)).size === members.length, '请选择不重复的待分配人员');
    check(destination === 'project' ? !!targetProjectId : destination === 'roster' && !targetProjectId, '请选择提取去向');
    const interns = [];
    for (const { personId, key } of members) {
      if (!key) {
        check(destination === 'project', '调休实习生只能提取到本人项目');
        interns.push(personId);
        continue;
      }
      const slot = state.transfers.available.find(row => row.key === key && row.personId === personId);
      check(slot, '名单已更新，请重新选择人员');
      const own = slot.ownerId === actorId;
      check(!own || destination === 'project', '本人名单中的人员只能提取到本人项目');
      applyAction(state, actor, own ? 'available.assign' : 'available.claim', { key, destination, targetProjectId, confirmed }, day);
    }
    if (interns.length) applyAction(state, actor, 'pool.claim', { personIds: interns, targetProjectId }, day);
  } else applyAction(state, actor, type, payload, day);
  state.revision = previous.revision + 1;
  return state;
}

// Each item updates the same private draft. A rejected item discards the whole batch.
function applyAction(state, actor, type, payload, day) {
  const actorId = actor.id;
  const entry = { id: id('transfer'), type, actorId, actorName: actor.name, createdAt: new Date().toISOString(), items: [], status: '模拟已完成', simulation: true };

  if (type === 'transfer' || type === 'approval.submit') {
    const relations = validateItems(state, actor, payload.items, day);
    const { target, manager } = validateTarget(state, payload.targetProjectId);
    check(relations.every(row => row.source.id !== target.id), '目标项目与来源项目相同，请重新选择');
    const crossLine = manager.lineId !== actor.lineId;
    check(type !== 'transfer' || !crossLine, '跨交付线换项须发起飞书审批');
    check(type !== 'approval.submit' || crossLine, '同交付线换项无需发起跨线审批');
    check(type !== 'transfer' || manager.id === actorId || payload.confirmed === true, '请确认换项并通知目标项目经理');
    entry.items = relations.map(({ person, source }) => ({
      ...personSummary(person), sourceProjectId: source.id, sourceProjectNo: source.projectNo || '', sourceProjectName: source.name,
      sourcePmId: actor.id, sourcePmName: source.pm, sourceLineId: actor.lineId, sourceLineName: actor.lineName,
      sourceRelationVersion: (person.endedProjectRelations || []).filter(row => row.projectId === source.id).length,
    }));
    Object.assign(entry, { targetProjectId: target.id, targetProjectNo: target.projectNo || '', targetProjectName: target.name, targetPmId: manager.id, targetPmName: manager.name, targetLineId: manager.lineId, targetLineName: manager.lineName });
    if (crossLine) {
      check(!state.transfers.approvals.some(approval => approval.status === '模拟待审批' && approval.items.some(item => entry.items.some(row => row.personId === item.personId && row.sourceProjectId === item.sourceProjectId))), '所选关联已有待审批申请，请先处理该申请');
      entry.status = '模拟待审批';
      entry.title = '跨交付线换项申请';
      entry.summary = `${relations.length}条关联申请换至${target.name}，审批通过后生效`;
      state.transfers.approvals.push({ ...clone(entry), requesterId: actorId });
    } else {
      entry.title = '同交付线换项';
      entry.summary = `${relations.length}条关联已换至${target.name}`;
      applyTransfer(state, relations, target, manager, entry, day);
    }
  } else if (type === 'available.release') {
    const relations = validateItems(state, actor, payload.items, day);
    check(relations.every(({ person }) => person.employeeType === '全职'), '仅可释放本人项目上的全职人员');
    entry.title = '释放至可分配人员';
    entry.items = relations.map(({ person, source }) => ({ ...personSummary(person), sourceProjectId: source.id, sourceProjectName: source.name }));
    for (const { person, source } of relations) {
      endRelations(state, person, [source.id], entry, day, entry.title);
      control(person, entry, day, false);
      let slot = state.transfers.available.find(r => r.personId === person.id && r.ownerId === actorId);
      if (!slot) {
        slot = { key: id('available'), personId: person.id, ownerId: actor.id, ownerName: actor.name, enteredAt: entry.createdAt, visible: false, sources: [] };
        state.transfers.available.push(slot);
      }
      if (!slot.sources.some(p => p.id === source.id)) slot.sources.push({ id: source.id, name: source.name });
    }
    entry.summary = `${relations.length} 条项目关联已释放至 ${actor.name} 的可分配人员列表`;
  } else if (type === 'available.claim') {
    const slot = state.transfers.available.find(r => r.key === payload.key && r.visible === true && r.ownerId !== actor.id);
    check(slot, '人员已被提取或当前不可提取，请刷新列表');
    const person = state.people.find(p => p.id === slot.personId);
    check(person && person.employeeType === '全职' && eligible(person, day) && !person.projectIds.length && !person.transferControl?.pool, '人员已不符合提取条件');
    const toRoster = payload.destination === 'roster';
    check(toRoster ? !payload.targetProjectId : payload.destination === 'project' && payload.targetProjectId, '请选择提取去向');
    const target = toRoster ? null : validateTarget(state, payload.targetProjectId).target;
    check(!target || target.pm === actor.name, '只能提取到本人负责的未结束项目');
    check(payload.confirmed === true, '请确认提取并通知原项目经理');
    state.transfers.available = state.transfers.available.filter(r => r.personId !== person.id);
    if (toRoster) {
      state.transfers.available.push({ ...slot, key: id('available'), ownerId: actor.id, ownerName: actor.name, visible: false, enteredAt: entry.createdAt });
    } else person.projectIds = [target.id];
    control(person, entry, day, false);
    const destinationName = toRoster ? `${actor.name}的可分配人员列表` : `${actor.name}负责的项目「${target.name}」`;
    Object.assign(entry, { title: '提取公开全职人员', sourceOwnerId: slot.ownerId, sourceOwnerName: slot.ownerName, targetPmId: actor.id, targetPmName: actor.name,
      targetProjectId: target?.id || '', targetProjectName: target?.name || '', destination: payload.destination,
      items: [{ ...personSummary(person), sourceProjectId: '', sourceProjectName: slot.ownerName + '的可分配人员' }],
      summary: `${person.name}已从${slot.ownerName}的可分配人员列表转入${destinationName}` });
    notify(state, entry, slot.ownerName, 'PM', `项目经理${actor.name}已从你的可分配人员列表中提取${person.name}，${toRoster ? '已转入其可分配人员列表，尚未分配项目' : `已加入其负责的项目「${target.name}」`}。`);
  } else if (['available.visibility', 'available.assign'].includes(type)) {
    const slot = state.transfers.available.find(r => r.key === payload.key && r.ownerId === actorId);
    check(slot, '记录已失效或无权维护，请刷新');
    const person = state.people.find(p => p.id === slot.personId);
    check(person && person.employeeType === '全职' && eligible(person, day), '人员已不符合分配条件');
    entry.items = [{ ...personSummary(person), sourceProjectId: '', sourceProjectName: '可分配人员' }];
    if (type === 'available.visibility') {
      check(typeof payload.visible === 'boolean', '请选择显示状态');
      slot.visible = payload.visible; entry.title = '更新共享范围';
      entry.summary = `${person.name} · ${slot.visible ? '所有PM可见' : '仅本人可见'}`;
    } else {
      const { target } = validateTarget(state, payload.targetProjectId);
      check(target.pm === actor.name, '只能分配至本人未结束项目');
      check(!person.projectIds.length, '人员已在项目中，请从当前项目办理换项');
      person.projectIds = [target.id];
      control(person, entry, day, false);
      state.transfers.available = state.transfers.available.filter(r => r.personId !== person.id);
      Object.assign(entry, { title: '分配全职人员', targetProjectId: target.id, targetProjectName: target.name, targetPmId: actor.id, summary: `${person.name} 已分配至 ${target.name}` });
    }
  } else if (type === 'pool.enter') {
    const relations = validateItems(state, actor, payload.items, day);
    const people = [...new Map(relations.map(row => [row.person.id, row.person])).values()];
    check(people.every(isIntern), '调休池仅适用于实习生');
    entry.items = relations.map(({ person, source }) => ({ ...personSummary(person), sourceProjectId: source.id, sourceProjectName: source.name }));
    entry.title = '进入调休池';
    entry.summary = `${people.length}名实习生已退出全部项目并进入调休池`;
    for (const person of people) {
      const sourceProjectIds = [...person.projectIds];
      const sourceProjectNames = sourceProjectIds.map(projectId => state.projects.find(project => project.id === projectId)?.name || projectId);
      endRelations(state, person, sourceProjectIds, entry, day, '调休入池');
      control(person, entry, day, true);
      state.transfers.pool.push({ personId: person.id, enteredAt: entry.createdAt, sourceProjectIds, sourceProjectNames, actorId, operationId: entry.id, formerPmId: actor.id, formerPmName: actor.name });
      notify(state, entry, person.name, '实习生', '你已被调休');
    }
  } else if (type === 'pool.claim') {
    const { target, manager } = validateTarget(state, payload.targetProjectId);
    check(target.pm === actor.name, '只能提取到自己负责的未结束项目');
    const personIds = [...new Set(payload.personIds || [])];
    check(personIds.length > 0, '请选择调休池中的实习生');
    const people = personIds.map(personId => {
      const person = state.people.find(row => row.id === personId);
      check(person && isIntern(person) && eligible(person, day) && person.transferControl?.pool && person.projectIds.length === 0 && state.transfers.pool.some(row => row.personId === personId), '实习生已被提取或不再处于可提取状态，请刷新');
      return person;
    });
    Object.assign(entry, { title: '提取调休池实习生', targetProjectId: target.id, targetProjectName: target.name, targetPmId: manager.id, targetPmName: manager.name, summary: `${people.length}名实习生已加入${target.name}` });
    entry.items = people.map(person => ({ ...personSummary(person), sourceProjectId: '', sourceProjectName: '调休池' }));
    for (const person of people) {
      person.projectIds = [target.id];
      control(person, entry, day, false);
      notify(state, entry, person.name, '实习生', `你已经被分配给${manager.name}经理下的${target.name}，请快速联系${manager.name}进行报道`);
      for (const [roleName, recipient] of [['PM', manager.name], ['PA', target.pa], ['QA', target.qa]]) notify(state, entry, recipient, roleName, `${person.name}已经加入${target.name}，请快速联系${person.name}进行作业`);
    }
    state.transfers.pool = state.transfers.pool.filter(row => !personIds.includes(row.personId));
  } else if (type === 'approval.resolve') {
    const approval = state.transfers.approvals.find(row => row.id === payload.approvalId);
    check(approval && approval.requesterId === actorId, '仅申请PM可处理自己的审批');
    check(approval.status === '模拟待审批', '该审批已经处理，请刷新');
    check(['approve', 'reject'].includes(payload.decision), '请选择通过或驳回');
    Object.assign(entry, { items: clone(approval.items), targetProjectId: approval.targetProjectId, targetProjectName: approval.targetProjectName, targetPmId: approval.targetPmId, targetPmName: approval.targetPmName, approvalId: approval.id });
    if (payload.decision === 'approve') {
      const relations = validateItems(state, actor, approval.items, day);
      check(relations.every(({ person, source }, index) => (person.endedProjectRelations || []).filter(row => row.projectId === source.id).length === (approval.items[index].sourceRelationVersion || 0)), '申请时的来源项目关联已结束，请驳回后按当前关联重新申请');
      const { target, manager } = validateTarget(state, approval.targetProjectId);
      check(manager.id === approval.targetPmId && manager.lineId !== actor.lineId, '目标PM或交付线已变更，请驳回后重新发起');
      applyTransfer(state, relations, target, manager, entry, day);
      entry.status = '模拟通过';
    } else entry.status = '模拟驳回';
    entry.title = '审批处理';
    entry.summary = `${entry.status} · ${approval.targetProjectName}`;
    approval.status = entry.status;
    approval.decisionAt = entry.createdAt;
  } else throw new Error('不支持的调配操作');

  record(state, entry);
}

export async function transferAction(actorId, type, payload, expectedRevision, role = 'PM') {
  check(!['approval.submit', 'approval.resolve'].includes(type), '交付线变更请在飞书审批中办理');
  check(Number.isInteger(expectedRevision), '缺少数据版本，请刷新后重试');
  const commit = () => {
    const next = updateHrWorkspace(previous => reduceTransferAction(previous, actorId, type, payload, expectedRevision, role), expectedRevision);
    return getTransferView(actorId, role, next);
  };
  // Web Locks serialize transfers across tabs before re-reading the revision.
  // The pure reducer remains available to server-side/unit-test callers.
  if (typeof window === 'undefined') return commit();
  check(globalThis.navigator?.locks?.request, '当前浏览器不支持安全的跨页调配，请使用新版Chrome或Edge打开本地服务');
  return globalThis.navigator.locks.request(`${HR_KEY}.transfers`, commit);
}
