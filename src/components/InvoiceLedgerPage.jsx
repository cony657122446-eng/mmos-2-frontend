import { loadWorkspace, saveWorkspace, normalizeInvoice, legacyView, combineInvoices, uid } from '../data/financeWorkspace';
import { findFinanceCustomer } from '../data/financeCustomers';
export { FinancePage as InvoiceLedgerPage } from './FinancePage';
export const INVOICE_KEY = 'mmos.finance.ledger.v1';
export function loadInvoices() { return loadWorkspace().invoices.map(legacyView); }
function fromAcceptance(acceptance, state) {
  const customer = findFinanceCustomer(acceptance, state.customers);
  if (!customer || !customer.active) throw new Error('客户不存在或已停用，不能提出新的开票需求');
  return normalizeInvoice({ ...acceptance, key: uid('invoice'), recordNo: acceptance.acceptanceNo, customerKey: customer.key, acceptanceType: acceptance.type,
    acceptanceAmount: acceptance.amount, taxIncluded: acceptance.amount, received: 0, invoiceNo: '', invoiceDate: '', voucher: '',
    payer: customer.fullName, taxNo: customer.taxNo, category: customer.invoiceItemName || '', taxCode: customer.taxCode || '',
    ocrAcceptanceNo: acceptance.ocrAcceptanceNo || acceptance.ocrResult?.acceptanceNo || '' }, state.customers);
}
export function createInvoice(acceptance) {
  const state = loadWorkspace();
  if (state.invoices.some(row => row.acceptanceNo === acceptance.acceptanceNo)) return state.invoices.map(legacyView);
  return saveWorkspace(state, { ...state, invoices: [...state.invoices, fromAcceptance(acceptance, state)] }, '验收审核生成开票需求', 'PMO').invoices.map(legacyView);
}
export function requestCombinedInvoice(acceptances) {
  const state = loadWorkspace();
  if (!acceptances.length || acceptances.some(row => row.applyStatus !== '已通过')) throw new Error('请选择审核通过的验收');
  let next = { ...state, invoices: [...state.invoices] };
  const keys = acceptances.map(acceptance => {
    let row = next.invoices.find(row => row.acceptanceNo === acceptance.acceptanceNo);
    if (!row) { row = fromAcceptance(acceptance, state); next.invoices.push(row); }
    if (row.invoiceNo || row.legacyConfirmed) throw new Error('所选验收已有已确认的开票业务');
    return row.key;
  });
  if (keys.length > 1) next = combineInvoices(next, keys);
  saveWorkspace(state, next, '验收侧提出开票需求', 'PMO');
}
export function projectInvoiceStatus(projectId, invoices = loadInvoices()) { const rows = invoices.filter(row => row.projectId === projectId); return !rows.length ? '未开票' : rows.some(row => !row.invoiceNo) ? '待开票' : '已开票'; }
