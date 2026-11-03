import { loadWorkspace, saveWorkspace, uid, readArray } from './financeWorkspace.js';
import { findFinanceCustomer } from './financeCustomers.js';
import { initialProjects } from './projectSeeds.js';
import { receiptStatus } from './financeLedger.js';

export const GROWTH = '客户增长与战略解决方案部';
export const CUSTOMER_ROLES = ['财务', GROWTH, 'PM', 'PMO'];
export const CONTACT_ROLES = { customerPoc: '客户POC', customerPm: '客户PM', resourceBp: '资源BP' };
export const canManageCustomers = role => role === '财务' || role === GROWTH;
const knownRole = role => CUSTOMER_ROLES.includes(role);
const actorName = role => ({ 财务: '财务 · 赵敏', PM: 'PM · 王然', PMO: 'PMO · 林晓彤', [GROWTH]: '增长部 · 演示账号' }[role] || '无权限账号');
const blankLinks = () => ({ customerType: '', customerPoc: [], customerPm: [], resourceBp: [] });
const text = value => String(value ?? '').trim();
const dateValid = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const requireRule = (ok, message) => { if (!ok) throw new Error(message); };
export const canViewCustomerProject = (role, project) => knownRole(role) && (role !== 'PM' || project.pm === '王然');
export const canEditCustomerProject = (role, project) => [GROWTH, 'PMO', 'PM'].includes(role) && canViewCustomerProject(role, project) && project.status !== '立项申请中';

export function customerProjects(state) {
  const base = readArray('mmos.project.master.v1');
  const projects = base.length ? base : initialProjects;
  const applications = readArray('mmos.initiation.applications').filter(row => row.status === '审核通过');
  const extra = applications.filter(row => !projects.some(project => project.projectNo === row.projectNo)).map(row => ({ ...row, key: `application-${row.key}`, status: row.kind === '子项目立项' ? '项目进行中' : '试标中' }));
  return [...projects, ...extra].map(project => {
    const customer = findFinanceCustomer({ customerKey: state.customerRelations?.bindings?.[project.projectNo] || project.customerKey, customer: project.customer }, state.customers);
    const approved = applications.find(row => row.projectNo === project.projectNo);
    const association = state.customerRelations?.links?.[project.projectNo] || approved?.customerLinks;
    return { key: project.key, projectNo: project.projectNo, projectName: project.projectName, mainProject: project.mainProject, pm: project.pm, status: project.status, startDate: project.startDate,
      customerKey: customer?.key, customer: customer?.name || project.customer,
      ...blankLinks(), ...(association || project.customerLinks || {}),
    };
  });
}

export function seedCustomerMaster(state) {
  if (state.customerRelations) return state;
  // Explicit demo fixtures; never derive contacts or roles from legacy contact/manager text.
  const contacts = [
    ['cm-demo-a', 'c1', '模拟陈悦'], ['cm-demo-b', 'c1', '模拟林可'], ['cm-demo-c', 'c1', '模拟许宁'],
    ['cm-demo-d', 'c1', '模拟未关联联系人'], ['cm-demo-e', 'c2', '模拟陈悦'], ['cm-demo-f', 'c2', '模拟周岚'],
  ].filter(([, key]) => state.customers.some(customer => customer.key === key)).map(([key, customerKey, name]) => ({ key, customerKey, name }));
  const projects = customerProjects(state);
  const links = {};
  const target = projects.find(row => row.projectNo === 'ZJ20260910922' && row.customerKey === 'c1');
  if (target) links[target.projectNo] = { customerType: '直签', customerPoc: ['cm-demo-a', 'cm-demo-b', 'cm-demo-c'], customerPm: ['cm-demo-a'], resourceBp: ['cm-demo-c'] };
  const second = projects.find(row => row.projectNo === 'ZJ20260911880' && row.customerKey === 'c2');
  if (second) links[second.projectNo] = { customerType: '转手', customerPoc: ['cm-demo-e'], customerPm: ['cm-demo-f'], resourceBp: [] };
  const visits = contacts.some(row => row.key === 'cm-demo-a') ? [
    { key: 'cm-demo-visit-1', contactKey: 'cm-demo-a', date: '2026-10-23', content: '模拟拜访：沟通下一批交付安排，确认样本验收方式。', nextDdl: '待定，等待客户反馈', issues: '新批次验收样本仍待客户补充。', note: '交互测试数据' },
    { key: 'cm-demo-visit-2', contactKey: 'cm-demo-a', date: '2026-10-30', content: '模拟拜访：回顾本周交付，记录新增质量关注点。', nextDdl: '11月上旬再沟通', issues: '客户将补充边界样本；进展由维护人手工更新。', note: '' },
  ] : [];
  return { ...state, customers: [...state.customers, { key: 'cm-demo-empty', code: 'DEMO-CM-001', name: '模拟新签客户', fullName: '模拟新签科技有限公司（测试）', taxNo: 'DEMO-CM-TAX', invoiceItemName: '', taxCode: '', term: null, active: true, createdAt: '2026-11-03' }], customerRelations: { version: 1, contacts, visits, recentVisits: {}, links, history: [], audit: [], bindings: Object.fromEntries(projects.filter(row => row.customerKey).map(row => [row.projectNo, row.customerKey])) } };
}

