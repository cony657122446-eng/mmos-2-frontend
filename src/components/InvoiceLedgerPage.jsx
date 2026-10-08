import React from 'react';
import { Button, Card, Empty, Input, Select, Space, Table, Tabs, Tag, message } from 'antd';
import { CheckCircle2, FileText, Search, ShieldCheck } from 'lucide-react';
import dayjs from 'dayjs';

export const INVOICE_KEY = 'mmos.invoice.records.v1';
const snapshotFields = ['项目名称', '开票对接方', '项目编号', '验收编号', '项目经理', '金额', '验收情况', '验收周期', '时间', '交付依据截图'];

const seedInvoices = [
  { key: 'inv-001', acceptanceNo: '260900001104', projectId: 'PRJ-002', projectNo: 'ZJ20260608002', projectName: '搜索相关性标注', customer: '字节', pm: '王然', amount: '248,600 元', acceptanceType: '最终验收', period: '2026-06-08 至 2026-09-08', approvedAt: '2026-09-12 15:10', evidenceName: '最终验收依据.png', invoiceStatus: '已开票', paymentStatus: '已到账', projectStatus: '项目结束', activity: ['2026-09-18 10:22 · 财务将到账状态更新为已到账', '2026-09-13 09:40 · 财务确认已开票', '2026-09-12 15:10 · 系统写入开票记录'] },
  { key: 'inv-002', acceptanceNo: '260900001156', projectId: 'PRJ-004', projectNo: 'ZJ20260626004', projectName: '广告文案改写', customer: '腾讯', pm: '王然', amount: '86,000 元', acceptanceType: '阶段验收', period: '2026-08-01 至 2026-08-31', approvedAt: '2026-09-20 16:48', evidenceName: '阶段验收依据.png', invoiceStatus: '待开票', paymentStatus: '未到账', projectStatus: '项目进行中', activity: ['2026-09-20 16:48 · 系统写入开票记录，等待财务开票'] },
  { key: 'inv-003', acceptanceNo: '260800001086', projectId: 'PRJ-004', projectNo: 'ZJ20260626004', projectName: '广告文案改写', customer: '腾讯', pm: '王然', amount: '42,000 元', acceptanceType: '阶段验收', period: '2026-06-26 至 2026-07-31', approvedAt: '2026-08-02 11:16', evidenceName: '七月验收依据.png', invoiceStatus: '已开票', paymentStatus: '已到账', projectStatus: '项目进行中', activity: ['2026-08-06 14:20 · 财务确认已开票'] },
];

function nowStamp() { return dayjs().format('YYYY-MM-DD HH:mm'); }
export function loadInvoices() { try { const value = localStorage.getItem(INVOICE_KEY); return value ? JSON.parse(value) : seedInvoices; } catch { return seedInvoices; } }
function persistInvoices(next) { localStorage.setItem(INVOICE_KEY, JSON.stringify(next)); window.dispatchEvent(new CustomEvent('mmos:invoice-updated', { detail: next })); }
export function createInvoice(acceptance) {
  const current = loadInvoices();
  if (current.some(item => item.acceptanceNo === acceptance.acceptanceNo)) return current;
  const created = { key: `inv-${Date.now()}`, acceptanceNo: acceptance.acceptanceNo, projectId: acceptance.projectId, projectNo: acceptance.projectNo, projectName: acceptance.projectName, customer: acceptance.customer, pm: acceptance.pm, amount: `${acceptance.amount} 元`, acceptanceType: acceptance.type, period: `${acceptance.start} 至 ${acceptance.end}`, approvedAt: acceptance.approvedAt, evidenceName: acceptance.evidenceName || '验收依据截图', evidence: acceptance.evidence, invoiceStatus: '待开票', paymentStatus: '未到账', projectStatus: acceptance.projectStatus, activity: [`${acceptance.approvedAt} · 系统写入开票记录，等待财务开票`] };
  const next = [created, ...current];
  persistInvoices(next);
  return next;
}
export function projectInvoiceStatus(projectId, invoices = loadInvoices()) { const rows = invoices.filter(item => item.projectId === projectId); if (!rows.length) return '未开票'; return rows.some(item => item.invoiceStatus === '待开票') ? '待开票' : '已开票'; }

