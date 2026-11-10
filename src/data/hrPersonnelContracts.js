import { displayText } from './displayText.js';

const copy = value => JSON.parse(JSON.stringify(value));
const text = value => String(value ?? '').trim();
const check = (condition, message) => { if (!condition) throw new Error(message); };
const uid = () => `personnel-contract-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
export const CONTRACT_TYPES = ['劳动合同', '劳务合同', '实习生协议', '兼职劳务合同', '保密协议', '补充协议', '其他协议'];
export const dateValid = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export const nextDay = (day, count = 1) => new Date(Date.parse(`${day}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10);
const signed = record => record.signed === true && typeof record.signedAt === 'string' && Number.isFinite(Date.parse(record.signedAt)) && dateValid(record.signedAt.slice(0, 10)) && !!text(record.evidence);
const signedDay = record => new Date(Date.parse(record.signedAt) + 8 * 3600000).toISOString().slice(0, 10);
const mainTypes = new Set(['劳动合同', '劳务合同', '实习生协议', '实习协议', '兼职劳务合同']);

export function contractExecution(record, records, person, day) {
  const missing = [];
  if (!record.type) missing.push('合同类型');
  if (record.signed !== true && record.signed !== false) missing.push('签署事实');
  if (record.signed === true && !signed(record)) missing.push('实际签署时间或材料依据');
  if (!dateValid(record.startDate)) missing.push('开始日期');
  if (!['固定期限', '无固定期限'].includes(record.termType)) missing.push('期限类型');
  if (record.termType === '固定期限' && !dateValid(record.endDate)) missing.push('结束日期');
  if (record.termType === '无固定期限' && !text(record.openEndedEvidence)) missing.push('无固定期限原文依据');
  if (record.termType === '无固定期限' && record.endDate) missing.push('无固定期限结束日期冲突');
  if (dateValid(record.endDate) && record.endDate < record.startDate) missing.push('期限起止冲突');
  const terminationFacts = [...(record.terminations || []), ...(record.termination ? [record.termination] : [])];
  if (terminationFacts.some(fact => !dateValid(fact.date) || !text(fact.evidence))) missing.push('终止日期或依据');
  const endings = [];
  if (record.termType === '固定期限' && dateValid(record.endDate)) endings.push({ date: nextDay(record.endDate), reason: '自然到期' });
  for (const fact of terminationFacts) if (dateValid(fact.date) && text(fact.evidence) && !endings.some(row => row.date === fact.date && row.evidence === fact.evidence)) endings.push({ date: fact.date, reason: fact.reason || '提前终止', evidence: fact.evidence });
  if (record.replacesId && !records.some(row => row.id === record.replacesId && row.personId === record.personId && row.id !== record.id)) missing.push('原合同关联');
  for (const successor of records.filter(row => row.replacesId === record.id && row.personId === record.personId && row.id !== record.id)) {
    const validTerm = successor.termType === '固定期限' && dateValid(successor.endDate) && successor.endDate >= successor.startDate || successor.termType === '无固定期限' && !successor.endDate && text(successor.openEndedEvidence);
    if (signed(successor) && signedDay(successor) <= day && dateValid(successor.startDate) && successor.startDate <= day && validTerm) endings.push({ date: successor.startDate, reason: '续签替代', contractId: successor.id, signedAt: successor.signedAt });
  }
  const departure = person?.resignation;
  const sameOnboarding = !!record.checklistId && record.checklistId === person?.checklistId;
  if (mainTypes.has(record.type) && !record.checklistId && departure?.status === '通过' && !departure.cancelled) missing.push('主合同与离职办理关联');
  if (mainTypes.has(record.type) && sameOnboarding && departure?.status === '通过' && !departure.cancelled && text(departure.evidence) && dateValid(departure.effectiveDate)) {
    endings.push({ date: nextDay(departure.effectiveDate), reason: '离职生效', evidence: departure.evidence });
  }
  endings.sort((a, b) => a.date.localeCompare(b.date));
  const end = endings.find(row => row.date <= day);
  const result = { missing, endings, endedOn: end ? nextDay(end.date, -1) : '', endReason: end?.reason || '' };
  if (missing.length) return { ...result, state: '执行待核对', explanation: missing.join('、') };
  if (end) return { ...result, state: '结束执行', explanation: `${end.reason}，${end.date}起结束执行` };
  if (record.signed !== true || signedDay(record) > day) return { ...result, state: '尚未进入执行', explanation: '尚未完成全部签署' };
  if (record.startDate > day) return { ...result, state: '尚未进入执行', explanation: `约定${record.startDate}开始` };
  return { ...result, state: '正在执行', explanation: '已完成签署且处于有效期，未到达终止或替代边界' };
}

