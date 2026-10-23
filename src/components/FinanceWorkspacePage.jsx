import { addFinanceDemo } from '../data/financeDemo';
import React from 'react';
import { Alert, Button, Card, DatePicker, Descriptions, Empty, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, message } from 'antd';
import dayjs from 'dayjs';
import { ShieldCheck } from 'lucide-react';
import { FinanceInvoiceDetail } from './FinanceInvoiceDetail';
import { FinanceFile } from './FinanceFile';
import { FinanceCosts } from './FinanceCosts';
import { FinanceApprovals, FinanceContracts, FinanceSettlement } from './FinanceSources';
import { JournalBox, JournalDetail } from './FinanceJournal';
import { invoiceStage, receiptStatus, validateFinanceInvoice, reconcileInvoiceReceipt } from '../data/financeLedger';
import { loadRoleWorkspace, saveWorkspace, financeAllowed, customerProjection, groupInvoice, combineInvoices, issueInvoice, registerReceipt, registerJournal, round, uid } from '../data/financeWorkspace';
import { invoiceNumber } from '../data/invoiceFields';

const money = value => invoiceNumber(value) == null ? '待补充' : `¥ ${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const names = { 'finance-customers': ['客户台账', '统一维护客户资料与开票信息，已开票资料保留历史快照。'], 'finance-invoices': ['发票与回款', '按验收明细跟踪开票与回款，支持同客户合票及手动分配。'], 'finance-journal': ['日记账', '只登记实际收支，按关联金额同步业务结果。'], 'finance-costs': ['职位成本', '按季度集中维护，按职位和月份生效。'], 'finance-settlement': ['兼职结算', '飞书审批与结算资料归集，完成确认后自动记入实际支出。'], 'finance-approvals': ['财务审批记录', '审批事实、成本归集与实际付款分别保留。'], 'finance-contracts': ['合同管理', '合同源台账只读查询，保留原字段与附件引用。'] };
const status = value => <Tag color={['已回款', '已开票'].includes(value) ? 'success' : value === '部分回款' ? 'warning' : 'processing'}>{value}</Tag>;
export function FinancePage({ page = 'finance-customers', role = '财务', onRoleChange }) {
  const [title, subtitle] = names[page] || names['finance-customers'];
  return <div className="trial-page finance-page"><div className="trial-page-heading"><div><p className="eyebrow">财务工作区</p><h1>{title}</h1><p className="subtitle">{subtitle}</p></div><div className="trial-role-switch"><ShieldCheck size={14} /><span>演示身份</span><Select aria-label="财务演示身份" value={role} onChange={onRoleChange} options={[{ value: '财务', label: '财务 · 赵敏' }, { value: 'PMO', label: 'PMO · 林晓彤' }, { value: 'PM', label: 'PM · 王然' }]} /></div></div>
    {financeAllowed(role, page) ? <FinanceWorkspace key={`${page}:${role}`} page={page} role={role} /> : <Card><Empty description="本页仅财务可查看。客户三字段和本月职位成本可在对应页面查看。" /></Card>}
  </div>;
}
function FinanceWorkspace({ page, role }) {
  const [state, setState] = React.useState(() => loadRoleWorkspace(role, dayjs().format('YYYY-MM')));
  const [editing, setEditing] = React.useState(null); const [invoiceKey, setInvoiceKey] = React.useState(''); const [invoiceEditing, setInvoiceEditing] = React.useState(false);
  const [tab, setTab] = React.useState('全部'); const [query, setQuery] = React.useState(''); const [selected, setSelected] = React.useState([]); const [journalKey, setJournalKey] = React.useState(''); const [auditOpen, setAuditOpen] = React.useState(false);
  const editable = role === '财务'; const { invoices, customers, journal } = state;
  React.useEffect(() => {
    if (role !== '财务') return;
    const current = loadRoleWorkspace(role, dayjs().format('YYYY-MM'));
    if (current.demoDataVersion) return;
    try { setState(saveWorkspace(current, addFinanceDemo(current), '初始化模拟测试数据')); }
    catch (error) { message.error(error.message || '测试数据初始化失败'); }
  }, [role]);
  React.useEffect(() => { const sync = () => { setState(loadRoleWorkspace(role, dayjs().format('YYYY-MM'))); setEditing(null); setInvoiceEditing(false); }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, [role]);
  const commit = (next, action = '更新财务台账') => {
    if (!editable) return false;
    try { const saved = saveWorkspace(state, next, action); setState(saved); return true; } catch (error) { message.error(error.message || '保存失败，原数据保持不变'); return false; }
  };
  const act = (operation, action) => { try { if (commit(operation(), action)) { setEditing(null); message.success(action); return true; } } catch (error) { message.error(error.message); } return false; };
  const saveCustomer = values => {
    const old = editing?.row; const name = values.name?.trim();
    if (!name || !values.fullName?.trim() || !values.taxNo?.trim()) return message.error('客户名称、全名和税号必填');
    if (customers.some(row => row.key !== old?.key && row.active && row.name === name)) return message.error('有效客户名称重复');
    const customer = { ...old, ...values, name, key: old?.key || uid('customer'), code: old?.code || `KH-${Date.now()}`, active: old?.active ?? true, createdAt: old?.createdAt || dayjs().format('YYYY-MM-DD HH:mm'), term: values.term ?? null, previousNames: [...new Set([...(old?.previousNames || []), ...(old && old.name !== name ? [old.name] : [])])] };
    delete customer.shortName; delete customer.customerManager;
    act(() => ({ ...state, customers: old ? customers.map(row => row.key === old.key ? customer : row) : [...customers, customer], invoices: invoices.map(row => old && row.customerKey === old.key && !row.invoiceNo ? { ...row, customer: name, payer: customer.fullName, taxNo: customer.taxNo, category: customer.invoiceItemName || '', taxCode: customer.taxCode || '' } : row) }), '客户及未开票资料已保存');
  };
  const openInvoice = row => { setInvoiceKey(row.key); setInvoiceEditing(false); };
  const detail = invoices.find(row => row.key === invoiceKey);
  const saveDetails = values => act(() => {
    const next = { ...detail, ...values, key: detail.key, recordNo: detail.recordNo, acceptanceNo: detail.acceptanceNo, projectNo: detail.projectNo, projectName: detail.projectName, customerKey: detail.customerKey, customer: detail.customer, acceptanceAmount: detail.acceptanceAmount };
    if (detail.groupId) for (const key of ['received', 'arrivedAt', 'invoiceNo', 'invoiceDate', 'taxIncluded', 'voucher', 'voucherUrl']) next[key] = detail[key];
    if (next.invoiceNo) { next.legacyConfirmed = false; next.migrationIssue = ''; }
    const error = validateFinanceInvoice(next, invoices); if (error) throw new Error(error);
    return { ...state, invoices: invoices.map(row => row.key === next.key ? next : row), journal: reconcileInvoiceReceipt(journal, detail, next, next.arrivedAt) };
  }, '详情修改已保存') && setInvoiceEditing(false);
  const tabs = ['全部', '待开票', '待回款', '部分回款', '已回款'];
  const matching = invoices.filter(row => !query || [row.recordNo, row.projectName, row.projectNo, row.customer, row.invoiceNo].some(value => String(value || '').includes(query.trim())));
  const invoiceColumns = [
    { title: '记录 / 系统验收编号', dataIndex: 'recordNo', width: 155 },
    { title: '业务项目', width: 210, render: (_, row) => <><Button type="link" onClick={() => openInvoice(row)}>{row.projectName}</Button>{row.groupId && <div><Tag>合票 · {groupInvoice(invoices, row).members.length} 条验收</Tag></div>}</> },
    { title: '项目编号', dataIndex: 'projectNo', width: 170 }, { title: '客户', dataIndex: 'customer', width: 100 }, { title: 'PM', dataIndex: 'pm', width: 90 },
    { title: '本条验收 / 发票金额', dataIndex: 'taxIncluded', width: 160, align: 'right', render: money },
    { title: '发票号码', dataIndex: 'invoiceNo', width: 170, render: (value, row) => value || (row.legacyConfirmed ? '历史资料待核对' : '待开票') },
    { title: '开票状态', width: 100, render: (_, row) => status(row.invoiceNo || row.legacyConfirmed ? '已开票' : '待开票') },
    { title: '回款状态', width: 100, render: (_, row) => status(receiptStatus(row)) },
    { title: '本条已收', dataIndex: 'received', width: 130, align: 'right', render: money },
    { title: '本条未收', width: 130, align: 'right', render: (_, row) => money(invoiceNumber(row.taxIncluded) == null || invoiceNumber(row.received) == null ? null : round(row.taxIncluded - row.received)) },
    { title: '操作', width: 190, fixed: 'right', render: (_, row) => <Space size={0}><Button type="link" onClick={() => openInvoice(row)}>详情</Button><Button type="link" disabled={row.legacyConfirmed && !row.invoiceNo} onClick={() => setEditing({ type: row.invoiceNo ? 'receipt' : 'invoice', row })}>{row.invoiceNo ? '登记回款' : '确认开票'}</Button></Space> },
  ];
  let body;
  if (page === 'finance-costs') body = <FinanceCosts state={state} role={role} commit={commit} />;
  else if (page === 'finance-contracts') body = <FinanceContracts state={state} />;
  else if (page === 'finance-approvals') body = <FinanceApprovals state={state} commit={commit} />;
  else if (page === 'finance-settlement') body = <FinanceSettlement state={state} commit={commit} />;
  else if (page === 'finance-customers') {
    const cols = [{ title: '客户编号', dataIndex: 'code', width: 140 }, { title: '客户名称', dataIndex: 'name', width: 120 }, { title: '客户全名', dataIndex: 'fullName', width: 270 }];
    if (editable) cols.push({ title: '纳税人识别号', dataIndex: 'taxNo', width: 210 }, { title: '项目名称（开票）', dataIndex: 'invoiceItemName', width: 180, render: value => value || '待补充' }, { title: '产品和服务编码', dataIndex: 'taxCode', width: 220, render: value => value || '待补充' }, { title: '账期（天）', dataIndex: 'term', width: 100, render: value => value ?? '未设置' }, { title: '状态', width: 100, render: (_, row) => row.active ? '启用' : '已停用' }, { title: '操作', width: 190, fixed: 'right', render: (_, row) => <Space size={0}><Button type="link" onClick={() => setEditing({ type: 'customer-detail', row })}>详情</Button><Button type="link" onClick={() => setEditing({ type: 'customer', row })}>编辑</Button>{row.active && <Button danger type="link" onClick={() => Modal.confirm({ title: `停用客户“${row.name}”？`, content: '历史开票及回款保留，不能再选用该客户发起新的开票需求。', onOk: () => act(() => ({ ...state, customers: customers.map(item => item.key === row.key ? { ...item, active: false } : item) }), '客户已停用') })}>停用</Button>}</Space> });
    body = <Card variant="borderless" className="trial-work-card"><div className="trial-list-toolbar"><span>{editable ? '客户开票资料' : '客户基础信息 · 只读'}</span>{editable && <Button type="primary" onClick={() => setEditing({ type: 'customer' })}>新增客户</Button>}</div><Table rowKey="key" dataSource={customerProjection(customers, role)} columns={cols} scroll={editable ? { x: 1530 } : undefined} /></Card>;
  } else if (page === 'finance-invoices') body = detail ? <FinanceInvoiceDetail row={detail} customers={customers} editable editing={invoiceEditing} onEdit={() => setInvoiceEditing(true)} onCancel={() => setInvoiceEditing(false)} onBack={() => { setInvoiceKey(''); setInvoiceEditing(false); }} onSave={saveDetails} onIssue={() => setEditing({ type: 'invoice', row: detail })} onReceipt={() => setEditing({ type: 'receipt', row: detail })} /> : <Card variant="borderless" className="trial-work-card"><div className="trial-list-toolbar"><Input.Search aria-label="搜索发票台账" value={query} onChange={event => setQuery(event.target.value)} placeholder="项目、客户、验收编号、发票号码" style={{ maxWidth: 400 }} allowClear /><Button disabled={selected.length < 2} onClick={() => { if (act(() => combineInvoices(state, selected), '已建立同客户合票关联')) setSelected([]); }}>合并所选验收开票</Button></div><Tabs activeKey={tab} onChange={setTab} items={tabs.map(value => ({ key: value, label: `${value} ${matching.filter(row => value === '全部' || invoiceStage(row) === value).length}` }))} /><Table className="finance-invoice-table" rowKey="key" rowSelection={{ selectedRowKeys: selected, onChange: setSelected, getCheckboxProps: row => ({ disabled: Boolean(row.invoiceNo || row.legacyConfirmed || row.groupId) }) }} dataSource={matching.filter(row => tab === '全部' || invoiceStage(row) === tab)} columns={invoiceColumns} scroll={{ x: 1850 }} locale={{ emptyText: <Empty description={`暂无${tab === '全部' ? '' : tab}记录`} /> }} /></Card>;
  else if (page === 'finance-journal') {
    const rows = journal.filter(row => !row.opening && (row.income > 0 || row.expense > 0));
    let balance = state.openingBalance ?? null;
    const withBalance = rows.map(row => { if (balance != null) balance = round(balance + row.income - row.expense); return { ...row, balance }; });
    body = journalKey ? <JournalDetail entry={withBalance.find(row => row.key === journalKey)} invoices={invoices} settlements={[]} approvals={state.approvals} onBack={() => setJournalKey('')} onLink={(entry, target, amount) => act(() => registerJournal(state, { allocations: [{ target: target.key, type: entry.income > 0 ? '开票' : target.type, name: target.name, amount }] }, entry.key), '追加关联已保存')} /> : <Card variant="borderless" className="trial-work-card"><Alert type="info" showIcon title="期初余额与正式记账顺序待确认" description="当前仅展示实际收入、支出及业务关联，不将演示期初值作为真实余额。" /><div className="trial-list-toolbar"><span>{rows.length} 条实际收支</span><Space><Button onClick={() => setEditing({ type: 'journal', direction: '收入' })}>登记收入</Button><Button type="primary" onClick={() => setEditing({ type: 'journal', direction: '支出' })}>登记支出</Button></Space></div><Table rowKey="key" dataSource={withBalance} scroll={{ x: 1300 }} columns={[{ title: '日期', dataIndex: 'date' }, { title: '摘要', dataIndex: 'summary' }, { title: '收付款人', dataIndex: 'payer' }, { title: '收入', dataIndex: 'income', align: 'right', render: money }, { title: '支出', dataIndex: 'expense', align: 'right', render: money }, { title: '余额', dataIndex: 'balance', align: 'right', render: value => value == null ? '期初待确认' : money(value) }, { title: '关联条数', render: (_, row) => row.allocations?.length || 0 }, { title: '未关联金额', align: 'right', render: (_, row) => money(round((row.income || row.expense) - (row.allocations || []).reduce((sum, link) => sum + Number(link.amount), 0))) }, { title: '操作', render: (_, row) => <Button type="link" onClick={() => setJournalKey(row.key)}>详情 / 关联</Button> }]} /></Card>;
  }
  return <><div className="finance-prototype-note"><span>{state.demoDataVersion ? '模拟测试数据已载入 · 仅供本地交互，非真实业务数据' : '本地交互预览 · 现有开票与日记账含历史演示数据'}</span>{editable && <Button size="small" type="link" onClick={() => setAuditOpen(true)}>操作记录</Button>}</div>{body}
    {editing?.type === 'customer' && <CustomerBox row={editing.row} onCancel={() => setEditing(null)} onSave={saveCustomer} />}
    {editing?.type === 'customer-detail' && <Modal open title="客户详情" onCancel={() => setEditing(null)} footer={<Button onClick={() => setEditing(null)}>关闭</Button>}><Descriptions column={1} items={Object.entries({ 客户编号: editing.row.code, 客户名称: editing.row.name, 客户全名: editing.row.fullName, 纳税人识别号: editing.row.taxNo, 对接人: editing.row.contact, '项目名称（开票）': editing.row.invoiceItemName, 产品和服务编码: editing.row.taxCode, 账期: editing.row.term, 入库时间: editing.row.createdAt, 是否停用: editing.row.active ? '否' : '是' }).map(([label, value]) => ({ key: label, label, children: value ?? '未设置' }))} /></Modal>}
    {editing?.type === 'invoice' && <IssueBox group={groupInvoice(invoices, editing.row)} onCancel={() => setEditing(null)} onSave={values => act(() => issueInvoice(state, editing.row, values), '开票已确认，未新增资金收支')} />}
    {editing?.type === 'receipt' && <ReceiptBox group={groupInvoice(invoices, editing.row)} onCancel={() => setEditing(null)} onSave={values => act(() => registerReceipt(state, editing.row, values.received, values.arrivedAt?.format('YYYY-MM-DD'), values.allocations, values.note), '回款与日记账已同步')} />}
    {editable && <JournalBox open={editing?.type === 'journal'} direction={editing?.direction} invoices={invoices} approvals={state.approvals} onCancel={() => setEditing(null)} onSave={values => act(() => registerJournal(state, { ...values, date: values.date.format('YYYY-MM-DD'), income: values.direction === '收入' ? Number(values.amount) : 0, expense: values.direction === '支出' ? Number(values.amount) : 0 }), '实际收支及关联已保存')} />}
    <Modal title="本地操作记录" open={auditOpen} width={900} onCancel={() => setAuditOpen(false)} footer={<Button onClick={() => setAuditOpen(false)}>关闭</Button>}><Table rowKey="key" expandable={{ expandedRowRender: row => <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>{JSON.stringify(row.changes || [], null, 2)}</pre> }} dataSource={editable ? [...state.audit].reverse() : []} columns={[{ title: '时间', dataIndex: 'time', render: value => dayjs(value).format('YYYY-MM-DD HH:mm:ss') }, { title: '操作人', dataIndex: 'actor' }, { title: '操作', dataIndex: 'action' }, { title: '结果', dataIndex: 'result' }, { title: '版本变化', render: (_, row) => `${row.before} → ${row.after}` }]} /></Modal>
  </>;
}
function CustomerBox({ row, onSave, onCancel }) {
  const [form] = Form.useForm();
  return <Modal open title={row ? '编辑客户' : '新增客户'} onCancel={onCancel} onOk={() => form.submit()}><Form form={form} name="finance-customer" layout="vertical" initialValues={row || { term: null }} onFinish={onSave}>
    {[['name', '客户名称'], ['fullName', '客户全名'], ['taxNo', '纳税人识别号'], ['contact', '对接人'], ['invoiceItemName', '项目名称（开票）'], ['taxCode', '产品和服务编码']].map(([name, label], index) => <Form.Item key={name} name={name} label={label} rules={index < 3 ? [{ required: true, whitespace: true }] : []}><Input /></Form.Item>)}
    <Form.Item name="term" label="账期（天，可空）"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item>
  </Form></Modal>;
}
function IssueBox({ group, onCancel, onSave }) {
  const [form] = Form.useForm();
  return <Modal open title={group.members.length > 1 ? '确认合并开票' : '确认开票'} onCancel={onCancel} onOk={() => form.submit()} width={650}><p>{group.projectName} · {group.members.length} 条验收 · 合计 {money(group.taxIncluded)}</p><Form name="finance-confirm-invoice" form={form} layout="vertical" initialValues={{ taxIncluded: group.taxIncluded }} onFinish={values => onSave({ ...values, invoiceDate: values.invoiceDate.format('YYYY-MM-DD'), voucher: values.attachment?.name, voucherUrl: values.attachment?.url })}>
    <Form.Item name="invoiceNo" label="发票号码" rules={[{ required: true, whitespace: true }]}><Input /></Form.Item><Form.Item name="invoiceDate" label="开票日期" rules={[{ required: true }]}><DatePicker /></Form.Item><Form.Item name="taxIncluded" label="整票含税金额" rules={[{ required: true }]}><InputNumber min={0} precision={2} /></Form.Item><Form.Item name="attachment" label="发票文件" rules={[{ required: true }]}><FinanceFile /></Form.Item>
  </Form></Modal>;
}
function ReceiptBox({ group, onCancel, onSave }) {
  const [form] = Form.useForm(); const received = Form.useWatch('received', form);
  return <Modal open title={group.members.length > 1 ? '整票回款与验收分配' : '登记回款'} onCancel={onCancel} onOk={() => form.submit()} width={800} okText="保存回款"><p>整票应收 {money(group.taxIncluded)} · 原累计 {money(group.received)}。仅累计增量产生新收入。</p><Form form={form} name="finance-register-receipt" layout="vertical" initialValues={{ received: group.received, note: group.note, allocations: Object.fromEntries(group.members.map(row => [row.key, row.received || 0])) }} onFinish={values => onSave({ ...values, allocations: group.members.length === 1 ? { [group.members[0].key]: values.received } : values.allocations })}>
    <Form.Item name="received" label="整票累计回款金额" rules={[{ required: true }]}><InputNumber min={0} max={group.taxIncluded} precision={2} /></Form.Item><Form.Item name="arrivedAt" label="实际到账日期" rules={[{ required: Number(received) > 0 }]}><DatePicker /></Form.Item><Form.Item name="note" label="回款备注"><Input /></Form.Item>
    {group.members.length > 1 && <Table rowKey="key" pagination={false} dataSource={group.members} columns={[{ title: '验收编号 / 项目', render: (_, row) => <>{row.recordNo}<br />{row.projectName}</> }, { title: '应收', dataIndex: 'acceptanceAmount', align: 'right', render: money }, { title: '累计分配（手动）', render: (_, row) => <Form.Item name={['allocations', row.key]} rules={[{ required: true }]} style={{ marginBottom: 0 }}><InputNumber aria-label={`${row.recordNo} 累计分配`} min={0} max={row.acceptanceAmount} precision={2} /></Form.Item> }]} />}
  </Form></Modal>;
}
