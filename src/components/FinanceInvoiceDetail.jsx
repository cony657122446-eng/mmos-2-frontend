import React from 'react';
import { Alert, Button, DatePicker, Form, Input, InputNumber, Select, Space, Tabs, Tag } from 'antd';
import dayjs from 'dayjs';
import { findFinanceCustomer } from '../data/financeCustomers';
import { invoiceNumber } from '../data/invoiceFields';
import { FinanceFile, FilePreview } from './FinanceFile';
import { invoiceStage, receiptStatus } from '../data/financeLedger';

const DATE_FIELDS = ['start', 'end', 'invoiceDate', 'arrivedAt'];
const rawFields = [
  'recordNo', 'parent', 'projectName', 'mainProject', 'projectNo', 'customerKey', 'customer',
  'acceptanceType', 'start', 'end', 'volume', 'deliveryAmount', 'acceptanceAmount', 'evidence', 'duplicate',
  'payer', 'taxNo', 'category', 'taxCode', 'taxIncluded', 'invoiceNo', 'invoiceDate', 'voucher',
  'received', 'arrivedAt', 'note', 'pm', 'previousPm', 'mentorPm', 'financeOwner',
  'invoiceSerialNo', 'invoiceType', 'isTaxIncluded', 'ocrAcceptanceNo', 'quantity', 'unitPrice',
];

function rateRatio(value) {
  if (typeof value === 'string' && value.trim().endsWith('%')) { const percent = invoiceNumber(value.replace('%', '')); return percent == null ? null : percent / 100; }
  return invoiceNumber(value);
}

function asDate(value) {
  if (!value) return undefined;
  const date = dayjs(value);
  return date.isValid() ? date : undefined;
}

function dateText(value) {
  const date = asDate(value);
  return date ? date.format('YYYY-MM-DD') : '—';
}