export function safeContractFile(file) {
  if (!file || !/\.pdf$/i.test(file.name || '')) return null;
  if (typeof file.data === 'string' && /^data:application\/pdf;base64,JVBER/.test(file.data)) return copy(file);
  if (typeof file.url === 'string' && /^\/[a-zA-Z0-9/_-]+\.pdf$/.test(file.url)) return copy(file);
  return null;
}

function retainContractDepartureFacts(state, day) {
  for (const record of state.personnelContracts) {
    const person = state.people.find(person => person.id === record.personId && person.employeeNo === record.employeeNo);
    const departure = person?.resignation;
    if (!mainTypes.has(record.type) || !record.checklistId || record.checklistId !== person?.checklistId || departure?.status !== '通过' || departure.cancelled || !dateValid(departure.effectiveDate) || !text(departure.evidence)) continue;
    const date = nextDay(departure.effectiveDate);
    if (date > day) continue;
    const sourceKey = `departure:${record.checklistId}:${date}`;
    record.terminations ||= [];
    if (record.terminations.some(fact => fact.sourceKey === sourceKey)) continue;
    const before = copy(record);
    record.terminations.push({ sourceKey, date, evidence: departure.evidence, reason: '离职生效', actor: '系统', at: new Date().toISOString() });
    record.version = (record.version || 0) + 1;
    auditContract(state, '系统', 'contract.departure', record, before, departure.evidence);
  }
}