export function initializeCustomerMaster() {
  const current = loadWorkspace();
  if (!current.customerRelations) saveWorkspace(current, seedCustomerMaster(current), '初始化客户主库模拟场景', '系统 · 本地演示');
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
    customers: state.customers.map(row => canManageCustomers(role) ? Object.fromEntries(['key', 'code', 'name', 'fullName', 'taxNo', 'invoiceItemName', 'taxCode', 'term', 'createdAt', 'active'].map(key => [key, row[key]])) : { key: row.key, code: row.code, name: row.name, fullName: row.fullName }),
    contacts, projects: projects.map(project => ({ ...project, roleNames: Object.fromEntries(Object.keys(CONTACT_ROLES).map(field => [field, (project[field] || []).map(key => names[key] || '联系人不存在')])) })),
    history: relation.history.filter(row => projects.some(project => project.projectNo === row.projectNo)),
    ...(role === GROWTH ? { visits: relation.visits, recentVisits: latestVisitDates(relation.visits) } : {}),
    audit: relation.audit.filter(row => row.kind === 'customer' ? canManageCustomers(role) : role === GROWTH || (row.kind === 'project' && projects.some(project => project.projectNo === row.object))).map(row => row.kind !== 'customer' ? row : { ...row, before: cleanCustomerAudit(row.before), after: cleanCustomerAudit(row.after) }),
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
export function applicationContactCandidates(customerName) {
  const state = loadWorkspace(), customer = findFinanceCustomer({ customer: customerName }, state.customers);
  return (state.customerRelations?.contacts || []).filter(row => row.customerKey === customer?.key).map(({ key, name }) => ({ value: key, label: name }));
}
export function prepareApplicationCustomers(record, approved = false) {
  const state = loadWorkspace(), customer = findFinanceCustomer({ customer: record.customer }, state.customers);
  const values = { customerType: record.customerType || '', ...Object.fromEntries(Object.keys(CONTACT_ROLES).map(field => [field, [...new Set(record[field] || [])]])) };
  requireRule(['', '直签', '转手'].includes(values.customerType), '客户类型仅支持直签、转手或空值');
  const contacts = state.customerRelations?.contacts || [];
  for (const field of Object.keys(CONTACT_ROLES)) requireRule(values[field].every(key => contacts.some(contact => contact.key === key && contact.customerKey === customer?.key)), '申请中存在不属于当前客户的联系人，请移除或重选');
  return { ...record, ...values, customerKey: customer?.key,
    ...(approved ? { customerLinks: values, customerContactSnapshot: Object.fromEntries(Object.keys(CONTACT_ROLES).map(field => [field, values[field].map(key => ({ key, name: contacts.find(contact => contact.key === key).name }))])) } : {}),
  };
}
export function customerDeleteReasons(state, customerKey) {
  const customer = state.customers.find(row => row.key === customerKey);
  const relation = state.customerRelations;
  const matches = row => row.customerKey === customerKey || (!row.customerKey && [row.customer, row.payer, row['甲方名称'], row['乙方名称']].some(value => value && [customer?.name, customer?.fullName, ...(customer?.previousNames || []), ...(customer?.previousFullNames || [])].filter(Boolean).includes(value)));
  const contacts = relation.contacts.filter(row => row.customerKey === customerKey);
  return [
    (customerProjects(state).some(row => row.customerKey === customerKey) || readArray('mmos.initiation.applications').some(matches)) && '项目 / 立项',
    contacts.length > 0 && '联系人',
    relation.visits.some(row => contacts.some(contact => contact.key === row.contactKey)) && '拜访记录',
    ['invoices', 'journal', 'contracts', 'approvals', 'settlements'].some(table => (state[table] || []).some(matches)) && '财务记录',
  ].filter(Boolean);
}

export function applyCustomerCommand(state, role, command) {
  requireRule(knownRole(role), '无客户主库权限');
  const next = structuredClone(state), rel = next.customerRelations;
  requireRule(rel, '请先初始化客户主库');
  const { type, key, values = {} } = command;
  let before = null, after = null, kind = type.split('.')[0], object = key;
  const customer = next.customers.find(row => row.key === key);
  const contact = rel.contacts.find(row => row.key === key);
  const now = new Date().toISOString();
  if (kind === 'customer') {
    requireRule(canManageCustomers(role), '仅财务及增长部可维护客户资料');
    if (type === 'customer.save') {
      requireRule(!key || customer, '客户不存在');
      const data = Object.fromEntries(['name', 'fullName', 'taxNo', 'invoiceItemName', 'taxCode'].map(field => [field, text(values[field])]));
      requireRule(data.name && data.fullName && data.taxNo, '客户名称、客户全名、纳税人识别号必填');
      requireRule(!next.customers.some(row => row.key !== key && row.active !== false && row.name.trim() === data.name), '有效客户名称重复');
      requireRule(values.term == null || values.term === '' || Number.isFinite(Number(values.term)), '账期须为有效天数或留空');
      before = customer || null;
      if (!customer) rel.customerSequence = Math.max(rel.customerSequence || 0, ...next.customers.map(row => /^KH-\d+$/.test(row.code || '') ? Number(row.code.slice(3)) : 0)) + 1;
      after = { ...customer, ...data, term: values.term == null || values.term === '' ? null : Number(values.term), key: key || command.newKey || uid('customer'), code: customer?.code || `KH-${String(rel.customerSequence).padStart(3, '0')}`, createdAt: customer?.createdAt || now, active: customer?.active ?? true,
        previousNames: [...new Set([...(customer?.previousNames || []), ...(customer && customer.name !== data.name ? [customer.name] : [])])], previousFullNames: [...new Set([...(customer?.previousFullNames || []), ...(customer && customer.fullName !== data.fullName ? [customer.fullName] : [])])] };
      object = after.key;
      next.customers = customer ? next.customers.map(row => row.key === key ? after : row) : [...next.customers, after];
      next.invoices = next.invoices.map(row => {
        if (!key || findFinanceCustomer(row, state.customers)?.key !== key) return row;
        if (!row.invoiceNo && !row.legacyConfirmed && row.invoiceStatus !== '已开票') return { ...row, customerKey: key, customer: after.name, payer: after.fullName, taxNo: after.taxNo, category: after.invoiceItemName, taxCode: after.taxCode };
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
  } else if (kind === 'project') {
    const project = customerProjects(next).find(row => row.projectNo === key);
    requireRule(project && canEditCustomerProject(role, project), '无权修改此项目的客户关联，或立项尚未生效');
    requireRule(type === 'project.save' && project.customerKey, '该项目尚未关联有效客户档案');
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
      after = { key: key || command.newKey || uid('visit'), contactKey, date: values.date, content: text(values.content), nextDdl: text(values.nextDdl), issues: text(values.issues), note: text(values.note) }; object = after.key;
      rel.visits = visit ? rel.visits.map(row => row.key === key ? after : row) : [...rel.visits, after];
    } else throw new Error('不支持的拜访操作');
  } else throw new Error('不支持的操作');
  rel.audit.unshift({ key: uid('customer-audit'), time: now, actor: actorName(role), kind, object, action: type, result: '成功', before, after });
  return next;
}

export function commitCustomerCommand(role, revision, command) {
  const current = loadWorkspace();
  requireRule((current.revision || 0) === revision, '数据已变化，请点击刷新后重新打开编辑；本次修改未保存');
  const next = applyCustomerCommand(current, role, command);
  saveWorkspace(current, next, command.type, actorName(role));
  return readCustomerView(role);
}
