import { findFinanceCustomer } from './financeCustomers.js';

// Presentation cleanup keeps the canonical identifiers used by stored relations.
const internalTransferStates = new Set(['模拟待审批', '模拟已失效', '模拟通知', '模拟待配置', '模拟已完成', '模拟通过', '模拟驳回']);
const canonicalFields = new Set(['id', 'ids', 'key', 'keys', 'recruitmentNo', 'employeeNo', 'externalNo', 'personalAccount', 'enterpriseAccount', 'evidence', 'originalDisplayName', 'originalDisplayFullName', 'previousNames', 'previousFullNames', 'data', 'url', 'uri', 'token']);
const uniqueNameScopes = { contacts: 'customerKey', customerGroups: '', customers: '', departments: 'parentId', locations: '', positions: 'departmentId' };
const legacyLabels = {
  status: { 演示快照: '来源快照' },
  sourceSystem: { 调配演示: '人员调配' },
  actor: { '增长部 · 演示账号': '增长部 · 客户增长', '系统 · 本地演示': '系统' },
  note: { 状态为交互演示配置: '工作地点配置' },
};

export function displayText(value) {
  return typeof value === 'string' ? value.replaceAll('-模拟-', '-').replaceAll('模拟', '').replace(/^招聘-调配演示-(\d+)$/, '招聘-调配-$1') : value;
}

function isCanonicalField(field) {
  return canonicalFields.has(field) || /(?:Id|Ids|Key|Keys|URL|Url|URI|Uri|Token)$/.test(field);
}

export function cleanDisplayRecord(value, field = '', context = referenceContext(value)) {
  if (isCanonicalField(field)) return value;
  if (typeof value === 'string') {
    if (field === 'status' && internalTransferStates.has(value)) return value;
    if (Object.hasOwn(legacyLabels[field] || {}, value)) return legacyLabels[field][value];
    if (['payer', 'buyer', '甲方名称', '乙方名称', 'subjectName', 'subjectFullName'].includes(field)) return context.subjectLabels?.get(value) || displayText(value);
    return displayText(value);
  }
  if (Array.isArray(value)) {
    let rows = value.map(item => cleanDisplayRecord(item, field, context));
    if (Object.hasOwn(uniqueNameScopes, field)) rows = preserveUniqueNames(value, rows, uniqueNameScopes[field]);
    if (field === 'customers') rows = preserveUniqueNames(value, rows, '', 'fullName');
    if (['customers', 'customerGroups'].includes(field)) rows = rows.map((row, index) => preserveCustomerAliases(value[index], row));
    return rows;
  }
  if (!value || typeof value !== 'object') return value;
  const next = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cleanDisplayRecord(item, key, context)]));
  return typeof value.customer === 'string' ? preserveCustomerReference(value, next, context) : next;
}

// Only these collections require name uniqueness. Existing names take priority,
// and a changed collision receives its own stable number without merging rows.
function preserveUniqueNames(previous, rows, scope, field = 'name') {
  const nameKey = row => JSON.stringify([scope ? row[scope] : '', row[field]?.trim()]);
  const used = new Set(rows.filter((row, index) => row[field] === previous[index][field]).map(nameKey));
  return rows.map((row, index) => {
    if (row[field] === previous[index][field] || !row[field]) return row;
    let next = row;
    if (used.has(nameKey(next))) {
      const suffix = displayText(row.code || row.key || row.id || String(index + 1));
      let name = `${row[field]}（${suffix}）`;
      let sequence = 2;
      while (used.has(nameKey({ ...row, [field]: name }))) name = `${row[field]}（${suffix}-${sequence++}）`;
      const originalField = field === 'fullName' ? 'originalDisplayFullName' : 'originalDisplayName';
      next = { ...row, [field]: name, [originalField]: previous[index][originalField] || previous[index][field] };
    }
    used.add(nameKey(next));
    return next;
  });
}

