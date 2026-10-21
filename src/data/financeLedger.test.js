import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FINANCE_LEDGER_STORAGE_KEY, loadFinanceLedger, saveFinanceLedger,
  invoiceStage, receiptStatus, validateFinanceInvoice, reconcileInvoiceReceipt,
} from './financeLedger.js';

const invoice = (overrides = {}) => ({
  key: 'i1', recordNo: 'R001', projectNo: 'P001', projectName: '项目一',
  customer: '客户一', invoiceNo: 'F001', invoiceDate: '2026-10-20', voucher: '发票.pdf',
  acceptanceAmount: 100, taxIncluded: 100, received: 0, arrivedAt: '2026-10-20', taxRate: 0.06, ...overrides,
});
const allocation = (target, amount, extra = {}) => ({ target, amount, type: '开票', name: target, ...extra });
const entry = (key, income, allocations, extra = {}) => ({
  key, date: '2026-10-20', payer: '客户一', summary: '原始摘要', income, expense: 0, allocations, ...extra,
});

test('分类以开票和分单位回款金额为准，包括零金额、部分回款和全额回款', () => {
  assert.equal(invoiceStage(invoice({ invoiceNo: '  ' })), '待开票');
  assert.equal(invoiceStage(invoice()), '待回款');
  assert.equal(receiptStatus(invoice()), '待回款');
  assert.equal(invoiceStage(invoice({ received: 0.1 })), '部分回款');
  assert.equal(receiptStatus(invoice({ received: 0.1 })), '部分回款');
  assert.equal(invoiceStage(invoice({ received: 100 })), '已回款');
  assert.equal(receiptStatus(invoice({ received: 100 })), '已回款');
  const zero = invoice({ acceptanceAmount: 0, taxIncluded: 0 });
  assert.equal(invoiceStage(zero), '已回款');
  assert.equal(receiptStatus(zero), '已回款');
  assert.equal(receiptStatus({ ...zero, invoiceNo: '' }), '待回款');
  assert.equal(invoiceStage(invoice({ taxIncluded: 0.3, received: 0.1 + 0.2 })), '已回款');
});

test('编辑校验拒绝重复票号、超收、不匹配金额和负数，允许空的可选字段', () => {
  assert.equal(validateFinanceInvoice(invoice(), [invoice()]), '');
  assert.match(validateFinanceInvoice(invoice({ invoiceNo: ' F001 ' }), [invoice({ key: 'i2' })]), /重复/);
  assert.match(validateFinanceInvoice(invoice({ received: 101 })), /不能大于/);
  assert.match(validateFinanceInvoice(invoice({ taxIncluded: 99 })), /等于验收/);
  assert.match(validateFinanceInvoice(invoice({ invoiceNo: '', received: 1 })), /先完成开票/);
  assert.match(validateFinanceInvoice(invoice({ quantity: -1 })), /非负/);
  assert.match(validateFinanceInvoice(invoice({ taxRate: 1.01 })), /税率/);
  assert.match(validateFinanceInvoice(invoice({ taxIncluded: Infinity })), /非负/);
  assert.match(validateFinanceInvoice(invoice({ invoiceDate: '' })), /开票日期/);
  assert.match(validateFinanceInvoice(invoice({ voucher: '' })), /发票凭证/);
  assert.match(validateFinanceInvoice(invoice({ projectNo: '  ' })), /项目编号/);
  assert.equal(validateFinanceInvoice(invoice({ quantity: '', unitPrice: null, volume: undefined, taxRate: '' })), '');
  assert.equal(validateFinanceInvoice(invoice({ invoiceNo: '', taxIncluded: 0, acceptanceAmount: 100 })), '');
  assert.equal(validateFinanceInvoice(invoice({ taxIncluded: 0.1 + 0.2, acceptanceAmount: 0.3 })), '');
});

test('核心金额缺失不可保存；明确的零金额有效，可选字段仍允许空', () => {
  for (const field of ['acceptanceAmount', 'taxIncluded', 'received']) {
    for (const missing of [null, undefined, '', '   ']) {
      assert.match(validateFinanceInvoice(invoice({ [field]: missing })), /必填/);
    }
  }
  assert.match(validateFinanceInvoice(invoice({ taxIncluded: null, acceptanceAmount: null, received: 0 })), /必填/);
  assert.equal(validateFinanceInvoice(invoice({
    acceptanceAmount: 0, taxIncluded: 0, received: 0,
    quantity: null, unitPrice: '', taxRate: undefined,
  })), '');
});

test('旧数据中缺失或非法的金额不会显示已回款，未知应收但有效正回款显示部分回款', () => {
  for (const invalid of [null, undefined, '', ' ', '错误', NaN, Infinity, -1, false, [], {}]) {
    const missingTotal = invoice({ taxIncluded: invalid, received: 0 });
    assert.equal(invoiceStage(missingTotal), '待回款');
    assert.equal(receiptStatus(missingTotal), '待回款');
    const positiveReceipt = invoice({ taxIncluded: invalid, received: 10 });
    assert.equal(invoiceStage(positiveReceipt), '待回款');
    assert.equal(receiptStatus(positiveReceipt), '部分回款');
    const missingReceipt = invoice({ taxIncluded: 0, received: invalid });
    assert.equal(invoiceStage(missingReceipt), '待回款');
    assert.equal(receiptStatus(missingReceipt), '待回款');
  }
  const legacy = invoice({ taxIncluded: null, acceptanceAmount: null, received: 0 });
  assert.equal(invoiceStage(legacy), '待回款');
  assert.equal(receiptStatus(legacy), '待回款');
  assert.equal(invoiceStage({ ...legacy, invoiceNo: '' }), '待开票');
});