export function ensurePersonnelContracts(state, day) {
  state.personnelContracts ||= [];
  state.contractExports ||= [];
  for (const person of state.people) {
    for (const legacy of person.contracts || []) {
      const id = `legacy:${person.id}:${legacy.id}`;
      if (state.personnelContracts.some(row => row.id === id)) continue;
      state.personnelContracts.push({
        ...copy(legacy), id, personId: person.id, employeeNo: person.employeeNo, version: 1,
        source: legacy.source || '历史合同来源', signed: ['已完成', '已签署'].includes(legacy.status) ? true : null,
        signedAt: legacy.signedAt || '', evidence: legacy.evidence || '', termType: legacy.termType || '',
        files: [], deleted: false, history: [], importedLegacyId: legacy.id,
      });
    }
  }
  if (state.personnelContractVersion >= 1) { retainContractDepartureFacts(state, day); return; }
  const sample = state.people.find(person => person.id === 'hr-1' && person.employeeNo === 'MCE00001831' && person.sourceId === 'demo-source-hr-1');
  if (sample) {
    const start = nextDay(day, -30), end = nextDay(day, 335);
    const file = { name: '人员合同预览.pdf', url: '/personnel-contract-preview.pdf', version: 1, at: `${day}T09:00:00+08:00`, source: '前端预览文件' };
    const base = { personId: sample.id, employeeNo: sample.employeeNo, checklistId: sample.checklistId || `onboarding-${sample.id}`, version: 1, source: '合同资料快照', evidence: '历史合同材料核对记录', form: '电子合同', owner: '签约主体', signed: true, signedAt: `${start}T10:00:00+08:00`, termType: '固定期限', startDate: start, endDate: end, deleted: false, history: [], files: [file], sensitivities: ['identity', 'salary'] };
    const samples = [
      { id: 'personnel-contract-active', type: '劳动合同', number: 'HT-2026-001', taskId: 'SIGN-2026-001' },
      { id: 'personnel-contract-nda', type: '保密协议', number: 'BM-2026-001', endDate: nextDay(day, 700), sensitivities: [] },
      { id: 'personnel-contract-open', type: '补充协议', number: 'BC-2026-001', termType: '无固定期限', endDate: '', openEndedEvidence: '原协议明确约定无固定期限', sensitivities: [] },
      { id: 'personnel-contract-missing', type: '其他协议', number: '', signed: null, signedAt: '', startDate: '', endDate: '', files: [], archiveError: '历史原件尚待补录' },
      { id: 'personnel-contract-archive-failed', type: '补充协议', number: 'BC-2026-002', files: [], archiveError: '最终签署PDF待补齐，签署完成事实已保留' },
      { id: 'personnel-contract-upcoming', type: '劳动合同', number: 'HT-2026-002', startDate: nextDay(day, 20), endDate: nextDay(day, 385), replacesId: 'personnel-contract-active' },
      { id: 'personnel-contract-expired', type: '劳务合同', number: 'LW-2025-001', startDate: nextDay(day, -365), endDate: nextDay(day, -1), signedAt: `${nextDay(day, -365)}T10:00:00+08:00` },
    ];
    for (const item of samples) if (!state.personnelContracts.some(row => row.id === item.id)) state.personnelContracts.push({ ...copy(base), ...item });
  }
  state.personnelContractVersion = 1;
  retainContractDepartureFacts(state, day);
}

export function projectPersonnelContracts(state, people, role, day) {
  const hr = ['人事', 'HR'].includes(role);
  return state.personnelContracts.filter(record => people.some(person => person.id === record.personId && person.employeeNo === record.employeeNo)).filter(record => hr || !record.deleted).map(record => {
    const person = people.find(person => person.id === record.personId);
    const originalPerson = state.people.find(row => row.id === record.personId);
    const permissions = state.fieldPermissions || {};
    const sensitiveAllowed = (record.sensitivities || ['identity', 'salary', 'bank']).every(key => permissions[{ identity: 'financeContractIdentity', salary: 'financeSalary', bank: 'financeContractBank' }[key]] === true);
    const canPreview = hr || role === '财务' && permissions.financeContractOriginals === true && sensitiveAllowed;
    const file = record.files?.at(-1);
    const archiveState = safeContractFile(file) ? '已归档' : record.archiveError ? '获取失败' : '原件待归档';
    const summary = {
      id: record.id, personId: record.personId, name: person.name, employeeNo: record.employeeNo, version: record.version,
      type: record.type || '类型待核对', number: record.number || '', form: record.form || '', owner: record.owner || '',
      startDate: record.startDate || '', endDate: record.endDate || '', termType: record.termType || '',
      signatureState: record.signed === true ? '签署完成' : record.signed === false ? '签署未完成' : '签署待核对',
      signedAt: record.signedAt || '', taskId: record.taskId || '', source: record.source || '',
      deleted: !!record.deleted, archiveState, execution: contractExecution(record, state.personnelContracts, originalPerson, day),
      canPreview, canManage: hr, canExport: hr,
    };
    if (hr) {
      const detailFields = ['evidence', 'openEndedEvidence', 'replacesId', 'termination', 'terminations', 'archiveError', 'updatedAt'];
      Object.assign(summary, Object.fromEntries(detailFields.filter(key => record[key] !== undefined).map(key => [key, copy(record[key])])));
      summary.history = (record.history || []).map(entry => ({
        at: entry.at, actor: entry.actor, type: entry.type, reason: entry.reason, version: entry.version,
        before: entry.before ? Object.fromEntries(['number', 'startDate', 'endDate', 'termType', 'type', 'deleted'].map(key => [key, entry.before[key] ?? ''])) : null,
      }));
      if (permissions.hrSalary === true) for (const key of ['salary', 'abilityAllowance', 'standbyAllowance']) {
        if (record[key] !== undefined) summary[key] = copy(record[key]);
      }
    }
    if (canPreview) summary.files = (record.files || []).map(safeContractFile).filter(Boolean);
    else delete summary.files;
    return displayText(summary);
  });
}