function preserveCustomerAliases(previous, next) {
  for (const [field, aliases] of [['name', 'previousNames'], ['fullName', 'previousFullNames']]) {
    if (previous[field] && previous[field] !== next[field]) next[aliases] = [...new Set([...(previous[aliases] || []), previous[field]])];
  }
  return next;
}

function referenceContext(value) {
  const customers = value?.customers || [], groups = value?.customerGroups || [];
  const nextCustomers = cleanDisplayRecord(customers, 'customers', {});
  const nextGroups = cleanDisplayRecord(groups, 'customerGroups', {});
  const labels = new Map();
  customers.forEach((row, index) => {
    for (const [field, aliases] of [['name', 'previousNames'], ['fullName', 'previousFullNames']]) {
      for (const name of [row[field], ...(row[aliases] || [])].filter(Boolean)) {
        const matches = customers.filter(other => other[field] === name || other[aliases]?.includes(name));
        if (matches.length === 1) labels.set(name, nextCustomers[index][field]);
      }
    }
  });
  return { customers, groups, nextCustomers, nextGroups, subjectLabels: labels };
}

function preserveCustomerReference(previous, next, context) {
  if (!context.customers) return next;
  const subject = findFinanceCustomer(previous, context.customers);
  const knownSubject = context.customers.find(row => row.key === (previous.subjectKey || previous.customerKey)) || subject;
  const groupKey = previous.groupKey || knownSubject?.groupKey;
  const groups = groupKey ? context.groups.filter(row => row.key === groupKey) : context.groups.filter(row => row.name === previous.customer || row.previousNames?.includes(previous.customer));
  const group = groups.length === 1 ? groups[0] : undefined;
  // Preserve the existing lookup result before names change. An explicit empty
  // subjectKey continues to represent an unresolved company subject.
  if (subject && !Object.hasOwn(previous, 'subjectKey') && !previous.customerKey) next.customerKey = subject.key;
  if (group && !previous.groupKey) next.groupKey = group.key;
  next.customer = context.nextGroups.find(row => row.key === group?.key)?.name || context.nextCustomers.find(row => row.key === subject?.key)?.name || next.customer;
  return next;
}

// Covers older saved names and descriptions across all MMOS modules. Parsing or
// write failures leave that entry untouched and are returned to the app shell.
export function migrateDisplayTextStorage(storage = globalThis.localStorage) {
  const result = { updated: [], errors: [] };
  if (!storage) return result;
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(key => key?.startsWith('mmos.'));
  const entries = [];
  for (const key of keys) {
    const raw = storage.getItem(key);
    try { entries.push({ key, raw, parsed: JSON.parse(raw) }); } catch { /* Preserve malformed entries. */ }
  }
  const ledger = entries.find(entry => entry.key === 'mmos.finance.ledger.v1')?.parsed;
  const legacyCustomers = entries.find(entry => entry.key === 'mmos.finance.customers.v1')?.parsed;
  const context = referenceContext(ledger || { customers: Array.isArray(legacyCustomers) ? legacyCustomers : [] });
  for (const { key, raw, parsed } of entries) {
    if (!raw || !/模拟|"演示快照"|"调配演示"|"增长部 · 演示账号"|"系统 · 本地演示"|"状态为交互演示配置"/.test(raw)) continue;
    const next = cleanDisplayRecord(parsed, key === 'mmos.finance.customers.v1' ? 'customers' : '', parsed?.customers || parsed?.customerGroups ? referenceContext(parsed) : context);
    if (JSON.stringify(next) === JSON.stringify(parsed)) continue;
    if (next && typeof next === 'object' && !Array.isArray(next) && Number.isInteger(next.revision)) next.revision++;
    try {
      storage.setItem(key, JSON.stringify(next));
      result.updated.push(key);
    } catch (error) { result.errors.push({ key, message: error.message }); }
  }
  return result;
}
