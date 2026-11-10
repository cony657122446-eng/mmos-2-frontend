import { loadWorkspace, saveWorkspace, uid, readArray } from './financeWorkspace.js';
import { findFinanceCustomer } from './financeCustomers.js';
import { initialProjects } from './projectSeeds.js';
import { receiptStatus } from './financeLedger.js';

export const GROWTH = '客户增长与战略解决方案部';
export const CUSTOMER_ROLES = ['财务', GROWTH, 'PM', 'PMO'];
export const CONTACT_ROLES = { customerPoc: '客户POC', customerPm: '客户PM', resourceBp: '资源BP' };
export const canManageCustomers = role => role === '财务' || role === GROWTH;
const knownRole = role => CUSTOMER_ROLES.includes(role);
const actorName = role => ({ 财务: '财务 · 赵敏', PM: 'PM · 王然', PMO: 'PMO · 林晓彤', [GROWTH]: '增长部 · 客户增长' }[role] || '无权限账号');
const blankLinks = () => ({ customerType: '', customerPoc: [], customerPm: [], resourceBp: [] });
const text = value => String(value ?? '').trim();
const dateValid = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const requireRule = (ok, message) => { if (!ok) throw new Error(message); };
export const canViewCustomerProject = (role, project) => knownRole(role) && (role !== 'PM' || project.pm === '王然');
export const canEditCustomerProject = (role, project) => [GROWTH, 'PMO', 'PM'].includes(role) && canViewCustomerProject(role, project) && project.status !== '立项申请中';

export function migrateCustomerSubjects(state) {
  if (state.customerGroups) return state;
  const next = structuredClone(state);
  next.customerGroups = next.customers.map(subject => ({
    key: `group-${subject.key}`, code: `C-${subject.code || subject.key}`, name: subject.name,
    createdAt: subject.createdAt, byteSigning: subject.key === 'c1' && subject.fullName === '北京字跳网络技术有限公司',
  }));
  next.customers = next.customers.map(subject => ({ ...subject, groupKey: `group-${subject.key}` }));
  if (next.customerGroups.some(group => group.key === 'group-c1' && group.byteSigning)) {
    next.customers.push({ key: 'cm-demo-byte-second', groupKey: 'group-c1', code: 'DEMO-SUB-002', name: '字节第二主体', fullName: '字节第二科技有限公司（测试）', taxNo: 'DEMO-BYTE-SUBJECT-002', invoiceItemName: '数据标注服务费', taxCode: '3040203000000000000', term: 45, active: true, createdAt: '2026-11-09' });
    next.customerRelations.contacts.push({ key: 'cm-demo-byte-contact', customerKey: 'cm-demo-byte-second', name: '陈悦' });
  }
  next.customerRelations.migrations = next.customers.map(subject => ({
    key: `subject-${subject.key}`, sourceKey: subject.key, subjectKey: subject.key,
    groupKey: subject.groupKey, result: '已承接原公司档案', evidence: '原档案稳定标识、公司全称及税号',
  }));
  next.customerRelations.projectSubjects = { ...next.customerRelations.bindings };
  for (const project of initialProjects) {
    if (!next.customerRelations.projectSubjects[project.projectNo]) {
      next.customerRelations.migrations.push({ key: `project-${project.projectNo}`, sourceKey: project.projectNo, result: '待核对', evidence: '原记录仅有客户称呼，需核实公司主体' });
    }
  }
  return next;
}
function groupForRecord(state, record) {
  const subject = state.customers.find(row => row.key === (record.subjectKey || record.customerKey));
  const key = record.groupKey || subject?.groupKey;
  if (key) return state.customerGroups?.find(group => group.key === key);
  const matches = state.customerGroups?.filter(group => group.name === record.customer || group.previousNames?.includes(record.customer)) || [];
  return matches.length === 1 ? matches[0] : undefined;
}
export function isByteCustomer(record, state = loadWorkspace()) {
  return groupForRecord(state.customerGroups ? state : seedCustomerMaster(state), record)?.byteSigning === true;
}
export function applicationCustomerOptions() {
  return (seedCustomerMaster(loadWorkspace()).customerGroups || []).map(group => ({ value: group.name, label: group.name, groupKey: group.key }));
}
export function applicationSubjectOptions(customerName) {
  const state = seedCustomerMaster(loadWorkspace());
  const group = groupForRecord(state, { customer: customerName });
  return state.customers.filter(subject => subject.groupKey === group?.key).map(subject => ({
    value: subject.key, label: `${subject.name} · ${subject.fullName}`,
  }));
}