function auditContract(state, role, type, row, before, reason) {
  const metadata = record => {
    if (!record) return null;
    const fields = ['id', 'personId', 'employeeNo', 'version', 'type', 'number', 'form', 'owner', 'termType', 'startDate', 'endDate', 'signed', 'signedAt', 'replacesId', 'termination', 'terminations', 'deleted', 'evidence', 'selection', 'missing', 'successCount'];
    return { ...Object.fromEntries(fields.filter(key => record[key] !== undefined).map(key => [key, copy(record[key])])), files: (record.files || []).map(file => ({ name: file.name, version: file.version, at: file.at, source: file.source })) };
  };
  state.audit.unshift({ id: uid(), actor: role, type, objectId: row.id, personId: row.personId, at: new Date().toISOString(), before: metadata(before), after: metadata(row), reason, result: '成功' });
}

function validateRecord(row, state) {
  const person = state.people.find(person => person.id === row.personId && person.masterCreated);
  check(person && person.employeeNo === row.employeeNo, '请选择稳定关联的已建档人员');
  for (const key of ['startDate', 'endDate']) check(!row[key] || dateValid(row[key]), '合同日期无效');
  check(!row.endDate || !row.startDate || row.endDate >= row.startDate, '合同结束日期不得早于开始日期');
  check(!row.type || CONTRACT_TYPES.includes(row.type), '请选择有效合同类型');
  check(!row.termType || ['固定期限', '无固定期限'].includes(row.termType), '期限类型无效');
  check(row.termType !== '无固定期限' || !row.endDate, '无固定期限合同不填写结束日期');
  check(row.signed !== true || signed(row), '请登记材料中的实际签署完成时间及依据');
  check(!row.replacesId || !!row.startDate, '关联续签须填写新合同约定开始日期');
  check(!row.sourceTaskKey || !state.personnelContracts.some(other => other.id !== row.id && other.sourceTaskKey === row.sourceTaskKey), '该来源任务已经关联其他合同，请核对原记录');
  if (row.replacesId) {
    const seen = new Set([row.id]);
    let ancestor = state.personnelContracts.find(other => other.id === row.replacesId);
    check(ancestor && ancestor.personId === row.personId, '被替代合同必须属于同一人员');
    while (ancestor) {
      check(!seen.has(ancestor.id), '续签关系不能自身替代或循环替代');
      seen.add(ancestor.id);
      ancestor = state.personnelContracts.find(other => other.id === ancestor.replacesId);
    }
  }
}

