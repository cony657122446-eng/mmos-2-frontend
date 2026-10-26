import { loadFinanceLedger, saveFinanceLedger, invoiceStage, receiptStatus, validateFinanceInvoice, reconcileInvoiceReceipt } from './financeLedger.js';
import { initialInvoices, initialJournal, legacyInvoices } from './financeSeeds.js';
import { loadFinanceCustomers, findFinanceCustomer } from './financeCustomers.js';
import { invoiceNumber } from './invoiceFields.js';
import { contractProjection } from './financeContracts.js';

export const round = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const uid = prefix => `${prefix}-${globalThis.crypto.randomUUID()}`;
export function readArray(key) { try { const data = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(data) ? data : []; } catch { return []; } }
export function normalizeInvoice(row, customers) {
  const customer = findFinanceCustomer(row, customers);
  const amount = invoiceNumber(row.taxIncluded ?? row.amountValue ?? row.amount);
  return { ...row, recordNo: row.recordNo || row.acceptanceNo, acceptanceNo: row.acceptanceNo || row.recordNo,
    legacyConfirmed: !row.invoiceNo && row.invoiceStatus === '已开票',
    migrationIssue: !row.invoiceNo && row.invoiceStatus === '已开票' ? '历史记录标记已开票，但票号、日期及文件缺失，请核对后补充，勿重复开票' : '',
    customerKey: row.customerKey || customer?.key, payer: row.payer || row.buyer || customer?.fullName,
    acceptanceAmount: invoiceNumber(row.acceptanceAmount) ?? amount, taxIncluded: amount,
    taxRate: typeof row.taxRate === 'string' && row.taxRate.endsWith('%') ? Number(row.taxRate.slice(0, -1)) / 100 : row.taxRate,
    received: invoiceNumber(row.received) ?? (row.invoiceNo || row.invoiceStatus === '已开票' ? null : 0), voucher: row.voucher || row.invoiceFile || '',
    evidence: row.evidence || row.evidenceName, category: row.invoiceNo ? row.category || customer?.invoiceItemName || '' : customer?.invoiceItemName || '',
    ...(!row.invoiceNo ? { payer: customer?.fullName || '', taxNo: customer?.taxNo || '', taxCode: customer?.taxCode || '' } : {}),
    start: row.start || row.period?.split(' 至 ')[0], end: row.end || row.period?.split(' 至 ')[1],
  };
}
export function loadWorkspace() {
  const state = loadFinanceLedger({ invoices: initialInvoices, journal: initialJournal });
  if (state.schema === 2) return { ...state, invoices: state.invoices.map(row => row.legacyConfirmed && !row.invoiceNo ? { ...row, received: null } : row), contracts: (state.contracts || []).map(contractProjection) };
  const customers = state.customers || loadFinanceCustomers();
  const invoices = state.invoices.map(row => normalizeInvoice(row, customers));
  const old = readArray('mmos.invoice.records.v1');
  for (const row of old.length ? old : legacyInvoices) {
    if (!invoices.some(item => item.acceptanceNo === row.acceptanceNo)) invoices.push(normalizeInvoice(row, customers));
  }
  return { ...state, schema: 2, revision: state.revision || 0, customers, invoices,
    journal: state.journal.filter(row => row.opening || Number(row.income) > 0 || Number(row.expense) > 0),
    // External sources start empty. Existing prototype invoices remain explicitly labelled in the UI.
    costs: state.costs || [], settlements: state.settlements || [], approvals: state.approvals || [], contracts: state.contracts || [], audit: state.audit || [],
  };
}
export function legacyView(row) { return { ...row, buyer: row.payer, amountValue: row.taxIncluded, amount: row.taxIncluded, invoiceFile: row.voucher, invoiceStatus: row.invoiceNo || row.legacyConfirmed ? '已开票' : '待开票', paymentStatus: receiptStatus(row) }; }
export function saveWorkspace(previous, next, action, actor = '财务 · 赵敏') {
  const stored = loadFinanceLedger(null);
  if (stored && (stored.revision || 0) !== (previous.revision || 0)) throw new Error('数据已变化，请刷新后重新操作');
  const changes = ['customers', 'invoices', 'journal', 'costs', 'settlements', 'approvals'].flatMap(table => {
    const before = new Map((previous[table] || []).map(row => [row.key, row]));
    const after = new Map((next[table] || []).map(row => [row.key, row]));
    return [...new Set([...before.keys(), ...after.keys()])].flatMap(key => {
      const old = before.get(key), row = after.get(key);
      const fields = [...new Set([...Object.keys(old || {}), ...Object.keys(row || {})])].filter(field => JSON.stringify(old?.[field]) !== JSON.stringify(row?.[field]));
      return fields.length ? [{ table, key, fields: fields.map(field => ({ field, before: /evidence|voucherUrl/.test(field) ? '[文件引用]' : old?.[field], after: /evidence|voucherUrl/.test(field) ? '[文件引用]' : row?.[field] })) }] : [];
    });
  });
  const state = { ...next, contracts: (next.contracts || []).map(contractProjection), schema: 2, revision: (previous.revision || 0) + 1,
    audit: [...(previous.audit || []), { key: uid('audit'), actor, time: new Date().toISOString(), action, result: '成功', before: previous.revision || 0, after: (previous.revision || 0) + 1, changes }] };
  saveFinanceLedger(state);
  window.dispatchEvent(new CustomEvent('mmos:invoice-updated', { detail: state.invoices.map(legacyView) }));
  window.dispatchEvent(new CustomEvent('mmos:finance-customers-updated', { detail: state.customers }));
  window.dispatchEvent(new CustomEvent('mmos:finance-updated'));
  return state;
}
export function groupRows(invoices, row) { return row.groupId ? invoices.filter(item => item.groupId === row.groupId) : [row]; }
export function groupTotal(rows) { return round(rows.reduce((sum, item) => sum + Number(item.acceptanceAmount), 0)); }
export function groupInvoice(invoices, row) {
  const members = groupRows(invoices, row);
  return { ...row, key: row.groupId || row.key, projectName: members.length > 1 ? `${row.customer} · 合并开票（${members.length} 条验收）` : row.projectName,
    taxIncluded: groupTotal(members), acceptanceAmount: groupTotal(members), received: round(members.reduce((sum, item) => sum + Number(item.received || 0), 0)), members };
}
export function combineInvoices(state, keys) {
  const rows = state.invoices.filter(row => keys.includes(row.key));
  if (!rows.length || rows.length !== keys.length) throw new Error('请选择有效验收记录');
  if (rows.some(row => row.invoiceNo || row.legacyConfirmed || row.groupId)) throw new Error('仅可合并尚未开票且未合并的验收记录');
  if (!rows[0].customerKey || rows.some(row => row.customerKey !== rows[0].customerKey)) throw new Error('仅同一客户的验收可以合并开票');
  if (rows.some(row => invoiceNumber(row.acceptanceAmount) == null)) throw new Error('验收金额缺失，请先核对来源');
  const groupId = uid('group');
  return { ...state, invoices: state.invoices.map(row => keys.includes(row.key) ? { ...row, groupId } : row) };
}
export function issueInvoice(state, row, values) {
  const group = groupInvoice(state.invoices, row);
  if (group.members.some(item => item.invoiceNo || item.legacyConfirmed)) throw new Error('本次记录已经开票，请核对历史资料');
  if (!values.invoiceNo?.trim() || !values.invoiceDate || !values.voucher || !values.voucherUrl) throw new Error('请填写发票号码、日期并上传发票文件');
  if (invoiceNumber(values.taxIncluded) == null || round(values.taxIncluded) !== group.taxIncluded) throw new Error('整票金额必须等于关联验收金额合计');
  const next = state.invoices.map(item => group.members.some(member => member.key === item.key) ? { ...item, invoiceNo: values.invoiceNo.trim(), invoiceDate: values.invoiceDate, voucher: values.voucher, voucherUrl: values.voucherUrl, taxIncluded: item.acceptanceAmount } : item);
  for (const item of next.filter(item => group.members.some(member => member.key === item.key))) {
    const error = validateFinanceInvoice(item, next); if (error) throw new Error(error);
  }
  return { ...state, invoices: next };
}
export function registerReceipt(state, row, received, date, allocations, note = '') {
  const previous = groupInvoice(state.invoices, row);
  if (!row.invoiceNo) throw new Error('请先完成开票');
  if (!Number.isFinite(Number(received)) || Number(received) < 0 || round(received) > previous.taxIncluded) throw new Error('累计回款不能为负或超过整票应收');
  const shares = previous.members.map(member => ({ ...member, received: allocations?.[member.key] ?? (previous.members.length === 1 ? received : undefined), arrivedAt: Number(received) > 0 ? date : '', note }));
  for (const item of shares) { const error = validateFinanceInvoice(item, state.invoices); if (error) throw new Error(error); }
  if (round(shares.reduce((sum, item) => sum + Number(item.received), 0)) !== round(received)) throw new Error('各验收累计分配合计必须等于整票累计回款');
  const keys = previous.members.map(item => item.key);
  // Fold per-acceptance historical links into the invoice scope. Acceptance shares remain on the invoice rows.
  const journal = state.journal.map(entry => ({ ...entry, allocations: (entry.allocations || []).map(link => link.type === '开票' && keys.includes(link.target) ? { ...link, target: previous.key, name: previous.projectName } : link) }));
  const nextJournal = reconcileInvoiceReceipt(journal, previous, { ...previous, received }, date);
  return { ...state, invoices: state.invoices.map(item => shares.find(member => member.key === item.key) || item), journal: nextJournal };
}
export function registerJournal(state, entry, appendKey) {
  const previous = appendKey && state.journal.find(row => row.key === appendKey);
  if (appendKey && !previous) throw new Error('日记账记录不存在');
  const base = previous || entry;
  const amount = Number(base.income || base.expense);
  if (!(amount > 0) || (Number(base.income) > 0 && Number(base.expense) > 0)) throw new Error('请填写一个方向的有效正金额');
  if (!base.date || !base.summary?.trim() || !base.payer?.trim() || !validDate(base.date)) throw new Error('实际日期、摘要和收付款人必填');
  if (!entry.allocations?.length) throw new Error('至少添加一条有效关联');
  const links = [...(previous?.allocations || []), ...entry.allocations];
  if (links.some(link => !(Number(link.amount) > 0)) || round(links.reduce((sum, link) => sum + Number(link.amount), 0)) > round(amount)) throw new Error('关联金额须大于0，合计不能超过本条收付');
  let invoices = state.invoices.map(row => ({ ...row }));
  for (const link of entry.allocations) {
    if (Number(base.income) > 0) {
      const row = invoices.find(item => item.key === link.target);
      if (!row?.invoiceNo) throw new Error('收入只能关联已开票的验收明细');
      row.received = round(Number(row.received || 0) + Number(link.amount)); row.arrivedAt = base.date;
      const error = validateFinanceInvoice(row, invoices); if (error) throw new Error(error);
    } else {
      const approval = state.approvals.find(item => item.key === link.target);
      if (!approval || !['费用报销', '对公付款', '借款'].includes(approval.type) || approval.status !== '已读取') throw new Error('支出仅关联已读取的报销、对公付款或借款审批');
    }
  }
  const saved = { ...base, key: base.key || uid('journal'), allocations: links };
  return { ...state, invoices, journal: previous ? state.journal.map(item => item.key === saved.key ? saved : item) : [...state.journal, saved] };
}
export function validDate(date) { return /^\d{4}-\d{2}-\d{2}$/.test(date || '') && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date; }
export function approvalPayment(approval, journal) {
  const paid = round(journal.reduce((sum, entry) => sum + (entry.expense > 0 ? (entry.allocations || []).filter(link => link.target === approval.key || link.approvalKey === approval.key).reduce((total, link) => total + Number(link.amount), 0) : 0), 0));
  const approved = invoiceNumber(approval.amount);
  return { paid, unpaid: approved == null ? null : Math.max(0, round(approved - paid)), difference: approved == null ? null : round(paid - approved), paymentStatus: paid === 0 ? '未付款' : approved == null || paid < approved ? '部分付款' : '已付款' };
}
export function settlementError(row, state) {
  const approval = state.approvals.find(item => item.key === row.approvalKey);
  if (!approval || approval.status !== '已读取' || approval.result !== '审批通过') return '来源审批尚未成功读取并通过';
  if (!row.sourceLineId || !row.projectMatched || !row.projectNo || !row.projectName || !row.idCode || !row.bankName || !row.bankNo || !row.bank) return '来源身份、项目匹配或收款资料不完整';
  if ([row.quantity, row.price, row.amount].some(value => invoiceNumber(value) == null || Number(value) < 0) || round(row.quantity * row.price) !== round(row.amount)) return '结算量 × 单价与应发金额不符';
  if (state.settlements.some(other => other.key !== row.key && (other.sourceLineId === row.sourceLineId || (other.projectNo === row.projectNo && other.period === row.period && other.idCode === row.idCode)))) return '重复结算明细，请核对来源';
  return '';
}
export function completeSettlements(state, keys, date) {
  if (!validDate(date)) throw new Error('请填写真实有效的实际付款日期');
  const rows = state.settlements.filter(row => keys.includes(row.key));
  if (!rows.length || rows.length !== keys.length) throw new Error('请选择本次有效结算明细');
  if (new Set(rows.map(row => `${row.approvalKey}|${row.period}`)).size !== 1) throw new Error('本次完成仅限同一来源审批、同一周期');
  for (const row of rows) { if (row.completedAt) throw new Error('所选明细已完成，请刷新'); const error = settlementError(row, state); if (error) throw new Error(error); }
  const key = uid('settlement-payment'); const amount = round(rows.reduce((sum, row) => sum + Number(row.amount), 0));
  if (!(amount > 0)) throw new Error('本次没有正金额实际支出');
  const entry = { key, date, summary: `兼职结算 · ${rows[0].period}`, payer: [...new Set(rows.map(row => row.bankName))].join('、'), income: 0, expense: amount,
    source: rows[0].approvalKey, allocations: rows.map(row => ({ target: row.key, approvalKey: row.approvalKey, type: '兼职结算', name: row.projectName, amount: row.amount })) };
  return { ...state, journal: [...state.journal, entry], settlements: state.settlements.map(row => keys.includes(row.key) ? { ...row, completedAt: new Date().toISOString(), completedBy: '财务 · 赵敏', paidDate: date, journalKey: key } : row) };
}
export function projectFinance(projectNo, state) {
  const rows = state.invoices.filter(row => row.projectNo === projectNo);
  const total = round(rows.reduce((sum, row) => sum + Number(row.acceptanceAmount || 0), 0));
  const received = round(rows.reduce((sum, row) => sum + Number(row.received || 0), 0));
  return { acceptanceInvoiced: round(rows.filter(row => row.invoiceNo).reduce((sum, row) => sum + Number(row.acceptanceAmount || 0), 0)), remitted: received,
    invoiceStatus: rows.length ? rows.some(row => !row.invoiceNo) ? '待开票' : '已开票' : '未开票', paymentStatus: received === 0 ? '待回款' : received < total ? '部分回款' : '已回款' };
}
export function financeAllowed(role, page) { return role === '财务' || ['finance-customers', 'finance-costs'].includes(page); }
export function customerProjection(rows, role) { return role === '财务' ? rows : rows.map(({ key, code, name, fullName }) => ({ key, code, name, fullName })); }
export function costProjection(rows, role, month) { return role === '财务' ? rows : rows.filter(row => row.month === month).map(({ key, position, month, daily }) => ({ key, position, month, daily })); }
export function loadRoleWorkspace(role, month) {
  const state = loadWorkspace();
  if (role === '财务') return state;
  return { revision: state.revision, customers: customerProjection(state.customers, role), costs: costProjection(state.costs, role, month), invoices: [], journal: [], settlements: [], approvals: [], contracts: [], audit: [] };
}