export function customerProjects(state) {
  const base = readArray('mmos.project.master.v1');
  const projects = base.length ? base : initialProjects;
  const applications = readArray('mmos.initiation.applications').filter(row => row.status === '审核通过');
  const extra = applications.filter(row => !projects.some(project => project.projectNo === row.projectNo)).map(row => ({ ...row, key: `application-${row.key}`, status: row.kind === '子项目立项' ? '项目进行中' : '试标中' }));
  return [...projects, ...extra].map(project => {
    const approved = applications.find(row => row.projectNo === project.projectNo);
    const explicitSubject = state.customerRelations?.projectSubjects?.[project.projectNo];
    const subjectKey = explicitSubject !== undefined ? explicitSubject : project.subjectKey ?? approved?.subjectKey ?? state.customerRelations?.bindings?.[project.projectNo] ?? project.customerKey;
    const customer = state.customers.find(row => row.key === subjectKey);
    const group = groupForRecord(state, { ...project, groupKey: project.groupKey || approved?.groupKey, subjectKey: customer?.key, customerKey: customer?.key });
    const association = state.customerRelations?.links?.[project.projectNo] || approved?.customerLinks;
    return { key: project.key, projectNo: project.projectNo, projectName: project.projectName, mainProject: project.mainProject, pm: project.pm, status: project.status, startDate: project.startDate,
      customerKey: customer?.key, subjectKey: customer?.key, subjectName: customer?.name, subjectFullName: customer?.fullName, groupKey: group?.key, customer: group?.name || project.customer,
      ...blankLinks(), ...(association || project.customerLinks || {}),
    };
  });
}

export function seedCustomerMaster(state) {
  if (state.customerRelations) return migrateCustomerSubjects(state);
  // Explicit demo fixtures; never derive contacts or roles from legacy contact/manager text.
  const contacts = [
    ['cm-demo-a', 'c1', '陈悦'], ['cm-demo-b', 'c1', '林可'], ['cm-demo-c', 'c1', '许宁'],
    ['cm-demo-d', 'c1', '未关联联系人'], ['cm-demo-e', 'c2', '陈悦'], ['cm-demo-f', 'c2', '周岚'],
  ].filter(([, key]) => state.customers.some(customer => customer.key === key)).map(([key, customerKey, name]) => ({ key, customerKey, name }));
  const demoBindings = { ZJ20260910922: 'c1', ZJ20260911880: 'c2' };
  const projects = customerProjects({ ...state, customerRelations: { bindings: demoBindings } });
  const links = {};
  const target = projects.find(row => row.projectNo === 'ZJ20260910922' && row.customerKey === 'c1');
  if (target) links[target.projectNo] = { customerType: '直签', customerPoc: ['cm-demo-a', 'cm-demo-b', 'cm-demo-c'], customerPm: ['cm-demo-a'], resourceBp: ['cm-demo-c'] };
  const second = projects.find(row => row.projectNo === 'ZJ20260911880' && row.customerKey === 'c2');
  if (second) links[second.projectNo] = { customerType: '转手', customerPoc: ['cm-demo-e'], customerPm: ['cm-demo-f'], resourceBp: [] };
  const visits = contacts.some(row => row.key === 'cm-demo-a') ? [
    { key: 'cm-demo-visit-1', contactKey: 'cm-demo-a', date: '2026-10-23', content: '拜访：沟通下一批交付安排，确认样本验收方式。', nextDdl: '待定，等待客户反馈', issues: '新批次验收样本仍待客户补充。', note: '交互测试数据' },
    { key: 'cm-demo-visit-2', contactKey: 'cm-demo-a', date: '2026-10-30', content: '拜访：回顾本周交付，记录新增质量关注点。', nextDdl: '11月上旬再沟通', issues: '客户将补充边界样本；进展由维护人手工更新。', note: '' },
  ] : [];
  return migrateCustomerSubjects({ ...state, customers: [...state.customers, { key: 'cm-demo-empty', code: 'DEMO-CM-001', name: '新签客户', fullName: '新签科技有限公司（测试）', taxNo: 'DEMO-CM-TAX', invoiceItemName: '', taxCode: '', term: null, active: true, createdAt: '2026-11-03' }], customerRelations: { version: 1, contacts, visits, recentVisits: {}, links, history: [], audit: [], bindings: Object.fromEntries(projects.filter(row => row.customerKey).map(row => [row.projectNo, row.customerKey])) } });
}