export function applyPersonnelContractAction(state, role, type, payload, day) {
  if (!['contract.add', 'contract.correct', 'contract.terminate', 'contract.delete', 'contract.restore', 'contract.export'].includes(type)) return false;
  check(['人事', 'HR'].includes(role), '仅人事可以维护或导出人员合同');
  ensurePersonnelContracts(state, day);
  if (type === 'contract.export') {
    check(Array.isArray(payload.selection) && payload.selection.length > 0, '请选择合同记录');
    const rows = payload.selection.map(selected => {
      const record = state.personnelContracts.find(row => row.id === selected.id && !row.deleted);
      check(record && record.version === selected.version, '合同或附件版本已变化，请刷新后重新导出');
      return { id: record.id, personId: record.personId, employeeNo: record.employeeNo, number: record.number, version: record.version, fileVersion: record.files?.at(-1)?.version || 0 };
    });
    const entry = { id: uid(), actor: role, at: new Date().toISOString(), selection: rows, missing: copy(payload.missing || []), successCount: payload.successCount || 0 };
    state.contractExports.unshift(entry);
    auditContract(state, role, type, entry, null, '人员合同导出');
    return true;
  }
  const old = state.personnelContracts.find(row => row.id === payload.id);
  const existing = type !== 'contract.add';
  if (existing) {
    check(old, '合同记录不存在');
    check(payload.expectedVersion === old.version, '合同记录已更新，请刷新后重试');
    check(type === 'contract.restore' ? old.deleted : !old.deleted, '合同可见状态已变化，请刷新');
  }
  const reason = text(payload.reason);
  check(reason, '请填写真实合同或材料依据');
  const row = old ? copy(old) : { id: uid(), personId: payload.personId, employeeNo: state.people.find(person => person.id === payload.personId)?.employeeNo, version: 0, files: [], history: [], source: '人事历史补录', signed: null, sensitivities: ['identity', 'salary', 'bank'] };
  if (type === 'contract.add' || type === 'contract.correct') {
    const fields = ['type', 'number', 'form', 'owner', 'termType', 'startDate', 'endDate', 'signed', 'signedAt', 'openEndedEvidence', 'replacesId'];
    for (const key of fields) if (Object.hasOwn(payload, key)) row[key] = typeof payload[key] === 'string' ? payload[key].trim() : payload[key];
    row.evidence = reason;
    if (payload.file) {
      const file = safeContractFile(payload.file);
      check(file && !file.url, '请上传可读取的PDF原件');
      row.files.push({ ...file, version: (row.files.at(-1)?.version || 0) + 1, at: new Date().toISOString(), source: reason });
      row.archiveError = '';
    }
    validateRecord(row, state);
  } else if (type === 'contract.terminate') {
    check(dateValid(payload.date), '请填写有效的终止生效日期');
    check(!row.startDate || payload.date >= row.startDate, '终止生效日期不得早于合同开始日期');
    row.terminations ||= row.termination ? [copy(row.termination)] : [];
    row.termination = { date: payload.date, evidence: reason, at: new Date().toISOString(), actor: role };
    if (!row.terminations.some(fact => fact.date === payload.date && fact.evidence === reason)) row.terminations.push(copy(row.termination));
  } else if (type === 'contract.delete') row.deleted = true;
  else if (type === 'contract.restore') row.deleted = false;
  else throw new Error('人员合同操作无效');
  const historyBefore = old ? { ...copy(old), history: undefined } : null;
  row.history ||= [];
  row.history.push({ at: new Date().toISOString(), actor: role, type, reason, before: historyBefore, version: row.version + 1 });
  row.version++;
  row.updatedAt = new Date().toISOString();
  if (old) state.personnelContracts[state.personnelContracts.findIndex(record => record.id === row.id)] = row;
  else state.personnelContracts.push(row);
  auditContract(state, role, type, row, old || null, reason);
  return true;
}

export function contractLaunchReadiness(person, configuration = {}) {
  const reasons = [];
  if (person.terminated || person.abandoned || person.trainingResult === '淘汰') reasons.push('本次办理已终止或不可继续');
  if (!person.checklistCreated) reasons.push('尚无本次入职办理');
  if (person.accountActive !== true) reasons.push('企业飞书账号尚未实际激活');
  if (person.materialsComplete !== true) reasons.push('合同所需资料尚待核验');
  if (person.contractTaskId) return { state: '已有签署任务', reasons: ['沿用已关联任务，避免重复发起'], taskId: person.contractTaskId };
  if (configuration.verified !== true) reasons.push('法大大模板、主体与变量配置待核验');
  return { state: reasons.length ? '待满足条件' : '待服务端发起', reasons, taskId: '' };
}