function money(value) {
  const number = invoiceNumber(value);
  return number == null ? '待补充' : `¥ ${number.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shown(value) { return value == null || value === '' ? '—' : String(value); }

function initialValues(row, customers) {
  const values = Object.fromEntries(rawFields.map(name => [name, row?.[name]]));
  const customer = row && findFinanceCustomer(row, customers);
  values.attachment = { name: row?.voucher, url: row?.voucherUrl };
  values.customerKey = row?.customerKey || customer?.key;
  values.customer = row?.customer || customer?.name || '';
  values.isTaxIncluded = row?.isTaxIncluded === true || row?.isTaxIncluded === '是' ? true : row?.isTaxIncluded === false || row?.isTaxIncluded === '否' ? false : undefined;
  DATE_FIELDS.forEach(name => { values[name] = asDate(row?.[name]); });
  const rate = rateRatio(row?.taxRate);
  values.taxRatePercent = rate == null ? undefined : Number((rate * 100).toFixed(6));
  return values;
}

function storedValues(values) {
  const result = Object.fromEntries(rawFields.map(name => [name, values[name]]));
  DATE_FIELDS.forEach(name => { result[name] = values[name] ? dayjs(values[name]).format('YYYY-MM-DD') : ''; });
  const percent = invoiceNumber(values.taxRatePercent);
  result.taxRate = percent == null ? null : percent / 100;
  if (values.attachment) { result.voucher = values.attachment.name; result.voucherUrl = values.attachment.url; }
  return result;
}

function derivedValues(row, customers) {
  const amount = invoiceNumber(row.taxIncluded);
  const received = invoiceNumber(row.received);
  const rate = rateRatio(row.taxRate);
  const receipt = receiptStatus(row);
  const stage = invoiceStage(row);
  const net = amount == null || rate == null ? null : Math.round(amount / (1 + rate) * 100) / 100;
  const customer = findFinanceCustomer(row, customers);
  const due = row.invoiceNo && row.invoiceDate && customer?.term != null ? asDate(row.invoiceDate)?.add(Number(customer.term), 'day') : null;
  const overdue = due && stage !== '已回款' ? Math.max(0, dayjs().startOf('day').diff(due.startOf('day'), 'day')) : 0;
  return {
    stage,
    receipt,
    net: money(net),
    tax: money(amount == null || net == null ? null : Math.round((amount - net) * 100) / 100),
    outstanding: money(amount == null || received == null ? null : Math.max(0, Math.round((amount - received) * 100) / 100)),
    invoiceMonth: row.invoiceDate ? asDate(row.invoiceDate)?.format('YYYY-MM') || '—' : '—',
    arrivedMonth: row.arrivedAt ? asDate(row.arrivedAt)?.format('YYYY-MM') || '—' : '—',
    due: due?.format('YYYY-MM-DD') || '—',
    dueMonth: due?.format('YYYY-MM') || '—',
    overdue: overdue > 0 ? `${overdue} 天` : '—',
  };
}

const groups = [
  { key: 'project', title: '项目与验收', fields: [
    { name: 'recordNo', label: '记录编号' }, { name: 'parent', label: '父记录' },
    { name: 'projectName', label: '项目名称' }, { name: 'mainProject', label: '主项目名称' },
    { name: 'projectNo', label: '内部项目编号 ID' }, { name: 'customerKey', label: '客户', kind: 'customer' },
    { name: 'acceptanceType', label: '验收类型', kind: 'acceptanceType' },
    { name: 'start', label: '项目开始时间', kind: 'date' }, { name: 'end', label: '项目结束时间', kind: 'date' },
    { name: 'volume', label: '数据量', kind: 'number', precision: 6 },
    { name: 'deliveryAmount', label: '交付金额', kind: 'money' }, { name: 'acceptanceAmount', label: '验收金额', kind: 'money' },
    { name: 'evidence', label: '交付依据截图', kind: 'multiline' }, { name: 'duplicate', label: '重复' },
  ] },
  { key: 'invoice', title: '开票信息', fields: [
    { name: 'invoiceSerialNo', label: '发票流水号' }, { name: 'invoiceType', label: '发票类型' },
    { name: 'isTaxIncluded', label: '是否含税', kind: 'boolean' },
    { name: 'payer', label: '付款方（购买方名称）' }, 
    { name: 'taxNo', label: '纳税人识别号' }, { name: 'category', label: '项目名称（开票）' },
    { name: 'taxCode', label: '商品和服务税收编码' }, { name: 'ocrAcceptanceNo', label: '备注（OCR 验收单号）' },
    { name: 'quantity', label: '数量', kind: 'number', precision: 6 },
    { name: 'unitPrice', label: '单价', kind: 'number', precision: 6 },
    { name: 'taxRatePercent', label: '开票税点（%）', kind: 'rate' },
    { name: 'taxIncluded', label: '含税金额', kind: 'money' },
    { derived: 'net', label: '不含税金额' }, { derived: 'tax', label: '税额' },
    { name: 'invoiceNo', label: '发票编号' }, { name: 'invoiceDate', label: '开票日期', kind: 'date' },
    { derived: 'invoiceMonth', label: '开票月份' }, { name: 'attachment', label: '发票凭证', kind: 'attachment' },
    { derived: 'stage', label: '当前状态' },
  ] },
  { key: 'receipt', title: '回款信息', fields: [
    { derived: 'receipt', label: '到账情况' }, { name: 'received', label: '到账金额', kind: 'money' },
    { derived: 'outstanding', label: '未收金额' }, { name: 'arrivedAt', label: '实际到账时间', kind: 'date' },
    { derived: 'arrivedMonth', label: '实际到账月份' }, { derived: 'due', label: '预计回款日' },
    { derived: 'dueMonth', label: '预计回款月份' }, { derived: 'overdue', label: '逾期天数' },
    { name: 'note', label: '备注', kind: 'multiline' },
  ] },
  { key: 'owners', title: '责任人', fields: [
    { name: 'pm', label: 'PM' }, { name: 'previousPm', label: '前 PM' },
    { name: 'mentorPm', label: '带教 PM' }, { name: 'financeOwner', label: '责任财务' },
  ] },
];

export function FinanceInvoiceDetail({ row, customers = [], editable = false, editing = false, onEdit, onCancel, onSave, onBack, onIssue, onReceipt }) {
  const [form] = Form.useForm();
  const watched = Form.useWatch([], form);
  const isEditing = editable && editing;
  React.useEffect(() => {
    form.resetFields();
    if (row) form.setFieldsValue(initialValues(row, customers));
  }, [row?.key, isEditing, form]);
  if (!row) return null;
  const initial = initialValues(row, customers);
  const live = isEditing ? storedValues({ ...initial, ...watched }) : row;
  const derived = derivedValues(live, customers);
  const chooseCustomer = key => {
    const customer = customers.find(item => item.key === key);
    form.setFieldsValue({
      customerKey: key,
      customer: customer?.name || '',
      payer: customer?.fullName || '',
      taxNo: customer?.taxNo || '',
      category: customer?.invoiceItemName || '',
      taxCode: customer?.taxCode || '',
    });
  };
  const customerOptions = customers.map(customer => ({ value: customer.key, label: customer.name }));
  if (initial.customerKey && !customerOptions.some(item => item.value === initial.customerKey)) customerOptions.push({ value: initial.customerKey, label: row.customer || initial.customerKey });

  const control = field => {
    if (field.kind === 'attachment') return <FinanceFile />;
    if (field.kind === 'date') return <DatePicker placeholder="选择日期" style={{ width: '100%' }} />;
    if (field.kind === 'customer') return <Select allowClear showSearch optionFilterProp="label" options={customerOptions} onChange={chooseCustomer} placeholder={row.customer || '请选择客户'} />;
    if (field.kind === 'acceptanceType') return <Select allowClear options={['阶段验收', '最终验收'].map(value => ({ value, label: value }))} />;
    if (field.kind === 'boolean') return <Select allowClear placeholder="待补充" options={[{ value: true, label: '是' }, { value: false, label: '否' }]} />;
    if (field.kind === 'money' || field.kind === 'number' || field.kind === 'rate') return <InputNumber min={0} max={field.kind === 'rate' ? 100 : undefined} precision={field.kind === 'money' ? 2 : field.precision ?? 6} style={{ width: '100%' }} />;
    if (field.kind === 'multiline') return <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} />;
    return <Input />;
  };
  const fieldValue = field => {
    if (field.kind === 'attachment') return <>{row.voucher || '未提供'} <FilePreview name={row.voucher} url={row.voucherUrl} /></>;
    if (field.derived) return derived[field.derived];
    if (field.kind === 'customer') return shown(row.customer);
    if (field.kind === 'date') return dateText(row[field.name]);
    if (field.kind === 'money') return money(row[field.name]);
    if (field.kind === 'boolean') return row[field.name] === true || row[field.name] === '是' ? '是' : row[field.name] === false || row[field.name] === '否' ? '否' : '待补充';
    if (field.kind === 'rate') { const rate = rateRatio(row.taxRate); return rate == null ? '待补充' : `${Number((rate * 100).toFixed(6))}%`; }
    return shown(row[field.name]);
  };
  const renderField = field => {
    const key = field.name || field.derived;
    if (isEditing && !field.derived && !['recordNo', 'projectNo', 'projectName', 'customerKey', 'acceptanceAmount', ...(row.groupId ? ['received', 'arrivedAt', 'taxIncluded', 'invoiceNo', 'invoiceDate', 'attachment'] : [])].includes(field.name)) return <Form.Item key={key} name={field.name} label={field.label}>{control(field)}</Form.Item>;
    const value = fieldValue(field);
    const isImage = field.name === 'evidence' && typeof value === 'string' && /^data:image\//.test(value);
    return <div key={key} className="finance-invoice-field-readonly"><small>{field.label}</small>{isImage ? <img className="quote-voucher-preview" src={value} alt="交付依据截图" /> : <strong>{value}</strong>}</div>;
  };
  const submit = values => { if (isEditing) onSave?.(storedValues({ ...initial, ...values })); };
  return <div className={`detail-screen finance-invoice-detail${isEditing ? ' finance-invoice-editor' : ''}`}>
    <div className="detail-screen-bar">
      <div className="detail-screen-main"><button className="detail-back" onClick={onBack}>返回列表</button><div className="detail-screen-kicker">{shown(row.recordNo)}</div><h1>{shown(row.projectName)}</h1></div>
      <Space wrap>
        <Tag color={derived.stage === '已回款' ? 'success' : 'processing'}>{derived.stage}</Tag>
        {isEditing ? <><Button onClick={onCancel}>取消</Button><Button type="primary" onClick={() => form.submit()}>保存修改</Button></> : editable && <><Button onClick={() => onEdit?.(row)}>编辑全部内容</Button>{derived.stage === '待开票' && <Button type="primary" onClick={() => onIssue?.(row)}>确认开票</Button>}{derived.stage !== '待开票' && !row.migrationIssue && <Button onClick={() => onReceipt?.(row)}>登记回款</Button>}</>}
      </Space>
    </div>
    {row.migrationIssue && <Alert type="warning" showIcon title={row.migrationIssue} />}
    {isEditing && <p className="modal-help-copy">仅更正当前台账资料。项目、客户和验收来源归属保持关联；合票发票信息与回款分配通过整票操作维护。</p>}
    {row.groupId && <p className="modal-help-copy">合并开票 · 当前金额为本条验收口径，登记回款时查看整票金额及各验收手动分配。</p>}
    <Form name="finance-invoice-detail" form={form} layout="vertical" preserve onFinish={submit}>
      {isEditing && <Form.Item name="customer" hidden><Input /></Form.Item>}
      <Tabs items={groups.map(group => ({ key: group.key, label: group.title, forceRender: true, children: <div className={`finance-invoice-fields${isEditing ? '' : ' quote-field-grid'}`}>{group.fields.map(renderField)}</div> }))} />
    </Form>
  </div>;
}

