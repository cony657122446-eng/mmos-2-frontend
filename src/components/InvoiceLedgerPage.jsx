import { loadWorkspace, saveWorkspace, legacyView, invoiceTasks } from '../data/financeWorkspace';
import { invoiceStateForAcceptanceGroup } from '../data/acceptanceGroups';
export { FinancePage as InvoiceLedgerPage } from './FinancePage';
export const INVOICE_KEY = 'mmos.finance.ledger.v1';
export function loadInvoiceTasks() { const state = loadWorkspace(); return invoiceTasks(state.invoices).map(row => ({ ...legacyView(row), subjectActive: state.customers.find(subject => subject.key === (row.subjectKey || row.customerKey))?.active !== false })); }
export function loadInvoices() { return loadWorkspace().invoices.map(legacyView); }
export function createInvoice(acceptance) {
  return requestCombinedInvoice([acceptance]);
}
export function requestCombinedInvoice(acceptances) {
  const state = loadWorkspace();
  const next = invoiceStateForAcceptanceGroup(state, acceptances);
  if (next === state) return state.invoices.map(legacyView);
  return saveWorkspace(state, next, '按已通过固定验收组生成财务待办', 'PMO').invoices.map(legacyView);
}
export function projectInvoiceStatus(projectId, invoices = loadInvoices()) { const rows = invoices.filter(row => row.projectId === projectId); return !rows.length ? '未开票' : rows.some(row => !row.invoiceNo) ? '待开票' : '已开票'; }
