export const CUSTOMER_STORAGE_KEY = 'mmos.finance.customers.v1';
export const CUSTOMER_UPDATED_EVENT = 'mmos:finance-customers-updated';

const initialCustomers = [
  { key: 'c1', code: 'KH-001', name: '字节', fullName: '北京字跳网络技术有限公司', taxNo: '91110108MA01ABCD1X', invoiceItemName: '数据标注服务费', taxCode: '3040203000000000000', shortName: '字节', contact: '周宁', term: 30, createdAt: '2026-08-01', active: true },
  { key: 'c2', code: 'KH-002', name: '腾讯', fullName: '深圳市腾讯计算机系统有限公司', taxNo: '9144030071526726XG', invoiceItemName: '数据标注服务费', taxCode: '3040203000000000000', shortName: '腾讯', contact: '李想', term: null, createdAt: '2026-08-12', active: true },
];

export function loadFinanceCustomers() {
  try {
    const workspace = JSON.parse(localStorage.getItem('mmos.finance.ledger.v1') || 'null');
    if (Array.isArray(workspace?.customers)) return workspace.customers;
    const saved = JSON.parse(localStorage.getItem(CUSTOMER_STORAGE_KEY) || 'null');
    return Array.isArray(saved) ? saved : initialCustomers;
  } catch { return initialCustomers; }
}

export function saveFinanceCustomers(customers) {
  localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customers));
  window.dispatchEvent(new CustomEvent(CUSTOMER_UPDATED_EVENT, { detail: customers }));
}

export function findFinanceCustomer(record, customers) {
  if (record.customerKey) return customers.find(item => item.key === record.customerKey);
  const matches = customers.filter(item => item.name === record.customer || item.previousNames?.includes(record.customer));
  return matches.length === 1 ? matches[0] : undefined;
}
