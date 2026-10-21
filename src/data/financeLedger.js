export const FINANCE_LEDGER_STORAGE_KEY = 'mmos.finance.ledger.v1';

const isRow = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isLedger = value => isRow(value) && Array.isArray(value.invoices) && value.invoices.every(isRow)
  && Array.isArray(value.journal) && value.journal.every(isRow);
const isBlank = value => value == null || (typeof value === 'string' && value.trim() === '');
const text = value => value == null ? '' : String(value).trim();
const numeric = value => isBlank(value) ? 0 : ['number', 'string'].includes(typeof value) ? Number(value) : NaN;
const cents = value => Math.round((numeric(value) + Number.EPSILON) * 100);
const hasInvoice = row => text(row.invoiceNo) !== '';
const isKnownAmount = value => !isBlank(value) && Number.isFinite(numeric(value))
  && numeric(value) >= 0 && Number.isSafeInteger(cents(value));
const isCalendarDate = value => {
  const date = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
};

export function loadFinanceLedger(fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(FINANCE_LEDGER_STORAGE_KEY) || 'null');
    return isLedger(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function saveFinanceLedger(state) {
  if (!isLedger(state)) throw new TypeError('发票与日记账数据格式不正确，未保存');
  localStorage.setItem(FINANCE_LEDGER_STORAGE_KEY, JSON.stringify(state));
}

export function invoiceStage(row) {
  if (!hasInvoice(row)) return row.legacyConfirmed ? '待回款' : '待开票';
  if (!isKnownAmount(row.taxIncluded) || !isKnownAmount(row.received)) return '待回款';
  return receiptStatus(row);
}

export function receiptStatus(row) {
  if (!isKnownAmount(row.received)) return '待回款';
  const received = cents(row.received);
  if (!isKnownAmount(row.taxIncluded)) return received > 0 ? '部分回款' : '待回款';
  const total = cents(row.taxIncluded);
  if (hasInvoice(row) && received >= total) return '已回款';
  if (received <= 0) return '待回款';
  return received < total ? '部分回款' : '已回款';
}

const nonnegativeFields = {
  volume: '验收工作量',
  quantity: '数量',
  unitPrice: '单价',
  price: '单价',
  deliveryAmount: '交付金额',
  acceptanceAmount: '验收金额',
  taxIncluded: '含税金额',
  received: '到账金额',
  amount: '金额',
  amountValue: '金额',
};

export function validateFinanceInvoice(row, invoices = []) {
  for (const [field, label] of Object.entries({ projectName: '项目名称', projectNo: '项目编号', recordNo: '记录编号' })) {
    if (!text(row[field])) return `${label}必填`;
  }
  for (const [field, label] of Object.entries({ acceptanceAmount: '验收金额', taxIncluded: '含税金额', received: '到账金额' })) {
    if (isBlank(row[field])) return `${label}必填`;
  }
  for (const [field, label] of Object.entries(nonnegativeFields)) {
    if (isBlank(row[field])) continue;
    const value = numeric(row[field]);
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(cents(value))) return `${label}必须为有效的非负数`;
  }
  if (!isBlank(row.taxRate) && (!Number.isFinite(numeric(row.taxRate)) || numeric(row.taxRate) < 0 || numeric(row.taxRate) > 1)) {
    return '税率必须在 0% 至 100% 之间';
  }
  for (const [field, label] of Object.entries({ invoiceDate: '开票日期', arrivedAt: '到账日期', start: '项目开始日期', end: '项目结束日期' })) {
    if (!isBlank(row[field]) && !isCalendarDate(row[field])) return `${label}必须为有效的 YYYY-MM-DD 日期`;
  }
  if (numeric(row.received) > 0 && isBlank(row.arrivedAt)) return '到账金额大于 0 时，到账日期必填';
  if (cents(row.received) > cents(row.taxIncluded)) return '到账金额不能大于含税金额';
  if (!hasInvoice(row)) {
    return cents(row.received) > 0 ? '请先完成开票，再登记回款' : '';
  }
  const duplicate = invoices.some(item => item !== row && (!row.key || item.key !== row.key)
    && text(item.invoiceNo) === text(row.invoiceNo) && (!row.groupId || item.groupId !== row.groupId));
  if (duplicate) return '发票编号重复，不能保存';
  if (!text(row.invoiceDate) || !text(row.voucher)) return '已开票记录的开票日期和发票凭证必填';
  if (cents(row.taxIncluded) !== cents(row.acceptanceAmount)) return '含税金额必须等于验收金额';
  return '';
}