test('正回款要求到账日期，非空日期必须符合真实日历与 YYYY-MM-DD 格式', () => {
  for (const missing of [null, undefined, '', '  ']) {
    assert.match(validateFinanceInvoice(invoice({ received: 1, arrivedAt: missing })), /到账日期必填/);
  }
  assert.equal(validateFinanceInvoice(invoice({ received: 0, arrivedAt: '' })), '');
  for (const field of ['invoiceDate', 'arrivedAt']) {
    for (const invalid of ['2026-02-30', '2026-02-29', '2026-13-01', '2026-00-01', '2026-01-00', '2026-1-01', '2026/01/01']) {
      assert.match(validateFinanceInvoice(invoice({ [field]: invalid })), /有效的 YYYY-MM-DD 日期/);
    }
    assert.equal(validateFinanceInvoice(invoice({ [field]: '2024-02-29' })), '');
  }
});

test('增加回款只新增差额收入，不重新登记原有回款', () => {
  const journal = [entry('j1', 0.1, [allocation('i1', 0.1)])];
  const result = reconcileInvoiceReceipt(journal, invoice({ received: 0.1 }), invoice({ received: 0.3 }), '2026-10-21');
  assert.equal(result.length, 2);
  assert.equal(result[0], journal[0]);
  assert.equal(result[1].income, 0.2);
  assert.equal(result[1].date, '2026-10-21');
  assert.deepEqual(result[1].allocations, [allocation('i1', 0.2, { name: '项目一' })]);
  assert.equal(journal.length, 1);
});

test('减少回款从后向前扣目标分摊，保留混合分摊、未分摊收入、支出和期初', () => {
  const journal = [
    entry('opening', 500, [allocation('i1', 500)], { opening: true }),
    entry('old', 30, [allocation('i1', 30)]),
    entry('mixed', 100, [allocation('i2', 20), allocation('i1', 40)]),
    entry('expense', 0, [allocation('i1', 10)], { expense: 10 }),
    entry('new', 10, [allocation('i1', 10)]),
  ];
  const original = structuredClone(journal);
  const result = reconcileInvoiceReceipt(journal, invoice({ received: 80 }), invoice({ received: 20 }), '2026-10-21');
  assert.deepEqual(result.map(row => row.key), ['opening', 'old', 'mixed', 'expense']);
  assert.equal(result[1].income, 20);
  assert.equal(result[1].allocations[0].amount, 20);
  assert.equal(result[2].income, 60);
  assert.deepEqual(result[2].allocations, [allocation('i2', 20)]);
  assert.equal(result[0], journal[0]);
  assert.equal(result[3], journal[3]);
  assert.deepEqual(journal, original);
});

test('保留相同 target 的非开票分摊，不足时抛错且不修改原日记账', () => {
  const journal = [entry('mixed', 30, [allocation('i1', 10), allocation('i1', 20, { type: '其他' })])];
  const result = reconcileInvoiceReceipt(journal, invoice({ received: 10 }), invoice({ received: 0 }), '2026-10-21');
  assert.equal(result[0].income, 20);
  assert.deepEqual(result[0].allocations, [allocation('i1', 20, { type: '其他' })]);
  const original = structuredClone(journal);
  assert.throws(() => reconcileInvoiceReceipt(journal, invoice({ received: 50 }), invoice({ received: 0 }), '2026-10-21'), /分摊金额不足/);
  assert.deepEqual(journal, original);
});

test('修改名称更新目标分摊名称，仅独占收入更新摘要和客户', () => {
  const journal = [
    entry('own', 20, [allocation('i1', 20)]),
    entry('mixed', 30, [allocation('i1', 10), allocation('i2', 20)]),
  ];
  const result = reconcileInvoiceReceipt(journal, invoice({ received: 30 }), invoice({ received: 30, projectName: '新项目', customer: '新客户' }), '2026-10-21');
  assert.equal(result[0].income, 20);
  assert.equal(result[0].payer, '新客户');
  assert.equal(result[0].summary, '新项目开票回款');
  assert.equal(result[1].summary, '原始摘要');
  assert.equal(result[1].payer, '客户一');
  assert.equal(result[1].allocations[0].name, '新项目');
  assert.equal(result[1].allocations[1], journal[1].allocations[1]);
});

test('存储支持重新加载和空台账，拒绝损坏结构并向调用方报告写入失败', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } });
  try {
    const fallback = { invoices: [invoice()], journal: [] };
    assert.equal(loadFinanceLedger(fallback), fallback);
    const saved = { invoices: [invoice({ received: 30 })], journal: [entry('j1', 30, [allocation('i1', 30)])] };
    saveFinanceLedger(saved);
    assert.deepEqual(loadFinanceLedger(fallback), saved);
    assert.notEqual(loadFinanceLedger(fallback), saved);
    saveFinanceLedger({ invoices: [], journal: [] });
    assert.deepEqual(loadFinanceLedger(fallback), { invoices: [], journal: [] });
    for (const invalid of ['{', '{}', '{"invoices":[],"journal":null}', '{"invoices":[null],"journal":[]}']) {
      storage.set(FINANCE_LEDGER_STORAGE_KEY, invalid);
      assert.equal(loadFinanceLedger(fallback), fallback);
    }
    assert.throws(() => saveFinanceLedger({ invoices: [] }), /格式/);
    globalThis.localStorage.setItem = () => { throw new Error('quota exceeded'); };
    assert.throws(() => saveFinanceLedger(saved), /quota/);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