export function initializeCustomerMaster() {
  const current = loadWorkspace();
  if (!current.customerRelations || !current.customerGroups) saveWorkspace(current, seedCustomerMaster(current), '初始化客户主库场景', '系统');
}

function contactVisible(role, contact, projects) {
  return knownRole(role) && (role !== 'PM' || projects.some(project => project.pm === '王然' && Object.keys(CONTACT_ROLES).some(field => project[field]?.includes(contact.key))));
}
export function projectCustomerView(state, role) {
  requireRule(knownRole(role), '无客户主库访问权限');
  const relation = state.customerRelations || { contacts: [], visits: [], recentVisits: {}, history: [], audit: [] };
  const projects = customerProjects(state).filter(project => canViewCustomerProject(role, project));
  const contacts = relation.contacts.filter(row => contactVisible(role, row, projects)).map(({ key, customerKey, name }) => ({ key, customerKey, name }));
  const names = Object.fromEntries(relation.contacts.map(row => [row.key, row.name]));
  return {
    revision: state.revision || 0,
    groups: state.customerGroups || [],
    migrations: canManageCustomers(role) ? relation.migrations || [] : [],
    customers: state.customers.map(row => canManageCustomers(role) ? Object.fromEntries(['key', 'groupKey', 'code', 'name', 'fullName', 'taxNo', 'invoiceItemName', 'taxCode', 'term', 'createdAt', 'active'].map(key => [key, row[key]])) : { key: row.key, groupKey: row.groupKey, code: row.code, name: row.name, fullName: row.fullName }),
    contacts, projects: projects.map(project => ({ ...project, ...(canManageCustomers(role) ? { subjectReferences: [...readArray('mmos.acceptance.records.v1').filter(row => row.projectNo === project.projectNo).map(row => ({ key: row.key, source: '验收', number: row.acceptanceNo, status: row.applyStatus, corrected: Boolean(row.subjectCorrection?.completed) })), ...state.invoices.filter(row => row.projectNo === project.projectNo).map(row => ({ key: row.key, source: '开票', number: row.recordNo || row.acceptanceNo, status: row.invoiceNo || row.legacyConfirmed ? '已开票' : '待开票', corrected: Boolean(row.subjectCorrection?.completed) }))] } : {}), roleNames: Object.fromEntries(Object.keys(CONTACT_ROLES).map(field => [field, (project[field] || []).map(key => names[key] || '联系人不存在')])) })),
    history: relation.history.filter(row => projects.some(project => project.projectNo === row.projectNo)),
    ...(role === GROWTH ? { visits: relation.visits, recentVisits: latestVisitDates(relation.visits) } : {}),
    audit: relation.audit.filter(row => ['customer', 'group', 'subject'].includes(row.kind) ? canManageCustomers(role) : role === GROWTH || (row.kind === 'project' && projects.some(project => project.projectNo === row.object))).map(row => row.kind !== 'customer' ? row : { ...row, before: cleanCustomerAudit(row.before), after: cleanCustomerAudit(row.after) }),
  };
}
// Derive from actual visit dates, not insertion order or legacy manual values.
export function latestVisitDates(visits) {
  return visits.reduce((dates, visit) => {
    if (dateValid(visit.date) && (!dates[visit.contactKey] || visit.date > dates[visit.contactKey])) dates[visit.contactKey] = visit.date;
    return dates;
  }, {});
}
function cleanCustomerAudit(row) { return row && Object.fromEntries(['code', 'name', 'fullName', 'taxNo', 'invoiceItemName', 'taxCode', 'term', 'active', 'createdAt'].map(key => [key, row[key]])); }
export function readCustomerView(role) { return projectCustomerView(loadWorkspace(), role); }
export function readContactCandidates(role, projectNo) {
  const state = loadWorkspace(), project = customerProjects(state).find(row => row.projectNo === projectNo);
  requireRule(project && canEditCustomerProject(role, project), '无项目联系人维护权限');
  return (state.customerRelations?.contacts || []).filter(row => row.customerKey === project.customerKey).map(({ key, name }) => ({ value: key, label: name }));
}
export function applicationContactCandidates(customerName, subjectKey) {
  const state = seedCustomerMaster(loadWorkspace()), customer = state.customers.find(row => row.key === subjectKey && row.groupKey === groupForRecord(state, { customer: customerName })?.key);
  return (state.customerRelations?.contacts || []).filter(row => row.customerKey === customer?.key).map(({ key, name }) => ({ value: key, label: name }));
}
export function prepareApplicationCustomers(record, approved = false) {
  initializeCustomerMaster();
  const state = loadWorkspace(), group = groupForRecord(state, record);
  requireRule(group, '请选择已存在的客户档案');
  const subjectKey = record.subjectKey ?? record.customerKey;
  const customer = state.customers.find(row => row.key === subjectKey);
  requireRule(!subjectKey || customer?.groupKey === group.key, '公司主体不属于当前客户');
  const values = { customerType: record.customerType || '', ...Object.fromEntries(Object.keys(CONTACT_ROLES).map(field => [field, [...new Set(record[field] || [])]])) };
  requireRule(['', '直签', '转手'].includes(values.customerType), '客户类型仅支持直签、转手或空值');
  const contacts = state.customerRelations?.contacts || [];
  for (const field of Object.keys(CONTACT_ROLES)) requireRule(values[field].every(key => contacts.some(contact => contact.key === key && contact.customerKey === customer?.key)), '申请中存在不属于当前客户的联系人，请移除或重选');
  return { ...record, ...values, groupKey: group.key, subjectKey: customer?.key || '', customerKey: customer?.key,
    customerSnapshot: approved ? { groupKey: group.key, customer: group.name, subjectKey: customer?.key || '', subjectName: customer?.name || '', fullName: customer?.fullName || '' } : record.customerSnapshot,
    ...(approved ? { customerLinks: values, customerContactSnapshot: Object.fromEntries(Object.keys(CONTACT_ROLES).map(field => [field, values[field].map(key => ({ key, name: contacts.find(contact => contact.key === key).name }))])) } : {}),
  };
}
export function customerDeleteReasons(state, customerKey) {
  const customer = state.customers.find(row => row.key === customerKey);
  const relation = state.customerRelations;
  const matches = row => row.subjectKey === customerKey || row.subjectSnapshot?.subjectKey === customerKey || row.customerSnapshot?.subjectKey === customerKey || row.invoiceSubjectSnapshot?.subjectKey === customerKey || row.customerKey === customerKey || (!row.customerKey && [row.customer, row.payer, row['甲方名称'], row['乙方名称']].some(value => value && [customer?.name, customer?.fullName, ...(customer?.previousNames || []), ...(customer?.previousFullNames || [])].filter(Boolean).includes(value)));
  const contacts = relation.contacts.filter(row => row.customerKey === customerKey);
  return [
    (customerProjects(state).some(row => row.customerKey === customerKey) || readArray('mmos.initiation.applications').some(matches)) && '项目 / 立项',
    (readArray('mmos.acceptance.records.v1').some(matches) || relation.history.some(row => row.changes?.before?.subjectKey === customerKey || row.changes?.after?.subjectKey === customerKey)) && '验收 / 主体变更历史',
    contacts.length > 0 && '联系人',
    relation.visits.some(row => row.subjectSnapshot?.subjectKey === customerKey || contacts.some(contact => contact.key === row.contactKey)) && '拜访记录',
    ['invoices', 'journal', 'contracts', 'approvals', 'settlements'].some(table => (state[table] || []).some(matches)) && '财务记录',
  ].filter(Boolean);
}

