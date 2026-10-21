import { findFinanceCustomer } from './financeCustomers.js';

export const INVOICE_FIELD_DEFINITIONS = [
  { key: 'serialNo', label: '发票流水号', width: 160 },
  { key: 'invoiceType', label: '发票类型', width: 180 },
  { key: 'taxIncluded', label: '是否含税', width: 100 },
  { key: 'buyer', label: '购买方名称', width: 260 },
  { key: 'buyerTaxNo', label: '购买方纳税人识别号', width: 220 },
  { key: 'remark', label: '备注', width: 180 },
  { key: 'itemName', label: '项目名称', width: 170 },
  { key: 'taxCode', label: '商品和服务税收编码', width: 220 },
  { key: 'quantity', label: '数量', width: 100 },
  { key: 'unitPrice', label: '单价', width: 140 },
  { key: 'amount', label: '金额', width: 140 },
  { key: 'taxRate', label: '税率', width: 100 },
];

export function invoiceNumber(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const normalized = String(value).replace(/[,，\s¥￥元]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

const currency = value => value == null ? '待补充' : `¥ ${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const text = value => value == null || value === '' ? '待补充' : String(value);

export function getInvoiceFields(record, customers, acceptances = []) {
  const customer = findFinanceCustomer(record, customers);
  const acceptance = acceptances.find(item => item.acceptanceNo === record.acceptanceNo);
  const ocrAcceptanceNo = record.ocrAcceptanceNo || record.ocrResult?.acceptanceNo || acceptance?.ocrAcceptanceNo || acceptance?.ocrResult?.acceptanceNo;
  const quantity = invoiceNumber(record.quantity);
  const amount = invoiceNumber(record.amountValue ?? record.amount);
  const unitPrice = invoiceNumber(record.unitPrice) ?? (quantity > 0 && amount != null ? amount / quantity : null);
  const included = record.isTaxIncluded;
  const taxIncluded = included === true || included === '是' ? '是' : included === false || included === '否' ? '否' : '待补充';
  const rate = record.taxRate;
  const values = {
    serialNo: text(record.invoiceSerialNo || record.serialNo),
    invoiceType: text(record.invoiceType),
    taxIncluded,
    buyer: text(customer?.fullName),
    buyerTaxNo: text(customer?.taxNo),
    remark: ocrAcceptanceNo ? String(ocrAcceptanceNo) : '待识别',
    itemName: text(customer?.invoiceItemName),
    taxCode: text(customer?.taxCode),
    quantity: quantity == null ? '待补充' : String(quantity),
    unitPrice: currency(unitPrice),
    amount: currency(amount),
    taxRate: typeof rate === 'number' && Number.isFinite(rate) ? `${Number((rate * 100).toFixed(4))}%` : text(rate),
  };
  return INVOICE_FIELD_DEFINITIONS.map(field => ({ ...field, value: values[field.key], hint: field.key === 'unitPrice' && invoiceNumber(record.unitPrice) == null && unitPrice != null ? '按当前金额 ÷ 数量计算，与金额采用相同含税口径' : undefined }));
}