export function InvoiceLedgerPage({ role = '财务', onRoleChange }) {
  const [records, setRecords] = React.useState(loadInvoices);
  const [tab, setTab] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [selectedKey, setSelectedKey] = React.useState('');
  React.useEffect(() => { const sync = event => event.detail && setRecords(event.detail); window.addEventListener('mmos:invoice-updated', sync); return () => window.removeEventListener('mmos:invoice-updated', sync); }, []);
  if (role !== '财务') return <div className="placeholder-page"><p className="eyebrow">财务 · 开票台账</p><h1>无权查看开票台账</h1><p>开票记录只对财务开放。PM 和 PMO 请在项目总览查看回写后的开票状态和到账状态。</p><div className="trial-role-switch"><ShieldCheck size={14} /><span>演示身份</span><Select aria-label="演示身份" size="small" value={role} onChange={onRoleChange} options={[{ value: 'PMO', label: 'PMO · 林晓彤' }, { value: 'PM', label: 'PM · 王然' }, { value: '财务', label: '财务 · 赵敏' }]} /></div></div>;
  const visible = records.filter(item => tab === 'all' || item.invoiceStatus === tab).filter(item => !query.trim() || [item.projectNo, item.projectName, item.acceptanceNo, item.customer, item.pm].some(value => String(value).includes(query.trim())));
  const selected = records.find(item => item.key === selectedKey);
  const update = (record, patch, notice) => {
    const next = records.map(item => item.key === record.key ? { ...item, ...patch } : item);
    persistInvoices(next);
    setRecords(next);
    if (notice) message.success(notice);
  };
  const markIssued = record => update(record, { invoiceStatus: '已开票', activity: [`${nowStamp()} · 财务确认已开票，项目业务状态保持${record.projectStatus}`, ...(record.activity || [])] }, '已确认开票，项目业务状态未改变');
  const markPaid = (record, paymentStatus) => update(record, { paymentStatus, activity: [`${nowStamp()} · 财务将到账状态更新为${paymentStatus}`, ...(record.activity || [])] }, '到账状态已回写');
  const countOf = status => records.filter(item => !status || item.invoiceStatus === status).length;
  const columns = [
    { title: '项目编号', dataIndex: 'projectNo', width: 146, render: value => <span className="trial-project-no">{value}</span> },
    { title: '项目名称', dataIndex: 'projectName', width: 180, render: (value, record) => <button className="trial-name-link" onClick={() => setSelectedKey(record.key)}><span className="trial-name-icon"><FileText size={14} /></span><span><strong>{value}</strong><small>{record.customer}</small></span></button> },
    { title: '开票对接方', dataIndex: 'customer', width: 110 },
    { title: '项目经理', dataIndex: 'pm', width: 90 },
    { title: '验收编号', dataIndex: 'acceptanceNo', width: 140 },
    { title: '金额', dataIndex: 'amount', width: 110 },
    { title: '验收情况', dataIndex: 'acceptanceType', width: 100 },
    { title: '验收周期', dataIndex: 'period', width: 190 },
    { title: '审核通过时间', dataIndex: 'approvedAt', width: 150 },
    { title: '开票状态', dataIndex: 'invoiceStatus', width: 100, render: value => <Tag color={value === '已开票' ? 'success' : 'processing'}>{value}</Tag> },
    { title: '到账状态', dataIndex: 'paymentStatus', width: 100 },
    { title: '操作', key: 'action', width: 180, render: (_, record) => <Space size={0}>{record.invoiceStatus === '待开票' && <Button type="link" size="small" onClick={() => markIssued(record)}>确认已开票</Button>}<Button type="link" size="small" onClick={() => setSelectedKey(record.key)}>到账状态</Button></Space> },
  ];
  const snapshot = selected && { 项目名称: selected.projectName, 开票对接方: selected.customer, 项目编号: selected.projectNo, 验收编号: selected.acceptanceNo, 项目经理: selected.pm, 金额: selected.amount, 验收情况: selected.acceptanceType, 验收周期: selected.period, 时间: selected.approvedAt, 交付依据截图: selected.evidenceName };
  if (selected) return <div className="trial-page invoice-page detail-screen"><div className="detail-screen-bar"><div className="detail-screen-main"><button className="detail-back" onClick={() => setSelectedKey('')}>返回列表</button><div className="detail-screen-kicker">开票台账 · {selected.acceptanceNo}</div><h1>{selected.projectName}</h1></div><Tag color={selected.invoiceStatus === '已开票' ? 'success' : 'processing'}>{selected.invoiceStatus}</Tag></div>
    <div className="quote-field-grid">{snapshotFields.map(label => <div key={label}><small>{label}</small><strong>{snapshot[label] || '—'}</strong></div>)}{selected.evidence && <img className="quote-voucher-preview" src={selected.evidence} alt="交付依据截图" />}</div>
    <div className="quote-wait-box">快照生成后不随项目或验收申请的后续修改回写。确认开票不会改变项目业务状态。</div>
    <div className="quote-drawer-actions">{selected.invoiceStatus === '待开票' && <Button type="primary" icon={<CheckCircle2 size={14} />} onClick={() => markIssued(selected)}>确认已开票</Button>}<Button onClick={() => markPaid(selected, selected.paymentStatus === '已到账' ? '未到账' : '已到账')}>{selected.paymentStatus === '已到账' ? '改回未到账' : '标记已到账'}</Button></div>
    <section className="trial-detail-section"><div className="trial-detail-heading"><div><p className="panel-kicker">操作留痕</p><h3>开票动态</h3></div></div><div className="init-activity">{selected.activity.map(item => <div key={item}><span /><p>{item}</p></div>)}</div></section>
  </div>;
  return <div className="trial-page invoice-page">
    <div className="trial-page-heading"><div><p className="eyebrow">财务 · 开票台账</p><h1>开票台账</h1><p className="subtitle">记录由验收审核写入成功后自动生成。财务确认开票和到账状态，不能修改验收快照。</p></div><div className="trial-role-switch"><ShieldCheck size={14} /><span>演示身份</span><Select aria-label="演示身份" size="small" value={role} onChange={onRoleChange} options={[{ value: 'PMO', label: 'PMO · 林晓彤' }, { value: 'PM', label: 'PM · 王然' }, { value: '财务', label: '财务 · 赵敏' }]} /></div></div>
    <div className="trial-stat-grid quote-stat-grid">{['待开票', '已开票'].map(item => <Card key={item} variant="borderless"><div><small>{item}</small><strong>{countOf(item)}</strong></div></Card>)}</div>
    <Card variant="borderless" className="trial-work-card">
      <div className="trial-list-toolbar"><Input prefix={<Search size={15} />} allowClear value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索项目编号、项目名称、验收编号、开票对接方、项目经理" aria-label="搜索开票记录" /><span className="trial-permission-chip"><ShieldCheck size={13} /> 财务可查看全部开票记录</span></div>
      <Tabs activeKey={tab} onChange={setTab} className="trial-tabs" items={[['all', '全部'], ['待开票', '待开票'], ['已开票', '已开票']].map(([key, label]) => ({ key, label: <span>{label} <em>{countOf(key === 'all' ? '' : key)}</em></span> }))} />
      <Table rowKey="key" columns={columns} dataSource={visible} pagination={{ pageSize: 8, showSizeChanger: false }} scroll={{ x: 1560 }} locale={{ emptyText: <Empty description="暂无符合条件的开票记录" /> }} onRow={record => ({ onClick: event => { if (event.target.closest('button, a, .ant-btn')) return; setSelectedKey(record.key); } })} />
    </Card>

  </div>;
}