export function applyCustomerCommand(state, role, command) {
  requireRule(knownRole(role), '无客户主库权限');
  const next = structuredClone(state), rel = next.customerRelations;
  if (command.requestId && rel.requests?.[command.requestId]) return next;
  requireRule(rel, '请先初始化客户主库');
  const { type, key, values = {} } = command;
  let before = null, after = null, kind = type.split('.')[0], object = key;
  const customer = next.customers.find(row => row.key === key);
  const contact = rel.contacts.find(row => row.key === key);
  const now = new Date().toISOString();
  if (kind === 'group') {
    requireRule(canManageCustomers(role), '仅财务及增长部可维护客户');
    const group = next.customerGroups.find(row => row.key === key);
    requireRule(!key || group, '客户不存在');
    before = group || null;
    if (type === 'group.save') {
      const name = text(values.name);
      requireRule(name, '客户名称必填');
      requireRule(!next.customerGroups.some(row => row.key !== key && row.name === name), '客户名称重复');
      rel.groupSequence = (rel.groupSequence || next.customerGroups.length) + (group ? 0 : 1);
      after = { ...group, key: key || uid('group'), name, code: group?.code || `C-${String(rel.groupSequence).padStart(4, '0')}`, createdAt: group?.createdAt || now, previousNames: [...new Set([...(group?.previousNames || []), ...(group ? [group.name] : [])])] };
      next.customerGroups = group ? next.customerGroups.map(row => row.key === key ? after : row) : [...next.customerGroups, after];
      object = after.key;
    } else if (type === 'group.delete') {
      requireRule(!next.customers.some(row => row.groupKey === key), '客户仍有关联公司主体');
      requireRule(!customerProjects(next).some(row => row.groupKey === key) && !readArray('mmos.initiation.applications').some(row => row.groupKey === key || row.customer === group?.name), '客户仍有项目或历史立项引用');
      next.customerGroups = next.customerGroups.filter(row => row.key !== key);
    } else throw new Error('不支持的客户操作');
  } else if (kind === 'customer') {
    requireRule(canManageCustomers(role), '仅财务及增长部可维护客户资料');
    if (type === 'customer.save') {
      requireRule(!key || customer, '客户不存在');
      const data = Object.fromEntries(['name', 'fullName', 'taxNo', 'invoiceItemName', 'taxCode'].map(field => [field, text(values[field])]));
      data.taxNo = String(values.taxNo ?? '');
      requireRule(data.name && data.fullName && text(data.taxNo), '主体简称、公司全称、纳税人识别号必填');
      const groupKey = values.groupKey || customer?.groupKey;
      requireRule(next.customerGroups.some(row => row.key === groupKey), '请选择所属客户');
      requireRule(!next.customers.some(row => row.key !== key && text(row.taxNo).toUpperCase() === text(data.taxNo).toUpperCase()), '纳税人识别号重复，请核对已有公司主体');
      if (customer && groupKey !== customer.groupKey) requireRule(!customerDeleteReasons(next, key).length, '主体存在业务引用，不能更改所属客户');
      requireRule(values.term == null || values.term === '' || Number.isFinite(Number(values.term)), '账期须为有效天数或留空');
      before = customer || null;
      if (!customer) rel.customerSequence = Math.max(rel.customerSequence || 0, ...next.customers.map(row => /^KH-\d+$/.test(row.code || '') ? Number(row.code.slice(3)) : 0)) + 1;
      after = { ...customer, ...data, groupKey, term: values.term == null || values.term === '' ? null : Number(values.term), key: key || command.newKey || uid('customer'), code: customer?.code || `SUB-${String(rel.customerSequence).padStart(5, '0')}`, createdAt: customer?.createdAt || now, active: customer?.active ?? true,
        previousNames: [...new Set([...(customer?.previousNames || []), ...(customer && customer.name !== data.name ? [customer.name] : [])])], previousFullNames: [...new Set([...(customer?.previousFullNames || []), ...(customer && customer.fullName !== data.fullName ? [customer.fullName] : [])])] };
      object = after.key;
      next.customers = customer ? next.customers.map(row => row.key === key ? after : row) : [...next.customers, after];
      next.invoices = next.invoices.map(row => {
        if (!key || findFinanceCustomer(row, state.customers)?.key !== key) return row;
        if (!row.invoiceNo && !row.legacyConfirmed && row.invoiceStatus !== '已开票') return { ...row, customerKey: key, customer: next.customerGroups.find(row => row.key === after.groupKey)?.name || after.name, subjectName: after.name, payer: after.fullName, taxNo: after.taxNo, category: after.invoiceItemName, taxCode: after.taxCode };
        if (row.invoiceNo && receiptStatus(row) === '已回款' && !Object.hasOwn(row, 'paidTermSnapshot')) return { ...row, paidTermSnapshot: customer?.term ?? null };
        return row;
      });
    } else if (type === 'customer.disable' || type === 'customer.delete') {
      requireRule(customer, '客户已不存在'); before = customer;
      if (type === 'customer.delete') {
        const reasons = customerDeleteReasons(next, key);
        requireRule(!reasons.length, `不能删除：仍有关联${reasons.join('、')}`);
        next.customers = next.customers.filter(row => row.key !== key);
      } else {
        after = { ...customer, active: false };
        next.customers = next.customers.map(row => row.key === key ? after : row);
      }
    } else throw new Error('不支持的客户操作');
  } else if (kind === 'contact') {
    requireRule(role === GROWTH, '仅增长部可维护联系人名单');
    requireRule(type === 'contact.save', '不支持的联系人操作');
    requireRule(!key || contact, '联系人不存在');
    const name = text(values.name), customerKey = values.customerKey;
    requireRule(name && next.customers.some(row => row.key === customerKey), '请选择所属客户并填写联系人姓名');
    requireRule(!rel.contacts.some(row => row.key !== key && row.customerKey === customerKey && row.name.trim() === name), '同一客户下联系人姓名重复');
    if (contact && contact.customerKey !== customerKey) {
      const referenced = [...customerProjects(next), ...readArray('mmos.initiation.applications')].some(project => Object.keys(CONTACT_ROLES).some(field => (project[field] || project.customerLinks?.[field] || []).includes(key)))
        || rel.history.some(row => JSON.stringify(row.changes).includes(`"${key}"`)) || rel.visits.some(row => row.contactKey === key);
      requireRule(!referenced, '联系人存在立项、项目、变更历史或拜访引用，不能修改所属客户');
    }
    before = contact || null; after = { key: key || command.newKey || uid('contact'), customerKey, name }; object = after.key;
    rel.contacts = contact ? rel.contacts.map(row => row.key === key ? after : row) : [...rel.contacts, after];
  } else if (type === 'subject.assign') {
    requireRule(canManageCustomers(role), '仅财务或增长部可补填及更正主体');
    const project = customerProjects(next).find(row => row.projectNo === key);
    const subject = next.customers.find(row => row.key === values.subjectKey);
    requireRule(project && subject && subject.groupKey === project.groupKey, '请选择项目所属客户的公司主体');
    requireRule(text(values.reason), '请填写主体补填或更正依据');
    if (project.subjectKey === subject.key) return state;
    const references = [...readArray('mmos.acceptance.records.v1').filter(row => row.projectNo === key), ...next.invoices.filter(row => row.projectNo === key)];
    requireRule(!references.length || references.every(row => row.subjectCorrection?.completed === true && row.subjectCorrection.targetSubjectKey === subject.key), '已有验收或开票记录，请先完成相关业务更正并取得有效处理结果');
    before = { subjectKey: project.customerKey, ...Object.fromEntries(Object.keys(blankLinks()).map(field => [field, Array.isArray(project[field]) ? project[field].map(id => ({ key: id, name: rel.contacts.find(row => row.key === id)?.name || '未知联系人' })) : project[field]])) };
    after = { subjectKey: subject.key, ...blankLinks(), customerType: project.customerType };
    rel.projectSubjects ||= {}; rel.projectSubjects[key] = subject.key; rel.bindings[key] = subject.key;
    rel.migrations = (rel.migrations || []).filter(row => row.key !== `project-${key}`).concat({ key: `project-${key}`, sourceKey: key, previousSubjectKey: project.subjectKey || '', groupKey: project.groupKey, subjectKey: subject.key, result: '已核对', evidence: text(values.reason), actor: actorName(role), time: now });
    rel.links[key] = { ...blankLinks(), customerType: project.customerType };
    rel.history.unshift({ key: uid('history'), projectNo: key, time: now, actor: actorName(role), reason: text(values.reason), changes: { before, after } });
  } else if (kind === 'project') {
    const project = customerProjects(next).find(row => row.projectNo === key);
    requireRule(project && canEditCustomerProject(role, project), '无权修改此项目的客户关联，或立项尚未生效');
    requireRule(type === 'project.save' && project.groupKey, '该项目尚未关联有效客户档案');
    before = Object.fromEntries(Object.keys(blankLinks()).map(field => [field, project[field]]));
    after = { customerType: values.customerType || '' };
    requireRule(['', '直签', '转手'].includes(after.customerType), '客户类型仅支持直签、转手或空值');
    for (const field of Object.keys(CONTACT_ROLES)) {
      requireRule(!values[field] || Array.isArray(values[field]), '联系人名单格式不正确');
      after[field] = [...new Set(values[field] || [])];
      requireRule(after[field].every(id => rel.contacts.some(row => row.key === id && row.customerKey === project.customerKey)), '所选联系人不存在或不属于本项目客户，请重新选择');
    }
    const snapshot = data => Object.fromEntries(Object.entries(data).map(([field, value]) => [field, Array.isArray(value) ? value.map(id => ({ key: id, name: rel.contacts.find(row => row.key === id)?.name || '未知联系人' })) : value]));
    if (JSON.stringify(before) !== JSON.stringify(after)) rel.history.unshift({ key: uid('history'), projectNo: key, time: now, actor: actorName(role), changes: { before: snapshot(before), after: snapshot(after) } });
    rel.links[key] = after; rel.bindings[key] = project.customerKey;
  } else if (kind === 'visit') {
    requireRule(role === GROWTH, '仅增长部可查看和维护拜访信息');
    if (type === 'visit.save') {
      const visit = rel.visits.find(row => row.key === key);
      requireRule(!key || visit, '拜访记录不存在');
      const contactKey = visit?.contactKey || values.contactKey;
      requireRule(rel.contacts.some(row => row.key === contactKey), '所属联系人不存在');
      requireRule(dateValid(values.date) && text(values.content), '请填写有效拜访日期及当次拜访记录');
      before = visit || null;
      const person = rel.contacts.find(row => row.key === contactKey);
      const subject = next.customers.find(row => row.key === person.customerKey);
      requireRule(subject, '联系人公司主体尚待核对');
      const group = next.customerGroups.find(row => row.key === subject.groupKey);
      after = { key: key || command.newKey || uid('visit'), contactKey, subjectSnapshot: visit?.subjectSnapshot || { subjectKey: subject.key, groupKey: group.key, customer: group.name, subjectName: subject.name, fullName: subject.fullName }, date: values.date, content: text(values.content), nextDdl: text(values.nextDdl), issues: text(values.issues), note: text(values.note) }; object = after.key;
      rel.visits = visit ? rel.visits.map(row => row.key === key ? after : row) : [...rel.visits, after];
    } else throw new Error('不支持的拜访操作');
  } else throw new Error('不支持的操作');
  rel.audit.unshift({ key: uid('customer-audit'), time: now, actor: actorName(role), kind, object, action: type, result: '成功', before, after });
  if (command.requestId) { rel.requests ||= {}; rel.requests[command.requestId] = { object, type }; }
  return next;
}