const isReceiptEntry = entry => !entry.opening && numeric(entry.expense) === 0 && numeric(entry.income) > 0;
const isTargetAllocation = (allocation, key) => allocation.target === key && allocation.type === '开票';

// Correct only the edited invoice's share: one journal entry can also contain
// receipts allocated to other invoices, or an amount that is still unallocated.
export function reconcileInvoiceReceipt(journal, previous, next, date) {
  if (!previous.key || previous.key !== next.key) throw new Error('台账记录标识发生变化，无法同步回款');
  const before = cents(previous.received);
  const after = cents(next.received);
  if (![before, after].every(value => Number.isSafeInteger(value) && value >= 0)) {
    throw new Error('到账金额无效，无法同步日记账');
  }
  const key = next.key;
  const renamed = previous.projectName !== next.projectName;
  const customerChanged = previous.customer !== next.customer || previous.payer !== next.payer;
  let updated = journal.map(entry => {
    if (!isReceiptEntry(entry)) return entry;
    const allocations = entry.allocations || [];
    if (!allocations.some(allocation => isTargetAllocation(allocation, key))) return entry;
    if (!renamed && !customerChanged) return entry;
    const exclusive = allocations.every(allocation => isTargetAllocation(allocation, key));
    return {
      ...entry,
      ...(exclusive && renamed ? { summary: `${next.projectName}开票回款` } : {}),
      ...(exclusive && customerChanged ? { payer: next.customer || next.payer || '' } : {}),
      allocations: allocations.map(allocation => isTargetAllocation(allocation, key)
        ? { ...allocation, name: next.projectName } : allocation),
    };
  });
  const difference = after - before;
  if (difference > 0) {
    const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return [...updated, {
      key: `j-receipt-${suffix}`,
      date,
      summary: `${next.projectName}开票回款`,
      payer: next.customer || next.payer || '',
      income: difference / 100,
      expense: 0,
      note: '台账回款调整',
      allocations: [{ target: key, type: '开票', name: next.projectName, amount: difference / 100 }],
    }];
  }
  let remaining = -difference;
  for (let index = updated.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const entry = updated[index];
    if (!isReceiptEntry(entry)) continue;
    const allocations = entry.allocations || [];
    const targets = allocations.filter(allocation => isTargetAllocation(allocation, key));
    if (!targets.length) continue;
    const amounts = targets.map(allocation => cents(allocation.amount));
    const income = cents(entry.income);
    if (!Number.isSafeInteger(income) || amounts.some(amount => !Number.isSafeInteger(amount) || amount < 0)
      || allocations.reduce((sum, item) => sum + cents(item.amount), 0) > income) {
      throw new Error('历史回款分摊与收入金额不一致，请先核对日记账');
    }
    let deducted = 0;
    const nextAllocations = [...allocations];
    for (let allocationIndex = nextAllocations.length - 1; allocationIndex >= 0 && remaining > 0; allocationIndex -= 1) {
      const allocation = nextAllocations[allocationIndex];
      if (!isTargetAllocation(allocation, key)) continue;
      const amount = cents(allocation.amount);
      const reduction = Math.min(amount, remaining);
      deducted += reduction;
      remaining -= reduction;
      if (reduction === amount) nextAllocations.splice(allocationIndex, 1);
      else nextAllocations[allocationIndex] = { ...allocation, amount: (amount - reduction) / 100 };
    }
    if (income === deducted && nextAllocations.length === 0) updated[index] = null;
    else updated[index] = { ...entry, income: (income - deducted) / 100, allocations: nextAllocations };
  }
  if (remaining > 0) throw new Error('历史回款分摊金额不足，无法同步减少到账金额，请先核对日记账');
  return updated.filter(entry => entry !== null);
}
