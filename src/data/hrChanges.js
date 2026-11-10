import { displayText } from './displayText.js';

export const HR_CHANGE_TYPES = [
  { key: 'position', title: '岗位变动', page: 'hr-position-changes' },
  { key: 'resignation', title: '离职', page: 'hr-resignations' },
  { key: 'regularization', title: '转正', page: 'hr-regularizations' },
  { key: 'salary', title: '薪资变动', page: 'hr-salary-changes' },
  { key: 'information', title: '人员信息变更申请', page: 'hr-information-changes' },
];

const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const text = value => typeof value === 'string' ? value.trim() : '';
const typeByKey = key => HR_CHANGE_TYPES.find(type => type.key === key);
const master = (label, currentKey = '', table = '人员主库') => ({ label, currentKey, table });
const salary = label => ({ label, table: '薪资档案', salary: true });

// These are existing MMOS fields. Feishu form IDs and source field IDs remain
// the responsibility of the eventual connector, which has not been configured.
const fieldMappings = {
  position: {
    departmentId: master('所属部门', 'departmentName'),
    positionId: master('岗位', 'positionName'),
    locationId: master('工作地点', 'locationName'),
    manager: master('直属经理'),
  },
  resignation: {
    expectedLastWorkDate: master('预计最后工作日期'),
    lastWorkDate: master('最后工作日期'),
    resignationEffectiveDate: master('离职生效日'),
    resignationReason: master('离职原因分类'),
    lastWorkMonth: master('最后工作日年月'),
  },
  regularization: {
    probationDate: master('试用期开始日期'),
    plannedRegularizationDate: { ...master('计划转正日期'), pending: true },
    actualRegularizationDate: master('实际转正日期'),
    regularizationType: master('转正类型'),
    stage: master('人员阶段'),
  },
  salary: {
    salary: salary('当前薪资'),
    abilityAllowance: salary('能力补贴'),
    standbyAllowance: salary('是否享受待岗补贴'),
  },
  information: {
    name: master('员工姓名'),
    phone: master('联系电话'),
    email: master('个人邮箱'),
    address: master('联系地址', '', '人员档案'),
    emergencyName: master('紧急联系人', '', '人员档案'),
    emergencyRelation: master('紧急联系人关系', '', '人员档案'),
    emergencyPhone: master('紧急联系人电话', '', '人员档案'),
    education: master('学历', '', '人员档案'),
    school: master('学校', '', '人员档案'),
    major: master('专业', '', '人员档案'),
    graduation: master('毕业年月', '', '人员档案'),
    english: master('英语水平', '', '人员档案'),
    abilityTags: master('能力标签', '', '人员档案'),
    ethnicity: master('民族', '', '人员档案'),
    politics: master('政治面貌', '', '人员档案'),
    birthday: master('生日', '', '人员档案'),
    nativePlace: master('籍贯', '', '人员档案'),
    idNumber: master('身份证号', '', '人员档案'),
    identityAttachment: master('证件附件', '', '人员档案'),
    bankAccounts: master('收款银行资料', '', '薪资档案'),
  },
};

export function matchHrChangePerson(record, people) {
  const personId = text(record.personId);
  const employeeNo = text(record.employeeNo);
  if (!personId && !employeeNo) return { person: null, status: '缺少人员标识' };
  const byId = personId ? people.filter(person => person.id === personId) : [];
  const byNumber = employeeNo ? people.filter(person => person.employeeNo === employeeNo) : [];
  if (byId.length > 1 || byNumber.length > 1) return { person: null, status: '人员标识重复，待核对' };
  if (personId && employeeNo && (byId.length !== 1 || byNumber.length !== 1 || byId[0].id !== byNumber[0].id)) {
    return { person: null, status: '人员标识不一致，待核对' };
  }
  const person = personId ? byId[0] : byNumber[0];
  if (!person) return { person: null, status: '待关联人员主库' };
  if (!person.masterCreated) return { person: null, status: '人员尚未建档' };
  return { person, status: '已关联' };
}

function approvalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)(feishu\.cn|larksuite\.com)$/.test(url.hostname) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

function displayValue(value) {
  if (Array.isArray(value)) return value.map(displayValue);
  if (value && typeof value === 'object') return clone(value);
  return displayText(value);
}

export function projectHrChangeRecords(state, personView, type, salaryAuthorized) {
  return (state.hrChangeRecords || []).filter(record => typeByKey(record.type) && (!type || record.type === type)).map((record, index) => {
    const definition = typeByKey(record.type);
    const association = matchHrChangePerson(record, state.people);
    const person = personView.people.find(row => row.id === association.person?.id);
    const fields = (record.fields || []).filter(field => fieldMappings[record.type][field.key]).map(field => {
      const mapping = fieldMappings[record.type][field.key];
      const restricted = mapping.salary && !salaryAuthorized;
      const current = mapping.salary ? person?.compensation?.[field.key] : person?.[mapping.currentKey || field.key];
      return {
        key: field.key, label: mapping.label, sourceLabel: displayText(text(field.sourceLabel) || mapping.label),
        before: restricted ? '无权限' : displayValue(field.before),
        after: restricted ? '无权限' : displayValue(field.after),
        targetTable: mapping.table, targetLabel: mapping.pending ? `${mapping.label} · 来源映射待核对` : mapping.label,
        currentValue: restricted ? '无权限' : displayValue(current),
      };
    });
    const restricted = record.type === 'salary' && !salaryAuthorized;
    return {
      id: record.id || `${record.type}:${record.sourceRecordId || index}`, type: record.type, title: definition.title,
      personId: person?.id || '', name: displayText(record.name || person?.name || ''),
      employeeNo: displayText(record.employeeNo || person?.employeeNo || ''),
      status: displayText(record.status || ''), requestedAt: record.requestedAt || '',
      completedAt: record.completedAt || '', effectiveDate: record.effectiveDate || '',
      source: displayText(record.source || ''), sourceRecordId: record.sourceRecordId || '',
      approvalNo: record.approvalNo || '', approvalUrl: approvalUrl(record.approvalUrl), readAt: record.readAt || '',
      associationStatus: association.status,
      fieldMappingStatus: fields.length === (record.fields || []).length && !record.fields?.some(field => fieldMappings[record.type][field.key]?.pending) ? '已关联现有字段' : '部分来源字段待核对',
      fields, reason: restricted ? '' : displayText(record.reason || ''), salaryAuthorized,
    };
  }).sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)));
}