export function commitCustomerCommand(role, revision, command) {
  const current = loadWorkspace();
  if (command.requestId && current.customerRelations?.requests?.[command.requestId]) return readCustomerView(role);
  requireRule((current.revision || 0) === revision, '数据已变化，请点击刷新后重新打开编辑；本次修改未保存');
  const next = applyCustomerCommand(current, role, command);
  saveWorkspace(current, next, command.type, actorName(role));
  return readCustomerView(role);
}

export function acceptanceSubjectSnapshot(projectNo, role = 'PMO') {
  initializeCustomerMaster();
  const state = loadWorkspace();
  const project = customerProjects(state).find(row => row.projectNo === projectNo);
  requireRule(project && (role === 'PMO' || (role === 'PM' && project.pm === '王然')), '无权提交此项目验收');
  requireRule(['项目进行中', '项目暂停'].includes(project.status), '仅项目进行中或项目暂停可发起验收');
  const subject = state.customers.find(row => row.key === project?.customerKey);
  requireRule(project && subject && subject.groupKey === project.groupKey, '发起验收前请由财务或增长部补齐有效公司主体');
  return { customerKey: subject.key, subjectKey: subject.key, groupKey: project.groupKey, customer: project.customer,
    subjectName: subject.name, subjectSnapshot: { subjectKey: subject.key, subjectName: subject.name, customer: project.customer, fullName: subject.fullName, groupKey: subject.groupKey } };
}