export function hrChangeSummaries(person, state, role, salaryAuthorized) {
  return (state.hrChangeRecords || []).filter(record => typeByKey(record.type) && matchHrChangePerson(record, state.people).person?.id === person.id).map(record => ({
    id: record.id, type: typeByKey(record.type).title, changeType: record.type,
    date: record.effectiveDate || '', status: displayText(record.status || ''), source: displayText(record.source || ''),
    reason: ['人事', 'HR'].includes(role) && (record.type !== 'salary' || salaryAuthorized) ? displayText(record.reason || '') : '',
  }));
}

export function ensureHrChangePreview(state, day) {
  if (state.hrChangePreviewVersion >= 1) return;
  state.hrChangeRecords ||= [];
  const date = days => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  const exactPerson = (id, number) => state.people.find(person => person.id === id && person.employeeNo === number && person.sourceSystem === 'MMOS1' && person.sourceId === `demo-source-${id}` && person.masterCreated);
  const lin = exactPerson('hr-1', 'MCE00001831');
  const zhou = exactPerson('hr-4', 'MCE00001834');
  const recordedProbation = new Date(`${lin?.probationDate}T00:00:00Z`);
  const probation = Number.isNaN(recordedProbation.getTime()) ? new Date(`${date(-4)}T00:00:00Z`) : recordedProbation;
  const probationDate = probation.toISOString().slice(0, 10);
  const regularizationLastDay = new Date(Date.UTC(probation.getUTCFullYear(), probation.getUTCMonth() + 4, 0)).getUTCDate();
  const regularizationDate = new Date(Date.UTC(probation.getUTCFullYear(), probation.getUTCMonth() + 3, Math.min(probation.getUTCDate(), regularizationLastDay))).toISOString().slice(0, 10);
  const field = (key, before, after, sourceLabel) => ({ key, before, after, sourceLabel });
  const add = (person, type, suffix, values) => {
    if (!person) return;
    const id = `hr-change-snapshot-${type}-${suffix}`;
    if (state.hrChangeRecords.some(record => record.id === id)) return;
    state.hrChangeRecords.push({
      id, type, personId: person.id, employeeNo: person.employeeNo, name: person.name,
      source: '审批记录快照', sourceRecordId: `${typeByKey(type).title}快照-${suffix}`,
      approvalNo: '', approvalUrl: '', readAt: '',
      requestedAt: `${date(-3)}T09:00:00+08:00`, completedAt: `${date(-2)}T15:00:00+08:00`,
      effectiveDate: date(-1), status: '已通过', ...values,
    });
  };
  add(lin, 'position', '001', {
    reason: '岗位职责调整', fields: [
      field('departmentId', '视听多模态交付线', '通用评测交付线', '所属部门'),
      field('positionId', '内容审核员', '数据标注员', '岗位'),
      field('locationId', '渝-南岸千方产业园', '渝-汉国中心', '工作地点'),
      field('manager', '林晓彤', '王然', '直属经理'),
    ],
  });
  add(zhou, 'resignation', '001', {
    effectiveDate: date(6), reason: '个人发展安排', fields: [
      field('expectedLastWorkDate', '', date(5), '预计最后工作日期'),
      field('lastWorkDate', '', date(5), '最后工作日期'),
      field('resignationReason', '', '个人发展', '离职原因分类'),
      field('lastWorkMonth', '', date(5).slice(0, 7), '最后工作日年月'),
      field('resignationEffectiveDate', '', date(6), '离职生效日'),
    ],
  });
  add(lin, 'regularization', '001', {
    status: '审批中', completedAt: '', effectiveDate: regularizationDate, reason: '试用期转正申请', fields: [
      field('probationDate', probationDate, probationDate, '试用期开始时间'),
      field('plannedRegularizationDate', '', regularizationDate, '计划转正日期'),
      field('actualRegularizationDate', '', '', '实际转正日期'),
      field('regularizationType', '', '试用转正', '转正类型'),
      field('stage', '试用期', '正式员工', '人员阶段'),
    ],
  });
  add(lin, 'salary', '001', {
    reason: '岗位薪资调整', fields: [
      field('salary', 5000, 5200, '薪资'),
      field('abilityAllowance', '原能力档位', '能力档位', '能力补贴'),
      field('standbyAllowance', false, false, '是否享受待岗补贴'),
    ],
  });
  add(lin, 'information', '001', {
    reason: '员工更新联系资料', fields: [
      field('phone', '原联系电话', '电话-1831', '联系电话'),
      field('address', '原联系地址', '联系地址', '联系地址'),
      field('emergencyName', '原紧急联系人', '紧急联系人', '紧急联系人'),
    ],
  });
  add(lin, 'information', '002', {
    status: '已驳回', reason: '联系电话资料需补充核实', effectiveDate: '', fields: [
      field('phone', '电话-1831', '待核实联系电话', '联系电话'),
    ],
  });
  state.hrChangeSync ||= { status: '来源快照', lastSuccess: '', note: '飞书审批接口待接入，当前展示来源快照。' };
  state.hrChangePreviewVersion = 1;
}
